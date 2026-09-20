# Embedding AnimeXOsource_Owais

AnimeXOsource_Owais exposes browser-facing embed routes that can be placed inside a website, portal, or local application. The embed page owns the player UI and reports lifecycle events to its parent window.

## Quick start

```html
<iframe
  src="https://owais-anime-stream-open.onrender.com/embed/ani/21/1?track=sub"
  width="100%"
  height="600"
  frameborder="0"
  allow="autoplay; fullscreen; picture-in-picture"
  allowfullscreen
  title="AnimeXOsource_Owais player">
</iframe>
```

Use the live URL for a quick test, or replace it with your self-hosted base URL.

## Route formats

| Route | Example | Use |
| --- | --- | --- |
| `/embed/ani/{id}/{episode}` | `/embed/ani/21/1?track=sub` | AniList numerical ID |
| `/embed/mal/{id}/{episode}` | `/embed/mal/21/1?track=dub` | MyAnimeList numerical ID |
| `/embed/{slug}/{episode}` | `/embed/one-piece/1?track=sub` | Slug or provider identifier |

The `track` query parameter accepts `sub` or `dub`. The player also supports the `player` query parameter where the deployment exposes multiple player modes.

## Responsive wrapper

```html
<div style="position:relative;width:100%;padding-top:56.25%;background:#050505;">
  <iframe
    src="https://owais-anime-stream-open.onrender.com/embed/ani/21/1?track=sub"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;"
    allow="autoplay; fullscreen; picture-in-picture"
    allowfullscreen
    title="AnimeXOsource_Owais responsive player">
  </iframe>
</div>
```

## PostMessage events

The player sends event messages to the parent page. Production hosts should restrict accepted origins to the exact domain they control.

```javascript
const playerOrigin = 'https://owais-anime-stream-open.onrender.com';

window.addEventListener('message', (message) => {
  if (message.origin !== playerOrigin) return;
  if (message.data?.source !== 'AnimeXOsource_Owais') return;

  const payload = message.data;
  switch (payload.event || payload.type) {
    case 'ready':
      console.log('Player ready', payload.server);
      break;
    case 'play':
      console.log('Playback started');
      break;
    case 'timeupdate':
      console.log('Position', payload.currentTime, payload.duration);
      break;
    case 'failover':
      console.warn('Provider failover', payload.from, payload.to);
      break;
    case 'ended':
      console.log('Episode ended');
      break;
  }
});
```

## Stream behavior

The backend first attempts the configured resolver. If an upstream provider blocks server-side token extraction but exposes an authorized browser embed URL, the resolver can return an `embed` source and the browser player mounts that frame directly. This avoids treating a provider-side datacenter restriction as a server crash.

A successful stream response contains `sources`, `subtitles`, and optional `skip` markers. A provider that is unavailable may return an error response. Your host application should show a clear fallback state and avoid retrying indefinitely.

## Testing checklist

Open the [live studio](https://owais-anime-stream-open.onrender.com/) and verify the following:

1. The Studio Console loads.
2. The catalog search returns metadata.
3. The embed URL generator creates an iframe snippet.
4. The embed page opens at `/embed/ani/21/1?track=sub`.
5. The player reports a `ready` event when an authorized provider source is available.

For a self-hosted integration, also test `/api/health`, `/docs`, and `/openapi.json` before embedding the player in another site.
