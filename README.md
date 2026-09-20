# ReAnime.to API
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

A high-performance, self-hosted anime metadata and HLS playback stream resolution service. Built with **FastAPI** (Python 3.11+) and a lightweight **Node.js WebAssembly (WASM) bridge** that resolves the CDN's rotating AES-256-CBC token layer for master `.m3u8` delivery.

Powers the frontend at **[https://owais-anime-stream.onrender.com/](https://owais-anime-stream.onrender.com/)**.

> **Zero Headless Browsers**: Operates entirely through HTTP/2 async connection pools and memory-efficient WebAssembly execution. No Puppeteer, Playwright, or Selenium required.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Local Setup](#local-setup)
- [API Endpoints Reference](#api-endpoints-reference)
- [Typical Request Flow](#typical-request-flow)
- [Deployment on Render](#deployment-on-render)
- [Keeping the Service Warm (Free Tier)](#keeping-the-service-warm-free-tier)
- [Frontend Integration Guide](#frontend-integration-guide)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Comprehensive Catalog Retrieval**: Search anime titles, fetch latest aired episodes, top weekly releases, and release schedules.
- **Rich Anime Metadata**: Full episode listings, AniList IDs, genres, synopsis, cover art, and related recommendations.
- **Server Discovery**: Resolves all active playback nodes (`HD-2 sub`, `HD-2 dub`, `HD-1 sub`, `HD-1 dub`) with automatic priority sorting.
- **WASM-Powered Stream Decryption**: Unpacks CDN obfuscated crypto data, runs WebAssembly key derivation routines, and deciphers AES-256-CBC encrypted `.m3u8` playlist URLs.
- **Subtitles & Media Chapters**: Extracts WebVTT/SRT multilingual subtitles, timeline preview thumbnail sprite sheets, and Intro/Outro skip timestamps.
- **Frontend Ready**: Built-in CORS configuration and drop-in JavaScript client (`frontend-integration/api-client.js`).

---

## Architecture

```
                                  +---------------------------+
                                  |     Frontend Client       |
                                  | (owais-anime-stream etc.) |
                                  +-------------+-------------+
                                                |
                                    HTTP / WS (CORS Enabled)
                                                v
+---------------------------------------------------------------------------------------+
|  ReAnime.to API (FastAPI)                                                             |
|                                                                                       |
|   /search, /home, /top, /info     /servers/{slug}/{ep}         /stream/from-link      |
|                |                           |                           |              |
|                v                           v                           v              |
|        +---------------+           +---------------+           +---------------+      |
|        |  catalog.py   |           |  catalog.py   |           |  resolver.py  |      |
|        +-------+-------+           +-------+-------+           +-------+-------+      |
+----------------|---------------------------|---------------------------|--------------+
                 |                           |                           |
                 v                           v                           |
         https://reanime.to          https://reanime.to                  |
         Catalog & Metadata          /api/flix/{id}/{ep}                 |
                                                                         v
                                                             +-----------------------+
                                                             |   Node.js WASM Bridge |
                                                             |   (node/resolve.js)   |
                                                             |                       |
                                                             |  1. Parse SSR payload |
                                                             |  2. Run WASM exports  |
                                                             |  3. PBKDF2 + AES Dec. |
                                                             +-----------+-----------+
                                                                         |
                                                                         v
                                                                master.m3u8 URL
                                                                Subtitles (VTT/SRT)
                                                                Thumbnail Sprites
```

---

## Requirements

- **Python 3.11+**
- **Node.js 20+** (with WebAssembly support enabled by default)
- **pip** and **npm**

---

## Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/walterwhite-69/ReAnime.to-API.git
cd ReAnime.to-API

# 2. Set up Python virtual environment
python -m venv venv

# On Linux / macOS:
source venv/bin/activate
# On Windows (Command Prompt / PowerShell):
venv\Scripts\activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Install Node dependencies for the WASM runtime
cd node && npm install && cd ..

# 5. Copy environment variables
cp .env.example .env

# 6. Run the FastAPI development server
uvicorn reanime:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`. Interactive Swagger documentation is available at `http://localhost:8000/docs`.

---

## API Endpoints Reference

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health status check |
| `GET` | `/search?q=...&limit=20` | Search anime by name |
| `GET` | `/home?limit=20` | Latest aired episodes and top weekly releases |
| `GET` | `/top?period=week&limit=20` | Top ranked anime (`day`, `week`, or `month`) |
| `GET` | `/schedule` | Weekly airing schedule |
| `GET` | `/info/{slug}` | Anime metadata and episode listing |
| `GET` | `/episodes/{slug}` | Episode listing only |
| `GET` | `/servers/{slug}/{episode}` | Available playback servers for an episode |
| `GET` | `/stream/{access_id}?v=2` | Resolve stream access ID to playable HLS URL |
| `GET` | `/stream/from-link?link={url}`| Resolve stream directly from CDN embed link |
| `GET` | `/thumbnails/{anilist_id}` | Episode thumbnail preview sprite data |
| `GET` | `/recommendations/{slug}` | Recommendations related to anime slug |

*Note: `slug` is the URL-friendly anime identifier from reanime.to (e.g. `one-piece-xamk74`).*

### Endpoint Examples

#### 1. Search Anime: `GET /search?q=demon+slayer&limit=1`
```json
{
  "limit": 1,
  "offset": 0,
  "query": "demon slayer",
  "results": [
    {
      "anime_id": "demon-slayer-kimetsu-no-yaiba-hashira-training-arc-xmk78y",
      "anilist_id": 166240,
      "title": {
        "english": "Demon Slayer: Kimetsu no Yaiba Hashira Training Arc",
        "romaji": "Kimetsu no Yaiba: Hashira Geiko-hen",
        "native": "鬼滅の刃 柱稽古編"
      },
      "cover_image": {
        "extra_large": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx166240-...",
        "large": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx166240-..."
      }
    }
  ]
}
```

#### 2. Get Servers: `GET /servers/one-piece-xamk74/1`
```json
{
  "sub": [
    {
      "serverName": "HD-2",
      "dataLink": "https://flixcloud.cc/e/rtt4nppua1i6?v=2",
      "dataType": "sub"
    },
    {
      "serverName": "HD-1",
      "dataLink": "https://flixcloud.cc/e/rtt4nppua1i6?v=1",
      "dataType": "sub"
    }
  ],
  "dub": [
    {
      "serverName": "HD-2",
      "dataLink": "https://flixcloud.cc/e/rtt4nppua1i6?v=2",
      "dataType": "dub"
    }
  ],
  "anilist_id": 21,
  "anime": {
    "anime_id": "one-piece-xamk74",
    "title": { "english": "ONE PIECE" }
  },
  "intro_start": 90,
  "intro_end": 180,
  "current": 1,
  "duration": 1440
}
```

#### 3. Resolve Stream: `GET /stream/from-link?link=https://flixcloud.cc/e/rtt4nppua1i6?v=2`
```json
{
  "url": "https://fetch8.flixcloud.cc/_v7/ad999757-665e-451f-aa37-fa79eb60967b/master.m3u8?token=eyJhbGciOiJIUzI1Ni...",
  "subtitles": [
    {
      "url": "https://fetch8.flixcloud.cc/subtitles/eng-2.vtt",
      "language": "English (Track 2 (ENG))",
      "format": "vtt",
      "default": true
    }
  ],
  "thumbnails_vtt": "https://fetch8.flixcloud.cc/thumbnails_vtt/ad999757-665e-451f-aa37-fa79eb60967b",
  "video_title": "One.Piece.E01.1080p.mkv",
  "intro_chapter": null,
  "outro_chapter": {
    "start": 1340,
    "end": 1420,
    "title": "Credits"
  },
  "video_id": "ad999757-665e-451f-aa37-fa79eb60967b"
}
```

---

## Typical Request Flow

```
1. Search Anime
   GET /search?q=demon+slayer
   └─ Choose anime slug: "demon-slayer-kimetsu-no-yaiba-hashira-training-arc-xmk78y"

2. Fetch Episode Servers
   GET /servers/demon-slayer-kimetsu-no-yaiba-hashira-training-arc-xmk78y/1
   └─ Returns sub[] and dub[] server lists. Pick serverName: "HD-2"
      with dataLink: "https://flixcloud.cc/e/abc123xyz?v=2"

3. Resolve Playable Stream
   GET /stream/from-link?link=https://flixcloud.cc/e/abc123xyz?v=2
   └─ Node WASM decodes token → returns master.m3u8, subtitles, and thumbnails.

4. Mount into Player
   Feed master.m3u8 into Hls.js or native <video> element.
```

---

## Deployment on Render

This repository includes a `render.yaml` Blueprint for automated deployment.

### Quick Deploy (Blueprint)

1. Fork or push this repository to GitHub.
2. Log in to [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** &rarr; **Blueprint**.
4. Select your GitHub repository.
5. Render detects `render.yaml` and provisions the Web Service automatically.

### Manual Setup (Web Service)

If creating manually on Render:

| Field | Configuration |
| :--- | :--- |
| **Type** | Web Service |
| **Environment** | Python |
| **Region** | Oregon (US West) or Frankfurt (EU Central) |
| **Branch** | `main` |
| **Build Command** | `pip install -r requirements.txt && cd node && npm install` |
| **Start Command** | `uvicorn reanime:app --host 0.0.0.0 --port $PORT` |
| **Plan** | Free (or Starter) |
| **Health Check Path** | `/health` |

#### Environment Variables

| Variable | Recommended Value | Note |
| :--- | :--- | :--- |
| `PYTHON_VERSION` | `3.11.0` | Python runtime version |
| `NODE_VERSION` | `20.0.0` | Node.js runtime for WASM bridge |
| `FRONTEND_ORIGIN` | `https://owais-anime-stream.onrender.com` | Allowed CORS origin |
| `PORT` | `8000` | Injected automatically by Render |

Once deployed, your API will be live at:
`https://<service-name>.onrender.com`

---

## Keeping the Service Warm (Free Tier)

Render Free Tier Web Services spin down to idle after **15 minutes** of inactivity. The subsequent request undergoes a cold-start delay of approximately **10–30 seconds**.

### Keepalive Cron Configuration

To ensure instantaneous playback response times:

1. Sign up for free at [cron-job.org](https://cron-job.org/) or [UptimeRobot](https://uptimerobot.com/).
2. Create a new monitoring job:
   - **URL**: `https://<service-name>.onrender.com/health`
   - **Schedule**: Every **14 minutes**
   - **Request Method**: `GET`
3. This keeps the FastAPI instance and HTTP/2 connection pool hot 24/7.

---

## Frontend Integration Guide

A prebuilt JavaScript client is provided in `frontend-integration/api-client.js`.

### Vanilla JS / Hls.js Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Anime Stream Player</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
  <video id="player" controls width="800" height="450"></video>

  <script type="module">
    import { setApiBase, getServers, getStreamFromLink, mountHlsPlayer } from "./frontend-integration/api-client.js";

    setApiBase("https://reanime-api.onrender.com");

    async function streamEpisode(slug, episodeNumber) {
      const video = document.getElementById("player");
      
      // 1. Fetch servers
      const serverInfo = await getServers(slug, episodeNumber);
      const server = serverInfo.sub[0] || serverInfo.dub[0];
      
      // 2. Resolve HLS stream
      const stream = await getStreamFromLink(server.dataLink);
      
      // 3. Attach to video element
      mountHlsPlayer(video, stream.url, stream.subtitles);
      video.play();
    }

    streamEpisode("one-piece-xamk74", 1);
  </script>
</body>
</html>
```

For complete React and Vue code snippets, see [frontend-integration/README.md](frontend-integration/README.md).

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming conventions, test guidelines, and PR procedures.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 ReAnime.to API contributors.
