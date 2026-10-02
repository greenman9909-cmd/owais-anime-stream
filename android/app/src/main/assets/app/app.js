const API_BASE = window.location.origin;
const ANI_ORIGIN = "https://ani.pm";
const ANI_API_DEFAULT = "https://ani.pm/api/partner/v1";
const ANI_EMBED_DEFAULT = "https://ani.pm/embed/ani";

const view = document.getElementById("view");
const playerScreen = document.getElementById("playerScreen");
const playerFrame = document.getElementById("playerFrame");
const localVideo = document.getElementById("localVideo");
const playerLoading = document.getElementById("playerLoading");
const playerUnavailable = document.getElementById("playerUnavailable");
const playerUnavailableText = document.getElementById("playerUnavailableText");
const officialButton = document.getElementById("officialButton");
const trackButton = document.getElementById("trackButton");
const bottomNav = document.getElementById("bottomNav");
const toastEl = document.getElementById("toast");
const sourceSheet = document.getElementById("sourceSheet");
const providerMode = document.getElementById("providerMode");
const subTemplate = document.getElementById("subTemplate");
const dubTemplate = document.getElementById("dubTemplate");
const localAddress = document.getElementById("localAddress");

const CLOUD_BOOT = window.OWAIS_CLOUD || {};

const state = {
  view: "home",
  currentAnime: null,
  currentTrack: "sub",
  currentEpisode: 1,
  currentMaxEpisodes: 1,
  browseMode: "week",
  searchTimer: null,
  officialUrl: "",
  playerMode: "embed",
  playerMessageId: 0,
  cloudConfig: {},
};

function esc(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name, className) {
  return '<svg class="' + esc(className || "") + '" aria-hidden="true"><use href="#i-' + esc(name) + '"></use></svg>';
}

function titleOf(anime) {
  if (!anime) return "Unknown";
  if (typeof anime.title === "string") return anime.title;
  const title = anime.title || {};
  return title.english || title.romaji || title.native || anime.nativeTitle || "Unknown";
}

function imageOf(anime) {
  return (anime && (anime.poster || anime.cover || anime.banner)) || "";
}

function bannerOf(anime) {
  return (anime && (anime.banner || anime.poster || anime.cover)) || "";
}

function stripHtml(value) {
  const div = document.createElement("div");
  div.innerHTML = String(value || "");
  return div.textContent || div.innerText || "";
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(function () {
    toastEl.classList.remove("show");
  }, 1900);
}

function apiBase() {
  return state.cloudConfig.ani_pm_api_base || state.cloudConfig.api_base || ANI_API_DEFAULT;
}

function embedBase() {
  return state.cloudConfig.ani_pm_embed_base || state.cloudConfig.embed_base || ANI_EMBED_DEFAULT;
}

async function loadCloudConfig() {
  if (!CLOUD_BOOT.supabaseUrl || !CLOUD_BOOT.supabasePublishableKey) return {};
  try {
    const response = await fetch(
      CLOUD_BOOT.supabaseUrl + "/rest/v1/yoru_app_config?select=key,value",
      {
        headers: {
          apikey: CLOUD_BOOT.supabasePublishableKey,
          Accept: "application/json",
        },
      },
    );
    if (!response.ok) return {};
    const rows = await response.json();
    state.cloudConfig = Object.fromEntries(
      (Array.isArray(rows) ? rows : []).map(function (row) {
        return [row.key, row.value];
      }),
    );
    return state.cloudConfig;
  } catch (_) {
    return {};
  }
}

async function localApi(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 18000);
  try {
    const response = await fetch(API_BASE + path, Object.assign({}, options || {}, {
      signal: controller.signal,
      headers: Object.assign({ Accept: "application/json" }, (options && options.headers) || {}),
    }));
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      throw new Error((data && (data.error || data.detail)) || ("HTTP " + response.status));
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function ani(path, params) {
  const url = new URL(apiBase() + path);
  const input = Object.assign({}, params || {});
  if (!("adult" in input)) input.adult = "0";
  Object.entries(input).forEach(function ([key, value]) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 18000);
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      mode: "cors",
      credentials: "omit",
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      const error = data && data.error;
      throw new Error((error && (error.message || error.code)) || ("ani.pm HTTP " + response.status));
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function payloadArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.results)) return payload.data.results;
  if (payload.data && Array.isArray(payload.data.items)) return payload.data.items;
  if (payload.data && Array.isArray(payload.data.titles)) return payload.data.titles;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function scoreNumber(raw) {
  const value = Number(raw && raw.score);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value > 10 ? value / 10 : value;
}

