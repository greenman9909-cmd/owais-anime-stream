/**
 * ReAnime.to API - Drop-in JavaScript client for anime streaming frontends.
 * Supports metadata queries and HLS stream resolution with Hls.js playback integration.
 */

let API_BASE = "https://reanime-api.onrender.com";

/**
 * Configure API base URL dynamically (e.g. for localhost development or custom domains).
 * @param {string} url - Base URL of the deployed ReAnime API
 */
export function setApiBase(url) {
  API_BASE = url.replace(/\/+$/, "");
}

/**
 * Get current API base URL.
 * @returns {string}
 */
export function getApiBase() {
  return API_BASE;
}

/**
 * Check service health.
 * @returns {Promise<{status: string, version: string, service: string}>}
 */
export async function getHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

/**
 * Search anime titles by name.
 * @param {string} query - Title query string
 * @param {number} limit - Maximum number of items (default: 20)
 * @param {number} offset - Pagination offset (default: 0)
 * @returns {Promise<any>}
 */
export async function searchAnime(query, limit = 20, offset = 0) {
  const res = await fetch(
    `${API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
  );
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch latest aired episodes and top weekly trending anime.
 * @param {number} limit - Items per section (default: 20)
 * @returns {Promise<{latest_aired: any, top_weekly: any}>}
 */
export async function getHome(limit = 20) {
  const res = await fetch(`${API_BASE}/home?limit=${limit}`);
  if (!res.ok) throw new Error(`Get home failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch top anime ranked by day, week, or month.
 * @param {"day"|"week"|"month"} period - Ranking period
 * @param {number} limit - Items limit
 * @returns {Promise<any>}
 */
export async function getTop(period = "week", limit = 20) {
  const res = await fetch(`${API_BASE}/top?period=${period}&limit=${limit}`);
  if (!res.ok) throw new Error(`Get top failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch weekly airing schedule.
 * @returns {Promise<any>}
 */
export async function getSchedule() {
  const res = await fetch(`${API_BASE}/schedule`);
  if (!res.ok) throw new Error(`Get schedule failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch detailed anime metadata, episode count, and episode listing.
 * @param {string} slug - Anime URL slug e.g. "one-piece-xamk74"
 * @returns {Promise<any>}
 */
export async function getInfo(slug) {
  const res = await fetch(`${API_BASE}/info/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`Get info failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch episode list only for a given anime slug.
 * @param {string} slug - Anime slug
 * @returns {Promise<any[]>}
 */
export async function getEpisodes(slug) {
  const res = await fetch(`${API_BASE}/episodes/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`Get episodes failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch all playback server links (sub and dub) for a specific episode.
 * @param {string} slug - Anime slug
 * @param {number} episode - Episode number
 * @param {number|null} anilistId - Optional AniList ID
 * @returns {Promise<{sub: any[], dub: any[], anilist_id: number, anime: any, intro_start?: number, intro_end?: number}>}
 */
export async function getServers(slug, episode, anilistId = null) {
  let url = `${API_BASE}/servers/${encodeURIComponent(slug)}/${episode}`;
  if (anilistId) {
    url += `?anilist_id=${encodeURIComponent(anilistId)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Get servers failed: ${res.status}`);
  return res.json();
}

/**
 * Resolve stream access ID to playable master.m3u8 URL, subtitles, thumbnails, and chapters.
 * @param {string} accessId - CDN stream access ID
 * @param {number} v - Embed protocol version (default: 2)
 * @returns {Promise<{url: string, subtitles: any[], thumbnails_vtt: string|null, video_title: string|null}>}
 */
export async function getStream(accessId, v = 2) {
  const res = await fetch(`${API_BASE}/stream/${encodeURIComponent(accessId)}?v=${v}`);
  if (!res.ok) throw new Error(`Get stream failed: ${res.status}`);
  return res.json();
}

/**
 * Resolve stream directly from full CDN embed dataLink URL.
 * @param {string} link - Full embed link e.g. "https://flixcloud.cc/e/abc123?v=2"
 * @returns {Promise<{url: string, subtitles: any[], thumbnails_vtt: string|null, video_title: string|null}>}
 */
export async function getStreamFromLink(link) {
  const res = await fetch(`${API_BASE}/stream/from-link?link=${encodeURIComponent(link)}`);
  if (!res.ok) throw new Error(`Get stream from link failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch thumbnail sprite sheet data for an anime by AniList ID.
 * @param {number} anilistId - Numeric AniList media ID
 * @returns {Promise<any>}
 */
export async function getThumbnails(anilistId) {
  const res = await fetch(`${API_BASE}/thumbnails/${encodeURIComponent(anilistId)}`);
  if (!res.ok) throw new Error(`Get thumbnails failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch recommended anime related to a slug.
 * @param {string} slug - Anime slug
 * @returns {Promise<any>}
 */
export async function getRecommendations(slug) {
  const res = await fetch(`${API_BASE}/recommendations/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`Get recommendations failed: ${res.status}`);
  return res.json();
}

/**
 * Helper to mount an HLS stream into an HTML5 video element using Hls.js with fallback.
 * @param {HTMLVideoElement} videoElement - HTML <video> target
 * @param {string} streamUrl - Resolved .m3u8 playlist URL
 * @param {Array<{url: string, language: string, default?: boolean}>} subtitles - Subtitle tracks
 * @returns {any} Hls instance or null if using native HLS
 */
export function mountHlsPlayer(videoElement, streamUrl, subtitles = []) {
  if (!videoElement || !streamUrl) return null;

  // Clear existing track elements
  while (videoElement.firstChild) {
    videoElement.removeChild(videoElement.firstChild);
  }

  // Append WebVTT / SRT tracks
  subtitles.forEach((track) => {
    const trackEl = document.createElement("track");
    trackEl.kind = "subtitles";
    trackEl.label = track.language || "Subtitles";
    trackEl.srclang = (track.language || "en").substring(0, 2).toLowerCase();
    trackEl.src = track.url;
    if (track.default) {
      trackEl.default = true;
    }
    videoElement.appendChild(trackEl);
  });

  // If Hls.js is loaded in window or bundled
  const HlsClass = window.Hls || null;
  if (HlsClass && HlsClass.isSupported()) {
    const hls = new HlsClass({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
    });
    hls.loadSource(streamUrl);
    hls.attachMedia(videoElement);
    return hls;
  } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
    // Native Safari / iOS HLS support
    videoElement.src = streamUrl;
    return null;
  } else {
    console.warn("HLS playback is not natively supported and Hls.js is not loaded.");
    videoElement.src = streamUrl;
    return null;
  }
}
