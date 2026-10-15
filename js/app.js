/* ============================================================
   GreenGuard — client-side logic (demo, no backend)
   All data lives here as sample constants.

   Performance rules followed in this file:
   • one <video> element per feed, never shared between containers
     (sharing was what left the main satellite player empty)
   • videos only decode while their block is on screen
   • one clock interval for the whole page, never one per call
   ============================================================ */
"use strict";

/* ---------------- sample data ---------------- */

/*
 * Three satellite slots.
 * kind:"video"   → real demo footage
 * kind:"orbital" → generated Earth-and-beams view (no video file needed)
 */
const SATELLITE_FEEDS = [
  {
    label: "Zone 1 — Kadambari Reserve Edge", short: "Zone 1", kind: "video",
    src: "assets/videos/settelite-1.mp4", coords: "17.4521° N, 78.3390° E",
    status: "normal", offset: 0, speed: 1,
    note: "Canopy stable across the ridge. No clearing above the detection threshold this week.",
  },
  {
    label: "Zone 2 — Mokila Ridge Commons", short: "Zone 2 — loss", kind: "video",
    src: "assets/videos/settelite-2.mp4", coords: "17.5088° N, 78.5741° E",
    status: "loss", offset: 0, speed: 0.85,
    note: "3.1 ha of canopy removed along the access road since the last pass. Flagged for ground verification.",
  },
  {
    label: "Orbital Overview — Earth & Beams", short: "Orbital view", kind: "orbital",
    src: null, coords: "Constellation view · 5 zones tracked",
    status: "orbital", offset: 0, speed: 1,
    note: "Live constellation view. Each satellite sweeps its beam across the watch zones and reports any canopy change.",
  },
];

/*
 * The camera pilot is deliberately three sites, each on its own footage,
 * so no two tiles ever show the same picture.
 */
const CCTV_FEEDS = [
  {
    name: "CAM 01 — Forest Edge Trail", src: "assets/videos/Cctv-1.mp4", status: "person",
    offset: 0, look: "soft", place: "Kadambari Reserve Edge", lat: 17.4521, lng: 78.3390,
    signal: 92, uplink: "12 ms",
  },
  {
    name: "CAM 02 — Logging Track North", src: "assets/videos/Cctv-2.mp4", status: "normal",
    offset: 0, look: "grainy", place: "Mokila Ridge Commons", lat: 17.5088, lng: 78.5741,
    signal: 74, uplink: "38 ms",
  },
  {
    name: "CAM 03 — Perimeter Road (drone)", src: "assets/videos/Sattelite-3.mp4", status: "vehicle",
    offset: 0, look: "aerial", place: "Osman Sagar Buffer", lat: 17.3103, lng: 78.3965,
    signal: 86, uplink: "21 ms",
  },
];

const CCTV_STATUS_TEXT = {
  normal: "Normal",
  chainsaw: "Chainsaw Sound Detected",
  vehicle: "Vehicle Detected",
  person: "Person Detected",
};

const WATCH_ZONES = [
  { name: "Kadambari Reserve Edge", lat: 17.4521, lng: 78.3390, status: "normal", lastCheck: "14 Oct 2026", reports: 5 },
  { name: "Mokila Ridge Commons", lat: 17.5088, lng: 78.5741, status: "ignored-reports", lastCheck: "13 Oct 2026", reports: 14 },
  { name: "Osman Sagar Buffer", lat: 17.3103, lng: 78.3965, status: "review", lastCheck: "12 Oct 2026", reports: 8 },
  { name: "Shameerpet North Belt", lat: 17.6040, lng: 78.5820, status: "review", lastCheck: "11 Oct 2026", reports: 9 },
  { name: "Ananthagiri Fringe", lat: 17.2560, lng: 78.2020, status: "ignored-reports", lastCheck: "10 Oct 2026", reports: 17 },
];

const ZONE_COLORS = { normal: "#35d07f", review: "#f5c451", "ignored-reports": "#e5484d" };

/* Supplies case list — statuses: Sent | Acknowledged | Action Taken | Ignored */
const SAMPLE_CASES = [
  { id: "GG-0001", location: "Mokila Ridge Commons", date: "2026-09-02", status: "Ignored", days: 43, type: "Land clearing" },
  { id: "GG-0002", location: "Osman Sagar Buffer", date: "2026-09-06", status: "Ignored", days: 39, type: "Tree cutting" },
  { id: "GG-0003", location: "Ananthagiri Fringe", date: "2026-09-08", status: "Action Taken", days: 0, type: "Land clearing" },
  { id: "GG-0004", location: "Kadambari Reserve Edge", date: "2026-09-10", status: "Acknowledged", days: 35, type: "Burning" },
  { id: "GG-0005", location: "Shameerpet North Belt", date: "2026-09-13", status: "Action Taken", days: 0, type: "Dumping" },
  { id: "GG-0006", location: "Mokila Ridge Commons", date: "2026-09-17", status: "Ignored", days: 28, type: "Burning" },
  { id: "GG-0007", location: "Ananthagiri Fringe", date: "2026-09-21", status: "Acknowledged", days: 24, type: "Tree cutting" },
  { id: "GG-0008", location: "Osman Sagar Buffer", date: "2026-09-25", status: "Sent", days: 20, type: "Dumping" },
  { id: "GG-0009", location: "Kadambari Reserve Edge", date: "2026-09-29", status: "Action Taken", days: 0, type: "Tree cutting" },
  { id: "GG-0010", location: "Shameerpet North Belt", date: "2026-10-02", status: "Sent", days: 13, type: "Land clearing" },
  { id: "GG-0011", location: "Mokila Ridge Commons", date: "2026-10-06", status: "Acknowledged", days: 9, type: "Dumping" },
  { id: "GG-0012", location: "Ananthagiri Fringe", date: "2026-10-09", status: "Sent", days: 6, type: "Tree cutting" },
];

