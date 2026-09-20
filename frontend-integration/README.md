# Frontend Integration Guide

This guide walks you through integrating any web frontend (React, Vue, Svelte, Next.js, or Vanilla JS) with the **ReAnime.to API** to build high-performance anime streaming applications.

---

## 1. Quickstart

Copy `frontend-integration/api-client.js` into your frontend project (e.g. `src/lib/api-client.js` or `src/services/api.js`).

```javascript
import {
  setApiBase,
  searchAnime,
  getHome,
  getServers,
  getStreamFromLink,
  mountHlsPlayer,
} from "./api-client.js";

// Optional: Configure your deployed API URL
setApiBase("https://reanime-api.onrender.com");
```

---

## 2. End-to-End Playback Flow

The typical user journey consists of:
1. Searching or browsing anime titles.
2. Loading anime details and episode count.
3. Fetching available playback servers (`HD-2`, `HD-1`, sub/dub).
4. Resolving the chosen server link into a direct `.m3u8` master playlist.
5. Mounting the stream into an HTML `<video>` element via HLS.js.

### Step-by-Step Implementation

```javascript
import Hls from "hls.js";
import { searchAnime, getInfo, getServers, getStreamFromLink, mountHlsPlayer } from "./api-client.js";

// Make Hls available globally or pass directly
window.Hls = Hls;

async function playEpisode(slug, episodeNumber, videoElement) {
  console.log(`Loading servers for ${slug} episode ${episodeNumber}...`);
  
  // 1. Get available playback servers
  const serverData = await getServers(slug, episodeNumber);
  
  // 2. Select preferred server (HD-2 sub has highest priority)
  const selectedServer = serverData.sub[0] || serverData.dub[0];
  if (!selectedServer) {
    throw new Error("No playback servers available for this episode.");
  }
  
  console.log(`Resolving stream for server ${selectedServer.serverName}...`);
  
  // 3. Resolve CDN stream link to direct master.m3u8
  const streamData = await getStreamFromLink(selectedServer.dataLink);
  
  // 4. Attach HLS stream and sync subtitles to the player
  const player = mountHlsPlayer(videoElement, streamData.url, streamData.subtitles);
  
  // 5. Handle seekbar thumbnails (WebVTT sprites)
  if (streamData.thumbnails_vtt) {
    console.log("Timeline thumbnail sprites:", streamData.thumbnails_vtt);
  }
  
  // 6. Handle Intro/Outro auto-skip timestamps
  if (streamData.intro_chapter) {
    console.log(`Skip Intro available: ${streamData.intro_chapter.start}s - ${streamData.intro_chapter.end}s`);
  }

  videoElement.play();
}
```

---

## 3. Framework Examples

### React Component Example

```jsx
import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { getServers, getStreamFromLink, mountHlsPlayer } from "./api-client";

export function VideoPlayer({ slug, episode }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("Resolving playback stream...");
  const [error, setError] = useState(null);

  useEffect(() => {
    let hlsInstance = null;
    window.Hls = Hls;

    async function load() {
      try {
        setStatus("Fetching servers...");
        const servers = await getServers(slug, episode);
        const server = servers.sub[0] || servers.dub[0];
        
        setStatus(`Resolving stream on ${server.serverName}...`);
        const stream = await getStreamFromLink(server.dataLink);

        hlsInstance = mountHlsPlayer(videoRef.current, stream.url, stream.subtitles);
        setStatus("Ready");
      } catch (err) {
        setError(err.message);
      }
    }

    load();

    return () => {
      if (hlsInstance) hlsInstance.destroy();
    };
  }, [slug, episode]);

  return (
    <div className="player-wrapper">
      {error && <div className="error-banner">{error}</div>}
      <video ref={videoRef} controls playsInline width="100%" />
      <p className="status-indicator">{status}</p>
    </div>
  );
}
```

---

## 4. Connecting to Deployed Frontend (`https://owais-anime-stream.onrender.com/`)

The deployed frontend at `https://owais-anime-stream.onrender.com/` communicates with the backend via `/api/anime`, `/api/stream/{slug}/{episode}`, and `/ws/telemetry`.

The FastAPI backend includes built-in compatibility adapters for all of these paths:
- `GET /api/anime?perPage=12` &rarr; Returns normalized card results.
- `GET /api/anime/{slug}` &rarr; Returns detailed synopsis and episode list.
- `GET /api/stream/{slug}/{episode}` &rarr; Resolves best server, invokes WASM bridge, and returns `{ sources: [{ url, quality: "1080p" }], subtitles }`.
- `WS /ws/telemetry` &rarr; Emits real-time node operational status.

### CORS Setup
Ensure the environment variable `FRONTEND_ORIGIN` is configured in your backend deployment:
```env
FRONTEND_ORIGIN=https://owais-anime-stream.onrender.com
```
This guarantees browsers allow seamless cross-origin communication between the frontend client and the API.
