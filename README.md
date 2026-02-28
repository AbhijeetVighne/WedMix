# WedMix — Wedding Music Editor

A browser-based music editor for creating wedding mixes. Upload songs, select parts, arrange with crossfade transitions, normalize volume, and export as MP3 or WAV — all client-side, no server needed.

## Features

- **Crossfade** — Equal-power crossfade between segments with configurable duration (0.5–10s)
- **Multi-part selection** — Pick multiple regions from any song using waveform drag or time inputs
- **Volume normalization** — Match all segments to a reference song's loudness
- **Preview** — Seekable preview player with transition testing
- **Export** — MP3 (192 kbps) or lossless WAV
- **Mobile-friendly** — Touch-optimized with large handles, time inputs, and responsive layout

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- WaveSurfer.js (waveform visualization & region selection)
- Web Audio API (mixing, crossfade, normalization)
- lamejs (MP3 encoding)

## Getting Started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