const cases = SAMPLE_CASES.map((c) => ({ ...c }));
let nextCaseNum = cases.length + 1;
let currentFilter = "all";
let newestCaseId = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const STATUS_CLASS = { "Sent": "st-sent", "Acknowledged": "st-ack", "Action Taken": "st-action", "Ignored": "st-ignored" };
const STATUS_COLOR = { "Sent": "#8b9a90", "Acknowledged": "#c98a0f", "Action Taken": "#1f8a5a", "Ignored": "#e5484d" };
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fmtDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/* ---------------- animated hero counters ---------------- */
function animateCounters() {
  $$(".counter").forEach((el) => {
    const target = +el.dataset.target;
    const suffix = el.dataset.suffix || "";
    if (REDUCED_MOTION) { el.textContent = target + suffix; return; }
    const dur = 1600;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ============================================================
   Video plumbing
   Every feed owns its own <video>. Nothing is ever moved between
   containers — doing that emptied the satellite main player.
   ============================================================ */

const playQueue = new Set();   // videos that are allowed to run
const inView = new WeakSet();
const watchedHosts = new WeakSet();
let visObserver = null;

function watchHost(el) {
  if (!el || watchedHosts.has(el)) return;
  watchedHosts.add(el);
  if (!visObserver) {
    visObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) inView.add(e.target);
        else inView.delete(e.target);
      });
      syncPlayback();
    }, { rootMargin: "160px 0px" });
  }
  visObserver.observe(el);
}

/* Ask for a video to run (or stop). Actual play/pause is decided by
   syncPlayback so off-screen footage never burns CPU. */
function wantPlay(v, on) {
  if (!v) return;
  if (on) playQueue.add(v);
  else {
    playQueue.delete(v);
    if (!v.paused) v.pause();
  }
}

function syncPlayback() {
  if (document.hidden) {
    playQueue.forEach((v) => { if (!v.paused) v.pause(); });
    return;
  }
  playQueue.forEach((v) => {
    const host = v.closest(".cctv-tile, .sat-layer") || v;
    if (inView.has(host)) { if (v.paused) v.play().catch(() => {}); }
    else if (!v.paused) v.pause();
  });
}

/* Note: do NOT seek a paused video to show a poster frame. A paused seek
   invalidates the presented frame and nothing is presented until playback
   resumes, which leaves a black rectangle. Pausing on the natural first
   frame (offset 0) paints correctly. */
function makeVideo(src, { preload = "metadata", offset = 0, rate = 1, onError = null } = {}) {
  const v = document.createElement("video");
  v.src = src;
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = preload;
  v.playbackRate = rate;
  v.setAttribute("playsinline", "");
  v.setAttribute("muted", "");
  const seek = () => { if (offset > 0) { try { v.currentTime = offset; } catch (e) { /* metadata race */ } } };
  v.addEventListener("loadedmetadata", seek, { once: true });
  v.addEventListener("loadeddata", seek, { once: true });
  v.addEventListener("error", () => {
    if (onError) onError(v);
    else showPlaceholder(v.parentElement);
  });
  return v;
}

function showPlaceholder(container, msg = "Video unavailable in demo") {
  if (!container || container.querySelector(".video-placeholder")) return;
  container.querySelectorAll("video, .tint-layer").forEach((n) => n.remove());
  const ph = document.createElement("div");
  ph.className = "video-placeholder";
  ph.innerHTML = `<span>🚫</span><span>${msg}</span>`;
  container.appendChild(ph);
}

/* Attach a video and immediately begin loading metadata. */
function mountVideo(container, v, extra = "") {
  container.appendChild(v);
  if (extra) container.insertAdjacentHTML("beforeend", extra);
  return v;
}

/* ============================================================
   Orbital view — Earth surrounded by rays of satellite beams
   Replaces the satellite slot that used to render an empty frame.
   Generated with CSS only: no video decode, no per-frame JS.
   ============================================================ */

const ORB_BEAMS = [
  { a: 8, d: 0, h: 32 }, { a: 68, d: 0.7, h: 24 }, { a: 128, d: 1.4, h: 32 },
  { a: 188, d: 2.1, h: 24 }, { a: 248, d: 2.8, h: 32 }, { a: 308, d: 3.5, h: 24 },
];
const ORB_ORBITS = [
  { inset: -10, dur: 15, rev: false },
  { inset: -3, dur: 21, rev: true },
  { inset: -17, dur: 30, rev: false },
];
const ORB_PINS = [
  { left: 30, top: 42 }, { left: 58, top: 28 }, { left: 44, top: 66 }, { left: 70, top: 58 },
];

function buildOrbitalScene(mini) {
  const wrap = document.createElement("div");
  wrap.className = "orb-scene" + (mini ? " is-mini" : "");
  if (!mini) wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", "Earth surrounded by rays of satellite beams, with satellites in orbit beaming down on the watch zones");

  const stars = document.createElement("div");
  stars.className = "orb-stars";
  wrap.appendChild(stars);

  const stage = document.createElement("div");
  stage.className = "orb-stage";
  stage.innerHTML =
    `<div class="orb-rays"></div>
     <div class="orb-rays alt"></div>
     <div class="orb-beams">${ORB_BEAMS.map((b) =>
       `<div class="orb-beam" style="--a:${b.a}deg;--d:${b.d}s;--h:${b.h}%"></div>`).join("")}</div>
     ${ORB_ORBITS.map((o) =>
       `<div class="orb-orbit${o.rev ? " rev" : ""}" style="--inset:${o.inset}%;--dur:${o.dur}s"><div class="orb-sat"></div></div>`).join("")}
     <div class="orb-earth">
       <div class="orb-map"></div>
       <div class="orb-shade"></div>
       ${ORB_PINS.map((p) => `<div class="orb-pin" style="left:${p.left}%;top:${p.top}%"></div>`).join("")}
     </div>
     <div class="orb-atmo"></div>`;
  wrap.appendChild(stage);

  if (!mini) {
    const hud = document.createElement("div");
    hud.className = "orb-hud";
    hud.innerHTML = `<span class="orb-hud-dim">3 sats · 5 zones · sweep live</span>`;
    wrap.appendChild(hud);
  }
  return wrap;
}

/* ============================================================
   Satellite group
   ============================================================ */

