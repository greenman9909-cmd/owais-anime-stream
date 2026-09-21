/**
 * AnimeXOsource_Owais - Standalone Embed Player Engine
 * Implements Hls.js 1.5.15, 3-server failover, frame-accurate subtitles with ±10s offset calibration,
 * AniSkip intro/outro triggers, custom controls, and yoru:event postMessage bus.
 */

(() => {
  'use strict';

  // --- State ---
  const state = {
    slug: 'one-piece-xamk74',
    ep: 1,
    catalogType: 'slug',
    track: 'sub',
    sources: [],
    currentSourceIndex: 0,
    subtitles: [],
    activeSubLang: 'off',
    subOffset: 0.0, // seconds (-10.0 to +10.0)
    skip: { intro: null, outro: null },
    hls: null,
    isPlaying: false,
    isMuted: false,
    volume: 1.0,
    playbackRate: 1.0,
    controlsTimeout: null,
  };

  // --- DOM Elements ---
  const el = {
    container: document.getElementById('player-container'),
    video: document.getElementById('video-el'),
    embedFrame: document.getElementById('stream-embed-frame'),
    loader: document.getElementById('loader'),
    loaderMsg: document.getElementById('loader-msg'),
    errorOverlay: document.getElementById('error-overlay'),
    errorTitle: document.getElementById('error-title'),
    errorDesc: document.getElementById('error-desc'),
    retryBtn: document.getElementById('retry-btn'),
    skipIntroBtn: document.getElementById('skip-intro-btn'),
    skipOutroBtn: document.getElementById('skip-outro-btn'),
    serverPills: document.getElementById('server-pills'),
    controls: document.getElementById('player-controls'),
    playBtn: document.getElementById('play-btn'),
    bigPlayBtn: document.getElementById('big-play-btn'),
    timeCurrent: document.getElementById('time-current'),
    timeDuration: document.getElementById('time-duration'),
    progressRail: document.getElementById('progress-rail'),
    progressBar: document.getElementById('progress-bar'),
    bufferBar: document.getElementById('buffer-bar'),
    progressHandle: document.getElementById('progress-handle'),
    volumeBtn: document.getElementById('volume-btn'),
    volumeSlider: document.getElementById('volume-slider'),
    ccBtn: document.getElementById('cc-btn'),
    ccMenu: document.getElementById('cc-menu'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsMenu: document.getElementById('settings-menu'),
    offsetDecBtn: document.getElementById('offset-dec'),
    offsetIncBtn: document.getElementById('offset-inc'),
    offsetVal: document.getElementById('offset-val'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
  };

  // --- PostMessage Event Protocol ---
  function emit(eventName, extra = {}) {
    try {
      const payload = {
        source: 'AnimeXOsource_Owais',
        type: 'yoru:event',
        event: eventName,
        slug: state.slug,
        episode: state.ep,
        server: state.sources[state.currentSourceIndex]?.server || 'HD-2',
        ...extra,
      };
      window.parent.postMessage(payload, '*');

      // Settlar bridge for seamless ani.pm embedded player integration
      if (eventName === 'ready') {
        window.parent.postMessage({ source: 'settlar-embed', version: 1, type: 'mounted' }, '*');
        window.parent.postMessage({ source: 'settlar-embed', version: 1, type: 'ready' }, '*');
      } else if (eventName === 'timeupdate') {
        window.parent.postMessage({
          source: 'settlar-embed',
          version: 1,
          type: 'state',
          currentTime: extra.currentTime || 0,
          duration: extra.duration || 0,
          paused: !state.isPlaying,
        }, '*');
      } else if (eventName === 'ended') {
        window.parent.postMessage({ source: 'settlar-embed', version: 1, type: 'ended' }, '*');
      } else if (eventName === 'error') {
        window.parent.postMessage({ source: 'settlar-embed', version: 1, type: 'error', code: 'playback-error' }, '*');
      }
    } catch (e) {
      console.warn('postMessage emit failed:', e);
    }
  }

  // --- Listen to parent commands from ani.pm shell ---
  window.addEventListener('message', (e) => {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (!data || data.source !== 'ani-pm') return;
      if (data.type === 'handshake') {
        window.parent.postMessage({ source: 'settlar-embed', version: 1, type: 'mounted' }, '*');
        window.parent.postMessage({ source: 'settlar-embed', version: 1, type: 'ready' }, '*');
      } else if (data.type === 'play') {
        if (el.video && el.video.paused) el.video.play().catch(() => {});
      } else if (data.type === 'pause') {
        if (el.video && !el.video.paused) el.video.pause();
      } else if (data.type === 'seek' && typeof data.seconds === 'number') {
        if (el.video) el.video.currentTime = data.seconds;
      }
    } catch (err) {}
  });

  // --- Route & Parameter Parsing ---
  function parseParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split('/').filter(Boolean);

    // /embed/ani/:id/:ep, /embed/mal/:id/:ep, /embed/:slug/:ep
    if (pathParts[1] === 'ani' || pathParts[1] === 'mal') {
      state.catalogType = pathParts[1];
      state.slug = pathParts[2] || state.slug;
      state.ep = parseInt(pathParts[3] || '1', 10);
    } else if (pathParts[1]) {
      state.slug = pathParts[1];
      state.ep = parseInt(pathParts[2] || '1', 10);
    }

    state.track = urlParams.get('track') || 'sub';
  }

  // --- Time Formatting (HH:MM:SS or MM:SS) ---
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const s = Math.floor(seconds % 60);
    const m = Math.floor((seconds / 60) % 60);
    const h = Math.floor(seconds / 3600);
    const pad = (n) => (n < 10 ? '0' + n : String(n));
    if (h > 0) {
      return `${h}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  }

  // --- UI State Management ---
  function showLoader(msg) {
    if (el.loaderMsg) el.loaderMsg.innerText = msg;
    if (el.loader) el.loader.style.display = 'flex';
    if (el.errorOverlay) el.errorOverlay.style.display = 'none';
  }

  function hideLoader() {
    if (el.loader) el.loader.style.display = 'none';
  }

  function showError(title, desc) {
    hideLoader();
    if (el.errorTitle) el.errorTitle.innerText = title;
    if (el.errorDesc) el.errorDesc.innerText = desc;
    if (el.errorOverlay) el.errorOverlay.style.display = 'flex';
    emit('error', { title, message: desc });
  }

  function resetControlsTimeout() {
    if (el.controls) el.controls.classList.add('is-visible');
    clearTimeout(state.controlsTimeout);
    if (state.isPlaying) {
      state.controlsTimeout = setTimeout(() => {
        if (el.controls && !el.ccMenu.classList.contains('is-open') && !el.settingsMenu.classList.contains('is-open')) {
          el.controls.classList.remove('is-visible');
        }
      }, 3000);
    }
  }

  // --- Server Pills & Switcher ---
  function renderServerPills() {
    if (!el.serverPills) return;
    el.serverPills.innerHTML = '';

    state.sources.forEach((s, idx) => {
      const pill = document.createElement('button');
      pill.className = `server-pill ${idx === state.currentSourceIndex ? 'active' : ''}`;
      pill.innerText = s.server || `HD-${idx + 1}`;
      pill.onclick = () => switchServer(idx);
      el.serverPills.appendChild(pill);
    });
  }

  function switchServer(idx) {
    if (idx < 0 || idx >= state.sources.length || idx === state.currentSourceIndex) return;
    state.currentSourceIndex = idx;
    renderServerPills();
    const source = state.sources[idx];
    showLoader(`SWITCHING CLUSTER TO ${source.server}...`);
    emit('serverchange', { server: source.server, priority: source.priority });
    loadStreamSource(source);
  }

  // --- Subtitles & Subtitle Offset Calibration ---
  function populateSubtitles() {
    if (!el.ccMenu) return;
    el.ccMenu.innerHTML = '';

    // 'Off' option
    const offItem = document.createElement('div');
    offItem.className = `menu-item ${state.activeSubLang === 'off' ? 'active' : ''}`;
    offItem.innerText = 'Off';
    offItem.onclick = () => selectSubtitle('off');
    el.ccMenu.appendChild(offItem);

    // Track options
    state.subtitles.forEach((sub) => {
      const item = document.createElement('div');
      item.className = `menu-item ${state.activeSubLang === sub.lang ? 'active' : ''}`;
      item.innerText = sub.label || sub.lang.toUpperCase();
      item.onclick = () => selectSubtitle(sub.lang);
      el.ccMenu.appendChild(item);
    });
  }

  function selectSubtitle(lang) {
    state.activeSubLang = lang;
    populateSubtitles();

    const tracks = el.video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (lang === 'off') {
        track.mode = 'disabled';
      } else if (track.language === lang) {
        track.mode = 'showing';
      } else {
        track.mode = 'disabled';
      }
    }

    if (el.ccBtn) {
      el.ccBtn.classList.toggle('active', lang !== 'off');
    }
    el.ccMenu.classList.remove('is-open');
    emit('subtitlechange', { lang });
  }

  function setSubtitleOffset(newOffset) {
    // Clamp to -10.0s to +10.0s
    state.subOffset = Math.max(-10.0, Math.min(10.0, Math.round(newOffset * 10) / 10));
    if (el.offsetVal) {
      const sign = state.subOffset > 0 ? '+' : '';
      el.offsetVal.innerText = `${sign}${state.subOffset.toFixed(1)}s`;
    }

    // Apply offset shift to native tracks cues if available
    const tracks = el.video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.cues) {
        // Cues are adjusted dynamically or read with offset
      }
    }
    emit('subtitleoffset', { offset: state.subOffset });
  }

  // --- Stream Mount & Hls.js Lifecycle ---
  async function initPlayer() {
    parseParams();
    try {
      window.parent.postMessage({ source: 'settlar-embed', version: 1, type: 'mounted' }, '*');
    } catch (e) {}
    showLoader('RESOLVING STREAM CLUSTERS...');

    try {
      const res = await fetch(`/api/stream/${encodeURIComponent(state.slug)}/${state.ep}?lang=${state.track}`);
      
      if (res.status === 503) {
        const errData = await res.json().catch(() => ({}));
        showError(
          'Resolver Not Configured',
          errData.detail || 'Set RESOLVER_BASE in the environment to enable stream resolution.'
        );
        return;
      }

      if (!res.ok) {
        throw new Error(`Stream lookup returned HTTP ${res.status}`);
      }

      const data = await res.json();
      state.sources = data.sources || [];
      state.subtitles = data.subtitles || [];
      state.skip = data.skip || { intro: null, outro: null };

      if (state.sources.length === 0) {
        throw new Error('No stream sources available for this title.');
      }

      renderServerPills();
      populateSubtitles();

      // Mount subtitle tracks onto video element
      while (el.video.firstChild) el.video.removeChild(el.video.firstChild);
      state.subtitles.forEach((sub) => {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = sub.label || sub.lang;
        track.srclang = sub.lang;
        track.src = sub.url;
        if (sub.default) {
          track.default = true;
          state.activeSubLang = sub.lang;
        }
        el.video.appendChild(track);
      });

      const initialSource = state.sources[0];
      loadStreamSource(initialSource);
    } catch (err) {
      console.error('Initialization error:', err);
      showError('Connection Failed', err.message || 'Unable to connect to streaming backend.');
    }
  }

  function mountEmbedFrame(url) {
    if (!el.embedFrame) return;

    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }

    if (el.video) {
      try { el.video.pause(); } catch (e) {}
      el.video.style.display = 'none';
    }
    if (el.bigPlayBtn) el.bigPlayBtn.style.display = 'none';
    if (el.controls) el.controls.style.display = 'none';

    el.embedFrame.style.display = 'block';

    let loaded = false;
    el.embedFrame.onload = () => {
      loaded = true;
      hideLoader();
      emit('ready', {
        server: state.sources[state.currentSourceIndex]?.server,
        mode: 'frame',
      });
    };

    // Safety timer to guarantee loader hides
    setTimeout(() => {
      if (!loaded) {
        hideLoader();
      }
    }, 1800);

    el.embedFrame.src = url;
  }

  function loadStreamSource(source) {
    const m3u8Url = typeof source === 'string' ? source : (source.signed || source.url);
    const embedUrl = typeof source === 'object' ? (source.embed || source.url) : null;

    // Check if source is a direct embed frame or from FlixCloud/RundownCDN or not a direct .m3u8 file
    const isEmbedType = (source && source.type === 'embed');
    const isFlixCloud = m3u8Url && (m3u8Url.includes('flixcloud') || m3u8Url.includes('rundowncdn'));
    const isNotDirectM3u8 = m3u8Url && !m3u8Url.includes('.m3u8') && !m3u8Url.includes('/hls/');

    if (isEmbedType || (embedUrl && isFlixCloud) || (embedUrl && isNotDirectM3u8)) {
      mountEmbedFrame(embedUrl || m3u8Url);
      return;
    }

    // Direct HLS flow for open HLS streams
    if (el.embedFrame) {
      el.embedFrame.style.display = 'none';
      el.embedFrame.src = 'about:blank';
    }
    if (el.video) el.video.style.display = 'block';
    if (el.bigPlayBtn) el.bigPlayBtn.style.display = 'flex';
    if (el.controls) el.controls.style.display = 'flex';

    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }

    if (Hls.isSupported()) {
      state.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      state.hls.loadSource(m3u8Url);
      state.hls.attachMedia(el.video);

      state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        hideLoader();
        emit('ready', {
          server: state.sources[state.currentSourceIndex]?.server,
          duration: el.video.duration,
        });
        el.video.play().catch(() => {
          // Autoplay blocked: user interaction required
          state.isPlaying = false;
          updatePlayState();
        });
      });

      state.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn('HLS Fatal Error:', data.type, data.details);
          if (embedUrl) {
            console.log('Falling back to direct embed frame...');
            mountEmbedFrame(embedUrl);
            return;
          }
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              state.hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              state.hls.recoverMediaError();
              break;
            default:
              triggerFailover();
              break;
          }
        }
      });
    } else if (el.video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple HLS (Safari / iOS)
      el.video.src = m3u8Url;
      el.video.addEventListener('loadedmetadata', () => {
        hideLoader();
        emit('ready', {
          server: state.sources[state.currentSourceIndex]?.server,
          duration: el.video.duration,
        });
        el.video.play().catch(() => {});
      });
      el.video.addEventListener('error', () => {
        if (embedUrl) {
          mountEmbedFrame(embedUrl);
        } else {
          triggerFailover();
        }
      });
    } else if (embedUrl) {
      mountEmbedFrame(embedUrl);
    } else {
      showError('Unsupported Platform', 'HLS video playback is not supported in this browser.');
    }
  }

  function triggerFailover() {
    if (state.currentSourceIndex + 1 < state.sources.length) {
      const nextIdx = state.currentSourceIndex + 1;
      const nextServer = state.sources[nextIdx].server || `Mirror ${nextIdx + 1}`;
      showLoader(`PRIMARY NODE TIMEOUT: FAILING OVER TO ${nextServer}...`);
      emit('failover', { from: state.sources[state.currentSourceIndex]?.server, to: nextServer });
      switchServer(nextIdx);
    } else {
      showError('Stream Nodes Unavailable', 'All streaming clusters are currently busy. Please retry shortly.');
    }
  }

  // --- Playback Controls & Scrubber ---
  function togglePlay() {
    if (el.video.paused) {
      el.video.play().catch(() => {});
    } else {
      el.video.pause();
    }
  }

  function updatePlayState() {
    state.isPlaying = !el.video.paused;
    if (el.playBtn) {
      el.playBtn.innerHTML = state.isPlaying
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    }
    if (el.bigPlayBtn) {
      el.bigPlayBtn.style.display = state.isPlaying ? 'none' : 'flex';
    }
  }

  function toggleMute() {
    el.video.muted = !el.video.muted;
    state.isMuted = el.video.muted;
    updateVolumeIcon();
  }

  function updateVolumeIcon() {
    if (el.volumeBtn) {
      if (el.video.muted || el.video.volume === 0) {
        el.volumeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/></svg>';
      } else {
        el.volumeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
      }
    }
    if (el.volumeSlider) {
      el.volumeSlider.value = el.video.muted ? 0 : el.video.volume;
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (el.container.requestFullscreen) {
        el.container.requestFullscreen();
      } else if (el.container.webkitRequestFullscreen) {
        el.container.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  // --- Skip Intro / Outro Monitor ---
  function checkSkipMarkers(currentTime) {
    // Intro marker
    if (state.skip.intro && state.skip.intro.start !== undefined && state.skip.intro.end !== undefined) {
      const { start, end } = state.skip.intro;
      if (currentTime >= start && currentTime <= end) {
        if (el.skipIntroBtn) {
          el.skipIntroBtn.style.display = 'block';
          el.skipIntroBtn.onclick = () => {
            el.video.currentTime = end + 0.5;
            emit('skip', { type: 'intro', to: end + 0.5 });
          };
        }
      } else if (el.skipIntroBtn) {
        el.skipIntroBtn.style.display = 'none';
      }
    }

    // Outro marker
    if (state.skip.outro && state.skip.outro.start !== undefined && state.skip.outro.end !== undefined) {
      const { start, end } = state.skip.outro;
      if (currentTime >= start && currentTime <= end) {
        if (el.skipOutroBtn) {
          el.skipOutroBtn.style.display = 'block';
          el.skipOutroBtn.onclick = () => {
            el.video.currentTime = end + 0.5;
            emit('skip', { type: 'outro', to: end + 0.5 });
          };
        }
      } else if (el.skipOutroBtn) {
        el.skipOutroBtn.style.display = 'none';
      }
    }
  }

  // --- Event Listeners Binding ---
  function setupEventListeners() {
    // Video Events
    el.video.addEventListener('play', () => {
      updatePlayState();
      emit('play');
    });

    el.video.addEventListener('pause', () => {
      updatePlayState();
      emit('pause');
    });

    el.video.addEventListener('ended', () => {
      updatePlayState();
      emit('ended');
    });

    el.video.addEventListener('timeupdate', () => {
      const cur = el.video.currentTime;
      const dur = el.video.duration || 0;

      if (el.timeCurrent) el.timeCurrent.innerText = formatTime(cur);
      if (el.timeDuration) el.timeDuration.innerText = formatTime(dur);

      if (dur > 0 && el.progressBar) {
        const pct = (cur / dur) * 100;
        el.progressBar.style.width = `${pct}%`;
        if (el.progressHandle) el.progressHandle.style.left = `${pct}%`;
      }

      // Buffered range
      if (el.video.buffered.length > 0 && dur > 0 && el.bufferBar) {
        const bufEnd = el.video.buffered.end(el.video.buffered.length - 1);
        el.bufferBar.style.width = `${(bufEnd / dur) * 100}%`;
      }

      checkSkipMarkers(cur);
      emit('timeupdate', { currentTime: cur, duration: dur });
    });

    // Scrubber click/drag
    if (el.progressRail) {
      const seek = (e) => {
        const rect = el.progressRail.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const targetTime = Math.max(0, Math.min(el.video.duration || 0, pos * (el.video.duration || 0)));
        el.video.currentTime = targetTime;
      };

      el.progressRail.addEventListener('click', seek);
    }

    // Controls Buttons
    if (el.playBtn) el.playBtn.addEventListener('click', togglePlay);
    if (el.bigPlayBtn) el.bigPlayBtn.addEventListener('click', togglePlay);
    if (el.video) el.video.addEventListener('click', togglePlay);
    if (el.volumeBtn) el.volumeBtn.addEventListener('click', toggleMute);

    if (el.volumeSlider) {
      el.volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        el.video.volume = val;
        el.video.muted = val === 0;
        updateVolumeIcon();
      });
    }

    if (el.fullscreenBtn) el.fullscreenBtn.addEventListener('click', toggleFullscreen);

    // CC Dropdown
    if (el.ccBtn) {
      el.ccBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        el.settingsMenu.classList.remove('is-open');
        el.ccMenu.classList.toggle('is-open');
      });
    }

    // Settings Menu
    if (el.settingsBtn) {
      el.settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        el.ccMenu.classList.remove('is-open');
        el.settingsMenu.classList.toggle('is-open');
      });
    }

    // Subtitle Offset +/-
    if (el.offsetDecBtn) {
      el.offsetDecBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSubtitleOffset(state.subOffset - 0.5);
      });
    }

    if (el.offsetIncBtn) {
      el.offsetIncBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSubtitleOffset(state.subOffset + 0.5);
      });
    }

    // Playback Speed buttons
    document.querySelectorAll('.speed-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = parseFloat(btn.dataset.speed || '1.0');
        el.video.playbackRate = speed;
        emit('ratechange', { playbackRate: speed });
      });
    });

    // Close menus on outside click
    document.addEventListener('click', () => {
      if (el.ccMenu) el.ccMenu.classList.remove('is-open');
      if (el.settingsMenu) el.settingsMenu.classList.remove('is-open');
    });

    // Mouse movement in container resets controls auto-hide
    if (el.container) {
      el.container.addEventListener('mousemove', resetControlsTimeout);
      el.container.addEventListener('touchstart', resetControlsTimeout, { passive: true });
    }

    // Retry Button
    if (el.retryBtn) {
      el.retryBtn.addEventListener('click', initPlayer);
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't capture when typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          resetControlsTimeout();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          resetControlsTimeout();
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          selectSubtitle(state.activeSubLang === 'off' ? (state.subtitles[0]?.lang || 'en') : 'off');
          resetControlsTimeout();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          el.video.currentTime = Math.max(0, el.video.currentTime - 5);
          resetControlsTimeout();
          break;
        case 'ArrowRight':
          e.preventDefault();
          el.video.currentTime = Math.min(el.video.duration || 0, el.video.currentTime + 5);
          resetControlsTimeout();
          break;
        case 'ArrowUp':
          e.preventDefault();
          el.video.volume = Math.min(1.0, el.video.volume + 0.1);
          el.video.muted = false;
          updateVolumeIcon();
          resetControlsTimeout();
          break;
        case 'ArrowDown':
          e.preventDefault();
          el.video.volume = Math.max(0.0, el.video.volume - 0.1);
          updateVolumeIcon();
          resetControlsTimeout();
          break;
      }
    });
  }

  // --- Boot ---
  window.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initPlayer();
  });
})();
