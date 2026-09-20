# AnimeXOsource_Owais
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

A high-performance, open-source anime video embed and playback infrastructure platform modeled after **[Anixo](https://anixo.buzz/)**. Built with a modern **FastAPI** backend, lightweight **Node.js WebAssembly (WASM) token decryption bridge**, and an ad-free, interactive **HLS.js player playground** with automatic 3-engine failover, frame-accurate subtitles, and skip intro/outro markers.

Powers the web application at **[https://owais-anime-stream.onrender.com/](https://owais-anime-stream.onrender.com/)**.

> **Unified Full-Stack Deployment**: Both the complete web platform console and the high-speed backend API are served from a single unified service, allowing instant 1-click deployment on Render's free tier with zero extra costs or complex build steps.

---

## Table of Contents

- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Web Platform & Studio Console](#web-platform--studio-console)
- [Embed Player Engine](#embed-player-engine)
- [Developer Integration](#developer-integration)
- [API Endpoints Reference](#api-endpoints-reference)
- [Local Setup](#local-setup)
- [Deployment on Render](#deployment-on-render)
- [Free Tier Keepalive](#free-tier-keepalive)
- [Contributing](#contributing)
- [License](#license)

---

## Key Features

- **Studio Console & Embed Playground**: Interactive stream tester supporting anime slugs, AniList numerical IDs, and MyAnimeList IDs. Generates 1-click playable URLs and responsive iframe embed snippets.
- **Automated 3-Engine Failover**: Cascades between Sora Edge, Neko CDN, and Zozo Edge clusters (`HD-2` &rarr; `HD-1`) for uninterrupted playback.
- **WASM-Powered Stream Resolution**: Unpacks rotating CDN crypto blocks and derives AES-256-CBC keys using WebAssembly in memory. No Puppeteer or headless browsers required.
- **Frame-Accurate Subtitles**: Native WebVTT/SRT multi-language subtitle track synchronization with clean styling.
- **Interactive Skip Markers**: Automatically detects opening themes and ending credits, displaying one-click "Skip Intro" and "Skip Credits" buttons.
- **PostMessage Event Bus**: Full bidirectional event communication (`ready`, `play`, `pause`, `timeupdate`, `ended`) for seamless host site integration.
- **Edge Cluster Telemetry**: Live ping and status probing across global delivery nodes.

---

## System Architecture

```
                                      +---------------------------------------------+
                                      |     Host Website / Client Application       |
                                      +---------------------+-----------------------+
                                                            |
                                               Embed Iframe / REST / WS
                                                            v
+-------------------------------------------------------------------------------------------------------------------+
|  AnimeXOsource_Owais Platform (FastAPI)                                                                           |
|                                                                                                                   |
|   GET /                GET /embed/:slug/:ep             GET /search, /home, /info        GET /stream/from-link    |
|   (Studio Console)     (HLS.js Embed Player)            (Catalog Normalizer)             (WASM Bridge Proxy)      |
|           |                     |                                |                                 |              |
|           v                     v                                v                                 v              |
|    templates/index.html   templates/embed.html              reanime/catalog.py            reanime/resolver.py     |
+------------------------------------------------------------------|---------------------------------|--------------+
                                                                   |                                 |
                                                                   v                                 |
                                                           https://reanime.to                        |
                                                           Catalog /api/v1/ & Flix                   |
                                                                                                     v
                                                                                         +-----------------------+
                                                                                         |   Node.js WASM Bridge |
                                                                                         |   (node/resolve.js)   |
                                                                                         |                       |
                                                                                         |  1. Parse SSR payload |
                                                                                         |  2. Execute WASM byte |
                                                                                         |  3. PBKDF2 / AES-CBC  |
                                                                                         +-----------+-----------+
                                                                                                     |
                                                                                                     v
                                                                                            master.m3u8 Stream
                                                                                            Multilingual Subtitles
                                                                                            Intro / Outro Timestamps
```

---

## Web Platform & Studio Console

When visiting the platform root (`/`), you have access to:
1. **Studio Console**: Test stream playback in real-time, toggle between sub/dub, select anime by slug or AniList ID, and copy ready-to-use embed code.
2. **Stream Engine Test Manifests**: Preset benchmarks (One Piece, Demon Slayer, Jujutsu Kaisen, Attack on Titan, Chainsaw Man, Frieren) that mount directly into the studio player with one click.
3. **Live Search**: Debounced real-time catalog search bar for querying anime titles.
4. **Cluster Telemetry**: Live ping probe table monitoring Sora Edge, Neko CDN, and Zozo Edge nodes.
5. **Developer Documentation**: Interactive code tabs for Iframe Embeds, JavaScript SDK, REST API, and PostMessage event listeners.

---

## Embed Player Engine

You can embed ad-free video streams into any third-party website or app using simple iframes:

### Route Formats

```html
<!-- Embed by Anime Slug -->
<iframe src="https://owais-anime-stream.onrender.com/embed/one-piece-xamk74/1?track=sub"
  width="100%" height="480" frameborder="0" allowfullscreen allow="autoplay; fullscreen; picture-in-picture">
</iframe>

<!-- Embed by AniList ID -->
<iframe src="https://owais-anime-stream.onrender.com/embed/ani/21/1?track=sub"
  width="100%" height="480" frameborder="0" allowfullscreen allow="autoplay; fullscreen; picture-in-picture">
</iframe>

<!-- Embed by MyAnimeList ID -->
<iframe src="https://owais-anime-stream.onrender.com/embed/mal/21/1?track=dub"
  width="100%" height="480" frameborder="0" allowfullscreen allow="autoplay; fullscreen; picture-in-picture">
</iframe>
```

---

## Developer Integration

### 1. JavaScript SDK Client (`frontend-integration/api-client.js`)

```javascript
import {
  setApiBase,
  searchAnime,
  getServers,
  getStreamFromLink,
  mountHlsPlayer
} from "./frontend-integration/api-client.js";

// Optional: Set custom API base
setApiBase("https://owais-anime-stream.onrender.com");

// 1. Search anime
const searchResults = await searchAnime("Demon Slayer");
const slug = searchResults.results[0].anime_id;

// 2. Discover servers
const serverInfo = await getServers(slug, 1);
const server = serverInfo.sub[0] || serverInfo.dub[0];

// 3. Resolve live stream URL
const stream = await getStreamFromLink(server.dataLink);

// 4. Attach to player
const videoElement = document.querySelector("#player");
mountHlsPlayer(videoElement, stream.url, stream.subtitles);
videoElement.play();
```

### 2. PostMessage Event Bus

The embed player broadcasts playback events to the parent window:

```javascript
window.addEventListener("message", (event) => {
  if (event.data?.source !== "AnimeXOsource_Owais") return;

  switch (event.data.type) {
    case "ready":
      console.log("Player mounted successfully on server:", event.data.server);
      break;
    case "play":
      console.log("Stream playback started");
      break;
    case "timeupdate":
      console.log("Current time:", event.data.currentTime, "/", event.data.duration);
      break;
    case "ended":
      console.log("Episode ended. Load next episode!");
      break;
  }
});
```

---

## API Endpoints Reference

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/` | AnimeXOsource_Owais Web Platform & Studio Console |
| `GET` | `/embed/{slug}/{episode}` | Interactive ad-free embed player |
| `GET` | `/embed/ani/{id}/{episode}` | Embed player by AniList numerical ID |
| `GET` | `/embed/mal/{id}/{episode}` | Embed player by MyAnimeList numerical ID |
| `GET` | `/health` / `/api/health` | Edge telemetry and cluster health status |
| `GET` | `/search?q=...&limit=20` | Catalog anime title search |
| `GET` | `/home?limit=20` | Latest aired episodes and top weekly releases |
| `GET` | `/top?period=week&limit=20` | Top ranked anime (`day`, `week`, or `month`) |
| `GET` | `/schedule` | Weekly airing schedule |
| `GET` | `/info/{slug}` | Full anime metadata and episode list |
| `GET` | `/episodes/{slug}` | Episode listing only |
| `GET` | `/servers/{slug}/{episode}` | Active playback servers (sub/dub) |
| `GET` | `/stream/{access_id}?v=2` | Resolve stream access ID to playable HLS URL |
| `GET` | `/stream/from-link?link={url}`| Resolve stream directly from CDN embed link |
| `GET` | `/thumbnails/{anilist_id}` | Episode timeline preview sprite data |
| `GET` | `/recommendations/{slug}` | Recommended anime related to slug |

---

## Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/walterwhite-69/ReAnime.to-API.git
cd ReAnime.to-API

# 2. Create virtual environment
python -m venv venv

# Linux / macOS:
source venv/bin/activate
# Windows (PowerShell / CMD):
venv\Scripts\activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Install Node runtime dependencies
cd node && npm install && cd ..

# 5. Start the platform on localhost
python -m uvicorn reanime:app --host 127.0.0.1 --port 8000
```

Open your browser at **`http://127.0.0.1:8000`** to access the web platform.
Swagger interactive API docs are available at **`http://127.0.0.1:8000/docs`**.

---

## Deployment on Render

This repository includes a pre-configured `render.yaml` Blueprint.

### 1-Click Render Deploy

1. Fork or push this repository to your GitHub account.
2. Log in to [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** &rarr; **Blueprint**.
4. Select your GitHub repository.
5. Render reads `render.yaml` and deploys both the web platform and backend API on a single service.

### Manual Render Setup

- **Runtime**: Python
- **Build Command**: `pip install -r requirements.txt && cd node && npm install`
- **Start Command**: `uvicorn reanime:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/health`
- **Environment Variables**:
  - `PYTHON_VERSION`: `3.11.0`
  - `NODE_VERSION`: `20.0.0`
  - `FRONTEND_ORIGIN`: `https://owais-anime-stream.onrender.com`

---

## Free Tier Keepalive

Render free-tier instances sleep after 15 minutes of inactivity. To keep your streaming cluster hot 24/7:

1. Create a free monitor at [cron-job.org](https://cron-job.org/) or [UptimeRobot](https://uptimerobot.com/).
2. Point it to: `https://<your-service>.onrender.com/health`
3. Interval: **Every 14 minutes**

---

## Contributing

Pull requests and issues are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

## License

Released under the **MIT License**. See [LICENSE](LICENSE) for full text.

Copyright (c) 2026 ReAnime.to API contributors.