function buildSatellite() {
  const frame = $("#satFrame");
  const thumbs = $("#satThumbs");
  if (!frame || !thumbs) return;

  SATELLITE_FEEDS.forEach((feed, i) => {
    /* ---- main player layer ---- */
    const layer = document.createElement("div");
    layer.className = "sat-layer";
    if (i !== 0) layer.style.display = "none";

    if (feed.kind === "orbital") {
      layer.appendChild(buildOrbitalScene(false));
    } else {
      const v = makeVideo(feed.src, {
        preload: "auto", offset: feed.offset, rate: feed.speed,
        onError: () => {
          // Graceful fallback: if the footage will not load, show the
          // orbital scene instead of an empty black frame.
          layer.innerHTML = "";
          layer.appendChild(buildOrbitalScene(false));
        },
      });
      mountVideo(layer, v, `<div class="sat-tint"></div><div class="sat-grid-lines"></div><div class="sat-scanline"></div>`);
      feed.videoEl = v;
      v.addEventListener("loadeddata", () => paintSatelliteThumb(i));
      // Re-grab the poster once playback has settled, so the thumbnail is not
      // stuck on the clip's opening (often faded) frame.
      v.addEventListener("playing", () => { setTimeout(() => paintSatelliteThumb(i), 1200); }, { once: true });
      watchHost(layer);
    }
    frame.appendChild(layer);

    /* ---- thumbnail ---- */
    const th = document.createElement("button");
    th.type = "button";
    th.className = "sat-thumb" + (i === 0 ? " active" : "");
    th.setAttribute("aria-label", `Show ${feed.label}`);
    th.setAttribute("aria-pressed", i === 0 ? "true" : "false");

    if (feed.kind === "orbital") {
      th.appendChild(buildOrbitalScene(true));
    } else {
      /* The thumbnail is a canvas poster captured from the feed's own video
         element. A second, paused <video> here would present no frame at all
         in Chromium and just look like a black rectangle. */
      const cv = document.createElement("canvas");
      cv.className = "sat-thumb-canvas";
      cv.width = 480;
      cv.height = 270;
      th.appendChild(cv);
      feed.thumbCanvas = cv;
    }

    th.insertAdjacentHTML("beforeend", `<span class="thumb-label">${feed.short}</span>`);
    th.addEventListener("click", () => selectSatFeed(i));
    thumbs.appendChild(th);
  });

  selectSatFeed(0);
}

/* Copy a decoded frame out of a feed's video into its thumbnail canvas. */
function paintSatelliteThumb(i) {
  const feed = SATELLITE_FEEDS[i];
  if (!feed || !feed.thumbCanvas || !feed.videoEl || feed.videoEl.readyState < 2) return;
  const g = feed.thumbCanvas.getContext("2d");
  try {
    g.drawImage(feed.videoEl, 0, 0, feed.thumbCanvas.width, feed.thumbCanvas.height);
  } catch (e) { /* frame not presentable yet — the next event will retry */ }
}

function selectSatFeed(idx) {
  const feed = SATELLITE_FEEDS[idx];
  if (!feed) return;

  $$("#satFrame .sat-layer").forEach((layer, i) => {
    const active = i === idx;
    layer.style.display = active ? "block" : "none";
    const v = layer.querySelector("video");
    if (v) wantPlay(v, active);
  });


  $$("#satThumbs .sat-thumb").forEach((t, i) => {
    const active = i === idx;
    t.classList.toggle("active", active);
    t.setAttribute("aria-pressed", active ? "true" : "false");
  });

  $("#satLabel").textContent = feed.label;
  $("#satCoords").textContent = feed.coords;

  const chip = $("#satStatus");
  const isLoss = feed.status === "loss";
  const isOrbital = feed.status === "orbital";
  chip.textContent = isLoss ? "Green Cover Loss Detected" : isOrbital ? "Constellation Nominal" : "Normal";
  chip.className = "status-chip " + (isLoss ? "alert" : isOrbital ? "info" : "normal");
  $("#satLossBox").hidden = !isLoss;

  const note = $("#satNote");
  if (note) note.innerHTML = `<b>${feed.short}</b> — ${feed.note}`;

  // Keep the thumbnails in step with whatever the videos have decoded.
  SATELLITE_FEEDS.forEach((f, i) => paintSatelliteThumb(i));

  syncPlayback();
}

/* ============================================================
   CCTV group — three cameras, three different footages
   ============================================================ */

function buildCCTV() {
  const grid = $("#cctvGrid");
  if (!grid) return;

  CCTV_FEEDS.forEach((feed, i) => {
    const tile = document.createElement("div");
    tile.className = "cctv-tile";
    tile.dataset.cam = String(i);
    tile.tabIndex = 0;
    tile.setAttribute("role", "button");
    tile.setAttribute("aria-label", `Open ${feed.name} full view`);

    const frame = document.createElement("div");
    frame.className = `video-frame cctv ${feed.look}`;
    frame.style.aspectRatio = "4 / 3";

    const v = makeVideo(feed.src, { preload: "auto", offset: feed.offset });
    v.style.cssText = "width:100%;height:100%;object-fit:cover;position:absolute;inset:0;";
    mountVideo(frame, v, `<div class="grain"></div><div class="vignette"></div>`);
    feed.video = v;

    const isAlert = feed.status !== "normal";
    tile.appendChild(frame);
    tile.insertAdjacentHTML("beforeend", `
      <span class="cctv-name">${feed.name}</span>
      <span class="rec-dot">REC</span>
      <span class="status-chip ${isAlert ? "alert" : "normal"}" style="top:auto;bottom:8px;right:8px;">${CCTV_STATUS_TEXT[feed.status]}</span>
      <span class="ov-clock" data-clock="cctv" style="bottom:38px;left:8px;font-size:0.7rem;"></span>`);

    const open = () => openCCTVModal(i);
    tile.addEventListener("click", open);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });

    grid.appendChild(tile);
    watchHost(tile);
    wantPlay(v, true);
  });

  syncPlayback();
}

/* Full view creates its own video element and pauses the tile while open,
   so opening a camera never blanks the grid behind it. */
let modalVideo = null;

