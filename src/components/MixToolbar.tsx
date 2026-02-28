import { Download, Volume2 } from 'lucide-react';
import { AudioFileData } from '../types';

interface Props {
  segmentCount: number;
  audioFiles: AudioFileData[];
  volumeRefFileId: string | null;
  onChangeVolumeRef: (fileId: string | null) => void;
  onPreview: () => void;
  isRendering: boolean;
  onExport: (format: 'mp3' | 'wav') => void;
  isExporting: boolean;
}

export default function MixToolbar({
  segmentCount,
  audioFiles,
  volumeRefFileId,
  onChangeVolumeRef,
  onPreview,
  isRendering,
  onExport,
  isExporting,
}: Props) {
  const disabled = segmentCount === 0;

  return (
    <div className="space-y-4">
      {/* Volume reference row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Volume2 className="w-4 h-4 text-stone-400" />
          <label className="text-sm font-medium text-stone-600">
            Match volume to:
          </label>
        </div>
        <select
          value={volumeRefFileId ?? ''}
          onChange={(e) =>
            onChangeVolumeRef(e.target.value === '' ? null : e.target.value)
          }
          disabled={disabled}
          className="w-full sm:flex-1 sm:max-w-xs text-sm rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value="">Off — keep original volumes</option>
          {audioFiles.map((af) => (
            <option key={af.id} value={af.id}>
              {af.name.replace(/\.[^.]+$/, '')}
            </option>
          ))}
        </select>
      </div>

      {/* Action buttons row */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="hidden sm:block sm:flex-1" />

        <button
          onClick={onPreview}
          disabled={disabled || isRendering}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 rounded-xl text-sm font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 active:bg-stone-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRendering ? (
            <>
              <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
              Rendering...
            </>
          ) : (
            'Preview Mix'
          )}
        </button>

        {/* MP3 export — recommended for sharing */}
        <button
          onClick={() => onExport('mp3')}
          disabled={disabled || isExporting}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-rose-500 to-amber-500 text-white hover:from-rose-600 hover:to-amber-600 active:from-rose-700 active:to-amber-700 transition-all shadow-md shadow-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export MP3
            </>
          )}
        </button>

        {/* WAV export — smaller button */}
        <button
          onClick={() => onExport('wav')}
          disabled={disabled || isExporting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl text-xs font-medium bg-stone-100 text-stone-500 hover:bg-stone-200 active:bg-stone-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          WAV
        </button>
      </div>
    </div>
  );
}
