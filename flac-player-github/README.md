# Karma Play — a self-hosted music player

A full-stack music player for your own library: upload common audio files, they're stored on disk
with metadata (title/artist/album/cover art) extracted automatically and saved to a
SQLite database, then streamed to a React web player with playlists, shuffle/repeat,
a seek bar, and a 3-band equalizer with a live VU-meter visualizer.

```
flac-player/
├── backend/     Node.js + Express API, SQLite database, file storage
└── frontend/    React + Vite web player
```

## Requirements

- **Node.js 22.13 or newer** for the backend (it uses Node's built-in `node:sqlite`
  module, so there's no native module to compile — no Visual Studio / build tools
  needed on Windows). Node 18+ is fine for the frontend.
- No external database server needed — it uses a local SQLite file.
- You'll see a one-line `ExperimentalWarning: SQLite is an experimental feature`
  when the backend starts. That's expected and harmless — the API is stable enough
  for this use case.

## 1. Run the backend

```bash
cd backend
npm install
npm start
```

This starts the API on **http://localhost:4000**. On first run it creates:
- `backend/data/library.db` — the SQLite database (songs + playlists)
- `backend/uploads/audio/` — uploaded FLAC files
- `backend/uploads/covers/` — extracted album art

## 2. Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The dev server proxies `/api` requests to the backend
automatically (see `frontend/vite.config.js`), so you don't need to configure CORS URLs.

## 3. Add music

Click the floating `+` button to browse for `.flac`, `.mp3`, `.m4a`, `.aac`, `.ogg`, `.wav`, `.webm`, `.opus`, or `.aiff` files. Each file is:
1. Saved into `backend/uploads/audio/`
2. Parsed for embedded tags (title, artist, album, year, genre, track number) and
   embedded cover art, using the `music-metadata` library
3. Registered in the database with its technical specs (sample rate, bit depth, bitrate)

Duplicate imports are handled automatically. An exact file is ignored; when the same
artist and title already exist, the higher-quality file replaces the lower-quality one
based on bit depth, sample rate, bitrate, and file size. Missing tags are inferred from
the filename. Optional AI enrichment can be enabled for uncertain tags with
`KARMA_AI_API_KEY`; `KARMA_AI_URL` and `KARMA_AI_MODEL` can override the default
OpenAI-compatible endpoint and model.

Those specs are shown in the now-playing panel and library list (e.g. `24/96` for
24-bit/96kHz), which is the kind of thing that actually matters for FLAC.

## Features

- **Library** — corner-button upload for common audio formats, per-track sample rate/bit depth/bitrate/file size
- **Playlists** — create, delete, add/remove tracks
- **Playback** — play/pause, seek (byte-range streaming so seeking is instant even on
  large files), non-repeating shuffle cycles, repeat (off / all / one), volume
- **Equalizer** — bass / mid / treble via Web Audio `BiquadFilterNode`s
- **Visualizer** — a segmented LED-style VU meter driven by a live `AnalyserNode`
- **Session memory** — the last track and position plus volume, EQ, shuffle, and repeat settings are restored from the browser

## Notes on FLAC in the browser

FLAC playback via the HTML `<audio>` element is natively supported in current
Chrome, Edge, and Firefox. Safari's support has historically been inconsistent
(older versions don't decode FLAC at all), so if you need guaranteed cross-browser
playback, test in Safari specifically before relying on it there.

## Deploying somewhere permanent

- **Backend**: any Node host with persistent disk (a VPS, Railway, Render, Fly.io).
  Avoid purely serverless hosts for the backend — it writes uploaded files and the
  SQLite database to local disk, which won't persist on ephemeral filesystems.
- **Frontend**: `npm run build` in `frontend/` produces a static `dist/` folder you
  can host anywhere (Netlify, Vercel, nginx, the same VPS as the backend). Point it
  at your backend's real URL by editing `vite.config.js`'s proxy for dev, or by
  putting a reverse proxy (nginx) in front of both in production so `/api` reaches
  the backend.
- **Storage growth**: FLAC files are large. Keep an eye on disk usage as your library
  grows, and make sure whatever host you pick gives you enough persistent storage.

## Extending it

Ideas if you want to keep going:
- User accounts/auth (currently single-user, no login)
- Waveform-accurate seek preview
- Gapless playback between tracks
- Lyrics (.lrc) support
- Mobile-responsive layout tweaks (current layout is desktop-first)