function normalizeTitle(raw) {
  raw = raw || {};
  const title = typeof raw.title === "string"
    ? raw.title
    : ((raw.title && (raw.title.english || raw.title.romaji || raw.title.native)) || raw.nativeTitle || "Unknown");
  const episodesRaw = raw.episodes;
  let total = 0;
  if (episodesRaw && typeof episodesRaw === "object") total = Number(episodesRaw.total || 0);
  else total = Number(episodesRaw || 0);

  return {
    anilistId: Number(raw.anilistId || raw.id || 0),
    malId: Number(raw.malId || 0) || null,
    title: title,
    nativeTitle: raw.nativeTitle || "",
    poster: raw.poster || raw.cover || (raw.coverImage && (raw.coverImage.extraLarge || raw.coverImage.large)) || "",
    banner: raw.banner || raw.bannerImage || raw.poster || raw.cover || "",
    synopsis: stripHtml(raw.synopsis || raw.description || ""),
    format: raw.format || "TV",
    status: raw.status || "",
    year: raw.year || raw.seasonYear || "",
    season: raw.season || "",
    score: scoreNumber(raw),
    rating: raw.rating || "",
    durationMinutes: Number(raw.durationMinutes || 0),
    episodes: total,
    episodeCounts: typeof episodesRaw === "object" ? episodesRaw : {},
    genres: Array.isArray(raw.genres) ? raw.genres : [],
    studios: Array.isArray(raw.studios) ? raw.studios : [],
    adult: Boolean(raw.adult),
    url: raw.url || "",
    embed: raw.embed || "",
    views: Number(raw.views || 0),
    episode: Number(raw.episode || 0),
    episodeTitle: raw.episodeTitle || "",
    addedAt: raw.addedAt || "",
    available: raw.available || {},
    episodeList: Array.isArray(raw.episodeList) ? raw.episodeList : [],
    raw: raw,
  };
}

