import { useCallback, useState } from 'react';
import { Upload, FileAudio } from 'lucide-react';

interface Props {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
}

const ACCEPT = '.mp3,.wav,.ogg,.aac,.flac,.m4a,.webm';

export default function FileUploader({ onFilesSelected, isLoading }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('audio/'),
      );
      if (files.length > 0) onFilesSelected(files);
    },
    [onFilesSelected],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) onFilesSelected(files);
      e.target.value = '';
    },
    [onFilesSelected],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
        ${
          isDragging
            ? 'border-rose-400 bg-rose-50 scale-[1.01]'
            : 'border-stone-200 bg-white hover:border-rose-300 hover:bg-rose-50/30'
        }
      `}
    >
      <label className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 sm:px-6 cursor-pointer">
        <input
          type="file"
          multiple
          accept={ACCEPT}
          onChange={handleFileInput}
          className="hidden"
          disabled={isLoading}
        />
        <div
          className={`
          w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 transition-all
          ${isDragging ? 'bg-rose-100' : 'bg-stone-100'}
        `}
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
          ) : isDragging ? (
            <FileAudio className="w-6 h-6 sm:w-7 sm:h-7 text-rose-500" />
          ) : (
            <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-stone-400" />
          )}
        </div>
        <p className="text-sm font-medium text-stone-600 mb-1 text-center">
          {isLoading
            ? 'Decoding audio files...'
            : 'Tap to browse or drop songs here'}
        </p>
        <p className="text-xs text-stone-400">
          MP3, WAV, OGG, AAC, FLAC, M4A
        </p>
      </label>
    </div>
  );
}
