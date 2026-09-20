# AnimeXOsource_Owais — Complete Developer & Implementation Guide

This guide walks you through integrating, embedding, and self-hosting **AnimeXOsource_Owais** in any web application, portal, or streaming infrastructure.

---

## 1. Quickstart: Drop-in Iframe Embed

The simplest way to embed any anime title into your website (HTML, WordPress, Webflow, Shopify, etc.):

```html
<div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000;">
  <iframe
    src="http://127.0.0.1:8000/embed/ani/21/1?track=sub"
    width="100%"
    height="100%"
    frameborder="0"
    allowfullscreen
    allow="autoplay; fullscreen; picture-in-picture"
    referrerpolicy="no-referrer-when-downgrade">
  </iframe>
</div>
```

### Route Patterns

| Route Pattern | Example | Description |
| :--- | :--- | :--- |
| `/embed/ani/:id/:ep` | `/embed/ani/21/1` | Embed by **AniList Numerical ID** (Recommended) |
| `/embed/mal/:id/:ep` | `/embed/mal/21/1` | Embed by **MyAnimeList ID** |
| `/embed/:slug/:ep` | `/embed/one-piece-21/1` | Embed by **Anime Slug or Title Query** |

### URL Query Parameters

| Parameter | Type | Default | Options | Description |
| :--- | :--- | :--- | :--- | :--- |
| `track` | String | `sub` | `sub`, `dub` | Audio track language |
| `player` | String | `hls` | `hls`, `direct` | `hls` loads adaptive HLS.js player; `direct` loads iframe player fallback |

---

## 2. React / Next.js Component

Copy-paste this component directly into your React / Next.js (App Router or Pages Router) project:

```tsx
import React, { useEffect, useRef } from "react";

export interface AnimePlayerProps {
  /** AniList ID (e.g. 21) or slug */
  id: number | string;
  /** Episode number (1-indexed) */
  episode?: number;
  /** Audio track */
  track?: "sub" | "dub";
  /** Base URL of your hosted backend */
  baseUrl?: string;
  /** Callback fired when stream is loaded */
  onReady?: (server: string) => void;
  /** Callback fired every time playback advances */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Callback fired when episode reaches completion */
  onEnded?: () => void;
}

export const AnimePlayer: React.FC<AnimePlayerProps> = ({
  id,
  episode = 1,
  track = "sub",
  baseUrl = "http://127.0.0.1:8000",
  onReady,
  onTimeUpdate,
  onEnded,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.source !== "AnimeXOsource_Owais" || e.data?.type !== "yoru:event") return;
      const { event, server, currentTime, duration } = e.data;

      switch (event) {
        case "ready":
          onReady?.(server);
          break;
        case "timeupdate":
          onTimeUpdate?.(currentTime, duration);
          break;
        case "ended":
          onEnded?.();
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onReady, onTimeUpdate, onEnded]);

  const embedUrl = `${baseUrl.replace(/\/$/, "")}/embed/ani/${id}/${episode}?track=${track}`;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        backgroundColor: "#000",
        overflow: "hidden",
        borderRadius: "8px",
      }}
    >
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={`Anime Episode ${episode}`}
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
};
```

---

## 3. PostMessage Event Protocol (`yoru:event`)

The embedded player continuously transmits playback events to your parent window via `window.parent.postMessage()`.

### Subscribing to Events

```javascript
window.addEventListener("message", (event) => {
  // 1. Verify origin & source signature
  if (event.data?.source !== "AnimeXOsource_Owais" || event.data?.type !== "yoru:event") return;

  const { event: eventName, server, currentTime, duration, to, from, message } = event.data;

  switch (eventName) {
    case "ready":
      console.log(`Stream ready on server node: ${server}`);
      break;

    case "play":
      console.log("Playback started");
      break;

    case "pause":
      console.log("Playback paused");
      break;

    case "timeupdate":
      // Progress persistence: save to database or localStorage
      const pct = (currentTime / duration) * 100;
      console.log(`Progress: ${pct.toFixed(1)}% (${currentTime}s / ${duration}s)`);
      break;

    case "skip":
      console.log(`Skipped opening/ending to: ${to}s`);
      break;

    case "serverchange":
      console.log(`User toggled cluster server to: ${server}`);
      break;

    case "failover":
      console.warn(`Primary node ${from} degraded. Auto-cascaded to ${to}`);
      break;

    case "ended":
      console.log("Episode finished! Autoplay next episode...");
      // Your custom next-episode trigger here
      break;

    case "error":
      console.error(`Playback error on ${server}: ${message}`);
      break;
  }
});
```

