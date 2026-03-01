import { useState, useCallback, useRef } from 'react';
import {
  AudioFileData,
  SegmentData,
  TransitionData,
  TRACK_COLORS,
} from './types';
import { decodeAudioFile, renderMix, encodeWAV, encodeMP3 } from './utils/audio';
import Header from './components/Header';
import FileUploader from './components/FileUploader';
import YouTubeImporter from './components/YouTubeImporter';
import TrackCard from './components/TrackCard';
import MixArrangement from './components/MixArrangement';
import MixToolbar from './components/MixToolbar';
import PreviewPlayer from './components/PreviewPlayer';

export default function App() {
  const [audioFiles, setAudioFiles] = useState<AudioFileData[]>([]);
  const [segments, setSegments] = useState<SegmentData[]>([]);
  const [transitions, setTransitions] = useState<TransitionData[]>([]);
  const [volumeRefFileId, setVolumeRefFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [previewBuffer, setPreviewBuffer] = useState<AudioBuffer | null>(null);
  const [previewingTransition, setPreviewingTransition] = useState<number | null>(null);

  const colorIndexRef = useRef(0);

  // ── File handling ──────────────────────────────────────────────

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setIsLoading(true);
    try {
      const newFiles: AudioFileData[] = [];
      for (const file of files) {
        const audioBuffer = await decodeAudioFile(file);
        const color = TRACK_COLORS[colorIndexRef.current % TRACK_COLORS.length];
        colorIndexRef.current++;
        newFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          file,
          audioBuffer,
          duration: audioBuffer.duration,
          color,
        });
      }
      setAudioFiles((prev) => [...prev, ...newFiles]);
    } catch (err) {
      console.error('Failed to decode audio:', err);
      alert('Could not decode one or more audio files. Please try a different format.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRemoveFile = useCallback((fileId: string) => {
    setAudioFiles((prev) => prev.filter((f) => f.id !== fileId));
    setSegments((prev) => {
      const remaining = prev.filter((s) => s.fileId !== fileId);
      setTransitions(
        remaining.length > 1
          ? remaining.slice(0, -1).map(() => ({ crossfade: true, duration: 3 }))
          : [],
      );
      return remaining;
    });
    setVolumeRefFileId((prev) => (prev === fileId ? null : prev));
  }, []);

  const handleYouTubeAudioImported = useCallback(
    (audioBuffer: AudioBuffer, fileName: string) => {
      const color = TRACK_COLORS[colorIndexRef.current % TRACK_COLORS.length];
      colorIndexRef.current++;
      const blob = new Blob([], { type: 'audio/mpeg' });
      const file = new File([blob], fileName, { type: 'audio/mpeg' });
      setAudioFiles((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: fileName,
          file,
          audioBuffer,
          duration: audioBuffer.duration,
          color,
        },
      ]);
    },
    [],
  );

  // ── Segment handling ───────────────────────────────────────────

  const handleAddSegment = useCallback(
    (fileId: string, startTime: number, endTime: number) => {
      const file = audioFiles.find((f) => f.id === fileId);
      if (!file) return;

      const seg: SegmentData = {
        id: crypto.randomUUID(),
        fileId,
        fileName: file.name,
        startTime,
        endTime,
        duration: endTime - startTime,
        color: file.color,
      };

      setSegments((prev) => {
        const next = [...prev, seg];
        if (next.length >= 2) {
          setTransitions((t) => [...t, { crossfade: true, duration: 3 }]);
        }
        return next;
      });
    },
    [audioFiles],
  );

  const handleMoveSegment = useCallback(
    (index: number, direction: 'up' | 'down') => {
      setSegments((prev) => {
        const next = [...prev];
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= next.length) return prev;
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    },
    [],
  );

  const handleRemoveSegment = useCallback((index: number) => {
    setSegments((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      setTransitions((t) => {
        if (t.length === 0) return t;
        const newT = [...t];
        newT.splice(Math.min(index, newT.length - 1), 1);
        return newT;
      });
      return next;
    });
  }, []);

  // ── Transition handling ────────────────────────────────────────

  const handleToggleCrossfade = useCallback((i: number) => {
    setTransitions((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], crossfade: !next[i].crossfade };
      return next;
    });
  }, []);

  const handleChangeCrossfadeDuration = useCallback(
    (i: number, dur: number) => {
      setTransitions((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], duration: dur };
        return next;
      });
    },
    [],
  );

  // ── Preview ────────────────────────────────────────────────────

  const handlePreview = useCallback(async () => {
    setPreviewBuffer(null);
    setPreviewingTransition(null);
    setIsRendering(true);
    try {
      const buffer = await renderMix(
        audioFiles,
        segments,
        transitions,
        volumeRefFileId,
      );
      setPreviewBuffer(buffer);
    } catch (err) {
      console.error('Preview failed:', err);
    } finally {
      setIsRendering(false);
    }
  }, [audioFiles, segments, transitions, volumeRefFileId]);

  const handleClosePreview = useCallback(() => {
    setPreviewBuffer(null);
    setPreviewingTransition(null);
  }, []);

  const handlePreviewTransition = useCallback(
    async (transitionIndex: number) => {
      setPreviewBuffer(null);
      setPreviewingTransition(transitionIndex);
      setIsRendering(true);
      try {
        const seg1 = segments[transitionIndex];
        const seg2 = segments[transitionIndex + 1];
        const trans = transitions[transitionIndex];
        const cfDur = trans.duration;

        // Trim segments to only include a few seconds around the crossfade
        // so the user hears the transition immediately, not after a long wait
        const CONTEXT = 5;
        const trimmedSeg1: SegmentData = {
          ...seg1,
          startTime: Math.max(seg1.startTime, seg1.endTime - cfDur - CONTEXT),
          duration: 0,
        };
        trimmedSeg1.duration = trimmedSeg1.endTime - trimmedSeg1.startTime;

        const trimmedSeg2: SegmentData = {
          ...seg2,
          endTime: Math.min(seg2.endTime, seg2.startTime + cfDur + CONTEXT),
          duration: 0,
        };
        trimmedSeg2.duration = trimmedSeg2.endTime - trimmedSeg2.startTime;

        const pairSegments = [trimmedSeg1, trimmedSeg2];
        const pairTransitions = [trans];
        const buffer = await renderMix(
          audioFiles,
          pairSegments,
          pairTransitions,
          volumeRefFileId,
        );
        setPreviewBuffer(buffer);
      } catch (err) {
        console.error('Transition preview failed:', err);
        setPreviewingTransition(null);
      } finally {
        setIsRendering(false);
      }
    },
    [audioFiles, segments, transitions, volumeRefFileId],
  );

  // ── Export ─────────────────────────────────────────────────────

  const handleExport = useCallback(
    async (format: 'mp3' | 'wav') => {
      setIsExporting(true);
      try {
        const buffer = await renderMix(
          audioFiles,
          segments,
          transitions,
          volumeRefFileId,
        );
        const blob =
          format === 'mp3' ? await encodeMP3(buffer) : encodeWAV(buffer);
        const ext = format === 'mp3' ? 'mp3' : 'wav';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wedding-mix.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export failed:', err);
        alert('Export failed. Please try again.');
      } finally {
        setIsExporting(false);
      }
    },
    [audioFiles, segments, transitions, volumeRefFileId],
  );

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-4 py-5 sm:py-8 space-y-6 sm:space-y-8">
        {/* Step 1: Upload */}
        <section>
          <SectionHeading number={1} title="Upload Your Songs" />
          <div className="space-y-4">
            <FileUploader
              onFilesSelected={handleFilesSelected}
              isLoading={isLoading}
            />

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs font-medium text-stone-400">or</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <YouTubeImporter onAudioImported={handleYouTubeAudioImported} />
            </div>
          </div>
        </section>

        {/* Step 2: Song Library */}
        {audioFiles.length > 0 && (
          <section>
            <SectionHeading
              number={2}
              title="Select Parts"
              subtitle="Drag the edge handles on the waveform or type exact times to pick the part you want"
            />
            <div className="space-y-3">
              {audioFiles.map((af) => (
                <TrackCard
                  key={af.id}
                  audioFile={af}
                  onAddSegment={handleAddSegment}
                  onRemoveFile={handleRemoveFile}
                />
              ))}
            </div>
          </section>
        )}

        {/* Step 3: Arrange Mix */}
        {audioFiles.length > 0 && (
          <section>
            <SectionHeading
              number={3}
              title="Arrange Your Mix"
              subtitle="Reorder segments and configure crossfade transitions between them"
            />
            <MixArrangement
              segments={segments}
              transitions={transitions}
              onMoveSegment={handleMoveSegment}
              onRemoveSegment={handleRemoveSegment}
              onToggleCrossfade={handleToggleCrossfade}
              onChangeCrossfadeDuration={handleChangeCrossfadeDuration}
              onPreviewTransition={handlePreviewTransition}
              onStopPreviewTransition={handleClosePreview}
              previewingTransition={previewingTransition}
            />

            {/* Inline preview player for transition testing */}
            {previewBuffer && previewingTransition !== null && (
              <div className="mt-3">
                <p className="text-xs text-stone-400 mb-2">
                  Testing {transitions[previewingTransition]?.duration}s crossfade between segments {previewingTransition + 1} &amp; {previewingTransition + 2}
                  <span className="text-stone-300 ml-1">(5s context + crossfade + 5s context)</span>
                </p>
                <PreviewPlayer
                  buffer={previewBuffer}
                  onClose={handleClosePreview}
                />
              </div>
            )}
          </section>
        )}

        {/* Step 4: Controls */}
        {audioFiles.length > 0 && (
          <section className="pb-8">
            <SectionHeading
              number={4}
              title="Preview & Export"
              subtitle="Pick a reference song to match volume levels, then preview or export your mix"
            />
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 space-y-4">
              <MixToolbar
                segmentCount={segments.length}
                audioFiles={audioFiles}
                volumeRefFileId={volumeRefFileId}
                onChangeVolumeRef={setVolumeRefFileId}
                onPreview={handlePreview}
                isRendering={isRendering}
                onExport={handleExport}
                isExporting={isExporting}
              />

              {/* Seekable preview player (full mix only, not transition tests) */}
              {previewBuffer && previewingTransition === null && (
                <PreviewPlayer
                  buffer={previewBuffer}
                  onClose={handleClosePreview}
                />
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-stone-100 py-4 text-center text-xs text-stone-300">
        WedMix — Made with love for your special day
      </footer>
    </div>
  );
}

function SectionHeading({
  number,
  title,
  subtitle,
}: {
  number: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-xs font-bold text-white">
          {number}
        </span>
        <h2 className="font-display text-lg font-semibold text-stone-800">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="text-xs text-stone-400 ml-8.5 pl-0.5">{subtitle}</p>
      )}
    </div>
  );
}
