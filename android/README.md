# OWAIS Anime Android

OWAIS Anime is now a **true local-first Android app**.

## Architecture

When the APK opens, it starts its own HTTP backend on the phone at a loopback address such as:

```text
http://127.0.0.1:8765
```

The bundled mobile UI is served by that local backend. The app does **not** use the Render deployment as its API.

The local backend handles:

- App UI delivery
- AniList search and catalog requests from the device
- Anime details and episode metadata
- Local provider configuration
- Local playback lookup
- In-memory metadata caching

The UI keeps My List and Continue Watching on the device.

## Playback sources

The APK intentionally does not bundle a third-party site's token-decryption or access-control bypass logic.

For playback, add an authorized source template from the in-app **Local Source** sheet.

Available placeholders:

```text
{id}
{anilistId}
{episode}
{ep}
{track}
```

Example shape:

```text
https://media.example/watch/{id}/{episode}?lang={track}
```

Choose either:

- **Embed page** for an authorized web player URL
- **Direct video / HLS URL** for a source your device can play directly

If no source is configured, the local backend can surface official streaming links exposed through AniList when available.

## Features

- Dedicated APK-specific dark mobile UI
- Automatic localhost backend on app launch
- No Render/backend URL dependency
- Trending and top-rated anime
- AniList search
- Anime details and episode grid
- SUB / DUB source templates
- Local HTML5 video or embed playback modes
- Fullscreen WebView video support
- Continue Watching stored locally
- My List stored locally
- Local metadata cache

## Build

Requires JDK 17, Android SDK 35 and Gradle 8.9.

```bash
gradle -p android assembleDebug
```

Output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

GitHub Actions publishes the latest successful build to the repository root as:

```text
OWAIS-Anime.apk
```
