import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Blend,
  ArrowRightLeft,
  Headphones,
} from 'lucide-react';
import { SegmentData, TransitionData } from '../types';
import { formatTime } from '../utils/audio';

interface Props {
  segments: SegmentData[];
  transitions: TransitionData[];
  onMoveSegment: (index: number, direction: 'up' | 'down') => void;
  onRemoveSegment: (index: number) => void;
  onToggleCrossfade: (transitionIndex: number) => void;
  onChangeCrossfadeDuration: (transitionIndex: number, dur: number) => void;
  onPreviewTransition: (transitionIndex: number) => void;
  onStopPreviewTransition: () => void;
  previewingTransition: number | null;
}

export default function MixArrangement({
  segments,
  transitions,
  onMoveSegment,
  onRemoveSegment,
  onToggleCrossfade,
  onChangeCrossfadeDuration,
  onPreviewTransition,
  onStopPreviewTransition,
  previewingTransition,
}: Props) {
  if (segments.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-stone-200 p-8 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mb-3">
          <Blend className="w-6 h-6 text-stone-300" />
        </div>
        <p className="text-sm text-stone-400 mb-1">Your mix is empty</p>
        <p className="text-xs text-stone-300">
          Select parts from your songs above and add them to the mix
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {segments.map((seg, i) => (
        <div key={seg.id}>
          {/* Segment row */}
          <div className="flex items-start sm:items-center gap-2 sm:gap-3 p-3 bg-white rounded-xl border border-stone-100 shadow-sm">
            {/* Position number */}
            <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs font-semibold text-stone-400 flex-shrink-0 mt-0.5 sm:mt-0">
              {i + 1}
            </span>

            {/* Color bar */}
            <div
              className="w-1 h-10 rounded-full flex-shrink-0 mt-0.5 sm:mt-0"
              style={{ backgroundColor: seg.color }}
            />

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-stone-700 truncate">
                {seg.fileName.replace(/\.[^.]+$/, '')}
              </p>
              <p className="text-xs text-stone-400">
                {formatTime(seg.startTime)} — {formatTime(seg.endTime)}
                <span className="ml-1.5 text-stone-300">
                  ({formatTime(seg.duration)})
                </span>
              </p>
            </div>

            {/* Actions — always visible for mobile */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => onMoveSegment(i, 'up')}
                disabled={i === 0}
                className="p-2 rounded-lg text-stone-400 hover:text-stone-600 active:bg-stone-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                title="Move up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMoveSegment(i, 'down')}
                disabled={i === segments.length - 1}
                className="p-2 rounded-lg text-stone-400 hover:text-stone-600 active:bg-stone-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                title="Move down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => onRemoveSegment(i)}
                className="p-2 rounded-lg text-stone-400 hover:text-red-500 active:bg-red-50 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Transition control between this and next segment */}
          {i < segments.length - 1 && transitions[i] && (
            <div className="flex items-center gap-2 sm:gap-3 py-2 px-4 sm:px-6">
              <div className="flex-1 border-t border-dashed border-stone-200" />

              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  onClick={() => onToggleCrossfade(i)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${
                      transitions[i].crossfade
                        ? 'bg-rose-100 text-rose-600'
                        : 'bg-stone-100 text-stone-400'
                    }
                  `}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  {transitions[i].crossfade ? 'Crossfade' : 'No Crossfade'}
                </button>

                {transitions[i].crossfade && (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0.5}
                        max={10}
                        step={0.5}
                        value={transitions[i].duration}
                        onChange={(e) =>
                          onChangeCrossfadeDuration(i, Number(e.target.value))
                        }
                        className="w-24 sm:w-20"
                      />
                      <span className="text-xs font-mono text-stone-400 w-8">
                        {transitions[i].duration}s
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        previewingTransition === i
                          ? onStopPreviewTransition()
                          : onPreviewTransition(i)
                      }
                      className={`
                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                        ${
                          previewingTransition === i
                            ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                            : 'bg-stone-100 text-stone-500 hover:bg-stone-200 active:bg-stone-300'
                        }
                      `}
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      {previewingTransition === i ? 'Stop' : 'Test'}
                    </button>
                  </>
                )}
              </div>

              <div className="flex-1 border-t border-dashed border-stone-200" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
