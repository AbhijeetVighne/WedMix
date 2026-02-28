import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { formatTime } from '../utils/audio';

interface Props {
  buffer: AudioBuffer;
  onClose: () => void;
}

export default function PreviewPlayer({ buffer, onClose }: Props) {
  const duration = buffer.duration;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const offsetRef = useRef(0);
  const isPlayingRef = useRef(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const setPlayingState = useCallback((playing: boolean) => {
    isPlayingRef.current = playing;
    setIsPlaying(playing);
  }, []);

  const stopSource = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch (_) { /* already stopped */ }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  }, []);

  const playFrom = useCallback(
    (fromOffset: number) => {
      stopSource();

      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioContext();
      }
      const ctx = ctxRef.current;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      offsetRef.current = fromOffset;
      startedAtRef.current = ctx.currentTime;

      source.start(0, fromOffset);
      source.onended = () => {
        setPlayingState(false);
        setCurrentTime(duration);
      };

      sourceRef.current = source;
      setPlayingState(true);
    },
    [buffer, duration, stopSource, setPlayingState],
  );

  const pause = useCallback(() => {
    if (ctxRef.current) {
      const elapsed = ctxRef.current.currentTime - startedAtRef.current;
      offsetRef.current = Math.min(offsetRef.current + elapsed, duration);
    }
    stopSource();
    setCurrentTime(offsetRef.current);
    setPlayingState(false);
  }, [duration, stopSource, setPlayingState]);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      const offset = currentTime >= duration ? 0 : offsetRef.current;
      playFrom(offset);
    }
  }, [currentTime, duration, pause, playFrom]);

  const seek = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(time, duration));
      offsetRef.current = clamped;
      setCurrentTime(clamped);
      if (isPlayingRef.current) {
        playFrom(clamped);
      }
    },
    [duration, playFrom],
  );

  const handleStop = useCallback(() => {
    stopSource();
    if (ctxRef.current) {
      ctxRef.current.close();
      ctxRef.current = null;
    }
    setPlayingState(false);
    setCurrentTime(0);
    offsetRef.current = 0;
    onClose();
  }, [stopSource, setPlayingState, onClose]);

  // Animation loop for live time updates
  useEffect(() => {
    let raf: number;
    const update = () => {
      if (ctxRef.current && isPlayingRef.current) {
        const elapsed = ctxRef.current.currentTime - startedAtRef.current;
        const time = offsetRef.current + elapsed;
        if (time >= duration) {
          setCurrentTime(duration);
          setPlayingState(false);
          return;
        }
        setCurrentTime(time);
      }
      if (isPlayingRef.current) {
        raf = requestAnimationFrame(update);
      }
    };
    if (isPlaying) {
      raf = requestAnimationFrame(update);
    }
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, duration, setPlayingState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSource();
      if (ctxRef.current) {
        ctxRef.current.close();
        ctxRef.current = null;
      }
    };
  }, [stopSource]);

  const getSeekTimeFromEvent = useCallback(
    (clientX: number) => {
      const bar = progressBarRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  const handleBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      seek(getSeekTimeFromEvent(e.clientX));
    },
    [seek, getSeekTimeFromEvent],
  );

  const handleTouchSeek = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length > 0) {
        seek(getSeekTimeFromEvent(e.touches[0].clientX));
      }
    },
    [seek, getSeekTimeFromEvent],
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-stone-800 rounded-xl p-3 sm:p-4 space-y-2">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 hover:bg-stone-100 active:bg-stone-200 transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-stone-800" />
          ) : (
            <Play className="w-4 h-4 text-stone-800 ml-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Seekable progress bar — tall enough for finger taps */}
          <div
            ref={progressBarRef}
            onClick={handleBarClick}
            onTouchStart={handleTouchSeek}
            onTouchMove={handleTouchSeek}
            className="relative h-3 sm:h-2 bg-stone-600 rounded-full cursor-pointer touch-none"
          >
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 to-amber-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
            {/* Seek thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-5 h-5 sm:w-3.5 sm:h-3.5 bg-white rounded-full shadow-md border-2 border-rose-400"
              style={{ left: `calc(${progress}% - 10px)` }}
            />
          </div>
        </div>

        {/* Time display */}
        <div className="flex-shrink-0 text-xs font-mono text-stone-300 tabular-nums text-right">
          <span className="hidden sm:inline">
            {formatTime(currentTime)}
            <span className="text-stone-500 mx-1">/</span>
            {formatTime(duration)}
          </span>
          <span className="sm:hidden">{formatTime(currentTime)}</span>
        </div>

        <button
          onClick={handleStop}
          className="p-2 rounded-lg text-stone-400 hover:text-white active:bg-stone-700 transition-colors"
          title="Close preview"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile time on separate row */}
      <div className="flex justify-between text-[10px] text-stone-500 font-mono tabular-nums sm:hidden px-12">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
