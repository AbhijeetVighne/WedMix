import { AudioFileData, SegmentData, TransitionData } from '../types';
import { Mp3Encoder } from '../lib/lamejs-bundle.js';

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();
  return audioBuffer;
}

function extractChannels(
  buffer: AudioBuffer,
  startTime: number,
  endTime: number,
): Float32Array[] {
  const sr = buffer.sampleRate;
  const s0 = Math.max(0, Math.floor(startTime * sr));
  const s1 = Math.min(buffer.length, Math.floor(endTime * sr));
  const len = s1 - s0;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) out[i] = src[s0 + i];
    channels.push(out);
  }
  return channels;
}

function rms(channels: Float32Array[]): number {
  let sum = 0;
  let count = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      sum += ch[i] * ch[i];
    }
    count += ch.length;
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

function applyGain(channels: Float32Array[], gain: number): Float32Array[] {
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      out[i] = Math.max(-1, Math.min(1, ch[i] * gain));
    }
    return out;
  });
}

interface MixSegment {
  channels: Float32Array[];
  numChannels: number;
  sampleRate: number;
}

/**
 * Renders all segments into a single AudioBuffer, applying crossfade
 * and optional volume normalization.
 *
 * When volumeRefFileId is provided, all segments are normalized to
 * match the RMS loudness of that reference file.
 * Crossfade uses equal-power (sin/cos) curves for smooth transitions.
 */
export async function renderMix(
  audioFiles: AudioFileData[],
  segments: SegmentData[],
  transitions: TransitionData[],
  volumeRefFileId: string | null,
): Promise<AudioBuffer> {
  if (segments.length === 0) throw new Error('No segments to mix');

  const fileMap = new Map(audioFiles.map((f) => [f.id, f]));

  const parts: MixSegment[] = segments.map((seg) => {
    const af = fileMap.get(seg.fileId)!;
    return {
      channels: extractChannels(af.audioBuffer, seg.startTime, seg.endTime),
      numChannels: af.audioBuffer.numberOfChannels,
      sampleRate: af.audioBuffer.sampleRate,
    };
  });

  if (volumeRefFileId) {
    const refFile = fileMap.get(volumeRefFileId);
    if (refFile) {
      const refChannels = extractChannels(
        refFile.audioBuffer,
        0,
        refFile.audioBuffer.duration,
      );
      const targetRMS = Math.max(rms(refChannels), 0.005);
      for (let i = 0; i < parts.length; i++) {
        const cur = rms(parts[i].channels);
        if (cur > 0) {
          parts[i].channels = applyGain(parts[i].channels, targetRMS / cur);
        }
      }
    }
  }

  const sr = parts[0].sampleRate;
  const maxCh = Math.max(...parts.map((p) => p.numChannels));

  // Compute crossfade overlap (in samples) for each transition
  const overlapSamples: number[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    if (transitions[i]?.crossfade) {
      const desired = Math.floor(transitions[i].duration * sr);
      const maxOverlap = Math.min(
        parts[i].channels[0].length,
        parts[i + 1].channels[0].length,
      );
      overlapSamples.push(Math.min(desired, maxOverlap));
    } else {
      overlapSamples.push(0);
    }
  }

  let totalLen = 0;
  for (let i = 0; i < parts.length; i++) {
    totalLen += parts[i].channels[0].length;
    if (i < overlapSamples.length) totalLen -= overlapSamples[i];
  }

  const outBuf = new AudioBuffer({
    numberOfChannels: maxCh,
    length: Math.max(totalLen, 1),
    sampleRate: sr,
  });

  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    const segLen = seg.channels[0].length;

    const fadeInSamples = i > 0 ? overlapSamples[i - 1] : 0;
    const fadeOutSamples = i < overlapSamples.length ? overlapSamples[i] : 0;

    for (let ch = 0; ch < maxCh; ch++) {
      const src = ch < seg.numChannels ? seg.channels[ch] : seg.channels[0];
      const dst = outBuf.getChannelData(ch);

      for (let s = 0; s < segLen; s++) {
        let sample = src[s];

        // Equal-power fade-in at the start
        if (fadeInSamples > 0 && s < fadeInSamples) {
          sample *= Math.sin((s / fadeInSamples) * (Math.PI / 2));
        }

        // Equal-power fade-out at the end
        if (fadeOutSamples > 0 && s >= segLen - fadeOutSamples) {
          const idx = s - (segLen - fadeOutSamples);
          sample *= Math.cos((idx / fadeOutSamples) * (Math.PI / 2));
        }

        const outIdx = pos + s;
        if (outIdx >= 0 && outIdx < outBuf.length) {
          dst[outIdx] += sample;
        }
      }
    }

    pos += segLen;
    if (i < overlapSamples.length) pos -= overlapSamples[i];
  }

  return outBuf;
}

export function encodeWAV(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const bps = 16;
  const bytesPerSample = bps / 8;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const total = 44 + dataSize;

  const ab = new ArrayBuffer(total);
  const v = new DataView(ab);

  const w = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  w(0, 'RIFF');
  v.setUint32(4, total - 8, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bps, true);
  w(36, 'data');
  v.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += bytesPerSample;
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}

function floatToInt16(float: Float32Array): Int16Array {
  const out = new Int16Array(float.length);
  for (let i = 0; i < float.length; i++) {
    const s = Math.max(-1, Math.min(1, float[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function encodeMP3(buffer: AudioBuffer, kbps = 192): Promise<Blob> {
  const numCh = Math.min(buffer.numberOfChannels, 2);
  const sr = buffer.sampleRate;
  const encoder = new Mp3Encoder(numCh, sr, kbps);
  const blockSize = 1152;

  const left = floatToInt16(buffer.getChannelData(0));
  const right = numCh > 1 ? floatToInt16(buffer.getChannelData(1)) : left;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const rightChunk = right.subarray(i, i + blockSize);
    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      const copy = new Uint8Array(mp3buf.length);
      copy.set(mp3buf);
      chunks.push(copy);
      totalBytes += copy.length;
    }

    // Yield to the event loop every ~50 blocks to keep UI responsive
    if ((i / blockSize) % 50 === 0 && i > 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const flush = encoder.flush();
  if (flush.length > 0) {
    const copy = new Uint8Array(flush.length);
    copy.set(flush);
    chunks.push(copy);
    totalBytes += copy.length;
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return new Blob([result.buffer as ArrayBuffer], { type: 'audio/mp3' });
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}
