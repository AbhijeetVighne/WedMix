import { useState, useCallback } from 'react';
import { Youtube, Download, Loader2, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const YT_URL_RE =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)/;

interface VideoInfo {
  title: string;
  duration: number;
}

interface Props {
  onAudioImported: (buffer: AudioBuffer, fileName: string) => void;
}

export default function YouTubeImporter({ onAudioImported }: Props) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'fetching-info' | 'downloading' | 'decoding' | 'error' | 'waking'
  >('idle');
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState('');

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleImport = useCallback(async () => {
    const trimmed = url.trim();
    if (!YT_URL_RE.test(trimmed)) {
      setError('Please enter a valid YouTube URL');
      setStatus('error');
      return;
    }

    setError('');
    setInfo(null);
    setStatus('fetching-info');

    // Start a timer to detect cold starts
    const coldStartTimer = setTimeout(() => {
      setStatus('waking');
    }, 6000);

    try {
      const infoRes = await fetch(
        `${API_URL}/api/info?url=${encodeURIComponent(trimmed)}`,
      );
      clearTimeout(coldStartTimer);

      if (!infoRes.ok) {
        const body = await infoRes.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch video info');
      }

      const videoInfo: VideoInfo = await infoRes.json();
      setInfo(videoInfo);
      setStatus('downloading');

      const audioRes = await fetch(
        `${API_URL}/api/extract?url=${encodeURIComponent(trimmed)}`,
      );

      if (!audioRes.ok) {
        const body = await audioRes.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to extract audio');
      }

      setStatus('decoding');
      const arrayBuffer = await audioRes.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();

      const safeName = videoInfo.title.replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 80);
      onAudioImported(audioBuffer, `${safeName}.mp3`);

      setUrl('');
      setInfo(null);
      setStatus('idle');
    } catch (err) {
      clearTimeout(coldStartTimer);
      setError(
        err instanceof Error ? err.message : 'Something went wrong',
      );
      setStatus('error');
    }
  }, [url, onAudioImported]);

  const busy = status !== 'idle' && status !== 'error';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Youtube className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-sm font-medium text-stone-600">
          Import from YouTube
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (status === 'error') setStatus('idle');
          }}
          placeholder="Paste YouTube link here..."
          disabled={busy}
          className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent disabled:opacity-50"
        />
        <button
          onClick={handleImport}
          disabled={busy || !url.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {status === 'idle' || status === 'error' ? 'Import' : 'Importing...'}
        </button>
      </div>

      {/* Status messages */}
      {status === 'fetching-info' && (
        <StatusMessage type="loading">
          Fetching video info...
        </StatusMessage>
      )}
      {status === 'waking' && (
        <StatusMessage type="loading">
          Server is waking up (first request can take ~30s)...
        </StatusMessage>
      )}
      {status === 'downloading' && info && (
        <StatusMessage type="loading">
          Downloading "{info.title}" ({formatDuration(info.duration)})...
        </StatusMessage>
      )}
      {status === 'decoding' && (
        <StatusMessage type="loading">
          Decoding audio...
        </StatusMessage>
      )}
      {status === 'error' && (
        <StatusMessage type="error">{error}</StatusMessage>
      )}
    </div>
  );
}

function StatusMessage({
  type,
  children,
}: {
  type: 'loading' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
        type === 'error'
          ? 'bg-red-50 text-red-600'
          : 'bg-stone-50 text-stone-500'
      }`}
    >
      {type === 'error' ? (
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      ) : (
        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
      )}
      {children}
    </div>
  );
}
