/**
 * AnimeXOsource_Owais - Studio Console & Platform Logic
 * Handles interactive stream mounting, catalog search with 300ms debouncing,
 * clipboard copying, radio parameter synchronization, 15s telemetry polling,
 * modal dialogs, local storage consent preferences, and bilingual Spanish/English localization.
 */

(() => {
  'use strict';

  // --- Localization Engine (Default: Spanish 'es') ---
  let currentLang = 'es';

  const translations = {
    es: {
      badge_opensource: 'CÓDIGO ABIERTO',
      nav_studio: 'Estudio',
      nav_catalog: 'Catálogo',
      nav_architecture: 'Arquitectura',
      nav_telemetry: 'Telemetría',
      nav_docs: 'Documentación',
      nav_status: '3 Nodos Activos',
      hero_tag: '<span>LISTO PARA CONMUTACIÓN</span> &bull; Cero Anuncios &bull; Subtítulos WebVTT &bull; Licencia MIT',
      hero_headline: 'Embeds de Video Anime<br>Limpios y de Alta Velocidad.',
      hero_sub: 'Un reproductor insertable y auto-alojado con conmutación automática por error en clúster de 3 nodos, marcadores de salto interactivos y resolución instantánea. Gratis y de código abierto para desarrolladores.',
      btn_studio: 'Iniciar Consola de Estudio',
      btn_docs: 'Documentación de API y SDK',
      mount_label: 'MONTAJE: ',
      copy_url: 'Copiar URL',
      copied: '¡Copiado!',
      stream_parameters: 'Parámetros de Transmisión',
      catalog_identifier: 'Identificador de Catálogo',
      slug_title: 'Slug / Título',
      playback_engine: 'Motor de Reproducción',
      hls_adaptive: 'HLS Adaptativo',
      direct_stream: 'Transmisión Directa',
      anime_id_label: 'ID de Anime o Slug',
      episode_label: 'Episodio',
      audio_track_label: 'Audio / Pista',
      subbed_option: 'Subtitulado (Original)',
      dubbed_option: 'Doblado (Inglés)',
      mount_stream_btn: 'Cargar Transmisión en el Reproductor',
      iframe_code_label: 'Código de Inserción Iframe',
      copy_code: 'Copiar Código',
      catalog_title: 'Manifiestos de Transmisión Verificados',
      catalog_subtitle: 'Títulos de referencia preconfigurados y verificados en los nodos del clúster. Seleccione cualquier título para cargarlo en el reproductor de vista previa.',
      catalog_search_placeholder: 'Buscar en el catálogo de anime...',
      filter_all: 'Todos los Lanzamientos',
      filter_trending: 'Tendencias',
      filter_action: 'Acción',
      filter_shonen: 'Shonen',
      filter_fantasy: 'Fantasía',
      card_mount_btn: 'Cargar Transmisión',
      score_prefix: 'Puntuación: ',
      arch_title: 'Arquitectura de Ingeniería',
      arch_subtitle: 'Resolución de transmisiones tolerante a fallos y proxy de borde diseñado para máxima fiabilidad.',
      arch_card1_title: 'Conmutación por Error en Clúster de 3 Servidores',
      arch_card1_desc: 'La conmutación automática en cascada entre los nodos perimetrales Sora, Neko y Zozo garantiza una entrega continua incluso ante caídas de proveedores regionales.',
      arch_card2_title: 'Subtítulos con Precisión de Cuadro',
      arch_card2_desc: 'Subtítulos sincronizados WebVTT y ASS con calibración de compensación personalizada (&plusmn;10s) renderizados en pistas de video HTML5 nativas.',
      arch_card3_title: 'Sincronización de Catálogo Dual',
      arch_card3_desc: 'Compatibilidad nativa para identificadores AniList y MyAnimeList con traducción automática de metadatos y mapeo de slugs.',
      arch_card4_title: 'Escudo de Tokens HMAC-SHA256',
      arch_card4_desc: 'Los orígenes del CDN y las URL de reproducción están firmadas con tokens criptográficos con expiración para evitar enlaces directos no autorizados.',
      arch_card5_title: 'Salto de Intro y Outro AniSkip',
      arch_card5_desc: 'Integración directa con la API de AniSkip que proporciona marcadores de tiempo para omitir intros y créditos automáticamente.',
      arch_card6_title: 'Bus de Eventos API PostMessage',
      arch_card6_desc: 'Protocolo de eventos bidireccional que emite eventos ready, play, pause, timeupdate y ended para una integración perfecta con aplicaciones web anfitrionas.',
      telemetry_title: 'Telemetría del Clúster',
      telemetry_subtitle: 'Estado en tiempo real de los nodos de entrega multimedia.',
      probe_btn: 'Sondear Ahora',
      status_operational: 'Operativo',
      status_degraded: 'Degradado',
      status_offline: 'Desconectado',
      round_trip_latency: 'Latencia de Ida y Vuelta',
      docs_title: 'Integración para Desarrolladores',
      docs_subtitle: 'Incruste transmisiones de video de AnimeXOsource_Owais en cualquier aplicación o portal web.',
      tab_iframe: 'Inserción Iframe',
      tab_react: 'React / Next.js',
      tab_api: 'API REST',
      tab_events: 'Eventos PostMessage',
      tab_selfhost: 'Auto-Alojamiento y Despliegue',
      modal_privacy_title: 'Política de Privacidad',
      modal_privacy_body: `
        <h4>1. Cero Recopilación de Datos Personales</h4>
        <p>AnimeXOsource_Owais es un proyecto de software de código abierto enfocado en la privacidad. No recopilamos, almacenamos, vendemos ni transmitimos ninguna información de identificación personal (PII), nombres, direcciones de correo electrónico, registros de IP ni historiales de visualización.</p>
        
        <h4>2. Almacenamiento Exclusivo en el Cliente</h4>
        <p>Este sitio web utiliza exclusivamente <code>localStorage</code> del navegador para recordar el volumen del reproductor, la preferencia de idioma de pista (subtitulado vs. doblado) y el estado del consentimiento. No se emplean cookies de rastreo de terceros ni balizas publicitarias.</p>

        <h4>3. Solicitudes de Metadatos a Terceros</h4>
        <p>Al buscar títulos o resolver manifiestos, las peticiones se transmiten a APIs públicas (como AniList GraphQL y AniSkip). Su interacción con dichos servicios está sujeta a las políticas de red estándar de sus proveedores.</p>

        <h4>4. Transparencia de Código Abierto</h4>
        <p>Todo el código fuente es públicamente auditable en GitHub. Es libre de inspeccionar el código o alojar su propia instancia privada de forma independiente.</p>
      `,
      modal_terms_title: 'Términos y Condiciones',
      modal_terms_body: `
        <h4>1. Licencia de Código Abierto</h4>
        <p>AnimeXOsource_Owais está licenciado bajo la Licencia MIT. El software se proporciona "tal cual", sin garantía de ningún tipo, expresa o implícita.</p>

        <h4>2. Aviso de No Alojamiento y Fines Educativos</h4>
        <p>AnimeXOsource_Owais no aloja, sube, almacena ni gestiona archivos de video o transmisiones multimedia protegidas por derechos de autor en sus servidores. El software opera únicamente como una prueba de concepto técnica para consulta de metadatos y manejo de protocolos HLS.</p>

        <h4>3. Contenido de Terceros y Marcas Registradas</h4>
        <p>Todos los títulos de anime, carátulas, nombres de personajes y marcas mostrados en el catálogo pertenecen a sus respectivos creadores y estudios de animación. Los metadatos se consultan desde la API pública de AniList bajo principios de uso legítimo.</p>

        <h4>4. Responsabilidad de Uso</h4>
        <p>Los usuarios y personas que auto-alojen el sistema son los únicos responsables de cumplir con las leyes y regulaciones locales sobre propiedad intelectual y streaming multimedia.</p>
      `,
      modal_refund_title: 'Política de Reembolso y No Comercial',
      modal_refund_body: `
        <h4>1. Software 100% Gratuito</h4>
        <p>AnimeXOsource_Owais es un proyecto de software libre sin fines comerciales. No vendemos suscripciones, membresías de usuario ni niveles premium, ni procesamos pagos comerciales de ningún tipo.</p>

        <h4>2. Sin Transacciones Monetarias</h4>
        <p>Dado que nunca se aceptan pagos ni datos de facturación en este servicio, las políticas y mecanismos de reembolso no son aplicables.</p>

        <h4>3. Advertencia contra Fraudes</h4>
        <p>Si algún sitio web o entidad externa intenta cobrarle por acceder a AnimeXOsource_Owais o afirma ser un representante de cobro oficial, tenga en cuenta que es un intento fraudulento y no autorizado.</p>
      `,
      modal_cookie_title: 'Política de Cookies y Almacenamiento Local',
      modal_cookie_body: `
        <h4>1. Cómo Utilizamos el Almacenamiento</h4>
        <p>No utilizamos cookies de seguimiento, píxeles de marketing ni perfiles de usuario. Empleamos únicamente el <code>localStorage</code> del navegador para preferencias técnicas estrictamente necesarias:</p>
        <ul style="margin-left: 1.25rem; margin-bottom: 0.85rem;">
          <li><strong>Volumen del Reproductor:</strong> Guarda el nivel de volumen entre reproducciones.</li>
          <li><strong>Preferencia de Audio:</strong> Recuerda la selección de pista (subtitulado o doblado).</li>
          <li><strong>Preferencia de Idioma:</strong> Guarda la selección de interfaz (Español / Inglés).</li>
          <li><strong>Confirmación de Aviso:</strong> Recuerda que ha descartado el aviso de consentimiento.</li>
        </ul>

        <h4>2. Control de su Almacenamiento</h4>
        <p>Puede borrar el almacenamiento local o los datos del navegador en cualquier momento desde los ajustes de su navegador web sin perjudicar la funcionalidad básica del reproductor.</p>
      `,
      modal_close_btn: 'Cerrar',
      cookie_text: `Esta plataforma de código abierto utiliza almacenamiento local estrictamente para preferencias esenciales del reproductor (volumen de audio e idioma). Cero cookies publicitarias o de rastreo. Consulte nuestra <a href="javascript:void(0)" onclick="openModal('modal-cookie')">Política de Cookies</a>.`,
      cookie_accept_btn: 'Aceptar',
      footer_privacy: 'Política de Privacidad',
      footer_terms: 'Términos de Servicio',
      footer_refund: 'Política de Reembolso',
      footer_cookie: 'Política de Cookies',
      footer_copy: 'AnimeXOsource_Owais &bull; Infraestructura de Embeds de Video Anime de Código Abierto &bull; Licencia MIT 2026',
      footer_meta: 'Plataforma de referencia para desarrolladores sin fines comerciales. Las transmisiones de video y metadatos se resuelven dinámicamente a través de APIs externas. Todas las marcas registradas y materiales protegidos pertenecen a sus respectivos propietarios.',
      placeholder_ani: 'ej. 21 (One Piece) o 113415 (Jujutsu Kaisen)',
      placeholder_mal: 'ej. 21 (One Piece MAL ID)',
      placeholder_slug: 'ej. one-piece-21 o título',
    },
    en: {
      badge_opensource: 'OPEN SOURCE',
      nav_studio: 'Studio',
      nav_catalog: 'Catalog',
      nav_architecture: 'Architecture',
      nav_telemetry: 'Telemetry',
      nav_docs: 'Docs',
      nav_status: '3 Nodes Active',
      hero_tag: '<span>FAILOVER READY</span> &bull; Zero Ads &bull; WebVTT Subtitles &bull; MIT License',
      hero_headline: 'High-Velocity, Clean<br>Anime Video Embeds.',
      hero_sub: 'A drop-in, self-hostable video player featuring automated 3-node cluster failover, frame-accurate skip markers, and instant stream resolution. Free and open-source for developers.',
      btn_studio: 'Launch Studio Console',
      btn_docs: 'API & SDK Documentation',
      mount_label: 'MOUNT: ',
      copy_url: 'Copy URL',
      copied: 'Copied!',
      stream_parameters: 'Stream Parameters',
      catalog_identifier: 'Catalog Identifier',
      slug_title: 'Slug / Title',
      playback_engine: 'Playback Engine',
      hls_adaptive: 'Adaptive HLS',
      direct_stream: 'Direct Stream',
      anime_id_label: 'Anime ID or Slug',
      episode_label: 'Episode',
      audio_track_label: 'Audio Track',
      subbed_option: 'Subbed (Original Audio)',
      dubbed_option: 'Dubbed (English Audio)',
      mount_stream_btn: 'Mount Stream to Player',
      iframe_code_label: 'Iframe Embed Code',
      copy_code: 'Copy Code',
      catalog_title: 'Verified Stream Manifests',
      catalog_subtitle: 'Pre-configured benchmark titles verified against cluster nodes. Select any title to load into the preview player.',
      catalog_search_placeholder: 'Search anime catalog...',
      filter_all: 'All Releases',
      filter_trending: 'Trending',
      filter_action: 'Action',
      filter_shonen: 'Shonen',
      filter_fantasy: 'Fantasy',
      card_mount_btn: 'Mount Stream',
      score_prefix: 'Score: ',
      arch_title: 'Engineered Architecture',
      arch_subtitle: 'Fault-tolerant stream resolution and edge proxying designed for reliability.',
      arch_card1_title: '3-Server Cluster Failover',
      arch_card1_desc: 'Automatic cascading between Sora, Neko, and Zozo edge nodes ensures continuous stream delivery even during regional upstream outages.',
      arch_card2_title: 'Frame-Accurate Subtitles',
      arch_card2_desc: 'Synchronized WebVTT and ASS subtitles with custom offset calibration (&plusmn;10s) rendered directly into HTML5 video cues.',
      arch_card3_title: 'Dual Catalog Sync',
      arch_card3_desc: 'Native support for both AniList and MyAnimeList IDs with automatic metadata translation and slug mapping.',
      arch_card4_title: 'HMAC-SHA256 Token Shield',
      arch_card4_desc: 'Upstream CDN origins and playback URLs are signed with time-expiring cryptographic tokens to prevent unauthorized hotlinking.',
      arch_card5_title: 'AniSkip Intro & Outro',
      arch_card5_desc: 'Direct AniSkip API integration providing timestamp markers to automatically skip openings and credits.',
      arch_card6_title: 'PostMessage API Event Bus',
      arch_card6_desc: 'Bidirectional event protocol emitting ready, play, pause, timeupdate, and ended events for smooth integration with host web applications.',
      telemetry_title: 'Cluster Telemetry',
      telemetry_subtitle: 'Real-time status across edge media delivery nodes.',
      probe_btn: 'Probe Now',
      status_operational: 'Operational',
      status_degraded: 'Degraded',
      status_offline: 'Offline',
      round_trip_latency: 'Round-Trip Latency',
      docs_title: 'Developer Integration',
      docs_subtitle: 'Embed AnimeXOsource_Owais video streams into any web application or portal.',
      tab_iframe: 'Iframe Embed',
      tab_react: 'React / Next.js',
      tab_api: 'REST API',
      tab_events: 'PostMessage Events',
      tab_selfhost: 'Self-Hosting & Deploy',
      modal_privacy_title: 'Privacy Policy',
      modal_privacy_body: `
        <h4>1. Zero Personal Data Collection</h4>
        <p>AnimeXOsource_Owais is a privacy-first, open-source software project. We do not collect, store, sell, or transmit any personally identifiable information (PII), names, email addresses, IP logs, or viewing histories.</p>
        
        <h4>2. Client-Side Storage Only</h4>
        <p>This website uses client-side <code>localStorage</code> strictly to remember your active player volume, track language preference (sub vs. dub), and consent status. No third-party tracking cookies, web beacons, or advertising trackers are used.</p>

        <h4>3. Upstream Metadata Requests</h4>
        <p>When searching for anime titles or resolving stream manifests, requests are proxied directly to public APIs (such as AniList GraphQL and AniSkip). Your interaction with these third-party endpoints is subject to their standard network policies.</p>

        <h4>4. Open Source Transparency</h4>
        <p>The entire source code is publicly auditable on GitHub. You are free to inspect network operations or host your own private instance.</p>
      `,
      modal_terms_title: 'Terms & Conditions',
      modal_terms_body: `
        <h4>1. Open Source License</h4>
        <p>AnimeXOsource_Owais is licensed under the MIT License. The software is provided "as is", without warranty of any kind, express or implied.</p>

        <h4>2. Non-Hosting & Educational Notice</h4>
        <p>AnimeXOsource_Owais does not host, upload, store, or manage any video files or copyrighted media streams on its servers. The software operates purely as an open-source technical proof-of-concept for metadata querying and HLS protocol handling.</p>

        <h4>3. Third-Party Content & Trademarks</h4>
        <p>All anime titles, artwork, character names, and trademarks displayed in catalog previews belong to their respective copyright owners and production studios. Metadata is retrieved from the community-driven AniList API under fair use principles.</p>

        <h4>4. Permitted Use</h4>
        <p>Users and self-hosters are solely responsible for compliance with their local regulations regarding media streaming and intellectual property laws.</p>
      `,
      modal_refund_title: 'Refund & Non-Commercial Policy',
      modal_refund_body: `
        <h4>1. 100% Free Software</h4>
        <p>AnimeXOsource_Owais is a completely free, non-commercial open-source project. We do not sell subscriptions, user memberships, or premium tiers, nor do we process commercial payments.</p>

        <h4>2. No Financial Transactions</h4>
        <p>Because no payments, billing information, or monetary transactions are ever accepted by this service, refund mechanisms do not apply.</p>

        <h4>3. Scam Warning</h4>
        <p>If any third-party website or entity attempts to charge you for access to AnimeXOsource_Owais or claims to be an authorized billing representative, be advised that they are fraudulent and unauthorized.</p>
      `,
      modal_cookie_title: 'Cookie & Local Storage Policy',
      modal_cookie_body: `
        <h4>1. How We Use Storage</h4>
        <p>We do not use tracking cookies, marketing pixels, or third-party profiling cookies. We exclusively use browser <code>localStorage</code> for strictly necessary technical preferences:</p>
        <ul style="margin-left: 1.25rem; margin-bottom: 0.85rem;">
          <li><strong>Player Volume:</strong> Saves your audio volume level between video changes.</li>
          <li><strong>Track Preference:</strong> Remembers your selection of subbed vs. dubbed audio.</li>
          <li><strong>Language Preference:</strong> Remembers your interface language selection (Spanish / English).</li>
          <li><strong>Consent Acknowledgment:</strong> Records that you have dismissed the notice banner.</li>
        </ul>

        <h4>2. Managing Your Storage</h4>
        <p>You can clear your browser's local storage or cookies at any time via your browser settings without affecting the functionality of the player.</p>
      `,
      modal_close_btn: 'Close',
      cookie_text: `This open-source platform uses local storage strictly for essential player settings (audio volume and track preferences). We use zero tracking or advertising cookies. Read our <a href="javascript:void(0)" onclick="openModal('modal-cookie')">Cookie Policy</a>.`,
      cookie_accept_btn: 'Acknowledge',
      footer_privacy: 'Privacy Policy',
      footer_terms: 'Terms of Service',
      footer_refund: 'Refund Policy',
      footer_cookie: 'Cookie Policy',
      footer_copy: 'AnimeXOsource_Owais &bull; Open-Source Anime Video Embed Infrastructure &bull; MIT License 2026',
      footer_meta: 'Non-commercial developer reference platform. Video streams and metadata are resolved dynamically via external APIs. All trademarks and copyrighted materials belong to their respective rights holders.',
      placeholder_ani: 'e.g. 21 (One Piece) or 113415 (Jujutsu Kaisen)',
      placeholder_mal: 'e.g. 21 (One Piece MAL ID)',
      placeholder_slug: 'e.g. one-piece-21 or title query',
    }
  };

  // --- Switch Language ---
  window.setLanguage = function (lang) {
    if (lang !== 'es' && lang !== 'en') lang = 'es';
    currentLang = lang;
    document.documentElement.lang = lang;

    try {
      localStorage.setItem('animexo_lang', lang);
    } catch (e) {
      console.warn('Unable to persist language in localStorage:', e);
    }

    // Toggle active state on switcher buttons
    const btnEs = document.getElementById('btn-lang-es');
    const btnEn = document.getElementById('btn-lang-en');
    if (btnEs) btnEs.classList.toggle('active', lang === 'es');
    if (btnEn) btnEn.classList.toggle('active', lang === 'en');

    const t = translations[lang] || translations.es;

    // Update all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key] !== undefined) {
        if (t[key].includes('<') || t[key].includes('&')) {
          el.innerHTML = t[key];
        } else {
          el.innerText = t[key];
        }
      }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (t[key] !== undefined) {
        el.placeholder = t[key];
      }
    });

    // Refresh dynamic studio placeholders
    window.handleCatalogTypeChange(studio.catalog);
  };

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
    const t = translations[currentLang] || translations.es;
    const idInput = document.getElementById('stream-id');
    if (idInput) {
      if (val === 'ani') {
        idInput.placeholder = t.placeholder_ani || 'ej. 21 (One Piece) o 113415 (Jujutsu Kaisen)';
        if (idInput.value === 'one-piece-xamk74') idInput.value = '21';
      } else if (val === 'mal') {
        idInput.placeholder = t.placeholder_mal || 'ej. 21 (One Piece MAL ID)';
      } else {
        idInput.placeholder = t.placeholder_slug || 'ej. one-piece-21 o título';
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
    const t = translations[currentLang] || translations.es;
    if (!urlDisplay) return;

    navigator.clipboard.writeText(urlDisplay.innerText).then(() => {
      if (label) {
        const orig = t.copy_url || 'Copiar URL';
        label.innerText = t.copied || '¡Copiado!';
        setTimeout(() => { label.innerText = orig; }, 2000);
      }
    }).catch(e => console.error('Copy failed:', e));
  };

  window.copyEmbedCode = function () {
    const embedInput = document.getElementById('display-embed-code');
    const label = document.getElementById('copy-embed-label');
    const t = translations[currentLang] || translations.es;
    if (!embedInput) return;

    navigator.clipboard.writeText(embedInput.value).then(() => {
      if (label) {
        const orig = t.copy_code || 'Copiar Código';
        label.innerText = t.copied || '¡Copiado!';
        setTimeout(() => { label.innerText = orig; }, 2000);
      }
    }).catch(e => console.error('Copy failed:', e));
  };

  window.copySnippet = function (snippetId, btnId) {
    const el = document.getElementById(snippetId);
    const btn = document.getElementById(btnId);
    const t = translations[currentLang] || translations.es;
    if (!el) return;

    navigator.clipboard.writeText(el.innerText).then(() => {
      if (btn) {
        const orig = t.copy_code || 'Copiar Código';
        btn.innerText = t.copied || '¡Copiado!';
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
      const t = translations[currentLang] || translations.es;

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

        const scorePrefix = t.score_prefix || 'Puntuación: ';
        const mountBtnText = t.card_mount_btn || 'Cargar Transmisión';
        const scoreText = item.score ? `${scorePrefix}${item.score}%` : `${scorePrefix}85%`;

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
            <button class="mount-btn" type="button" aria-label="Mount ${title} stream">${mountBtnText}</button>
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
        const t = translations[currentLang] || translations.es;

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
              pillEl.innerHTML = `<span class="status-ping-dot"></span><span>${t.status_operational || 'Operativo'}</span>`;
            } else if (status === 'degraded') {
              pillEl.className = 'node-status-badge degraded';
              pillEl.innerHTML = `<span class="status-ping-dot degraded"></span><span>${t.status_degraded || 'Degradado'}</span>`;
            } else {
              pillEl.className = 'node-status-badge offline';
              pillEl.innerHTML = `<span class="status-ping-dot offline"></span><span>${t.status_offline || 'Desconectado'}</span>`;
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
    // Default to Spanish ('es') unless the user previously explicitly chose another
    let initialLang = 'es';
    try {
      const saved = localStorage.getItem('animexo_lang');
      if (saved === 'en' || saved === 'es') {
        initialLang = saved;
      }
    } catch (e) {}

    window.setLanguage(initialLang);
    window.mountActiveStream();
    window.pingTelemetry(false);
    setInterval(() => window.pingTelemetry(false), 15000);
    checkCookieConsent();
  });
})();
