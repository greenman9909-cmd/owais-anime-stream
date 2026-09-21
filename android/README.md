# OWAIS Anime Android

A local-first Android client for the existing AnimeXOsource_Owais backend.

## How it works

The mobile UI is bundled inside the APK under `android/app/src/main/assets/app/`. It does not load a remote website shell. The app calls the existing API for catalog/search/details and opens the existing embed player for playback.

Default backend:

```text
https://owais-anime-stream-open.onrender.com
```

The backend can be changed from **My List → Backend settings**, including a local network or localhost URL.

## Features

- Mobile-first dark anime streaming UI
- Trending and top-rated home rows
- AniList search
- Anime details, genres, score and episode grid
- SUB / DUB switching
- Existing OWAIS embed/player integration
- Fullscreen WebView video support
- Continue Watching stored locally on the device
- My List stored locally on the device
- Render wake-up/retry UX
- Configurable backend URL

## Build

Requires JDK 17, Android SDK 35 and Gradle 8.9.

```bash
gradle -p android assembleDebug
```

Output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

GitHub Actions also publishes the latest successful build to the repository root as:

```text
OWAIS-Anime.apk
```

The app is a client for your configured backend. Media availability and playback depend on the resolver/provider configuration and permissions of that backend.