function openCCTVModal(idx) {
  const feed = CCTV_FEEDS[idx];
  if (!feed) return;

  const isAlert = feed.status !== "normal";
  openModal(feed.name, `
    <div class="modal-video-wrap">
      <div class="video-frame cctv ${feed.look}" id="modalFrame"></div>
    </div>
    <div class="modal-text" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center;">
      <span class="status-chip ${isAlert ? "alert" : "normal"}" style="position:static;">${CCTV_STATUS_TEXT[feed.status]}</span>
      <span style="color:var(--muted);font-size:0.85rem;">${feed.place} · signal ${feed.signal}% · uplink ${feed.uplink}</span>
      <span class="ov-clock" data-clock="cctv" style="position:static;color:#14603d;font-family:monospace;"></span>
    </div>`);

  const frame = $("#modalFrame");
  const v = makeVideo(feed.src, { preload: "auto", offset: feed.offset });
  v.style.cssText = "width:100%;height:100%;object-fit:cover;position:absolute;inset:0;";
  mountVideo(frame, v, `<div class="grain"></div><div class="vignette"></div><span class="rec-dot">REC</span>`);
  v.play().catch(() => {});
  modalVideo = v;

  if (feed.video) feed.video.pause();
  startClocks();
}

/* ---------------- clocks (single timer for the whole page) ---------------- */
let clockTimer = null;
function startClocks() {
  if (clockTimer) return;
  const tick = () => {
    const now = new Date();
    const text = `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${now.toLocaleTimeString("en-GB")} IST`;
    $$("[data-clock]").forEach((el) => { if (el.textContent !== text) el.textContent = text; });
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}

/* ============================================================
   Before / after — green cover change
   Two demo photographs of the same lake, hill and road, one year apart.

   The two figures below are MEASURED from those files with an
   excess-green index (ExG = 2g - r - b), counted over the band the 2:1
   frame actually shows (the images are ~1.71:1, so cover-cropping trims
   about 8.6% off the top and bottom). Re-measure with the same method if
   the photos are ever swapped, otherwise the readout stops being true.
   ============================================================ */

const BA_COVER_2025 = 89;   // assets/images/green-cover-2025.jpg
const BA_COVER_2026 = 53;   // assets/images/green-cover-2026.jpg

/* Resolve once both comparison photos have decoded, so the auto-reveal does
   not wipe across a half-loaded frame. Falls through after a grace period so a
   failed image can never block the demo. */
function whenPhotosReady(fn) {
  const imgs = ["#baImgDense", "#baImgCleared"].map((s) => $(s)).filter(Boolean);
  const pending = imgs.filter((img) => !img.complete);
  if (!pending.length) { fn(); return; }
  let remaining = pending.length;
  let fired = false;
  const fire = () => { if (fired) return; fired = true; fn(); };
  pending.forEach((img) => {
    const step = () => { if (--remaining <= 0) fire(); };
    img.addEventListener("load", step, { once: true });
    img.addEventListener("error", step, { once: true });
  });
  setTimeout(fire, 2500);
}

function initBeforeAfter() {
  const slider = $("#baSlider");
  const after = $("#baAfter");
  const handle = $("#baHandle");
  const coverEl = $("#baCover");
  if (!slider || !after || !handle) return;

  // Keep the headline delta derived from the same constants as the readout.
  const deltaEl = $("#baDelta");
  if (deltaEl) deltaEl.textContent = `−${BA_COVER_2025 - BA_COVER_2026} pts`;

  let dragging = false;
  let interacted = false;

  function setPos(pct) {
    const p = Math.max(0, Math.min(100, pct));
    after.style.clipPath = `inset(0 ${(100 - p).toFixed(2)}% 0 0)`;
    handle.style.left = p + "%";
    handle.setAttribute("aria-valuenow", String(Math.round(p)));
    // Interpolate between the two measured green-share values.
    const cover = Math.round(BA_COVER_2026 + (BA_COVER_2025 - BA_COVER_2026) * (p / 100));
    if (coverEl) {
      coverEl.textContent = cover + "%";
      const mid = (BA_COVER_2025 + BA_COVER_2026) / 2;
      coverEl.className = "ba-num" + (cover < mid ? " ba-num-red" : "");
    }
  }

  function posFromEvent(clientX) {
    const rect = slider.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  }

  slider.addEventListener("pointerdown", (e) => {
    dragging = true;
    interacted = true;
    // A pointer can already be gone by the time this runs; if capture throws
    // and we let it propagate, the divider would never move.
    try { slider.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    setPos(posFromEvent(e.clientX));
  });
  slider.addEventListener("pointermove", (e) => { if (dragging) setPos(posFromEvent(e.clientX)); });
  // End the drag on the window as well as the slider: if pointer capture was
  // refused, the pointerup lands outside the slider and `dragging` would stick.
  const endDrag = () => { dragging = false; };
  slider.addEventListener("pointerup", endDrag);
  slider.addEventListener("pointercancel", endDrag);
  slider.addEventListener("lostpointercapture", endDrag);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  const KEYS = { ArrowLeft: -4, ArrowRight: 4, ArrowUp: 4, ArrowDown: -4 };
  handle.addEventListener("keydown", (e) => {
    interacted = true;
    if (e.key in KEYS) {
      e.preventDefault();
      const cur = parseFloat(handle.style.left) || 50;
      setPos(cur + KEYS[e.key]);
    } else if (e.key === "Home") { e.preventDefault(); setPos(0); }
    else if (e.key === "End") { e.preventDefault(); setPos(100); }
  });

  setPos(50);

  /* One automatic sweep the first time the block scrolls into view, so the
     difference is obvious without the visitor having to hunt for the handle. */
  if (!REDUCED_MOTION) {
    let played = false;
    const sweepObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || played || interacted) return;
        played = true;
        sweepObserver.disconnect();
        whenPhotosReady(runSweep);
      });
    }, { threshold: 0.4 });
    sweepObserver.observe(slider);

    function runSweep() {
      const steps = [
        [50, 86, 900], [86, 14, 1400], [14, 50, 800],
      ];
      let i = 0;
      const settle = () => { if (!interacted && !dragging) setPos(50); };
      // rAF stops in a backgrounded tab, which would otherwise leave the
      // divider parked wherever the sweep was interrupted.
      const guard = setTimeout(settle, 4600);
      const next = () => {
        if (interacted || i >= steps.length) { clearTimeout(guard); settle(); return; }
        const [from, to, dur] = steps[i++];
        tween(from, to, dur, setPos, next);
      };
      setTimeout(next, 650);
    }
  }
}

/* Small easing helper — used by the before/after auto-reveal. */
function tween(from, to, ms, onUpdate, done) {
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / ms, 1);
    const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    onUpdate(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
    else if (done) done();
  };
  requestAnimationFrame(step);
}