---

## 4. REST API Reference

All REST endpoints return standardized JSON.

### 1. Catalog Search Proxy
Proxies search queries to AniList GraphQL with poster artwork and scores:
```bash
curl -X GET "http://127.0.0.1:8000/api/search?q=one+piece&perPage=5"
```
**Response (200 OK):**
```json
{
  "results": [
    {
      "anilistId": 21,
      "malId": 21,
      "title": { "romaji": "ONE PIECE", "english": "One Piece" },
      "format": "TV",
      "year": 1999,
      "score": 88,
      "cover": "https://..."
    }
  ]
}
```

### 2. Stream Resolution with 3-Node Failover
Resolves playback servers, master `.m3u8` playlist, WebVTT subtitle tracks, and AniSkip markers:
```bash
curl -X GET "http://127.0.0.1:8000/api/stream/21/1?lang=sub"
```
**Response (200 OK):**
```json
{
  "sources": [
    { "server": "HD-2", "priority": 1, "url": "https://.../master.m3u8", "embed": "https://...", "signed": "https://...&t=...&e=..." },
    { "server": "HD-1", "priority": 2, "url": "https://.../master.m3u8", "embed": "https://...", "signed": "https://...&t=...&e=..." },
    { "server": "SD-1", "priority": 3, "url": "https://.../master.m3u8", "embed": "https://...", "signed": "https://...&t=...&e=..." }
  ],
  "subtitles": [
    { "lang": "en", "label": "English", "url": "https://.../eng.ass", "default": true }
  ],
  "skip": {
    "intro": { "start": 28.78, "end": 118.78 },
    "outro": { "start": 1388.0, "end": 1500.0 }
  }
}
```

### 3. Cluster Telemetry
Monitors status and round-trip latencies of edge delivery nodes:
```bash
curl -X GET "http://127.0.0.1:8000/api/health"
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "uptime": 1240,
  "servers": [
    { "name": "Sora Edge", "region": "US-East", "status": "online", "latencyMs": 24 },
    { "name": "Neko CDN", "region": "EU-West", "status": "online", "latencyMs": 38 },
    { "name": "Zozo Edge", "region": "AP-South", "status": "online", "latencyMs": 52 }
  ]
}
```

---

## 5. Self-Hosting & Deployment

### Environment Configuration (`.env`)

```ini
PORT=8000
HOST=0.0.0.0
SHIELD_SECRET=replace-with-a-random-32-byte-hex-secret
STUDIO_TOKEN=optional-bearer-token-to-restrict-studio-ui
```

### Option A: Local / Virtual Machine Run
```bash
# 1. Clone repository
git clone https://github.com/greenman9909-cmd/owais-anime-stream.git
cd owais-anime-stream

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Start server
python -m uvicorn reanime.app:app --host 0.0.0.0 --port 8000
```

### Option B: Production Docker Deployment
```dockerfile
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "reanime.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t animexo-player .
docker run -d -p 8000:8000 --name animexo animexo-player
```

---

## 6. Troubleshooting Common Issues

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **HTTP 403 on Video Stream** | Upstream CDN (FlixCloud) requires specific referer | The built-in player automatically mounts the secure embed frame fallback (`embedUrl`) where referers are handled natively. |
| **CORS Blocked in Browser** | Accessing raw m3u8 playlists across domains | Use `/embed/ani/:id/:ep` inside an `<iframe>` rather than fetching raw `.m3u8` directly. |
| **Subtitle Desync** | Frame rate conversion variance | Click the settings cog ⚙️ on the player to adjust subtitle offset by `±0.5s` increments. |
| **Broken Poster Art** | Third-party S4 CDN hash changes | Benchmark covers are stored locally under `/static/covers/`. |

---

## License

AnimeXOsource_Owais is released under the **MIT License**.
Open-source developer reference infrastructure.
