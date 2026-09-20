/**
 * AnimeXOsource_Owais - Studio Console & Platform Logic
 * Handles interactive stream mounting, catalog search with 300ms debouncing,
 * clipboard copying, radio parameter synchronization, 30s telemetry polling,
 * modal dialogs, and local storage consent preferences.
 */

(() => {
  'use strict';

  // --- Current Studio State ---
  const studio = {
    catalog: 'ani', // 'ani', 'slug', 'mal'
    id: '21',
    ep: 1,
    track: 'sub',
    playerType: 'hls',
  };

  // --- Parameter Refresh & URL Construction ---
  window.refreshStreamRoute = function () {
    const idInput = document.getElementById('stream-id');
    const epInput = document.getElementById('stream-ep');
    const trackInput = document.getElementById('stream-track');

    const idVal = idInput ? idInput.value.trim() : studio.id;
    const epVal = epInput ? epInput.value.trim() : studio.ep;
    const trackVal = trackInput ? trackInput.value : studio.track;

    studio.id = idVal || '21';
    studio.ep = parseInt(epVal || '1', 10);
    studio.track = trackVal;

    let path;
    if (studio.catalog === 'ani') {
      path = `/embed/ani/${encodeURIComponent(studio.id)}/${studio.ep}`;
    } else if (studio.catalog === 'mal') {
      path = `/embed/mal/${encodeURIComponent(studio.id)}/${studio.ep}`;
    } else {
      path = `/embed/${encodeURIComponent(studio.id)}/${studio.ep}`;
    }

    const params = new URLSearchParams();
    if (studio.track !== 'sub') params.set('track', studio.track);
    if (studio.playerType !== 'hls') params.set('player', studio.playerType);

    const qs = params.toString() ? '?' + params.toString() : '';
    const fullUrl = window.location.origin + path + qs;

    const urlDisplay = document.getElementById('display-stream-url');
    if (urlDisplay) urlDisplay.innerText = fullUrl;

    const embedInput = document.getElementById('display-embed-code');
    if (embedInput) {
      embedInput.value = `<iframe src="${fullUrl}" width="100%" height="100%" frameborder="0" allowfullscreen allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    }

    return fullUrl;
  };

  window.handleCatalogTypeChange = function (val) {
    studio.catalog = val;
    const idInput = document.getElementById('stream-id');
    if (idInput) {
      if (val === 'ani') {
        idInput.placeholder = 'e.g. 21 (One Piece) or 113415 (Jujutsu Kaisen)';
        if (idInput.value === 'one-piece-xamk74') idInput.value = '21';
      } else if (val === 'mal') {
        idInput.placeholder = 'e.g. 21 (One Piece MAL ID)';
      } else {
        idInput.placeholder = 'e.g. one-piece-21 or title query';
        if (idInput.value === '21') idInput.value = 'one-piece-21';
      }
    }
    window.refreshStreamRoute();
  };

  window.handlePlayerTypeChange = function (val) {
    studio.playerType = val;
    window.refreshStreamRoute();
  };

  window.mountActiveStream = function () {
    const fullUrl = window.refreshStreamRoute();
    const iframe = document.getElementById('live-iframe');
    if (iframe) {
      iframe.src = fullUrl;
    }
  };

  // --- Copy Actions ---
  window.copyStreamUrl = function () {
    const urlDisplay = document.getElementById('display-stream-url');
    const label = document.getElementById('copy-stream-label');
    if (!urlDisplay) return;

    navigator.clipboard.writeText(urlDisplay.innerText).then(() => {
      if (label) {
        label.innerText = 'Copied!';
        setTimeout(() => { label.innerText = 'Copy URL'; }, 2000);
      }
    }).catch(e => console.error('Copy failed:', e));
  };

  window.copyEmbedCode = function () {
    const embedInput = document.getElementById('display-embed-code');
    const label = document.getElementById('copy-embed-label');
    if (!embedInput) return;

    navigator.clipboard.writeText(embedInput.value).then(() => {
      if (label) {
        label.innerText = 'Copied!';
        setTimeout(() => { label.innerText = 'Copy Code'; }, 2000);
      }
    }).catch(e => console.error('Copy failed:', e));
  };

  window.copySnippet = function (snippetId, btnId) {
    const el = document.getElementById(snippetId);
    const btn = document.getElementById(btnId);
    if (!el) return;

    navigator.clipboard.writeText(el.innerText).then(() => {
      if (btn) {
        const orig = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => { btn.innerText = orig; }, 2000);
      }
    }).catch(e => console.error('Copy failed:', e));
  };

  // --- Catalog Presets & Filters ---
  window.mountAnimePreset = function (slugOrId, ep = 1, catalog = 'ani') {
    studio.catalog = catalog;
    studio.id = String(slugOrId);
    studio.ep = ep;

    // Sync radio selector
    document.querySelectorAll('input[name="catalog-type"]').forEach(r => {
      r.checked = (r.value === catalog);
    });

    const idInput = document.getElementById('stream-id');
    const epInput = document.getElementById('stream-ep');

    if (idInput) idInput.value = String(slugOrId);
    if (epInput) epInput.value = String(ep);

    window.mountActiveStream();

    const studioEl = document.getElementById('studio');
    if (studioEl) {
      studioEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.querySelectorAll('.anime-card').forEach(c => c.classList.remove('is-active-stream'));
    const activeCard = document.getElementById('card-' + slugOrId);
    if (activeCard) activeCard.classList.add('is-active-stream');
  };

  window.filterAnimeCards = function (category, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const cards = document.querySelectorAll('.anime-card');
    cards.forEach(c => {
      const cat = c.getAttribute('data-category') || '';
      if (category === 'all' || cat.includes(category)) {
        c.style.display = 'flex';
      } else {
        c.style.display = 'none';
      }
    });
  };

  // --- Live Catalog Search with 300ms Debounce ---
  let searchTimeout = null;
  window.handleSearchInput = function (val) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = val.trim();
      if (!query) {
        document.querySelectorAll('.anime-card').forEach(c => c.style.display = 'flex');
        return;
      }

      // Filter existing cards first
      let visibleCount = 0;
      document.querySelectorAll('.anime-card').forEach(c => {
        const title = (c.getAttribute('data-title') || '').toLowerCase();
        if (title.includes(query.toLowerCase())) {
          c.style.display = 'flex';
          visibleCount++;
        } else {
          c.style.display = 'none';
        }
      });

      // If fewer than 2 matches, query /api/search
      if (visibleCount < 2) {
        fetchLiveSearch(query);
      }
    }, 300);
  };

  async function fetchLiveSearch(query) {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&perPage=6`);
      if (!res.ok) return;
      const data = await res.json();
      const items = data.results || [];
      if (items.length === 0) return;

      const grid = document.getElementById('anime-grid');
      if (!grid) return;

      items.forEach(item => {
        const title = typeof item.title === 'object' ? (item.title.english || item.title.romaji) : String(item.title || 'Anime');
        const cover = item.cover || item.image || `https://placehold.co/600x340/15151b/f43f5e?text=${encodeURIComponent(title)}`;
        const aid = item.anilistId || item.id;

        if (document.getElementById('card-' + aid)) return;

        const card = document.createElement('div');
        card.className = 'anime-card';
        card.id = 'card-' + aid;
        card.setAttribute('data-category', 'all search');
        card.setAttribute('data-title', title);
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.onclick = () => window.mountAnimePreset(aid, 1, 'ani');
        card.onkeydown = (e) => { if (e.key === 'Enter') window.mountAnimePreset(aid, 1, 'ani'); };

        const scoreText = item.score ? `Score: ${item.score}%` : 'Score: 85%';

        card.innerHTML = `
          <div class="card-art">
            <img src="${cover}" alt="${title} cover art" loading="lazy" onerror="this.onerror=null; this.src='/static/covers/21.jpg'">
            <span class="card-tag">ANILIST #${aid}</span>
            <span class="card-res">1080P</span>
          </div>
          <div class="card-details">
            <h3 class="card-title">${title}</h3>
            <div class="card-subtext">
              <span>${item.format || 'TV'}</span>
              <span>&bull;</span>
              <span>${item.year || 2024}</span>
              <span>&bull;</span>
              <span class="card-score">${scoreText}</span>
            </div>
            <button class="mount-btn" type="button" aria-label="Mount ${title} stream">Mount Stream</button>
          </div>
        `;
        grid.prepend(card);
      });
    } catch (e) {
      console.warn('Live search fetch error:', e);
    }
  }

  // --- Docs Tabs ---
  window.switchDocsTab = function (tabKey, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));

    if (btn) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    }
    const pane = document.getElementById('pane-' + tabKey);
    if (pane) pane.classList.add('active');
  };

  // --- Telemetry Polling (Every 15s) ---
  window.pingTelemetry = function (isManual = false) {
    const nodes = [
      { card: 'card-n1', pill: 'pill-n1', lat: 'lat-n1', signal: 'signal-n1', host: 'host-n1', defLat: 45 },
      { card: 'card-n2', pill: 'pill-n2', lat: 'lat-n2', signal: 'signal-n2', host: 'host-n2', defLat: 40 },
      { card: 'card-n3', pill: 'pill-n3', lat: 'lat-n3', signal: 'signal-n3', host: 'host-n3', defLat: 15 },
    ];

    if (isManual) {
      nodes.forEach(n => {
        const lEl = document.getElementById(n.lat);
        if (lEl) lEl.innerText = '...';
      });
    }

    fetch('/api/health')
      .then(r => r.json())
      .then(d => {
        const servers = d.servers || [];

        nodes.forEach((n, idx) => {
          const srv = servers[idx];
          if (!srv) return;

          const cardEl = document.getElementById(n.card);
          const pillEl = document.getElementById(n.pill);
          const latEl = document.getElementById(n.lat);
          const signalEl = document.getElementById(n.signal);
          const hostEl = document.getElementById(n.host);

          if (hostEl && srv.host) {
            hostEl.innerText = srv.host;
          }

          const status = srv.status || 'online';
          const latVal = (srv.latencyMs !== null && srv.latencyMs !== undefined) ? srv.latencyMs : n.defLat;

          // Update card status class
          if (cardEl) {
            cardEl.className = `telemetry-card status-${status}`;
          }

          // Update status badge
          if (pillEl) {
            if (status === 'online') {
              pillEl.className = 'node-status-badge online';
              pillEl.innerHTML = '<span class="status-ping-dot"></span><span>Operational</span>';
            } else if (status === 'degraded') {
              pillEl.className = 'node-status-badge degraded';
              pillEl.innerHTML = '<span class="status-ping-dot degraded"></span><span>Degraded</span>';
            } else {
              pillEl.className = 'node-status-badge offline';
              pillEl.innerHTML = '<span class="status-ping-dot offline"></span><span>Offline</span>';
            }
          }

          // Update Latency Value & Color
          if (latEl) {
            latEl.innerText = latVal;
            latEl.className = 'latency-val' + (latVal > 200 ? ' red' : (latVal > 70 ? ' amber' : ''));
          }

          // Update Signal Bars
          if (signalEl) {
            const colorClass = latVal > 200 ? 'red' : (latVal > 70 ? 'amber' : 'green');
            const activeBars = latVal < 40 ? 4 : (latVal < 80 ? 3 : (latVal < 200 ? 2 : 1));
            signalEl.innerHTML = `
              <span class="signal-bar ${activeBars >= 1 ? 'active ' + colorClass : ''}"></span>
              <span class="signal-bar ${activeBars >= 2 ? 'active ' + colorClass : ''}"></span>
              <span class="signal-bar ${activeBars >= 3 ? 'active ' + colorClass : ''}"></span>
              <span class="signal-bar ${activeBars >= 4 ? 'active ' + colorClass : ''}"></span>
            `;
          }
        });
      })
      .catch((e) => {
        console.warn('Telemetry probe fetch failed:', e);
      });
  };

  // --- Modal Dialog Management ---
  window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // Focus close button for accessibility
    const closeBtn = modal.querySelector('.modal-close-btn') || modal.querySelector('.btn-secondary');
    if (closeBtn) closeBtn.focus();
  };

  window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  // Keyboard accessibility: Escape closes any open modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.is-open').forEach(m => {
        m.classList.remove('is-open');
      });
      document.body.style.overflow = '';
    }
  });

  // --- Cookie / Storage Consent Management ---
  window.acceptCookieConsent = function () {
    try {
      localStorage.setItem('animexo_consent', 'true');
    } catch (e) {
      console.warn('Storage consent write blocked:', e);
    }
    const banner = document.getElementById('cookie-banner');
    if (banner) banner.classList.remove('is-visible');
  };

  function checkCookieConsent() {
    try {
      const consent = localStorage.getItem('animexo_consent');
      if (!consent) {
        const banner = document.getElementById('cookie-banner');
        if (banner) banner.classList.add('is-visible');
      }
    } catch (e) {
      // Ignore if localStorage disabled
    }
  }

  // --- Global Initialization ---
  window.addEventListener('DOMContentLoaded', () => {
    window.mountActiveStream();
    window.pingTelemetry(false);
    setInterval(() => window.pingTelemetry(false), 30000);
    checkCookieConsent();
  });
})();