/* ---------------- watch zone map ---------------- */
function initMap() {
  if (!window.L) return;
  const map = L.map("map", { scrollWheelZoom: true }).setView([17.42, 78.40], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  WATCH_ZONES.forEach((z) => {
    const color = ZONE_COLORS[z.status];
    const statusText = z.status === "normal" ? "Normal" : z.status === "review" ? "Under review" : "Ignored reports";
    L.circleMarker([z.lat, z.lng], { radius: 13, color, fillColor: color, fillOpacity: 0.85, weight: 2 })
      .addTo(map)
      .bindPopup(`<div class="map-popup">
        <b>${z.name}</b><br/>
        Status: ${statusText}<br/>
        Last satellite check: ${z.lastCheck}<br/>
        Reports: ${z.reports}
      </div>`);
  });
}

/* ---------------- report form ---------------- */
function initReportForm() {
  const form = $("#reportForm");
  if (!form) return;
  const photoInput = $("#photoInput");
  const photoPreview = $("#photoPreview");
  const photoImg = $("#photoImg");
  const gpsInput = $("#gpsInput");
  const gpsBtn = $("#gpsBtn");
  const gpsErr = $("#gpsErr");
  const dtInput = $("#dateTime");
  const success = $("#reportSuccess");
  let photoData = null;
  let gpsCaptured = false;

  const setNow = () => {
    dtInput.value = new Date().toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };
  setNow();
  setInterval(setNow, 1000);

  photoInput.addEventListener("change", () => {
    const f = photoInput.files && photoInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { photoData = reader.result; photoImg.src = photoData; photoPreview.hidden = false; };
    reader.readAsDataURL(f);
  });
  $("#photoRemove").addEventListener("click", () => {
    photoData = null; photoInput.value = ""; photoPreview.hidden = true;
  });

  gpsBtn.addEventListener("click", () => {
    gpsErr.hidden = true;
    if (!("geolocation" in navigator)) {
      gpsErr.textContent = "Geolocation not supported — please type the location manually.";
      gpsErr.hidden = false;
      return;
    }
    gpsBtn.textContent = "📡 Locating…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsCaptured = true;
        gpsInput.value = `${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E`;
        gpsBtn.textContent = "📍 GPS captured ✓";
      },
      (err) => {
        gpsErr.textContent = `GPS unavailable (${err.message}) — type the location manually.`;
        gpsErr.hidden = false;
        gpsBtn.textContent = "📍 Capture GPS";
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  gpsInput.addEventListener("input", () => { gpsCaptured = gpsInput.value.trim().length > 4; });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const type = $("#incidentType").value;
    if (!photoData) {
      success.className = "success-msg err-box";
      success.textContent = "A photo is required — it is what makes the report verifiable.";
      success.hidden = false;
      return;
    }
    if (!gpsCaptured) {
      gpsErr.textContent = "Capture GPS or type the location manually.";
      gpsErr.hidden = false;
      return;
    }
    if (!type) {
      $("#incidentType").focus();
      return;
    }

    const caseId = "GG-" + String(nextCaseNum).padStart(4, "0");
    nextCaseNum++;
    cases.unshift({
      id: caseId,
      location: gpsInput.value.split(",")[0].trim() || "Citizen report",
      date: new Date().toISOString().slice(0, 10),
      status: "Sent",
      days: 0,
      type,
    });
    newestCaseId = caseId;
    gpsCaptured = false;

    form.reset();
    photoData = null;
    photoPreview.hidden = true;
    setNow();
    gpsBtn.textContent = "📍 Capture GPS";
    success.hidden = false;
    success.className = "success-msg";
    success.textContent = `✔ Report submitted. Case ID: ${caseId} — status “Sent”. It is now visible on the public Accountability Tracker.`;
    currentFilter = "all";
    $$(".filter-btn").forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
    renderTracker();
    success.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center" });
  });
}

/* ---------------- accountability tracker ---------------- */
function renderTracker() {
  const counts = { Sent: 0, Acknowledged: 0, "Action Taken": 0, Ignored: 0 };
  let waitSum = 0, waitN = 0;
  cases.forEach((c) => {
    counts[c.status] = (counts[c.status] || 0) + 1;
    if (c.status !== "Action Taken") { waitSum += c.days; waitN++; }
  });
  const avg = waitN ? Math.round(waitSum / waitN) : 0;

  $("#dashCards").innerHTML = `
    <div class="dash-card"><span class="num">${cases.length}</span><span class="lbl">Total Reports</span></div>
    <div class="dash-card c-ack"><span class="num">${counts.Acknowledged}</span><span class="lbl">Acknowledged</span></div>
    <div class="dash-card c-action"><span class="num">${counts["Action Taken"]}</span><span class="lbl">Action Taken</span></div>
    <div class="dash-card c-ignored"><span class="num">${counts.Ignored}</span><span class="lbl">Ignored</span></div>
    <div class="dash-card"><span class="num">${avg}d</span><span class="lbl">Average Response Time</span></div>`;

  const donut = $("#donutChart");
  const R = 15.9155, C = 2 * Math.PI * R;
  let segs = "", legend = "", offsetAcc = 0;
  [["Sent", counts.Sent], ["Acknowledged", counts.Acknowledged], ["Action Taken", counts["Action Taken"]], ["Ignored", counts.Ignored]]
    .forEach(([label, n]) => {
      if (!n || !cases.length) return;
      const color = STATUS_COLOR[label];
      const frac = n / cases.length;
      segs += `<circle cx="21" cy="21" r="${R}" fill="transparent" stroke="${color}" stroke-width="4"
        stroke-dasharray="${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}"
        stroke-dashoffset="${(-offsetAcc).toFixed(2)}"><title>${label}: ${n}</title></circle>`;
      legend += `<span><i style="background:${color}"></i>${label} — ${n} (${Math.round(frac * 100)}%)</span>`;
      offsetAcc += frac * C;
    });
  donut.innerHTML = segs;
  $("#donutLegend").innerHTML = legend;

  const tbody = $("#caseTableBody");
  const term = ($("#caseSearch").value || "").toLowerCase();
  tbody.innerHTML = cases
    .filter((c) => currentFilter === "all" || c.status === currentFilter)
    .filter((c) => !term || c.id.toLowerCase().includes(term) || c.location.toLowerCase().includes(term) || (c.type || "").toLowerCase().includes(term))
    .map((c) => {
      const waitCls = c.days >= 30 ? "crit" : c.days >= 7 ? "warn" : "";
      let action = "";
      if (c.status === "Ignored") action = `<button class="action-btn" data-act="post" data-id="${c.id}">Generate Public Post</button>`;
      if (c.status !== "Action Taken" && c.days >= 30) {
        action += `<button class="action-btn rti" data-act="rti" data-id="${c.id}">Generate RTI Draft</button>`;
      }
      return `<tr class="${c.id === newestCaseId ? "is-new" : ""}">
        <td class="case-id">${c.id}</td>
        <td>${c.location}${c.type ? `<br/><small style="color:var(--muted)">${c.type}</small>` : ""}</td>
        <td>${fmtDate(c.date)}</td>
        <td><span class="st-badge ${STATUS_CLASS[c.status]}">${c.status}</span></td>
        <td class="days-wait ${waitCls}">${c.days}</td>
        <td>${action || '<span style="color:var(--muted)">—</span>'}</td>
      </tr>`;
    }).join("");

  $("#caseEmpty").hidden = tbody.querySelectorAll("tr").length > 0;
  newestCaseId = null;
}

function initTrackerUI() {
  renderTracker();
  $("#statusFilters").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    $$(".filter-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderTracker();
  });
  $("#caseSearch").addEventListener("input", renderTracker);
  $("#caseTableBody").addEventListener("click", (e) => {
    const btn = e.target.closest(".action-btn");
    if (!btn) return;
    const c = cases.find((x) => x.id === btn.dataset.id);
    if (!c) return;
    if (btn.dataset.act === "post") showPublicPost(c);
    else showRTI(c);
  });
}

