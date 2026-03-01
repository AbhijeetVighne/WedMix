import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.js';
import { Play, Pause, Plus, X } from 'lucide-react';
import { AudioFileData } from '../types';
import { formatTime } from '../utils/audio';

interface Props {
  audioFile: AudioFileData;
  onAddSegment: (fileId: string, start: number, end: number) => void;
  onRemoveFile: (fileId: string) => void;
}

function parseTimeStr(value: string): number {
  // Accept "m:ss", "m.ss" (dot as separator), or plain seconds
  const cleaned = value.trim();
  const sepMatch = cleaned.match(/^(\d+)[:.](\d{2,}\.?\d*)$/);
  if (sepMatch) {
    return parseInt(sepMatch[1], 10) * 60 + parseFloat(sepMatch[2]);
  }
  const colonParts = cleaned.split(':');
  if (colonParts.length === 2) {
    return parseInt(colonParts[0], 10) * 60 + parseFloat(colonParts[1]);
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.max(0, num);
}

function toTimeStr(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}:${parseFloat(s) < 10 ? '0' : ''}${s}`;
}

function TimeInput({
  value,
  onCommit,
  className,
}: {
  value: number;
  onCommit: (seconds: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft !== null ? draft : toTimeStr(value);

  return (
    <input
      type="text"
      value={display}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        setDraft(toTimeStr(value));
        requestAnimationFrame(() => e.target.select());
      }}
      onBlur={() => {
        if (draft !== null) {
          onCommit(parseTimeStr(draft));
          setDraft(null);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      inputMode="text"
      className={className}
    />
  );
}

export default function TrackCard({
  audioFile,
  onAddSegment,
  onRemoveFile,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionRef = useRef<Region | null>(null);
  const selectionEndRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [regionStart, setRegionStart] = useState(0);
  const [regionEnd, setRegionEnd] = useState(audioFile.duration);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: audioFile.color + '40',
      progressColor: audioFile.color,
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      cursorColor: audioFile.color,
      cursorWidth: 1,
      normalize: true,
    });

    const regionsPlugin = ws.registerPlugin(RegionsPlugin.create());

    ws.loadBlob(audioFile.file);

    ws.on('ready', () => {
      const dur = ws.getDuration();
      const region = regionsPlugin.addRegion({
        start: 0,
        end: dur,
        color: audioFile.color + '18',
        drag: false,
        resize: true,
      });

      region.on('click', (e: MouseEvent) => {
        e.stopPropagation();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const ratio = (e.clientX - rect.left) / rect.width;
        ws.seekTo(Math.max(0, Math.min(1, ratio)));
      });

      region.on('update', () => {
        setRegionStart(region.start);
        setRegionEnd(region.end);
      });
      region.on('update-end', () => {
        setRegionStart(region.start);
        setRegionEnd(region.end);
      });

      regionRef.current = region;
      setRegionStart(0);
      setRegionEnd(dur);
      setIsReady(true);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });
    ws.on('timeupdate', (time: number) => setCurrentTime(time));

    wsRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [audioFile]);

  useEffect(() => {
    if (isPlaying && selectionEndRef.current !== null && currentTime >= selectionEndRef.current) {
      wsRef.current?.pause();
      selectionEndRef.current = null;
    }
  }, [isPlaying, currentTime]);

  const togglePlay = useCallback(() => {
    if (!wsRef.current || !isReady) return;
    selectionEndRef.current = null;
    if (isPlaying) {
      wsRef.current.pause();
    } else {
      wsRef.current.play();
    }
  }, [isPlaying, isReady]);

  const playRegion = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    selectionEndRef.current = regionEnd;
    ws.setTime(regionStart);
    ws.play();
  }, [regionStart, regionEnd]);

  const handleAdd = useCallback(() => {
    onAddSegment(audioFile.id, regionStart, regionEnd);
  }, [audioFile.id, regionStart, regionEnd, onAddSegment]);

  const updateRegionFromInputs = useCallback(
    (newStart: number, newEnd: number) => {
      const region = regionRef.current;
      if (!region) return;
      const cStart = Math.max(0, Math.min(newStart, audioFile.duration));
      const cEnd = Math.max(cStart + 0.1, Math.min(newEnd, audioFile.duration));
      region.setOptions({ start: cStart, end: cEnd });
      setRegionStart(cStart);
      setRegionEnd(cEnd);
    },
    [audioFile.duration],
  );

  const cleanName = audioFile.name.replace(/\.[^.]+$/, '');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-stone-50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: audioFile.color }}
          />
          <span className="text-sm font-medium text-stone-700 truncate">
            {cleanName}
          </span>
          <span className="text-xs text-stone-400 flex-shrink-0">
            {formatTime(audioFile.duration)}
          </span>
        </div>
        <button
          onClick={() => onRemoveFile(audioFile.id)}
          className="p-2 -mr-1 rounded-lg text-stone-300 hover:text-red-400 active:text-red-500 hover:bg-red-50 transition-colors"
          title="Remove song"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Waveform */}
      <div className="px-3 sm:px-4 pt-3 pb-2">
        <div ref={containerRef} className="track-waveform rounded-lg overflow-hidden" />

        {/* Live playback time */}
        {isReady && isPlaying && (
          <div className="mt-1.5 px-0.5">
            <span
              className="font-mono text-sm font-semibold tabular-nums"
              style={{ color: audioFile.color }}
            >
              {formatTime(currentTime)}
              <span className="text-stone-300 font-normal text-xs mx-1">/</span>
              <span className="text-stone-400 text-xs font-normal">
                {formatTime(audioFile.duration)}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Selection inputs + buttons */}
      {isReady && (
        <div className="px-3 sm:px-4 pb-3 space-y-2.5">
          {/* Time inputs for precise selection */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-stone-400 flex-shrink-0">Selection</label>
            <div className="flex items-center gap-1.5">
              <TimeInput
                value={regionStart}
                onCommit={(v) => updateRegionFromInputs(Math.min(v, regionEnd - 0.1), regionEnd)}
                className="w-[4.5rem] text-center text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
              />
              <span className="text-stone-300 text-xs">to</span>
              <TimeInput
                value={regionEnd}
                onCommit={(v) => updateRegionFromInputs(regionStart, Math.max(v, regionStart + 0.1))}
                className="w-[4.5rem] text-center text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
              />
            </div>
            <span className="text-[11px] text-stone-300 tabular-nums">
              ({formatTime(regionEnd - regionStart)})
            </span>
          </div>

          {/* Action buttons — large touch targets */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={togglePlay}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 active:bg-stone-300 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isPlaying ? 'Pause' : 'Play All'}
            </button>

            <button
              onClick={playRegion}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 active:bg-stone-300 transition-colors"
            >
              <Play className="w-4 h-4" />
              Play Selection
            </button>

            <div className="flex-1 min-w-0" />

            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors shadow-sm active:opacity-80"
              style={{ backgroundColor: audioFile.color }}
            >
              <Plus className="w-4 h-4" />
              Add to Mix
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
