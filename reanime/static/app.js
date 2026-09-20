/**
 * AnimeXOsource_Owais - Studio Console & Platform Logic
 */

function refreshStreamRoute() {
  const catalog = document.getElementById('stream-catalog').value;
  const id = document.getElementById('stream-id').value.trim() || 'one-piece-xamk74';
  const ep = document.getElementById('stream-ep').value.trim() || '1';
  const track = document.getElementById('stream-track').value;

  let path;
  if (catalog === 'ani') {
    path = `/embed/ani/${id}/${ep}`;
  } else if (catalog === 'mal') {
    path = `/embed/mal/${id}/${ep}`;
  } else {
    path = `/embed/${id}/${ep}`;
  }

  const params = new URLSearchParams();
  if (track !== 'sub') params.set('track', track);

  const qs = params.toString() ? '?' + params.toString() : '';
  const fullUrl = window.location.origin + path + qs;

  const urlDisplay = document.getElementById('display-stream-url');
  if (urlDisplay) urlDisplay.innerText = fullUrl;

  const embedInput = document.getElementById('display-embed-code');
  if (embedInput) {
    embedInput.value = `<iframe src="${fullUrl}" width="100%" height="100%" frameborder="0" allowfullscreen allow="autoplay; fullscreen; picture-in-picture"></iframe>`;
  }

  return fullUrl;
}

function mountActiveStream() {
  const fullUrl = refreshStreamRoute();
  const iframe = document.getElementById('live-iframe');
  if (iframe) {
    iframe.src = fullUrl;
  }
}

function copyStreamUrl() {
  const urlDisplay = document.getElementById('display-stream-url');
  const label = document.getElementById('copy-stream-label');
  if (!urlDisplay) return;

  navigator.clipboard.writeText(urlDisplay.innerText).then(() => {
    if (label) {
      label.innerText = 'Copied!';
      setTimeout(() => { label.innerText = 'Copy URL'; }, 2000);
    }
  }).catch(e => console.error('Copy failed:', e));
}

function copyEmbedCode() {
  const embedInput = document.getElementById('display-embed-code');
  const label = document.getElementById('copy-embed-label');
  if (!embedInput) return;

  navigator.clipboard.writeText(embedInput.value).then(() => {
    if (label) {
      label.innerText = 'Copied!';
      setTimeout(() => { label.innerText = 'Copy Embed Code'; }, 2000);
    }
  }).catch(e => console.error('Copy failed:', e));
}

function copySnippet(snippetId, btnId) {
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
}

function mountAnimePreset(slugOrId, ep = 1, catalog = 'slug') {
  const catInput = document.getElementById('stream-catalog');
  const idInput = document.getElementById('stream-id');
  const epInput = document.getElementById('stream-ep');

  if (catInput) catInput.value = catalog;
  if (idInput) idInput.value = String(slugOrId);
  if (epInput) epInput.value = String(ep);

  mountActiveStream();

  const studioEl = document.getElementById('studio');
  if (studioEl) {
    studioEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.querySelectorAll('.anime-card').forEach(c => c.classList.remove('is-active-stream'));
  const activeCard = document.getElementById('card-' + slugOrId);
  if (activeCard) activeCard.classList.add('is-active-stream');
}

function filterAnimeCards(category, btn) {
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
}

let searchTimeout = null;
function handleSearchInput(val) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = val.trim();
    if (!query) {
      document.querySelectorAll('.anime-card').forEach(c => c.style.display = 'flex');
      return;
    }

    // Filter local cards first
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

    // If fewer than 2 matches, query live API
    if (visibleCount < 2) {
      fetchLiveSearch(query);
    }
  }, 350);
}

async function fetchLiveSearch(query) {
  try {
    const res = await fetch(`/api/anime?q=${encodeURIComponent(query)}&perPage=6`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return;

    const grid = document.getElementById('anime-grid');
    if (!grid) return;

    data.results.forEach(item => {
      if (document.getElementById('card-' + item.slug)) return;

      const card = document.createElement('div');
      card.className = 'anime-card';
      card.id = 'card-' + item.slug;
      card.setAttribute('data-category', 'all search');
      card.setAttribute('data-title', item.title);
      card.onclick = () => mountAnimePreset(item.slug, 1, 'slug');

      card.innerHTML = `
        <div class="card-thumb">
          <img src="${item.image || 'https://placehold.co/600x340/15151b/f43f5e?text=' + encodeURIComponent(item.title)}" alt="${item.title}" loading="lazy">
          <span class="card-badge">LIVE QUERY</span>
          <span class="card-res">1080P</span>
        </div>
        <div class="card-body">
          <h4 class="card-title">${item.title}</h4>
          <div class="card-meta">
            <span>${item.studio || 'Studio'}</span>
            <span>·</span>
            <span>${item.year || 2024}</span>
            <span>·</span>
            <span class="card-rating">★ ${item.rating || '8.5'}</span>
          </div>
          <button class="card-btn" type="button">Mount Stream ↗</button>
        </div>
      `;
      grid.prepend(card);
    });
  } catch (e) {
    console.warn('Live search fetch error:', e);
  }
}

function switchDocsTab(tabKey, btn) {
  document.querySelectorAll('.docs-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.docs-pane').forEach(p => p.classList.remove('active'));

  if (btn) btn.classList.add('active');
  const pane = document.getElementById('pane-' + tabKey);
  if (pane) pane.classList.add('active');
}

function pingTelemetry(isManual = false) {
  const p1 = document.getElementById('pill-n1');
  const p2 = document.getElementById('pill-n2');
  const p3 = document.getElementById('pill-n3');
  const l1 = document.getElementById('lat-n1');
  const l2 = document.getElementById('lat-n2');
  const l3 = document.getElementById('lat-n3');

  if (isManual) {
    if (l1) l1.innerText = 'Probing...';
    if (l2) l2.innerText = 'Probing...';
    if (l3) l3.innerText = 'Probing...';
  }

  fetch('/api/health?fresh=1')
    .then(r => r.json())
    .then(d => {
      const servers = d.servers || [
        { id: 1, name: 'Sora Edge', status: 'operational', latencyMs: 24 },
        { id: 2, name: 'Neko CDN', status: 'operational', latencyMs: 38 },
        { id: 3, name: 'Zozo Edge', status: 'operational', latencyMs: 52 }
      ];

      function update(srv, pill, lat) {
        if (!pill || !lat || !srv) return;
        pill.innerText = srv.status === 'operational' ? 'Operational' : 'Degraded';
        pill.style.color = srv.status === 'operational' ? '#22c55e' : '#f59e0b';
        lat.innerText = srv.latencyMs ? `${srv.latencyMs}ms` : 'Fast';
      }

      update(servers.find(s => s.id === 1) || servers[0], p1, l1);
      update(servers.find(s => s.id === 2) || servers[1], p2, l2);
      update(servers.find(s => s.id === 3) || servers[2], p3, l3);
    })
    .catch(() => {
      if (l1) l1.innerText = '24ms';
      if (l2) l2.innerText = '32ms';
      if (l3) l3.innerText = '64ms';
    });
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  mountActiveStream();
  pingTelemetry(false);
  setInterval(() => pingTelemetry(false), 30000);
});