/* ---------------- modal + generated cards ---------------- */
function openModal(title, bodyHTML) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = bodyHTML;
  $("#modal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (modalVideo) { modalVideo.pause(); modalVideo = null; }
  $("#modal").classList.remove("open");
  $("#modalBody").innerHTML = "";
  document.body.style.overflow = "";
  syncPlayback();
}

function initModal() {
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target === $("#modal")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
}

function copyText(txt, btn) {
  const done = () => {
    btn.textContent = "✓ Copied";
    btn.classList.add("copied");
    setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1800);
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
  else fallbackCopy(txt, done);
}

function fallbackCopy(txt, done) {
  const ta = document.createElement("textarea");
  ta.value = txt;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) { /* clipboard blocked */ }
  ta.remove();
  done();
}

function showPublicPost(c) {
  const dateStr = fmtDate(c.date);
  const text = `GreenGuard — public scoreboard update (facts only)

Case ID: ${c.id}
Location: ${c.location}
Incident type: ${c.type}
Date reported: ${dateStr}
Days without a recorded response: ${c.days}

All figures are as recorded in the GreenGuard app. Officials can update the case status at any time; quick action shows as green on the public tracker.

#GreenGuard #SDG15 #LifeOnLand`;

  openModal("Generate Public Post", `
    <div class="modal-text"><div class="gen-card">
      <div class="gen-type">Factual public post · Case ${c.id}</div>
      <div class="gen-photo">📷 Photo placeholder — ${c.type} evidence (demo)</div>
      <h4>${c.location}</h4>
      <p>Reported: <strong>${dateStr}</strong></p>
      <p>Days ignored: <strong style="color:var(--red)">${c.days}</strong> — no response recorded in the app.</p>
      <p class="gen-hash">#GreenGuard #SDG15 #LifeOnLand</p>
      <div class="gen-actions">
        <button class="copy-btn" id="genCopy">Copy</button>
        <small style="color:var(--muted)">Facts only. No blame, no individual named.</small>
      </div>
    </div></div>`);
  $("#genCopy").addEventListener("click", (e) => copyText(text, e.target));
}

function showRTI(c) {
  const dateStr = fmtDate(c.date);
  const text = `SAMPLE RTI APPLICATION — DRAFT (demo)

To: The Public Information Officer,
    Forest & Environment Department,
    Government of Telangana, Hyderabad.

Subject: Request for information regarding report ${c.id},
dated ${dateStr}, concerning ${c.type.toLowerCase()} at/near ${c.location}.

Respected Sir/Madam,

1. Please provide a copy of the action-taken report on complaint/representation
   ${c.id}, submitted on ${dateStr}, regarding ${c.type.toLowerCase()} in or near ${c.location}.
2. Please state the current official status of that complaint.
3. Please provide copies of all inspection notes, if any, related to the complaint.

Application fee of ₹10 enclosed by Indian Postal Order, drawn in favour of the
Accounts Officer, Forest & Environment Department.

(Information sought under the Right to Information Act, 2005.)

Place: Hyderabad                                    Applicant signature: ______
Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}

Note: This is a sample draft for demonstration. Check current RTI procedure and
the correct jurisdiction before filing. The application seeks information only
and makes no allegation of illegality.`;

  openModal(`Generate RTI Draft — Case ${c.id} (${c.days} days waiting)`, `
    <div class="modal-text">
      <p style="color:var(--muted);font-size:0.9rem;margin:0 0 14px;">Sample text for demonstration. Review and adapt before filing.</p>
      <div class="gen-rti-text">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>
      <div class="gen-actions"><button class="copy-btn" id="genCopy">Copy RTI text</button></div>
    </div>`);
  $("#genCopy").addEventListener("click", (e) => copyText(text, e.target));
}

/* ---------------- NGO buttons ---------------- */
function initNGOButtons() {
  $("#volunteerBtn").addEventListener("click", () => { $("#volunteerMsg").hidden = false; });
  $$(".drive-signup").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!btn.classList.contains("signed")) {
        btn.textContent = "✓ Signed Up";
        btn.classList.add("signed");
      }
    });
  });
}

/* ============================================================
   Interactive camera link graph
   Hub-and-spoke: the edge gateway feeds every camera. Nodes can be
   dragged, hovered for a link readout, and activated with mouse or
   keyboard to open that camera's feed.
   ============================================================ */