function dedupeTitles(rows) {
  const seen = new Set();
  return rows.map(normalizeTitle).filter(function (item) {
    if (!item.anilistId || item.adult) return false;
    const key = String(item.anilistId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function setActiveNav(name) {
  document.querySelectorAll(".nav-item").forEach(function (button) {
    button.classList.toggle("active", button.dataset.action === "nav-" + name);
  });
}

function loading(message) {
  view.innerHTML =
    '<div class="loading-screen">' +
      '<div class="spinner"></div>' +
      '<b>' + esc(message || "Loading") + '</b>' +
      '<span>Syncing the catalogue.</span>' +
    '</div>';
}

function errorScreen(title, message, retryAction) {
  view.innerHTML =
    '<div class="error-screen">' +
      '<b>' + esc(title) + '</b>' +
      '<p>' + esc(message) + '</p>' +
      '<button class="retry-btn" data-action="' + esc(retryAction || "nav-home") + '">Try again</button>' +
    '</div>';
}

function scoreLabel(anime) {
  return anime.score ? anime.score.toFixed(1) : "—";
}

function animeCard(anime, extra) {
  const name = titleOf(anime);
  const episodeText = extra && extra.episode ? (" · Ep " + extra.episode) : "";
  return (
    '<button class="anime-card" data-action="detail" data-id="' + esc(anime.anilistId) + '">' +
      '<div class="poster-wrap">' +
        '<img src="' + esc(imageOf(anime)) + '" alt="' + esc(name) + '" loading="lazy">' +
        '<span class="poster-score">★ ' + esc(scoreLabel(anime)) + '</span>' +
      '</div>' +
      '<h3>' + esc(name) + '</h3>' +
      '<p>' + esc(anime.year || "") + (anime.format ? " · " + esc(anime.format) : "") + esc(episodeText) + '</p>' +
    '</button>'
  );
}

function rankedCard(anime, rank) {
  return (
    '<button class="rank-card" data-action="detail" data-id="' + esc(anime.anilistId) + '">' +
      '<span class="rank-number">' + rank + '</span>' +
      '<div class="rank-poster"><img src="' + esc(imageOf(anime)) + '" alt="' + esc(titleOf(anime)) + '" loading="lazy"></div>' +
      '<div class="rank-copy"><b>' + esc(titleOf(anime)) + '</b><span>★ ' + esc(scoreLabel(anime)) + '</span></div>' +
    '</button>'
  );
}

function continueItems() {
  try { return JSON.parse(localStorage.getItem("owais_continue") || "[]"); }
  catch (_) { return []; }
}

function saveContinue(item) {
  const items = continueItems().filter(function (entry) {
    return !(String(entry.id) === String(item.id) && Number(entry.episode) === Number(item.episode));
  });
  items.unshift(item);
  localStorage.setItem("owais_continue", JSON.stringify(items.slice(0, 20)));
}

function findContinue(id, episode) {
  return continueItems().find(function (item) {
    return String(item.id) === String(id) && Number(item.episode) === Number(episode);
  });
}

function watchlistIds() {
  try { return JSON.parse(localStorage.getItem("owais_watchlist") || "[]"); }
  catch (_) { return []; }
}

function saveWatchlist(ids) {
  localStorage.setItem("owais_watchlist", JSON.stringify(ids));
}

function isSaved(id) {
  return watchlistIds().map(String).includes(String(id));
}

function toggleSaved(id) {
  let ids = watchlistIds();
  const key = String(id);
  if (ids.map(String).includes(key)) {
    ids = ids.filter(function (value) { return String(value) !== key; });
    showToast("Removed from Library");
  } else {
    ids.unshift(Number(id));
    showToast("Saved to Library");
  }
  saveWatchlist(ids.slice(0, 100));
}

function renderContinue() {
  const items = continueItems();
  if (!items.length) return "";
  return (
    '<section class="section">' +
      '<div class="section-head"><h2>Continue Watching</h2><span>Resume instantly</span></div>' +
      '<div class="card-row">' +
        items.slice(0, 8).map(function (item) {
          const pct = item.duration > 0 ? Math.max(0, Math.min(100, item.currentTime / item.duration * 100)) : 0;
          return (
            '<button class="continue-card" data-action="watch" data-id="' + esc(item.id) + '" data-episode="' + esc(item.episode) + '">' +
              '<div class="continue-thumb" style="background-image:url(&quot;' + esc(item.banner || item.cover || "") + '&quot;)">' +
                '<span class="continue-play">' + icon("logo") + '</span>' +
              '</div>' +
              '<div class="continue-body"><b>' + esc(item.title) + '</b><span>Episode ' + esc(item.episode) + '</span>' +
                '<div class="progress-mini"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
              '</div>' +
            '</button>'
          );
        }).join("") +
      '</div>' +
    '</section>'
  );
}

async function loadHome() {
  state.view = "home";
  state.currentAnime = null;
  setActiveNav("home");
  loading("Loading OWAIS");

  try {
    const results = await Promise.allSettled([
      ani("/top", { range: "week", limit: 18 }),
      ani("/recent", { page: 1, limit: 18 }),
      ani("/top", { range: "all", limit: 12 }),
    ]);

    let weekly = results[0].status === "fulfilled" ? dedupeTitles(payloadArray(results[0].value)) : [];
    let recentRaw = results[1].status === "fulfilled" ? payloadArray(results[1].value) : [];
    let allTime = results[2].status === "fulfilled" ? dedupeTitles(payloadArray(results[2].value)) : [];
    let recent = dedupeTitles(recentRaw);

    if (!weekly.length && !recent.length) {
      const fallback = await Promise.all([
        localApi("/api/anime?sort=trending&perPage=18"),
        localApi("/api/anime?sort=score&perPage=12"),
      ]);
      weekly = dedupeTitles((fallback[0] && fallback[0].results) || []);
      allTime = dedupeTitles((fallback[1] && fallback[1].results) || []);
      recent = weekly.slice(4);
    }

    const hero = weekly[0] || recent[0] || allTime[0];
    if (!hero) {
      errorScreen("Catalogue unavailable", "No titles were returned right now.", "nav-home");
      return;
    }

    const heroGenres = (hero.genres || []).slice(0, 3).join(" · ");
    const heroHtml =
      '<section class="v4-hero">' +
        '<div class="v4-hero-art" style="background-image:url(&quot;' + esc(bannerOf(hero)) + '&quot;)"></div>' +
        '<div class="v4-hero-shade"></div>' +
        '<div class="v4-hero-copy">' +
          '<span class="feature-pill">Featured this week</span>' +
          '<h1>' + esc(titleOf(hero)) + '</h1>' +
          '<div class="v4-meta"><span class="score">★ ' + esc(scoreLabel(hero)) + '</span><span>' + esc(hero.year || "Anime") + '</span><span>' + esc(hero.format || "TV") + '</span></div>' +
          '<p>' + esc(heroGenres || "Discover something worth watching.") + '</p>' +
          '<div class="v4-hero-actions">' +
            '<button class="watch-now" data-action="watch" data-id="' + esc(hero.anilistId) + '" data-episode="1">' + icon("logo") + ' Play now</button>' +
            '<button class="circle-action" data-action="toggle-save" data-id="' + esc(hero.anilistId) + '" aria-label="Save">' + icon("bookmark") + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="hero-dots"><i></i><i></i><i></i></div>' +
      '</section>';

    const weeklyHtml =
      '<section class="v4-section"><div class="v4-section-head"><div><span>Trending now</span><h2>Popular This Week</h2></div><button data-action="nav-browse">See all</button></div>' +
      '<div class="card-row">' + weekly.slice(0, 12).map(animeCard).join("") + '</div></section>';

    const latestHtml = recent.length ?
      '<section class="section"><div class="section-head"><h2>Latest Episodes</h2><span>Fresh on ani.pm</span></div><div class="card-row">' +
        recent.slice(0, 12).map(function (item) { return animeCard(item, { episode: item.episode }); }).join("") +
      '</div></section>' : "";

    const topHtml = allTime.length ?
      '<section class="v4-section top10-section"><div class="v4-section-head"><div><span>Community favourites</span><h2>All-time picks</h2></div></div>' +
        '<div class="rank-row">' + allTime.slice(0, 10).map(function (item, index) { return rankedCard(item, index + 1); }).join("") + '</div></section>' : "";

    view.innerHTML = heroHtml + renderContinue() + weeklyHtml + latestHtml + topHtml;
  } catch (error) {
    errorScreen("Could not load the catalogue", error.message || "Request failed.", "nav-home");
  }
}

async function loadBrowse(mode) {
  state.view = "browse";
  state.currentAnime = null;
  state.browseMode = mode || state.browseMode || "week";
  setActiveNav("browse");
  loading("Loading Browse");

  try {
    const params = state.browseMode === "movie"
      ? { range: "all", format: "MOVIE", limit: 45 }
      : { range: state.browseMode, limit: 45 };
    const payload = await ani("/top", params);
    const items = dedupeTitles(payloadArray(payload));

    view.innerHTML =
      '<section class="browse-page">' +
        '<div class="browse-intro"><span class="eyebrow">Explore</span><h1>Browse anime</h1><p>Public ani.pm catalogue · adult titles hidden</p></div>' +
        '<div class="filter-strip">' +
          '<button class="' + (state.browseMode === "week" ? "active" : "") + '" data-action="browse-sort" data-sort="week">This week</button>' +
          '<button class="' + (state.browseMode === "month" ? "active" : "") + '" data-action="browse-sort" data-sort="month">This month</button>' +
          '<button class="' + (state.browseMode === "all" ? "active" : "") + '" data-action="browse-sort" data-sort="all">All time</button>' +
          '<button class="' + (state.browseMode === "movie" ? "active" : "") + '" data-action="browse-sort" data-sort="movie">Movies</button>' +
        '</div>' +
        (items.length ? '<div class="browse-grid">' + items.map(animeCard).join("") + '</div>' : '<div class="empty-screen"><b>No titles found</b><p>Try another filter.</p></div>') +
      '</section>';
  } catch (error) {
    errorScreen("Browse unavailable", error.message || "Request failed.", "nav-browse");
  }
}

function loadSearch() {
  state.view = "search";
  state.currentAnime = null;
  setActiveNav("search");
  view.innerHTML =
    '<section class="search-page">' +
      '<span class="eyebrow">Find your next watch</span><h1 class="page-title">Search</h1>' +
      '<label class="search-box">' + icon("search") + '<input id="searchInput" autocomplete="off" autocapitalize="none" placeholder="Search anime…"></label>' +
      '<p id="searchStatus" class="search-status">Type at least 2 characters.</p>' +
      '<div id="searchResults"></div>' +
    '</section>';
  setTimeout(function () {
    const input = document.getElementById("searchInput");
    if (input) input.focus();
  }, 50);
}

async function runSearch(query) {
  const status = document.getElementById("searchStatus");
  const results = document.getElementById("searchResults");
  if (!status || !results) return;
  const q = String(query || "").trim();
  if (q.length < 2) {
    status.textContent = "Type at least 2 characters.";
    results.innerHTML = "";
    return;
  }
  status.textContent = "Searching…";
  try {
    const payload = await ani("/titles", { q: q, page: 1, limit: 30 });
    const items = dedupeTitles(payloadArray(payload));
    status.textContent = items.length ? (items.length + " results") : "No results";
    results.innerHTML = items.length ? '<div class="grid">' + items.map(animeCard).join("") + '</div>' : "";
  } catch (error) {
    status.textContent = "Search failed";
    results.innerHTML = '<div class="empty-screen"><b>Could not search</b><p>' + esc(error.message || "Try again.") + '</p></div>';
  }
}

function availabilityText(ep) {
  const available = ep.available || {};
  const parts = [];
  if (available.sub) parts.push("SUB");
  if (available.dub) parts.push("DUB");
  if (available.subHard) parts.push("HARDSUB");
  return parts.length ? parts.join(" · ") : "Unavailable";
}

async function openDetail(id) {
  state.view = "detail";
  setActiveNav("");
  loading("Opening series");
  try {
    let raw;
    try {
      const payload = await ani("/series/" + encodeURIComponent(id));
      raw = payload.data || payload;
    } catch (error) {
      raw = await localApi("/api/anime/" + encodeURIComponent(id));
    }

    const anime = normalizeTitle(raw);
    anime.episodeList = Array.isArray(raw.episodeList) ? raw.episodeList : [];
    if (!anime.episodeList.length && anime.episodes > 0) {
      anime.episodeList = Array.from({ length: Math.min(anime.episodes, 500) }, function (_, i) {
        return { number: i + 1, title: null, available: { sub: true }, embed: {} };
      });
    }

    state.currentAnime = anime;
    state.currentMaxEpisodes = Math.max(1, anime.episodeList.length || anime.episodes || 1);

    const tags = (anime.genres || []).slice(0, 5).map(function (tag) { return '<span class="tag">' + esc(tag) + '</span>'; }).join("");
    const episodes = anime.episodeList.map(function (ep) {
      const number = Number(ep.number || 1);
      return (
        '<button class="episode-row" data-action="watch" data-id="' + esc(anime.anilistId) + '" data-episode="' + number + '">' +
          '<span class="episode-number">' + number + '</span>' +
          '<span class="episode-thumb" style="background-image:url(&quot;' + esc(ep.thumbnail || bannerOf(anime)) + '&quot;)"><i>' + icon("logo") + '</i></span>' +
          '<span class="episode-copy"><b>' + esc(ep.title || ("Episode " + number)) + '</b><small>' + esc(availabilityText(ep)) + (ep.runtimeSeconds ? " · " + Math.round(ep.runtimeSeconds / 60) + " min" : "") + '</small></span>' +
          '<span class="episode-more">›</span>' +
        '</button>'
      );
    }).join("");

    view.innerHTML =
      '<section class="series-page">' +
        '<div class="series-backdrop" style="background-image:url(&quot;' + esc(bannerOf(anime)) + '&quot;)"><button class="series-back" data-action="nav-home" aria-label="Back">' + icon("arrow-left") + '</button></div>' +
        '<div class="series-body">' +
          '<div class="series-title-block"><span class="eyebrow">Series</span><h1>' + esc(titleOf(anime)) + '</h1>' +
            '<div class="series-meta"><span>★ ' + esc(scoreLabel(anime)) + '</span><span>' + esc(anime.year || "") + '</span><span>' + esc(anime.format || "TV") + '</span><span>' + esc((anime.episodes || anime.episodeList.length) + " eps") + '</span></div>' +
            '<div class="tag-row">' + tags + '</div>' +
          '</div>' +
          '<div class="series-actions"><button class="watch-now wide" data-action="watch" data-id="' + esc(anime.anilistId) + '" data-episode="1">' + icon("logo") + ' Play episode 1</button>' +
            '<button class="secondary-square" data-action="toggle-save" data-id="' + esc(anime.anilistId) + '" aria-label="Save">' + icon("bookmark") + '</button></div>' +
          '<p class="series-synopsis">' + esc(anime.synopsis || "No synopsis available.") + '</p>' +
          '<div class="episodes-toolbar"><h2>Episodes</h2><div class="track-toggle"><button class="' + (state.currentTrack === "sub" ? "active" : "") + '" data-action="set-track" data-track="sub">SUB</button><button class="' + (state.currentTrack === "dub" ? "active" : "") + '" data-action="set-track" data-track="dub">DUB</button></div></div>' +
          '<div class="episode-list">' + episodes + '</div>' +
        '</div>' +
      '</section>';
  } catch (error) {
    errorScreen("Could not open series", error.message || "Request failed.", "nav-home");
  }
}

function getEpisode(anime, episode) {
  const list = (anime && anime.episodeList) || [];
  return list.find(function (item) { return Number(item.number) === Number(episode); }) || null;
}

function trackForEpisode(ep, preferred) {
  if (!ep || !ep.available) return preferred || "sub";
  if (preferred === "dub" && ep.available.dub) return "dub";
  if (preferred === "sub" && ep.available.sub) return "sub";
  if (ep.available.sub) return "sub";
  if (ep.available.dub) return "dub";
  return preferred || "sub";
}

function withAdultOff(url) {
  try {
    const u = new URL(url);
    u.searchParams.set("adult", "0");
    return u.toString();
  } catch (_) {
    return url;
  }
}

function embedFor(anime, ep, track) {
  if (ep && ep.embed && ep.embed[track]) return withAdultOff(ep.embed[track]);
  return withAdultOff(embedBase() + "/" + anime.anilistId + "/" + Number(ep && ep.number || state.currentEpisode || 1) + "/" + track);
}

function resetPlayerSurface() {
  try { localVideo.pause(); } catch (_) {}
  localVideo.removeAttribute("src");
  localVideo.load();
  localVideo.classList.add("hidden");
  playerFrame.src = "about:blank";
  playerFrame.classList.add("hidden");
  playerUnavailable.classList.add("hidden");
  officialButton.classList.add("hidden");
  playerLoading.classList.remove("hidden");
  state.officialUrl = "";
}

function sendPlayer(cmd, args) {
  try {
    if (!playerFrame.contentWindow) return;
    state.playerMessageId += 1;
    playerFrame.contentWindow.postMessage({
      ns: "anipm.player",
      v: 1,
      id: state.playerMessageId,
      cmd: cmd,
      args: args || {},
    }, ANI_ORIGIN);
  } catch (_) {}
}

async function ensureSeries(id) {
  if (state.currentAnime && String(state.currentAnime.anilistId) === String(id) && state.currentAnime.episodeList && state.currentAnime.episodeList.length) {
    return state.currentAnime;
  }
  const payload = await ani("/series/" + encodeURIComponent(id));
  const raw = payload.data || payload;
  const anime = normalizeTitle(raw);
  anime.episodeList = Array.isArray(raw.episodeList) ? raw.episodeList : [];
  state.currentAnime = anime;
  return anime;
}

async function openPlayer(id, episode) {
  episode = Math.max(1, Number(episode || 1));
  let anime;
  try {
    anime = await ensureSeries(id);
  } catch (error) {
    showToast("This title is not available in the player");
    return;
  }

  const ep = getEpisode(anime, episode);
  const chosenTrack = trackForEpisode(ep, state.currentTrack);
  if (chosenTrack !== state.currentTrack) {
    state.currentTrack = chosenTrack;
    showToast(chosenTrack.toUpperCase() + " is available for this episode");
  }

  if (ep && ep.available && !ep.available.sub && !ep.available.dub) {
    showToast("This episode is not available yet");
    return;
  }

  state.currentEpisode = episode;
  state.currentMaxEpisodes = Math.max(1, anime.episodeList.length || anime.episodes || episode);
  const name = titleOf(anime);

  document.getElementById("playerTitle").textContent = name;
  document.getElementById("playerSubtitle").textContent = "Episode " + episode + " · " + state.currentTrack.toUpperCase();
  document.getElementById("playerMetaTitle").textContent = name;
  document.getElementById("playerMetaEpisode").textContent = "Episode " + episode + " · " + state.currentTrack.toUpperCase();
  document.getElementById("episodeNumber").textContent = String(episode);
  trackButton.textContent = state.currentTrack.toUpperCase();

  resetPlayerSurface();
  playerScreen.classList.remove("hidden");
  bottomNav.classList.add("hidden");
  document.body.style.overflow = "hidden";

  const previous = findContinue(anime.anilistId, episode);
  saveContinue({
    id: anime.anilistId,
    title: name,
    cover: imageOf(anime),
    banner: bannerOf(anime),
    episode: episode,
    currentTime: previous ? Number(previous.currentTime || 0) : 0,
    duration: previous ? Number(previous.duration || 0) : Number((ep && ep.runtimeSeconds) || 0),
    updatedAt: Date.now(),
  });

  state.playerMode = "embed";
  playerFrame.classList.remove("hidden");
  playerFrame.src = embedFor(anime, ep || { number: episode }, state.currentTrack);
  playerFrame.onload = function () {
    playerLoading.classList.add("hidden");
    sendPlayer("hello");
    sendPlayer("setAccent", { color: "#8b5cf6" });
    const resume = findContinue(anime.anilistId, episode);
    if (resume && Number(resume.currentTime || 0) > 8) {
      setTimeout(function () {
        sendPlayer("seek", { time: Number(resume.currentTime || 0) });
      }, 450);
    }
  };
}

function closePlayer() {
  resetPlayerSurface();
  playerScreen.classList.add("hidden");
  bottomNav.classList.remove("hidden");
  document.body.style.overflow = "";
  if (state.currentAnime) openDetail(state.currentAnime.anilistId);
  else loadHome();
}

async function loadLibrary() {
  state.view = "library";
  state.currentAnime = null;
  setActiveNav("library");
  const ids = watchlistIds();
  view.innerHTML =
    '<section class="library-page"><span class="eyebrow">Saved on this device</span><h1 class="page-title">Library</h1>' +
      '<div class="library-actions"><button data-action="clear-history">Clear watch progress</button></div>' +
      '<div id="libraryContent">' + (ids.length ? '<div class="loading-screen"><div class="spinner"></div><b>Loading Library</b></div>' : '<div class="empty-screen"><b>Your Library is empty</b><p>Save a title from its series page.</p></div>') + '</div>' +
    '</section>';
  if (!ids.length) return;

  const rows = await Promise.all(ids.slice(0, 40).map(async function (id) {
    try {
      const payload = await ani("/titles/" + encodeURIComponent(id));
      return normalizeTitle(payload.data || payload);
    } catch (_) { return null; }
  }));
  const clean = rows.filter(Boolean);
  const container = document.getElementById("libraryContent");
  if (container) container.innerHTML = clean.length ? '<div class="grid">' + clean.map(animeCard).join("") + '</div>' : '<div class="empty-screen"><b>Nothing could be loaded</b><p>Try again later.</p></div>';
}

async function openSourceSettings() {
  await loadCloudConfig();
  providerMode.value = "embed";
  subTemplate.value = state.cloudConfig.ani_pm_embed_base || ANI_EMBED_DEFAULT;
  dubTemplate.value = "";
  localAddress.textContent = "ani.pm public API";
  sourceSheet.classList.remove("hidden");
}

function closeSourceSettings() {
  sourceSheet.classList.add("hidden");
}

function clearHistory() {
  localStorage.removeItem("owais_continue");
  showToast("Watch progress cleared");
  if (state.view === "library") loadLibrary();
}

window.addEventListener("message", function (event) {
  if (event.origin !== ANI_ORIGIN || event.source !== playerFrame.contentWindow) return;
  const message = event.data || {};

  let currentTime = null;
  let duration = null;
  let complete = false;

  if (message.ns === "anipm.player" && message.v === 1 && message.event) {
    const data = message.data || {};
    if (message.event === "timeupdate" || message.event === "state") {
      currentTime = Number(data.currentTime || data.time || 0);
      duration = Number(data.duration || data.durationSeconds || 0);
    }
    if (message.event === "ended" || message.event === "complete") complete = true;
  }

  if (message.event === "time") {
    currentTime = Number(message.time || 0);
    duration = Number(message.duration || 0);
  }
  if (message.type === "watching-log") {
    currentTime = Number(message.currentTime || 0);
    duration = Number(message.duration || 0);
  }
  if (message.event === "complete") complete = true;

  if (state.currentAnime && currentTime !== null) {
    saveContinue({
      id: state.currentAnime.anilistId,
      title: titleOf(state.currentAnime),
      cover: imageOf(state.currentAnime),
      banner: bannerOf(state.currentAnime),
      episode: state.currentEpisode,
      currentTime: Math.max(0, currentTime),
      duration: Math.max(0, duration || 0),
      updatedAt: Date.now(),
    });
  }

  if (complete && state.currentAnime && state.currentEpisode < state.currentMaxEpisodes) {
    setTimeout(function () {
      openPlayer(state.currentAnime.anilistId, state.currentEpisode + 1);
    }, 850);
  }
});

localVideo.addEventListener("timeupdate", function () {
  if (!state.currentAnime) return;
  saveContinue({
    id: state.currentAnime.anilistId,
    title: titleOf(state.currentAnime),
    cover: imageOf(state.currentAnime),
    banner: bannerOf(state.currentAnime),
    episode: state.currentEpisode,
    currentTime: Number(localVideo.currentTime || 0),
    duration: Number(localVideo.duration || 0),
    updatedAt: Date.now(),
  });
});

document.addEventListener("input", function (event) {
  if (event.target && event.target.id === "searchInput") {
    clearTimeout(state.searchTimer);
    const value = event.target.value;
    state.searchTimer = setTimeout(function () { runSearch(value); }, 280);
  }
});

document.addEventListener("click", function (event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  if (action === "nav-home") loadHome();
  else if (action === "nav-browse") loadBrowse("week");
  else if (action === "nav-search") loadSearch();
  else if (action === "nav-library") loadLibrary();
  else if (action === "browse-sort") loadBrowse(button.dataset.sort || "week");
  else if (action === "detail") openDetail(button.dataset.id);
  else if (action === "watch") openPlayer(button.dataset.id, button.dataset.episode || 1);
  else if (action === "close-player") closePlayer();
  else if (action === "toggle-save") {
    toggleSaved(button.dataset.id);
    button.classList.toggle("saved", isSaved(button.dataset.id));
  }
  else if (action === "set-track") {
    state.currentTrack = button.dataset.track || "sub";
    if (state.currentAnime) openDetail(state.currentAnime.anilistId);
  }
  else if (action === "toggle-track") {
    state.currentTrack = state.currentTrack === "sub" ? "dub" : "sub";
    if (state.currentAnime) openPlayer(state.currentAnime.anilistId, state.currentEpisode);
  }
  else if (action === "prev-episode") {
    if (state.currentAnime && state.currentEpisode > 1) openPlayer(state.currentAnime.anilistId, state.currentEpisode - 1);
  }
  else if (action === "next-episode") {
    if (state.currentAnime && state.currentEpisode < state.currentMaxEpisodes) openPlayer(state.currentAnime.anilistId, state.currentEpisode + 1);
    else showToast("Latest available episode");
  }
  else if (action === "source-settings") openSourceSettings();
  else if (action === "close-source-settings") closeSourceSettings();
  else if (action === "save-source-settings" || action === "clear-source-settings") closeSourceSettings();
  else if (action === "open-official" && state.officialUrl) window.location.href = state.officialUrl;
  else if (action === "clear-history") clearHistory();
});

window.OWAIS_NATIVE_PROGRESS = function (id, episode, positionMs, durationMs) {
  if (!state.currentAnime || String(state.currentAnime.anilistId) !== String(id)) return;
  saveContinue({
    id: state.currentAnime.anilistId,
    title: titleOf(state.currentAnime),
    cover: imageOf(state.currentAnime),
    banner: bannerOf(state.currentAnime),
    episode: Number(episode || state.currentEpisode || 1),
    currentTime: Math.max(0, Number(positionMs || 0) / 1000),
    duration: Math.max(0, Number(durationMs || 0) / 1000),
    updatedAt: Date.now(),
  });
};

window.OWAIS_APP_BACK = function () {
  if (!sourceSheet.classList.contains("hidden")) { closeSourceSettings(); return true; }
  if (!playerScreen.classList.contains("hidden")) { closePlayer(); return true; }
  if (["detail", "browse", "search", "library"].includes(state.view)) { loadHome(); return true; }
  return false;
};

loadCloudConfig().finally(function () {
  if (localAddress) localAddress.textContent = "ani.pm public API";
  loadHome();
});
