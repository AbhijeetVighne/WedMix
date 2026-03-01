import express from 'express';
import cors from 'cors';
import { spawn } from 'node:child_process';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

const MAX_DURATION_SECONDS = 15 * 60;

const YT_DLP_BASE = [
  '--js-runtimes', 'node',
  '--no-playlist',
  '--extractor-args', 'youtube:player_client=web_creator',
  '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

const YT_URL_RE =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)/;

function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return YT_URL_RE.test(url.trim());
}

function cleanYouTubeUrl(url) {
  try {
    const u = new URL(url.trim());
    const videoId = u.searchParams.get('v');
    if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    return url.trim();
  } catch {
    return url.trim();
  }
}

function runCommand(cmd, args, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    const stdout = [];
    const stderr = [];

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Command timed out'));
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => stdout.push(chunk));
    proc.stderr.on('data', (chunk) => stderr.push(chunk));

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      const out = Buffer.concat(stdout).toString();
      const err = Buffer.concat(stderr).toString();
      if (code !== 0) {
        reject(new Error(err || `Process exited with code ${code}`));
      } else {
        resolve({ stdout: out, stderr: err });
      }
    });
  });
}

// GET /api/info?url=...
app.get('/api/info', async (req, res) => {
  const rawUrl = req.query.url;
  if (!validateUrl(rawUrl)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  const url = cleanYouTubeUrl(rawUrl);

  try {
    const { stdout } = await runCommand('yt-dlp', [
      '--no-download',
      ...YT_DLP_BASE,
      '--print', '%(title)s',
      '--print', '%(duration)s',
      url,
    ], 30_000);

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
    res.status(500).json({ error: err.message.slice(0, 500) });
  }
});

// GET /api/extract?url=...
app.get('/api/extract', async (req, res) => {
  const rawUrl = req.query.url;
  if (!validateUrl(rawUrl)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  const url = cleanYouTubeUrl(rawUrl);

  try {
    const { stdout: infoOut } = await runCommand('yt-dlp', [
      '--no-download',
      ...YT_DLP_BASE,
      '--print', '%(title)s',
      '--print', '%(duration)s',
      url,
    ], 30_000);

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

    const proc = spawn('yt-dlp', [
      '-f', 'bestaudio',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '128K',
      ...YT_DLP_BASE,
      '-o', '-',
      url,
    ]);

    proc.stdout.pipe(res);

    let stderrLog = '';
    proc.stderr.on('data', (chunk) => {
      stderrLog += chunk.toString();
    });

    proc.on('error', (err) => {
      console.error('yt-dlp process error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Audio extraction failed' });
      }
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp extract stderr:', stderrLog);
        if (!res.headersSent) {
          res.status(500).json({ error: stderrLog.slice(0, 500) || 'Audio extraction failed' });
        }
      }
    });

    req.on('close', () => {
      proc.kill('SIGTERM');
    });
  } catch (err) {
    console.error('Extract failed:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message.slice(0, 500) });
    }
  }
});

app.get('/health', async (_req, res) => {
  try {
    const { stdout: ytVer } = await runCommand('yt-dlp', ['--version'], 5000);
    const { stdout: ffVer } = await runCommand('ffmpeg', ['-version'], 5000);
    res.json({
      status: 'ok',
      ytdlp: ytVer.trim(),
      ffmpeg: ffVer.split('\n')[0],
    });
  } catch (err) {
    res.json({ status: 'ok', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`WedMix server listening on port ${PORT}`);
});