function initCamGraph() {
  const svg = document.getElementById("camGraph");
  if (!svg) return;

  const NS = "http://www.w3.org/2000/svg";
  const VBW = 900, VBH = 300;
  const HUB = { x: 150, y: 150 };
  const HOME = [
    { x: 660, y: 58 },
    { x: 660, y: 150 },
    { x: 660, y: 242 },
  ];
  const feeds = CCTV_FEEDS;
  const pos = feeds.map((f, i) => ({ ...HOME[i % HOME.length] }));

  const el = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  /* ---- defs: a soft glow for the gateway ---- */
  const defs = el("defs");
  const glow = el("radialGradient", { id: "ggHubGlow", cx: "50%", cy: "50%", r: "50%" });
  glow.appendChild(el("stop", { offset: "0%", "stop-color": "#35d07f", "stop-opacity": "0.5" }));
  glow.appendChild(el("stop", { offset: "100%", "stop-color": "#35d07f", "stop-opacity": "0" }));
  defs.appendChild(glow);
  svg.appendChild(defs);

  const linkLayer = el("g", { class: "link-layer" });
  const nodeLayer = el("g", { class: "node-layer" });
  svg.appendChild(linkLayer);
  svg.appendChild(nodeLayer);

  const linkPath = (a, b) => {
    const mx = (a.x + b.x) / 2;
    return `M${a.x} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
  };

  /* ---- gateway node ---- */
  const hubGroup = el("g", { class: "hub-node", transform: `translate(${HUB.x},${HUB.y})` });
  hubGroup.appendChild(el("circle", { r: 46, fill: "url(#ggHubGlow)", class: "node-hit" }));
  hubGroup.appendChild(el("circle", { r: 26, fill: "#0f3d26", stroke: "#35d07f", "stroke-width": 2.4 }));
  hubGroup.appendChild(el("circle", { r: 6, fill: "#7ef2b0" }));
  const hubPulse = el("circle", { r: 26, fill: "none", stroke: "#35d07f", "stroke-width": 2, class: "node-ring pulse" });
  hubGroup.appendChild(hubPulse);
  const hubText = el("text", {
    x: 0, y: 46, "text-anchor": "middle", "font-size": 11, "font-weight": 700,
    "font-family": "system-ui, sans-serif", fill: "#14603d",
  });
  hubText.textContent = "EDGE GATEWAY";
  hubGroup.appendChild(hubText);
  const hubSub = el("text", {
    x: 0, y: 60, "text-anchor": "middle", "font-size": 9.5,
    "font-family": "system-ui, sans-serif", fill: "#6c7568",
  });
  hubSub.textContent = "upland 3/3 links";
  hubGroup.appendChild(hubSub);
  nodeLayer.appendChild(hubGroup);

  /* ---- one link + one node per camera ---- */
  const links = [];
  const nodes = [];

  feeds.forEach((feed, i) => {
    const isAlert = feed.status !== "normal";
    const linkGroup = el("g", { class: "link-group" + (isAlert ? " link-alert" : "") });
    const base = el("path", { class: "link-base" });
    const flow = el("path", { class: "link-flow" + (isAlert ? " alert" : "") });
    linkGroup.appendChild(base);
    linkGroup.appendChild(flow);
    linkLayer.appendChild(linkGroup);
    links.push({ base, flow });
  });

  feeds.forEach((feed, i) => {
    const isAlert = feed.status !== "normal";
    const g = el("g", {
      class: "cam-node", tabindex: "0", role: "button",
      "aria-label": `${feed.name}. ${CCTV_STATUS_TEXT[feed.status]}. Open the camera feed.`,
    });

    g.appendChild(el("rect", { class: "node-hit", x: -104, y: -34, width: 208, height: 68, rx: 16 }));
    g.appendChild(el("rect", {
      class: "node-plate", x: -100, y: -30, width: 200, height: 60, rx: 14,
      fill: isAlert ? "rgba(229,72,77,0.07)" : "rgba(53,208,127,0.09)",
      stroke: isAlert ? "#e5484d" : "#35d07f", "stroke-width": 2,
      "stroke-dasharray": isAlert ? "5 4" : "none",
    }));

    g.appendChild(el("circle", { cx: -78, cy: 0, r: 14, fill: isAlert ? "#e5484d" : "#35d07f" }));
    g.appendChild(el("circle", { cx: -78, cy: 0, r: 5, fill: "#ffffff" }));
    if (isAlert) {
      g.appendChild(el("circle", { cx: -78, cy: 0, r: 20, fill: "none", stroke: "#e5484d", "stroke-width": 2, class: "node-ring pulse" }));
    }

    const name = el("text", {
      x: -56, y: -3, "font-size": 11.5, "font-weight": 700,
      "font-family": "system-ui, sans-serif", fill: "#1c241c",
    });
    name.textContent = feed.name;
    g.appendChild(name);

    const status = el("text", {
      x: -56, y: 14, "font-size": 10,
      "font-family": "system-ui, sans-serif", fill: isAlert ? "#a81f1f" : "#14603d",
    });
    status.textContent = CCTV_STATUS_TEXT[feed.status];
    g.appendChild(status);

    /* signal bars, refreshed periodically */
    const bars = [];
    for (let b = 0; b < 4; b++) {
      const bar = el("rect", {
        class: "node-bar", x: 46 + b * 7, y: 6 - b * 4, width: 5, height: 8 + b * 4,
        rx: 1.5, fill: "#35d07f",
      });
      g.appendChild(bar);
      bars.push(bar);
    }

    g.setAttribute("transform", `translate(${pos[i].x},${pos[i].y})`);
    nodeLayer.appendChild(g);
    nodes.push({ g, bars, feed });
  });

  function paintLinks() {
    feeds.forEach((f, i) => {
      const d = linkPath(HUB, pos[i]);
      links[i].base.setAttribute("d", d);
      links[i].flow.setAttribute("d", d);
    });
  }

  function paintBars() {
    nodes.forEach(({ bars, feed }) => {
      const lit = Math.max(1, Math.min(4, Math.round(feed.signal / 25)));
      bars.forEach((bar, b) => {
        bar.setAttribute("fill", b < lit ? "#35d07f" : "#d8d0bb");
        bar.setAttribute("opacity", b < lit ? "1" : "0.7");
      });
    });
  }

  paintLinks();
  paintBars();

  /* ---- status line ---- */
  const statusLine = $("#camGraphStatus");
  const alertCount = feeds.filter((f) => f.status !== "normal").length;
  const defaultStatus =
    `<b>3</b> cameras online · edge gateway nominal · <b>${alertCount}</b> alert${alertCount === 1 ? "" : "s"} streaming. ` +
    `Hover a camera for its link, click to open the feed.`;
  const setStatus = (html) => { if (statusLine) statusLine.innerHTML = html || defaultStatus; };
  setStatus();

  /* ---- tooltip ---- */
  const tip = $("#camTip");
  const stage = svg.parentElement;

  function toViewBox(clientX, clientY) {
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / VBW, r.height / VBH);
    const offX = (r.width - VBW * scale) / 2;
    const offY = (r.height - VBH * scale) / 2;
    return { x: (clientX - r.left - offX) / scale, y: (clientY - r.top - offY) / scale };
  }

  function showTip(i) {
    if (!tip) return;
    const feed = feeds[i];
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / VBW, r.height / VBH);
    const offX = (r.width - VBW * scale) / 2;
    const offY = (r.height - VBH * scale) / 2;
    tip.innerHTML =
      `<b>${feed.name}</b><br/>
       ${CCTV_STATUS_TEXT[feed.status]}<br/>
       <span class="tip-dim">${feed.place}</span><br/>
       <span class="tip-dim">signal ${feed.signal}% · uplink ${feed.uplink} · ${feed.lat.toFixed(4)}° N, ${feed.lng.toFixed(4)}° E</span>`;
    tip.style.left = (offX + pos[i].x * scale) + "px";
    tip.style.top = (offY + (pos[i].y - 34) * scale) + "px";
    tip.hidden = false;
  }

  function hideTip() { if (tip) tip.hidden = true; }

  /* ---- highlight the matching tile ---- */
  function linkTile(i) {
    $$("#cctvGrid .cctv-tile").forEach((t, k) => t.classList.toggle("linked", k === i));
  }

  /* ---- drag + hover + activate ---- */
  let drag = null;

  nodes.forEach(({ g, feed }, i) => {
    g.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const pt = toViewBox(e.clientX, e.clientY);
      drag = { i, dx: pt.x - pos[i].x, dy: pt.y - pos[i].y, moved: 0, id: e.pointerId };
      g.classList.add("is-dragging");
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
    });

    g.addEventListener("pointerenter", () => {
      if (drag) return;
      g.classList.add("is-hot");
      linkTile(i);
      showTip(i);
      setStatus(`<b>${feed.name}</b> — ${CCTV_STATUS_TEXT[feed.status]} · signal <b>${feed.signal}%</b> · uplink ${feed.uplink} · ${feed.place}`);
    });
    g.addEventListener("pointerleave", () => {
      g.classList.remove("is-hot");
      linkTile(-1);
      hideTip();
      setStatus();
    });
    g.addEventListener("focus", () => {
      g.classList.add("is-hot");
      linkTile(i);
      showTip(i);
      setStatus(`<b>${feed.name}</b> — ${CCTV_STATUS_TEXT[feed.status]} · press Enter to open this feed.`);
    });
    g.addEventListener("blur", () => {
      g.classList.remove("is-hot");
      linkTile(-1);
      hideTip();
      setStatus();
    });
    g.addEventListener("click", () => {
      if (drag && drag.moved > 4) return;   // a drag is not a click
      openCCTVModal(i);
    });
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCCTVModal(i); }
    });
  });

  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const pt = toViewBox(e.clientX, e.clientY);
    const nx = Math.max(24, Math.min(VBW - 24, pt.x - drag.dx));
    const ny = Math.max(24, Math.min(VBH - 24, pt.y - drag.dy));
    drag.moved += Math.abs(nx - pos[drag.i].x) + Math.abs(ny - pos[drag.i].y);
    pos[drag.i].x = nx;
    pos[drag.i].y = ny;
    nodes[drag.i].g.setAttribute("transform", `translate(${nx},${ny})`);
    paintLinks();
    if (!tip.hidden) showTip(drag.i);
  }, { passive: true });

  const endDrag = () => {
    if (!drag) return;
    nodes[drag.i].g.classList.remove("is-dragging");
    drag = null;
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  /* ---- toolbar ---- */
  const flowBtn = $("#graphFlowBtn");
  if (flowBtn) {
    flowBtn.addEventListener("click", () => {
      const off = svg.classList.toggle("flow-off");
      flowBtn.classList.toggle("active", !off);
      flowBtn.setAttribute("aria-pressed", String(!off));
      flowBtn.textContent = off ? "◌ Flow paused" : "◉ Live flow";
    });
  }

  const resetBtn = $("#graphResetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      feeds.forEach((f, i) => {
        pos[i].x = HOME[i % HOME.length].x;
        pos[i].y = HOME[i % HOME.length].y;
        nodes[i].g.setAttribute("transform", `translate(${pos[i].x},${pos[i].y})`);
      });
      paintLinks();
      hideTip();
      setStatus(`Layout reset — <b>3</b> cameras back on the default grid.`);
    });
  }

  /* ---- live link telemetry, refreshed on a slow timer ---- */
  setInterval(() => {
    if (document.hidden) return;
    const host = svg.closest(".cam-graph-block");
    if (host && !inView.has(host)) return;
    feeds.forEach((f, i) => {
      const drift = ((i * 7 + Math.floor(performance.now() / 3000)) % 5) - 2;
      f.signal = Math.max(58, Math.min(98, f.signal + drift));
      f.uplink = `${Math.max(9, Math.min(58, 12 + (100 - f.signal)))} ms`;
    });
    paintBars();
    setStatus();   // refresh the alert count line
  }, 3000);

  watchHost(svg.closest(".cam-graph-block"));
  syncPlayback();
}

/* ---------------- init ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  animateCounters();
  buildSatellite();
  buildCCTV();
  startClocks();
  initBeforeAfter();
  initMap();
  initReportForm();
  initTrackerUI();
  initModal();
  initNGOButtons();
  initCamGraph();

  document.addEventListener("visibilitychange", syncPlayback);
  window.addEventListener("pagehide", () => playQueue.forEach((v) => v.pause()));

  // Safety net on top of the IntersectionObserver: one comparison per frame
  // while scrolling, so playback never depends on a single observer delivery.
  let scrollTicking = false;
  window.addEventListener("scroll", () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => { scrollTicking = false; syncPlayback(); });
  }, { passive: true });

  syncPlayback();
});
