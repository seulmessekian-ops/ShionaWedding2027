/* ============================================================================
   Shant & Siona — interactions
   Vanilla JS. Mapbox GL JS + Turf load from CDN for the journey map.
   Progressive: the page is fully readable even if the map fails to load.
   ========================================================================== */
(function () {
  'use strict';

  var body = document.body;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------- LANGUAGE TOGGLE */
  var STORE_KEY = 'ss-lang';
  var langToggle = document.getElementById('langToggle');
  var langLabel = document.getElementById('langLabel');

  function getStored() { try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; } }
  function setStored(v) { try { localStorage.setItem(STORE_KEY, v); } catch (e) {} }

  function applyLang(lang) {
    lang = lang === 'hy' ? 'hy' : 'en';
    body.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', lang);
    var nodes = document.querySelectorAll('[data-en]');
    for (var i = 0; i < nodes.length; i++) {
      var v = lang === 'hy' ? nodes[i].getAttribute('data-hy') : nodes[i].getAttribute('data-en');
      if (v !== null) nodes[i].textContent = v;
    }
    var ph = document.querySelectorAll('[data-en-ph]');
    for (var j = 0; j < ph.length; j++) {
      var pv = lang === 'hy' ? ph[j].getAttribute('data-hy-ph') : ph[j].getAttribute('data-en-ph');
      if (pv !== null) ph[j].setAttribute('placeholder', pv);
    }
    if (langLabel) langLabel.textContent = lang === 'hy' ? 'ENG' : 'ՀԱՅ';
    if (langToggle) langToggle.setAttribute('aria-label', lang === 'hy' ? 'Switch to English' : 'Անցնել հայերենի (switch to Armenian)');
  }
  applyLang(getStored() || 'en');
  if (langToggle) langToggle.addEventListener('click', function () {
    var next = body.getAttribute('data-lang') === 'hy' ? 'en' : 'hy';
    applyLang(next); setStored(next);
  });

  /* ----------------------------------------------------------- COUNTDOWN */
  // Wedding day: 7 July 2027, 13:00, Armenia time (UTC+4, no DST).
  var TARGET = new Date('2027-07-07T13:00:00+04:00').getTime();
  var cd = {
    days: document.querySelector('[data-cd="days"]'),
    hours: document.querySelector('[data-cd="hours"]'),
    mins: document.querySelector('[data-cd="mins"]'),
    secs: document.querySelector('[data-cd="secs"]')
  };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tick() {
    if (!cd.days) return;
    var diff = TARGET - Date.now(); if (diff < 0) diff = 0;
    var s = Math.floor(diff / 1000);
    cd.days.textContent = pad(Math.floor(s / 86400));
    cd.hours.textContent = pad(Math.floor((s % 86400) / 3600));
    cd.mins.textContent = pad(Math.floor((s % 3600) / 60));
    cd.secs.textContent = pad(s % 60);
  }
  tick(); setInterval(tick, 1000);

  /* --------------------------------------------- HEADER STATE + PROGRESS */
  var header = document.getElementById('siteHeader');
  var progress = document.getElementById('progressBar');

  /* --------------------------------------------------------- MOBILE MENU */
  var menuBtn = document.getElementById('menuBtn');
  var navLinks = document.getElementById('navLinks');
  function setMenu(open) {
    if (!navLinks || !menuBtn) return;
    navLinks.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    var use = menuBtn.querySelector('use');
    if (use) use.setAttribute('href', open ? '#i-close' : '#i-menu');
  }
  if (menuBtn) menuBtn.addEventListener('click', function () {
    setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
  });
  if (navLinks) navLinks.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 780) setMenu(false); });

  /* ------------------------------------------------------- SCROLL REVEAL */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ===================================================== JOURNEY MAP =====
     Scroll-driven Mapbox map of Armenia. As the guest scrolls through the
     pinned section, the camera moves between the four locations and the
     route line draws on. Falls back to a static map when motion is reduced,
     Mapbox is unavailable, or no access token is set. */

  // Mapbox token: set in assets/config.js (see README). Not committed to git.
  var MAPBOX_TOKEN = '';

  var JOURNEY_STOPS = [
    { id: 'yerevan', lng: 44.4939, lat: 40.1553, zoom: 9, labelEn: 'Yerevan', labelHy: 'Երևան' },
    { id: 'goris',   lng: 46.3380, lat: 39.5110, zoom: 10, labelEn: 'Goris',   labelHy: 'Գորիս' },
    { id: 'tatev',   lng: 46.2503, lat: 39.3793, zoom: 11, labelEn: 'Tatev',   labelHy: 'Տաթև' },
    { id: 'sisian',  lng: 46.0350, lat: 39.5210, zoom: 10, labelEn: 'Sisian',  labelHy: 'Սիսիան' }
  ];

  // Scroll budget per leg (more time on short Goris/Tatev winding segments).
  var SCROLL_LEG_BREAKS = [0, 0.65, 0.82, 1.0];
  // Continuous zoom keyframes at each stop (no step jumps at leg boundaries).
  var ZOOM_AT_STOP = [9.0, 7.0, 8.8, 10.0];
  var CENTER_SMOOTH = 0.10;
  var ZOOM_SMOOTH = 0.06;
  var LINE_SMOOTH = 0.18;

  var journey = document.getElementById('journey');
  var jScroll = document.getElementById('journeyScroll');
  var jStage = document.getElementById('journeyStage');
  var mapEl = document.getElementById('armeniaMap');
  var mapFallback = document.getElementById('mapFallback');
  var mapAriaLive = document.getElementById('mapAriaLive');
  var jCards = document.querySelectorAll('#journeyCards .j-card');
  var jSteps = document.querySelectorAll('#journeySteps .js-step');

  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function smoothAlpha(rate, deltaMs) {
    return 1 - Math.pow(1 - rate, deltaMs / 16.67);
  }
  function stopLabel(idx) {
    var s = JOURNEY_STOPS[idx];
    if (!s) return '';
    return body.getAttribute('data-lang') === 'hy' ? s.labelHy : s.labelEn;
  }

  var map = null;
  var mapReady = false;
  var mapMarkers = [];
  var routeFeature = null;
  var routeLengthKm = 0;
  var routeStopProgress = [];
  var journeyInView = true;
  var viewState = { lng: 0, lat: 0, zoom: 9, lineProg: 0, initialized: false };
  var journeyLoopRunning = false;
  var lastFrameMs = 0;

  var interactive = journey && jScroll && jStage && mapEl && !reduceMotion &&
    'IntersectionObserver' in window;

  function getMapToken() {
    if (window.MAPBOX_CONFIG && window.MAPBOX_CONFIG.token) return window.MAPBOX_CONFIG.token;
    if (MAPBOX_TOKEN) return MAPBOX_TOKEN;
    var meta = document.querySelector('meta[name="mapbox-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  var FALLBACK_MSG = {
    'no-token': {
      en: 'Add your Mapbox access token in assets/script.js (see README §3).',
      hy: 'Ավելացրեք Mapbox token-ը assets/script.js-ում (տես README §3)։'
    },
    'no-mapbox': {
      en: 'Mapbox could not load — check your connection or disable ad blockers for this page.',
      hy: 'Mapbox-ը բեռնվել չէ — ստուգեք կապը կամ անջատեք ad blocker-ը այս էջի համար։'
    },
    'file-protocol': {
      en: 'Open via a local server, not the HTML file directly. Run: python3 -m http.server 5050 — then visit http://localhost:5050',
      hy: 'Բացեք տեղային server-ով, ոչ թե HTML ֆայլը ուղղակի։ Գործարկեք՝ python3 -m http.server 5050 — ապա http://localhost:5050'
    },
    'route-failed': {
      en: 'Map loaded, but the route line could not be fetched. Ensure assets/route.geojson is served over http/https.',
      hy: 'Քարտեզը բեռնվել է, բայց երթուղին չի բեռնվել։ Ստուգեք, որ assets/route.geojson-ը հասանելի է server-ով։'
    },
    'auth-failed': {
      en: 'Mapbox rejected the access token (401/403). Check the token in script.js and URL restrictions in your Mapbox dashboard (allow http://localhost:* for local preview).',
      hy: 'Mapbox-ը մերժել է token-ը (401/403)։ Ստուգեք script.js-ի token-ը և Mapbox dashboard-ի URL restrictions-ը (localhost-ի համար թույլ տվեք http://localhost:*)։'
    },
    'webgl-failed': {
      en: 'Could not start the map — WebGL may be disabled in your browser.',
      hy: 'Քարտեզը չի սկսվել — WebGL-ը կարող է անջատված լինել ձեր browser-ում։'
    }
  };

  function showMapFallback(reason, fatal) {
    if (fatal === undefined) fatal = reason !== 'route-failed';
    var lang = body.getAttribute('data-lang') === 'hy' ? 'hy' : 'en';
    var msg = FALLBACK_MSG[reason];
    if (mapFallback) {
      mapFallback.textContent = msg ? msg[lang] : FALLBACK_MSG['no-token'][lang];
      mapFallback.classList.toggle('is-warning', reason === 'route-failed');
      mapFallback.hidden = false;
    }
    if (fatal && mapEl) mapEl.hidden = true;
  }

  function hideMapFallback() {
    if (mapFallback) {
      mapFallback.hidden = true;
      mapFallback.classList.remove('is-warning');
    }
    if (mapEl) mapEl.hidden = false;
  }

  function createMarkerEl(stop, index) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'map-marker';
    el.setAttribute('data-stop', String(index));
    el.setAttribute('aria-label', stop.labelEn);
    el.innerHTML =
      '<span class="map-marker-halo" aria-hidden="true"></span>' +
      '<span class="map-marker-dot" aria-hidden="true"></span>' +
      '<span class="map-marker-num" aria-hidden="true">' + (index < 9 ? '0' : '') + (index + 1) + '</span>' +
      '<span class="map-marker-label" data-en="' + stop.labelEn + '" data-hy="' + stop.labelHy + '">' + stop.labelEn + '</span>';
    return el;
  }

  function fitAllStops() {
    if (!map || !mapReady) return;
    var bounds = new mapboxgl.LngLatBounds();
    for (var i = 0; i < JOURNEY_STOPS.length; i++) {
      bounds.extend([JOURNEY_STOPS[i].lng, JOURNEY_STOPS[i].lat]);
    }
    map.fitBounds(bounds, { padding: 48, duration: 0, maxZoom: 8.5 });
  }

  function computeRouteStopProgress() {
    var N = JOURNEY_STOPS.length;
    routeStopProgress = [];
    if (!routeFeature || !window.turf || routeLengthKm <= 0) {
      for (var f = 0; f < N; f++) routeStopProgress.push(f / (N - 1));
      return;
    }
    for (var si = 0; si < N; si++) {
      var pt = turf.point([JOURNEY_STOPS[si].lng, JOURNEY_STOPS[si].lat]);
      var snapped = turf.nearestPointOnLine(routeFeature, pt);
      routeStopProgress.push(snapped.properties.location / routeLengthKm);
    }
    routeStopProgress[0] = 0;
    routeStopProgress[N - 1] = 1;
    for (var m = 1; m < N; m++) {
      if (routeStopProgress[m] <= routeStopProgress[m - 1]) {
        routeStopProgress[m] = Math.min(1, routeStopProgress[m - 1] + 0.001);
      }
    }
    routeStopProgress[N - 1] = 1;
  }

  function routePointAtProg(prog) {
    if (!routeFeature || !window.turf || routeLengthKm <= 0) return null;
    prog = Math.max(0, Math.min(1, prog));
    return turf.along(routeFeature, routeLengthKm * prog, { units: 'kilometers' });
  }

  function scrollLegFromProg(prog) {
    var N = JOURNEY_STOPS.length;
    var idx = prog * (N - 1);
    var i = Math.floor(idx);
    var t = idx - i;
    if (i >= N - 1) { i = N - 2; t = 1; }
    return { i: i, t: t, e: smooth(t) };
  }

  function legFromRouteProg(prog) {
    if (!routeStopProgress.length) return scrollLegFromProg(prog);
    var N = JOURNEY_STOPS.length;
    prog = Math.max(0, Math.min(1, prog));
    if (prog >= 1) return { i: N - 2, t: 1, e: 1 };
    for (var i = 0; i < N - 1; i++) {
      if (prog < routeStopProgress[i + 1] || i === N - 2) {
        var span = routeStopProgress[i + 1] - routeStopProgress[i];
        var t = span > 0 ? (prog - routeStopProgress[i]) / span : 0;
        t = Math.max(0, Math.min(1, t));
        return { i: i, t: t, e: smooth(t) };
      }
    }
    return { i: 0, t: 0, e: 0 };
  }

  function activeStopFromProg(prog) {
    var N = JOURNEY_STOPS.length;
    if (!routeStopProgress.length) return Math.round(prog * (N - 1));
    prog = Math.max(0, Math.min(1, prog));
    if (prog >= routeStopProgress[N - 1]) return N - 1;
    for (var i = 0; i < N - 1; i++) {
      if (prog < routeStopProgress[i + 1]) return i;
    }
    return N - 1;
  }

  function scrollToLineProgress(scrollProg) {
    var N = JOURNEY_STOPS.length;
    scrollProg = Math.max(0, Math.min(1, scrollProg));
    if (!routeStopProgress.length) return scrollProg;
    if (scrollProg >= 1) return 1;
    for (var i = 0; i < N - 1; i++) {
      if (scrollProg <= SCROLL_LEG_BREAKS[i + 1] || i === N - 2) {
        var scrollSpan = SCROLL_LEG_BREAKS[i + 1] - SCROLL_LEG_BREAKS[i];
        var t = scrollSpan > 0 ? (scrollProg - SCROLL_LEG_BREAKS[i]) / scrollSpan : 0;
        t = Math.max(0, Math.min(1, smooth(t)));
        return lerp(routeStopProgress[i], routeStopProgress[i + 1], t);
      }
    }
    return 1;
  }

  function scrollProgForLineProgress(lineProg) {
    var N = JOURNEY_STOPS.length;
    lineProg = Math.max(0, Math.min(1, lineProg));
    if (!routeStopProgress.length) return lineProg;
    if (lineProg >= 1) return 1;
    for (var i = 0; i < N - 1; i++) {
      if (lineProg <= routeStopProgress[i + 1] || i === N - 2) {
        var lineSpan = routeStopProgress[i + 1] - routeStopProgress[i];
        var scrollSpan = SCROLL_LEG_BREAKS[i + 1] - SCROLL_LEG_BREAKS[i];
        var t = lineSpan > 0 ? (lineProg - routeStopProgress[i]) / lineSpan : 0;
        t = Math.max(0, Math.min(1, t));
        return SCROLL_LEG_BREAKS[i] + t * scrollSpan;
      }
    }
    return 1;
  }

  function zoomForLineProgress(lineProg) {
    var N = JOURNEY_STOPS.length;
    lineProg = Math.max(0, Math.min(1, lineProg));
    if (!routeStopProgress.length) {
      var leg = scrollLegFromProg(lineProg);
      return lerp(JOURNEY_STOPS[leg.i].zoom, JOURNEY_STOPS[leg.i + 1].zoom, leg.e);
    }
    if (lineProg >= 1) return ZOOM_AT_STOP[N - 1];
    for (var i = 0; i < N - 1; i++) {
      if (lineProg <= routeStopProgress[i + 1] || i === N - 2) {
        var span = routeStopProgress[i + 1] - routeStopProgress[i];
        var t = span > 0 ? (lineProg - routeStopProgress[i]) / span : 0;
        t = Math.max(0, Math.min(1, smooth(t)));
        return lerp(ZOOM_AT_STOP[i], ZOOM_AT_STOP[i + 1], t);
      }
    }
    return ZOOM_AT_STOP[N - 1];
  }

  function computeJourneyTargets(scrollProg) {
    var lineProg = scrollToLineProgress(scrollProg);
    var leg = legFromRouteProg(lineProg);
    var a = JOURNEY_STOPS[leg.i], b = JOURNEY_STOPS[leg.i + 1], e = leg.e;
    var routePt = routePointAtProg(lineProg);
    var targetLng = routePt ? routePt.geometry.coordinates[0] : lerp(a.lng, b.lng, e);
    var targetLat = routePt ? routePt.geometry.coordinates[1] : lerp(a.lat, b.lat, e);
    var targetZoom = zoomForLineProgress(lineProg);
    return {
      lineProg: lineProg,
      targetLng: targetLng,
      targetLat: targetLat,
      targetZoom: targetZoom,
      activeIdx: activeStopFromProg(lineProg)
    };
  }

  function setRouteProgress(progress) {
    if (!map || !mapReady || !map.getLayer('route-active')) return;
    progress = Math.max(0, Math.min(1, progress));
    map.setPaintProperty('route-active', 'line-gradient', [
      'step', ['line-progress'],
      '#c2a14d', progress,
      'rgba(0,0,0,0)'
    ]);
    var showTraveler = progress >= 0.02;
    if (map.getLayer('traveler')) {
      map.setPaintProperty('traveler', 'circle-opacity', showTraveler ? 0.95 : 0);
      map.setPaintProperty('traveler', 'circle-stroke-opacity', showTraveler ? 1 : 0);
    }
    var pt = routePointAtProg(progress);
    if (pt && map.getSource('traveler')) {
      map.getSource('traveler').setData(pt);
    }
  }

  function addMapMarkers() {
    for (var m = 0; m < JOURNEY_STOPS.length; m++) {
      var el = createMarkerEl(JOURNEY_STOPS[m], m);
      new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([JOURNEY_STOPS[m].lng, JOURNEY_STOPS[m].lat])
        .addTo(map);
      mapMarkers.push({ el: el });
    }
  }

  function finishMapSetup() {
    if (mapMarkers.length === 0) addMapMarkers();
    mapReady = true;
    hideMapFallback();
    map.resize();
    requestAnimationFrame(function () {
      if (map) map.resize();
      if (reduceMotion || !interactive) {
        fitAllStops();
        setRouteProgress(1);
        for (var mk = 0; mk < mapMarkers.length; mk++) {
          mapMarkers[mk].el.classList.add('is-active');
        }
      } else {
        render();
        startJourneyLoop();
      }
    });
  }

  function addRouteLayers(geojson) {
    routeFeature = geojson.features[0];
    if (window.turf) routeLengthKm = turf.length(routeFeature, { units: 'kilometers' });
    computeRouteStopProgress();

    map.addSource('route', { type: 'geojson', data: geojson, lineMetrics: true });

    map.addLayer({
      id: 'route-ghost',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#56602f',
        'line-width': 3,
        'line-opacity': 0.35,
        'line-dasharray': [2, 2]
      }
    });

    map.addLayer({
      id: 'route-active',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#c2a14d',
        'line-width': 5,
        'line-opacity': 0.95
      }
    });

    map.addSource('traveler', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [JOURNEY_STOPS[0].lng, JOURNEY_STOPS[0].lat] }
      }
    });

    map.addLayer({
      id: 'traveler',
      type: 'circle',
      source: 'traveler',
      paint: {
        'circle-radius': 7,
        'circle-color': '#5b1320',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#f5ecda'
      }
    });
  }

  function initMap() {
    if (map) return;

    var token = getMapToken();
    if (!token) {
      showMapFallback('no-token');
      return;
    }
    if (typeof mapboxgl === 'undefined') {
      showMapFallback('no-mapbox');
      return;
    }

    mapboxgl.accessToken = token;
    try {
      map = new mapboxgl.Map({
        container: mapEl,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: [JOURNEY_STOPS[0].lng, JOURNEY_STOPS[0].lat],
        zoom: JOURNEY_STOPS[0].zoom,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        cooperativeGestures: false,
        scrollZoom: false,
        dragPan: false,
        doubleClickZoom: false,
        touchZoomRotate: false,
        boxZoom: false,
        keyboard: false
      });
    } catch (err) {
      showMapFallback('webgl-failed');
      return;
    }

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('error', function (e) {
      if (e && e.error && (e.error.status === 401 || e.error.status === 403)) {
        showMapFallback('auth-failed');
      }
    });

    map.on('load', function () {
      map.resize();
      fetch('assets/route.geojson')
        .then(function (r) {
          if (!r.ok) throw new Error('route fetch ' + r.status);
          return r.json();
        })
        .then(function (geojson) {
          addRouteLayers(geojson);
          finishMapSetup();
        })
        .catch(function (err) {
          console.warn('Journey route failed to load:', err);
          showMapFallback('route-failed', false);
          finishMapSetup();
        });
    });
  }

  var mapInitStarted = false;
  function startMapIfNeeded() {
    if (mapInitStarted || !mapEl) return;
    if (location.protocol === 'file:') {
      showMapFallback('file-protocol');
      return;
    }
    var token = getMapToken();
    if (!token) {
      showMapFallback('no-token');
      return;
    }
    if (typeof mapboxgl === 'undefined') {
      showMapFallback('no-mapbox');
      return;
    }
    mapInitStarted = true;
    journeyInView = true;
    initMap();
  }

  var current = -1;
  function setActive(idx, silent) {
    idx = Math.max(0, Math.min(JOURNEY_STOPS.length - 1, idx));
    if (idx === current && !silent) return;
    current = idx;
    for (var c = 0; c < jCards.length; c++) jCards[c].classList.toggle('is-active', c === idx);
    for (var p = 0; p < jSteps.length; p++) jSteps[p].classList.toggle('is-active', p === idx);
    for (var k = 0; k < mapMarkers.length; k++) {
      mapMarkers[k].el.classList.toggle('is-active', k === idx);
    }
    if (!silent && mapAriaLive) {
      mapAriaLive.textContent = stopLabel(idx);
    }
  }

  function scrollProgress() {
    if (!jScroll) return 0;
    var rect = jScroll.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    var prog = total > 0 ? (-rect.top) / total : 0;
    return Math.max(0, Math.min(1, prog));
  }

  function scrollToStop(idx) {
    if (!jScroll || !interactive) return;
    var N = JOURNEY_STOPS.length;
    var lineProg = routeStopProgress.length ? routeStopProgress[idx] : (N > 1 ? idx / (N - 1) : 0);
    var prog = scrollProgForLineProgress(lineProg);
    var rect = jScroll.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    var targetY = window.scrollY + rect.top + prog * total;
    window.scrollTo({ top: targetY, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function render() {
    if (!mapReady || !map || !journeyInView) return;

    var now = performance.now();
    var deltaMs = lastFrameMs ? Math.min(now - lastFrameMs, 50) : 16.67;
    lastFrameMs = now;

    var scrollProg = scrollProgress();
    var targets = computeJourneyTargets(scrollProg);

    if (!viewState.initialized) {
      viewState.lng = targets.targetLng;
      viewState.lat = targets.targetLat;
      viewState.zoom = targets.targetZoom;
      viewState.lineProg = targets.lineProg;
      viewState.initialized = true;
      lastFrameMs = now;
      map.jumpTo({ center: [viewState.lng, viewState.lat], zoom: viewState.zoom, pitch: 0, bearing: 0 });
      setRouteProgress(viewState.lineProg);
      setActive(targets.activeIdx);
      return;
    }

    var centerAlpha = smoothAlpha(CENTER_SMOOTH, deltaMs);
    var zoomAlpha = smoothAlpha(ZOOM_SMOOTH, deltaMs);
    var lineAlpha = smoothAlpha(LINE_SMOOTH, deltaMs);

    viewState.lng = lerp(viewState.lng, targets.targetLng, centerAlpha);
    viewState.lat = lerp(viewState.lat, targets.targetLat, centerAlpha);
    viewState.zoom = lerp(viewState.zoom, targets.targetZoom, zoomAlpha);
    viewState.lineProg = lerp(viewState.lineProg, targets.lineProg, lineAlpha);

    map.jumpTo({ center: [viewState.lng, viewState.lat], zoom: viewState.zoom, pitch: 0, bearing: 0 });
    setRouteProgress(viewState.lineProg);
    setActive(targets.activeIdx);
  }

  function startJourneyLoop() {
    if (journeyLoopRunning || !interactive) return;
    journeyLoopRunning = true;
    function tick() {
      if (!journeyLoopRunning) return;
      render();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function onJourneyScroll() {
    /* continuous rAF loop handles render */
  }

  function onMapResize() {
    if (map) map.resize();
    onJourneyScroll();
  }

  if (mapEl) {
    startMapIfNeeded();
  }

  if (interactive) {
    journey.classList.add('is-interactive');
    window.addEventListener('scroll', onJourneyScroll, { passive: true });
    window.addEventListener('resize', onMapResize, { passive: true });
  }

  function bindStopNav(el, idx) {
    el.addEventListener('click', function () { scrollToStop(idx); });
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); scrollToStop(idx); }
    });
  }
  for (var s = 0; s < jSteps.length; s++) bindStopNav(jSteps[s], s);

  if (mapEl) {
    mapEl.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.map-marker');
      if (!btn) return;
      var stopIdx = parseInt(btn.getAttribute('data-stop'), 10);
      if (!isNaN(stopIdx)) scrollToStop(stopIdx);
    });
  }

  if (jScroll && 'IntersectionObserver' in window) {
    var visObserver = new IntersectionObserver(function (entries) {
      journeyInView = entries[0].intersectionRatio > 0;
      if (journeyInView && mapReady) render();
    }, { threshold: [0, 0.01] });
    visObserver.observe(jScroll);
  }

  var mapWrap = document.querySelector('#journey .map-wrap');
  if (mapWrap && 'ResizeObserver' in window) {
    var mapResizeObs = new ResizeObserver(function () {
      if (map) map.resize();
    });
    mapResizeObs.observe(mapWrap);
  }

  /* -------------------------------------- HEADER + PROGRESS (shared scroll) */
  var ticking = false;
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle('is-scrolled', y > 40);
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  onScroll();

  /* ---------------------------------------------------------- RSVP FORM */
  var form = document.getElementById('rsvpForm');
  if (form) {
    var submitBtn = document.getElementById('rsvpSubmit');
    var success = document.getElementById('rsvpSuccess');
    function isHy() { return body.getAttribute('data-lang') === 'hy'; }

    function showError(id, on) {
      var input = document.getElementById(id) || form.querySelector('[name="' + id + '"]');
      var msg = form.querySelector('[data-err-for="' + id + '"]');
      var field = input ? input.closest('.field') : (msg ? msg.closest('.field') : null);
      if (field) field.classList.toggle('has-error', on);
      if (msg) msg.hidden = !on;
    }

    form.addEventListener('change', function (e) {
      if (e.target.name === 'attending') showError('attending', false);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements['name'];
      var email = form.elements['email'];
      var attending = form.querySelector('input[name="attending"]:checked');
      var ok = true;

      if (!name.value.trim()) { showError('rsvp-name', true); ok = false; } else showError('rsvp-name', false);
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
      if (!emailOk) { showError('rsvp-email', true); ok = false; } else showError('rsvp-email', false);
      if (!attending) { showError('attending', true); ok = false; } else showError('attending', false);

      if (!ok) {
        var firstErr = form.querySelector('.has-error input, .field-error:not([hidden])');
        if (firstErr && firstErr.focus) firstErr.focus();
        return;
      }

      // --- DEMO submission --- replace with Formspree / Google Forms / your
      // own endpoint. See README → "Wiring up the RSVP form".
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = isHy() ? 'Ուղարկվում է…' : 'Sending…'; }
      setTimeout(function () {
        form.querySelectorAll('.field, #rsvpSubmit').forEach(function (n) { if (n.id !== 'rsvpSuccess') n.style.display = 'none'; });
        if (success) { success.hidden = false; success.setAttribute('tabindex', '-1'); success.focus(); }
      }, 700);
    });
  }
})();
