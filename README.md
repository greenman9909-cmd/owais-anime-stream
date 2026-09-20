# AnimeXOsource_Owais
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

A high-speed, open-source anime video embed and playback infrastructure platform modeled after **[Anixo](https://anixo.buzz/)**. Built with a unified **FastAPI** backend, ad-free **HLS.js 1.5.15 standalone embed player** featuring automated 3-server failover (`HD-2` &rarr; `HD-1` &rarr; `SD-1`), frame-accurate WebVTT subtitle synchronization with **±10s offset calibration**, interactive **AniSkip intro/outro triggers**, HMAC-SHA256 origin shielding, and real-time edge cluster telemetry.

---

## Table of Contents

- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Web Platform & Studio Console](#web-platform--studio-console)
- [Embed Player Engine](#embed-player-engine)
- [Developer Integration](#developer-integration)
- [API Reference](#api-reference)
- [Local Setup & Verification](#local-setup--verification)
- [Environment Variables](#environment-variables)
- [Deployment on Render](#deployment-on-render)
- [Contributing](#contributing)
- [License](#license)

---

## Key Features

- **Studio Console & Embed Playground**: Interactive web console supporting anime slugs, AniList numerical IDs, and MyAnimeList IDs. Generates 1-click playable URLs and responsive iframe embed snippets.
- **Automated 3-Server Failover**: Cascades between Sora Edge, Neko CDN, and Zozo Edge clusters (`HD-2` &rarr; `HD-1` &rarr; `SD-1`) for uninterrupted playback during upstream hiccups.
- **Frame-Accurate Subtitles**: Native WebVTT multi-language subtitle track synchronization with interactive `±10.0s` offset calibration directly in player settings.
- **Interactive AniSkip Markers**: Automatically queries opening themes (`op`) and ending credits (`ed`), rendering one-click "Skip Intro" and "Skip Credits" floating buttons.
- **HMAC-SHA256 Origin Shield**: Edge proxy protection securing stream links with rotating cryptographic signatures and unix expiration timestamps (`?t=<token>&e=<expiry>`).
- **Bidirectional PostMessage Bus**: Standardized `yoru:event` protocol (`ready`, `play`, `pause`, `timeupdate`, `ended`, `failover`, `serverchange`) for host site integration.
- **Edge Cluster Telemetry**: Live ping probing across global delivery nodes (US-East, EU-West, AP-South).

---

## System Architecture

```
                                    +-----------------------------------------+
                                    |     Host Application / Web Browser      |
                                    +--------------------+--------------------+
                                                         |
                                             Iframe Embed / REST API
                                                         v
+---------------------------------------------------------------------------------------------------------------+
|  AnimeXOsource_Owais (FastAPI Single Process)                                                                 |
|                                                                                                               |
|   GET /                  GET /embed/...                  GET /api/search           GET /api/stream            |
|   (Studio Console)       (HLS.js Embed Player)           (AniList GraphQL)         (Stream Resolver & Shield) |
|         |                      |                                 |                             |              |
|         v                      v                                 v                             v              |
|  templates/index.html   templates/embed.html             reanime/anilist.py            reanime/resolver.py    |
|  static/app.js          static/embed.js                                                reanime/shield.py      |
|                                                                                        reanime/aniskip.py     |
+---------------------------------------------------------------------------------------------------------------+
                                                                                                 |
                                                               +---------------------------------+
                                                               |
                                                               v
                                                +------------------------------+
                                                | Upstream Resolver & Clusters |
                                                |   HD-2  •  HD-1  •  SD-1     |
                                                +------------------------------+
```

---

## Web Platform & Studio Console

Visiting `/` opens the dark cyberpunk studio console:
1. **Studio Console**: Test stream playback in real-time, toggle between sub/dub, select anime by slug or AniList ID, and copy ready-to-use embed code.
2. **Stream Engine Test Manifests**: Preset benchmarks (One Piece, Demon Slayer, Jujutsu Kaisen, Attack on Titan, Chainsaw Man, Frieren) that mount directly into the studio player with one click.
3. **Live Search**: Debounced 300ms real-time catalog search querying AniList GraphQL.
4. **Cluster Telemetry**: Live ping probe table monitoring Sora Edge, Neko CDN, and Zozo Edge nodes with 30s auto-refresh.
5. **Developer Documentation**: Interactive code tabs for Iframe Embeds, JavaScript SDK, REST API, and PostMessage event listeners.

---

## Embed Player Engine

Embed ad-free video streams into any third-party website or application using standard iframes:

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

### PostMessage Event Bus (`yoru:event`)

The embed player broadcasts playback events to the parent window:

```javascript
window.addEventListener("message", (event) => {
  if (event.data?.source !== "AnimeXOsource_Owais" && event.data?.type !== "yoru:event") return;

  const type = event.data.event || event.data.type;
  switch (type) {
    case "ready":
      console.log("Player mounted successfully on server:", event.data.server);
      break;
    case "play":
      console.log("Stream playback started");
      break;
    case "timeupdate":
      console.log("Progress:", event.data.currentTime, "/", event.data.duration);
      break;
    case "failover":
      console.warn("Failover triggered:", event.data.from, "->", event.data.to);
      break;
    case "ended":
      console.log("Episode ended. Autoplay next episode!");
      break;
  }
});
```

---

## API Reference

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/` | AnimeXOsource_Owais Web Platform & Studio Console |
| `GET` | `/embed/{slug}/{episode}` | Standalone Hls.js embed player |
| `GET` | `/embed/ani/{id}/{episode}` | Embed player by AniList numerical ID |
| `GET` | `/embed/mal/{id}/{episode}` | Embed player by MyAnimeList numerical ID |
| `GET` | `/api` | Service JSON root metadata |
| `GET` | `/api/search` | AniList GraphQL catalog search proxy |
| `GET` | `/api/anime/{slug}` | Single anime metadata and episode listings |
| `GET` | `/api/stream/{slug}/{ep}` | Stream resolution with 3-node failover, subtitles, and AniSkip |
| `GET` | `/api/health` | Edge telemetry and cluster health status |
| `GET` | `/api/embed-code` | Responsive iframe and direct URL generator |
| `POST` | `/api/shield/validate` | HMAC-SHA256 origin shield token validation |

---

## Local Setup & Verification

```bash
# 1. Clone the repository
git clone https://github.com/greenman9909-cmd/owais-anime-stream.git
cd owais-anime-stream

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy environment configuration
cp .env.example .env

# 4. Run automated test suite
python -m pytest -v

# 5. Boot local development server
python -m uvicorn reanime.app:app --host 127.0.0.1 --port 8000
```

Open your browser at **`http://127.0.0.1:8000`** to access the web platform.
Swagger interactive API docs are available at **`http://127.0.0.1:8000/docs`**.

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8000` | Port for local or production HTTP server |
| `HOST` | `0.0.0.0` | Host bind address |
| `RESOLVER_BASE` | `""` | Base URL of stream resolver (empty returns 503 for local dev) |
| `RESOLVER_KEY` | `""` | Bearer auth key for stream resolver |
| `SHIELD_SECRET` | `"change-me"` | HMAC secret key for URL signing and origin shielding |
| `STUDIO_TOKEN` | `""` | Optional Bearer token to protect the studio landing page |
| `SORA_HOST` | `""` | US-East edge cluster host domain |
| `NEKO_HOST` | `""` | EU-West CDN edge host domain |
| `ZOZO_HOST` | `""` | AP-South edge host domain |

---

## Deployment on Render

This repository includes a pre-configured `render.yaml` Blueprint.

### 1-Click Render Deploy

1. Push your changes to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) &rarr; **New +** &rarr; **Blueprint**.
3. Select this repository.
4. Render automatically provisions the web service with all dependencies.

---

## Contributing

Pull requests and issues are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

## License

Released under the **MIT License**. See [LICENSE](LICENSE) for full text.

Copyright (c) 2026 AnimeXOsource_Owais contributors.
