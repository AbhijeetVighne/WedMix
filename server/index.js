import express from 'express';
import cors from 'cors';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5199',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'));
      }
    },
  }),
);

const MAX_DURATION_SECONDS = 15 * 60;

const YT_URL_RE =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)/;

function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return YT_URL_RE.test(url.trim());
}

// GET /api/info?url=...
app.get('/api/info', async (req, res) => {
  const url = req.query.url;
  if (!validateUrl(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--no-download',
      '--print',
      '%(title)s\n%(duration)s',
      '--no-warnings',
      url.trim(),
    ], { timeout: 30_000 });

    const lines = stdout.trim().split('\n');
    const title = lines[0] || 'Unknown';
    const duration = parseInt(lines[1], 10) || 0;

    if (duration > MAX_DURATION_SECONDS) {
      return res.status(400).json({
        error: `Video is too long (${Math.round(duration / 60)} min). Max ${MAX_DURATION_SECONDS / 60} minutes.`,
      });
    }

    res.json({ title, duration });
  } catch (err) {
    console.error('Info fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch video info. Check the URL and try again.' });
  }
});

// GET /api/extract?url=...
app.get('/api/extract', async (req, res) => {
  const url = req.query.url;
  if (!validateUrl(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    // First check duration
    const { stdout: infoOut } = await execFileAsync('yt-dlp', [
      '--no-download',
      '--print',
      '%(title)s\n%(duration)s',
      '--no-warnings',
      url.trim(),
    ], { timeout: 30_000 });

    const lines = infoOut.trim().split('\n');
    const title = lines[0] || 'audio';
    const duration = parseInt(lines[1], 10) || 0;

    if (duration > MAX_DURATION_SECONDS) {
      return res.status(400).json({
        error: `Video is too long (${Math.round(duration / 60)} min). Max ${MAX_DURATION_SECONDS / 60} minutes.`,
      });
    }

    const safeTitle = title.replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 80);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}.mp3"`,
    );
    res.setHeader('X-Audio-Title', encodeURIComponent(title));

    // Stream audio directly to response via yt-dlp + ffmpeg
    const proc = spawn('yt-dlp', [
      '-f', 'bestaudio',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '128K',
      '--no-warnings',
      '--no-playlist',
      '-o', '-',
      url.trim(),
    ]);

    proc.stdout.pipe(res);

    proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString();
      if (msg.includes('ERROR')) console.error('yt-dlp stderr:', msg);
    });

    proc.on('error', (err) => {
      console.error('yt-dlp process error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Audio extraction failed' });
      }
    });

    proc.on('close', (code) => {
      if (code !== 0 && !res.headersSent) {
        res.status(500).json({ error: 'Audio extraction failed' });
      }
    });

    req.on('close', () => {
      proc.kill('SIGTERM');
    });
  } catch (err) {
    console.error('Extract failed:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Audio extraction failed. Check the URL and try again.' });
    }
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`WedMix server listening on port ${PORT}`);
});
