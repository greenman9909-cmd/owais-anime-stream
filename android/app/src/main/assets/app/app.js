const DEFAULT_API = "https://owais-anime-stream-open.onrender.com";
let API_BASE = (localStorage.getItem("owais_api_base") || DEFAULT_API).replace(/\/+$/, "");

const view = document.getElementById("view");
const playerScreen = document.getElementById("playerScreen");
const playerFrame = document.getElementById("playerFrame");
const playerLoading = document.getElementById("playerLoading");
const serverChip = document.getElementById("serverChip");
const serverText = document.getElementById("serverText");
const bottomNav = document.getElementById("bottomNav");
const toastEl = document.getElementById("toast");

const state = {
  view: "home",
  home: null,
  currentAnime: null,
  currentTrack: "sub",
  currentEpisode: 1,
  currentMaxEpisodes: 1,
  searchTimer: null,
  searchResults: []
};

function esc(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleOf(anime) {
  if (!anime) return "Unknown";
  const title = anime.title || {};
  return title.english || title.romaji || title.native || "Unknown";
}

function imageOf(anime) {
  return anime.cover || anime.banner || "";
}

function bannerOf(anime) {
  return anime.banner || anime.cover || "";
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(function () {
    toastEl.classList.remove("show");
  }, 1800);
}

function setServerState(mode, text) {
  serverChip.classList.remove("online", "offline");
  if (mode) serverChip.classList.add(mode);
  serverText.textContent = text;
}

async function api(path, options, retry) {
  retry = retry == null ? 1 : retry;
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 25000);

  try {
    const response = await fetch(API_BASE + path, Object.assign({}, options || {}, {
      signal: controller.signal,
      headers: Object.assign({"Accept": "application/json"}, (options && options.headers) || {})
    }));

    if (!response.ok) {
      let detail = "";
      try {
        const data = await response.json();
        detail = data.detail || data.error || "";
      } catch (_) {}
      throw new Error("HTTP " + response.status + (detail ? " — " + detail : ""));
    }

    setServerState("online", "Online");
    return await response.json();
  } catch (error) {
    if (retry > 0) {
      setServerState("", "Waking server");
      await new Promise(function (resolve) { setTimeout(resolve, 3500); });
      return api(path, options, retry - 1);
    }
    setServerState("offline", "Offline");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function setActiveNav(name) {
  document.querySelectorAll(".nav-item").forEach(function (button) {
    button.classList.toggle("active", button.dataset.action === "nav-" + name);
  });
}

function loading(message) {
  view.innerHTML =
    '<div class="loading-screen"><div class="spinner"></div><b>' +
    esc(message || "Loading anime") +
    '</b><span>Your Render service may need a few seconds to wake up.</span></div>';
}

function errorScreen(title, message, retryAction) {
  view.innerHTML =
    '<div class="error-screen"><b>' + esc(title) + '</b><p>' + esc(message) +
    '</p><button class="retry-btn" data-action="' + esc(retryAction || "nav-home") + '">Try again</button></div>';
}

function animeCard(anime) {
  const name = titleOf(anime);
  const score = anime.score ? String(anime.score) + "%" : "—";
  return (
    '<button class="anime-card" data-action="detail" data-id="' + esc(anime.anilistId) + '">' +
      '<div class="poster-wrap">' +
        '<img src="' + esc(imageOf(anime)) + '" alt="' + esc(name) + '" loading="lazy">' +
        '<span class="poster-score">★ ' + esc(score) + '</span>' +
      '</div>' +
      '<h3>' + esc(name) + '</h3>' +
      '<p>' + esc(anime.year || "") + ' • ' + esc(anime.format || "TV") + '</p>' +
    '</button>'
  );
}

function continueItems() {
  try {
    return JSON.parse(localStorage.getItem("owais_continue") || "[]");
  } catch (_) {
    return [];
  }
}

function saveContinue(item) {
  const items = continueItems().filter(function (entry) {
    return String(entry.id) !== String(item.id);
  });
  items.unshift(item);
  localStorage.setItem("owais_continue", JSON.stringify(items.slice(0, 12)));
}

function watchlistIds() {
  try {
    return JSON.parse(localStorage.getItem("owais_watchlist") || "[]");
  } catch (_) {
    return [];
  }
}

function saveWatchlist(ids) {
  localStorage.setItem("owais_watchlist", JSON.stringify(ids));
}

function isSaved(id) {
  return watchlistIds().map(String).includes(String(id));
}

function toggleSaved(id) {
  let ids = watchlistIds();
  const stringId = String(id);

  if (ids.map(String).includes(stringId)) {
    ids = ids.filter(function (value) { return String(value) !== stringId; });
    showToast("Removed from My List");
  } else {
    ids.unshift(Number(id));
    showToast("Added to My List");
  }

  saveWatchlist(ids.slice(0, 80));
}

function renderContinue() {
  const items = continueItems();
  if (!items.length) return "";

  const cards = items.slice(0, 8).map(function (item) {
    const pct = item.duration > 0 ? Math.max(0, Math.min(100, (item.currentTime / item.duration) * 100)) : 0;
    return (
      '<button class="continue-card" data-action="watch" data-id="' + esc(item.id) + '" data-episode="' + esc(item.episode) + '">' +
        '<div class="continue-thumb" style="background-image:url(&quot;' + esc(item.banner || item.cover || "") + '&quot;)">' +
          '<span class="continue-play">▶</span>' +
        '</div>' +
        '<div class="continue-body"><b>' + esc(item.title) + '</b><span>Episode ' + esc(item.episode) + '</span>' +
          '<div class="progress-mini"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '</div>' +
      '</button>'
    );
  }).join("");

  return (
    '<section class="section"><div class="section-head"><h2>Continue Watching</h2><span>On this device</span></div>' +
    '<div class="card-row">' + cards + '</div></section>'
  );
}

async function loadHome() {
  state.view = "home";
  state.currentAnime = null;
  setActiveNav("home");
  loading("Loading your anime home");

  try {
    const result = await Promise.all([
      api("/api/anime?sort=trending&perPage=14"),
      api("/api/anime?sort=score&perPage=14")
    ]);

    const trending = (result[0] && result[0].results) || [];
    const top = (result[1] && result[1].results) || [];
    state.home = {trending: trending, top: top};

    const hero = trending[0] || top[0];
    if (!hero) {
      errorScreen("No anime found", "The catalog returned no results.", "nav-home");
      return;
    }

    const genres = (hero.genres || []).slice(0, 2).join(" • ");
    const heroHtml =
      '<section class="hero">' +
        '<div class="hero-bg" style="background-image:url(&quot;' + esc(bannerOf(hero)) + '&quot;)"></div>' +
        '<div class="hero-content"><span class="eyebrow">TRENDING NOW</span>' +
          '<h1>' + esc(titleOf(hero)) + '</h1>' +
          '<div class="hero-meta"><span class="score">★ ' + esc(hero.score || "—") + '%</span><span>' + esc(hero.year || "") + '</span><span>' + esc(hero.format || "TV") + '</span><span>' + esc(genres) + '</span></div>' +
          '<p>Discover this title, browse episodes, and stream through your OWAIS Anime backend.</p>' +
          '<div class="hero-actions">' +
            '<button class="primary-btn" data-action="watch" data-id="' + esc(hero.anilistId) + '" data-episode="1">▶ Play episode 1</button>' +
            '<button class="secondary-btn" data-action="detail" data-id="' + esc(hero.anilistId) + '">Details</button>' +
          '</div>' +
        '</div>' +
      '</section>';

    const trendingHtml =
      '<section class="section"><div class="section-head"><h2>Trending</h2><span>Popular this week</span></div><div class="card-row">' +
      trending.map(animeCard).join("") + '</div></section>';

    const topHtml =
      '<section class="section"><div class="section-head"><h2>Top Rated</h2><span>Highest scores</span></div><div class="card-row">' +
      top.map(animeCard).join("") + '</div></section>';

    view.innerHTML = heroHtml + renderContinue() + trendingHtml + topHtml;
  } catch (error) {
    errorScreen("Could not load anime", error.message || "Connection failed.", "nav-home");
  }
}

function loadSearch() {
  state.view = "search";
  state.currentAnime = null;
  setActiveNav("search");
  view.innerHTML =
    '<section class="search-page">' +
      '<span class="eyebrow">DISCOVER</span><h1 class="page-title">Search anime</h1>' +
      '<div class="search-box"><span>⌕</span><input id="searchInput" type="search" placeholder="One Piece, Naruto, Frieren…" autocomplete="off"></div>' +
      '<div id="searchStatus" class="search-status">Type at least 2 characters.</div>' +
      '<div id="searchGrid" class="grid"></div>' +
    '</section>';

  const input = document.getElementById("searchInput");
  input.addEventListener("input", function () {
    clearTimeout(state.searchTimer);
    const query = input.value.trim();
    state.searchTimer = setTimeout(function () {
      if (query.length >= 2) doSearch(query);
      else {
        document.getElementById("searchStatus").textContent = "Type at least 2 characters.";
        document.getElementById("searchGrid").innerHTML = "";
      }
    }, 360);
  });
  setTimeout(function () { input.focus(); }, 150);
}

async function doSearch(query) {
  const status = document.getElementById("searchStatus");
  const grid = document.getElementById("searchGrid");
  if (!status || !grid) return;

  status.textContent = "Searching for “" + query + "”…";
  grid.innerHTML = "";

  try {
    const data = await api("/api/search?q=" + encodeURIComponent(query) + "&perPage=24");
    const results = (data && data.results) || [];
    state.searchResults = results;
    status.textContent = results.length ? results.length + " results" : "No results found.";
    grid.innerHTML = results.map(animeCard).join("");
  } catch (error) {
    status.textContent = "Search failed: " + error.message;
  }
}

async function openDetail(id) {
  state.view = "detail";
  setActiveNav("");
  loading("Loading anime details");

  try {
    const anime = await api("/api/anime/" + encodeURIComponent(id));
    state.currentAnime = anime;
    state.currentMaxEpisodes = Math.max(1, Number(anime.episodes || (anime.episodeList || []).length || 1));

    const name = titleOf(anime);
    const genres = (anime.genres || []).slice(0, 5).map(function (genre) {
      return '<span class="tag">' + esc(genre) + '</span>';
    }).join("");

    const episodeList = anime.episodeList && anime.episodeList.length
      ? anime.episodeList
      : Array.from({length: state.currentMaxEpisodes}, function (_, index) {
          return {number: index + 1};
        });

    const episodes = episodeList.map(function (episode, index) {
      const num = Number(episode.number || index + 1);
      const cls = num === state.currentEpisode ? "ep-btn last" : "ep-btn";
      return '<button class="' + cls + '" data-action="watch" data-id="' + esc(anime.anilistId) + '" data-episode="' + num + '">' + num + '</button>';
    }).join("");

    view.innerHTML =
      '<section class="detail-page">' +
        '<div class="detail-hero" style="background-image:url(&quot;' + esc(bannerOf(anime)) + '&quot;)">' +
          '<button class="round-btn detail-back" data-action="nav-home">←</button>' +
        '</div>' +
        '<div class="detail-content">' +
          '<div class="detail-main">' +
            '<img class="detail-poster" src="' + esc(imageOf(anime)) + '" alt="' + esc(name) + '">' +
            '<div class="detail-title"><h1>' + esc(name) + '</h1><p>★ ' + esc(anime.score || "—") + '% • ' + esc(anime.year || "") + ' • ' + esc(anime.format || "TV") + '</p><div class="tag-row">' + genres + '</div></div>' +
          '</div>' +
          '<div class="detail-actions">' +
            '<button class="primary-btn" data-action="watch" data-id="' + esc(anime.anilistId) + '" data-episode="1">▶ Start watching</button>' +
            '<button class="secondary-btn" data-action="toggle-save" data-id="' + esc(anime.anilistId) + '">' + (isSaved(anime.anilistId) ? "♥ In My List" : "♡ My List") + '</button>' +
          '</div>' +
          '<p class="synopsis">' + esc(anime.synopsis || "No synopsis available.") + '</p>' +
          '<div class="episode-head"><h2>Episodes</h2>' +
            '<div class="track-toggle">' +
              '<button class="' + (state.currentTrack === "sub" ? "active" : "") + '" data-action="set-track" data-track="sub">SUB</button>' +
              '<button class="' + (state.currentTrack === "dub" ? "active" : "") + '" data-action="set-track" data-track="dub">DUB</button>' +
            '</div>' +
          '</div>' +
          '<div class="episode-grid">' + episodes + '</div>' +
        '</div>' +
      '</section>';
  } catch (error) {
    errorScreen("Could not load details", error.message || "Request failed.", "nav-home");
  }
}

async function openPlayer(id, episode) {
  episode = Math.max(1, Number(episode || 1));
  let anime = state.currentAnime;

  if (!anime || String(anime.anilistId) !== String(id)) {
    try {
      anime = await api("/api/anime/" + encodeURIComponent(id));
      state.currentAnime = anime;
    } catch (error) {
      showToast("Could not load player details");
      return;
    }
  }

  state.currentEpisode = episode;
  state.currentMaxEpisodes = Math.max(1, Number(anime.episodes || (anime.episodeList || []).length || episode));

  const name = titleOf(anime);
  document.getElementById("playerTitle").textContent = name;
  document.getElementById("playerSubtitle").textContent = "Episode " + episode + " • " + state.currentTrack.toUpperCase();
  document.getElementById("playerMetaTitle").textContent = name;
  document.getElementById("playerMetaEpisode").textContent = "Episode " + episode + " • " + state.currentTrack.toUpperCase();
  document.getElementById("episodeNumber").textContent = String(episode);

  playerLoading.classList.remove("hidden");
  playerScreen.classList.remove("hidden");
  bottomNav.classList.add("hidden");
  document.body.style.overflow = "hidden";

  saveContinue({
    id: anime.anilistId,
    title: name,
    cover: imageOf(anime),
    banner: bannerOf(anime),
    episode: episode,
    currentTime: 0,
    duration: 0,
    updatedAt: Date.now()
  });

  playerFrame.src =
    API_BASE + "/embed/ani/" + encodeURIComponent(anime.anilistId) + "/" +
    encodeURIComponent(episode) + "?track=" + encodeURIComponent(state.currentTrack);

  playerFrame.onload = function () {
    setTimeout(function () { playerLoading.classList.add("hidden"); }, 450);
  };
}

function closePlayer() {
  playerFrame.src = "about:blank";
  playerScreen.classList.add("hidden");
  bottomNav.classList.remove("hidden");
  document.body.style.overflow = "";
  playerLoading.classList.add("hidden");
  if (state.currentAnime) openDetail(state.currentAnime.anilistId);
  else loadHome();
}

function loadLibrary() {
  state.view = "library";
  state.currentAnime = null;
  setActiveNav("library");

  const ids = watchlistIds();
  view.innerHTML =
    '<section class="library-page">' +
      '<span class="eyebrow">YOUR SPACE</span><h1 class="page-title">My List</h1>' +
      '<div class="library-actions">' +
        '<button data-action="server-settings">Backend settings</button>' +
        '<button data-action="clear-history">Clear continue watching</button>' +
      '</div>' +
      '<div id="libraryContent">' +
        (ids.length
          ? '<div class="loading-screen"><div class="spinner"></div><b>Loading My List</b></div>'
          : '<div class="empty-screen"><b>Your list is empty</b><p>Save anime from any details page and they will stay on this device.</p></div>') +
      '</div>' +
    '</section>';

  if (ids.length) {
    Promise.all(ids.slice(0, 30).map(function (id) {
      return api("/api/anime/" + encodeURIComponent(id), null, 0).catch(function () { return null; });
    })).then(function (items) {
      const clean = items.filter(Boolean);
      const container = document.getElementById("libraryContent");
      if (!container) return;
      container.innerHTML = clean.length
        ? '<div class="grid">' + clean.map(animeCard).join("") + '</div>'
        : '<div class="empty-screen"><b>Nothing could be loaded</b><p>Try again when the backend is online.</p></div>';
    });
  }
}

function configureServer() {
  const next = prompt(
    "OWAIS Anime backend URL\\n\\nUse your Render URL, local network server, or localhost:",
    API_BASE
  );

  if (!next) return;
  API_BASE = next.trim().replace(/\/+$/, "");
  localStorage.setItem("owais_api_base", API_BASE);
  setServerState("", "Checking");
  showToast("Backend updated");
  checkHealth();
  loadHome();
}

async function checkHealth() {
  try {
    await api("/api/health", null, 0);
    setServerState("online", "Online");
  } catch (_) {
    setServerState("offline", "Offline");
  }
}

document.addEventListener("click", function (event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;

  if (action === "nav-home") loadHome();
  else if (action === "nav-search") loadSearch();
  else if (action === "nav-library") loadLibrary();
  else if (action === "detail") openDetail(button.dataset.id);
  else if (action === "watch") openPlayer(button.dataset.id, button.dataset.episode || 1);
  else if (action === "close-player") closePlayer();
  else if (action === "toggle-save") {
    toggleSaved(button.dataset.id);
    button.textContent = isSaved(button.dataset.id) ? "♥ In My List" : "♡ My List";
  }
  else if (action === "set-track") {
    state.currentTrack = button.dataset.track || "sub";
    if (state.currentAnime) openDetail(state.currentAnime.anilistId);
  }
  else if (action === "toggle-track") {
    state.currentTrack = state.currentTrack === "sub" ? "dub" : "sub";
    openPlayer(state.currentAnime.anilistId, state.currentEpisode);
  }
  else if (action === "prev-episode") {
    if (state.currentEpisode > 1) openPlayer(state.currentAnime.anilistId, state.currentEpisode - 1);
  }
  else if (action === "next-episode") {
    if (state.currentEpisode < state.currentMaxEpisodes) openPlayer(state.currentAnime.anilistId, state.currentEpisode + 1);
    else showToast("You reached the latest episode");
  }
  else if (action === "server-settings") configureServer();
  else if (action === "clear-history") {
    localStorage.removeItem("owais_continue");
    showToast("Continue Watching cleared");
  }
});

window.addEventListener("message", function (event) {
  const data = event.data || {};
  if (data.source !== "AnimeXOsource_Owais") return;
  if (!state.currentAnime) return;

  if (data.event === "ready") {
    playerLoading.classList.add("hidden");
  }

  if (data.event === "timeupdate") {
    saveContinue({
      id: state.currentAnime.anilistId,
      title: titleOf(state.currentAnime),
      cover: imageOf(state.currentAnime),
      banner: bannerOf(state.currentAnime),
      episode: state.currentEpisode,
      currentTime: Number(data.currentTime || 0),
      duration: Number(data.duration || 0),
      updatedAt: Date.now()
    });
  }

  if (data.event === "ended" && state.currentEpisode < state.currentMaxEpisodes) {
    showToast("Episode finished");
  }
});

window.OWAIS_APP_BACK = function () {
  if (!playerScreen.classList.contains("hidden")) {
    closePlayer();
    return true;
  }
  if (state.view === "detail" || state.view === "search" || state.view === "library") {
    loadHome();
    return true;
  }
  return false;
};

checkHealth();
loadHome();
