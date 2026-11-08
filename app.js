import * as pdfjsLib from "./lib/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdf.worker.min.mjs";

const C = Object.assign({
  pdf: "bd.pdf", autoMode: "scroll", scrollSpeed: 45, pageDuration: 10, pauseAtEnd: 5, pageGap: 0,
  clickToExplore: true, hint: "Cliquez pour explorer la BD",
  exitCombo: { ctrl: true, alt: true, shift: false, key: "q" },
  inactivityReturn: 0, chapters: null, background: "#111",
}, window.KIOSQUE_CONFIG || {});
// ?pdf=autre.pdf dans l'URL remplace le fichier de la config
const qp = new URLSearchParams(location.search);
if (qp.get("pdf")) C.pdf = qp.get("pdf");
if (qp.get("mode")) C.autoMode = qp.get("mode");
// Garde-fous : une faute de frappe dans config.js ne doit pas laisser un écran noir.
if (C.autoMode !== "scroll" && C.autoMode !== "pages") {
  console.warn(`autoMode « ${C.autoMode} » inconnu, « scroll » utilisé`);
  C.autoMode = "scroll";
}
const num = (v, def, min) => (Number.isFinite(+v) && +v >= min ? +v : def);
C.scrollSpeed = num(C.scrollSpeed, 45, 1);
C.pageDuration = num(C.pageDuration, 10, 1);
C.pauseAtEnd = num(C.pauseAtEnd, 5, 0);
C.pageGap = num(C.pageGap, 0, 0);
C.inactivityReturn = num(C.inactivityReturn, 0, 0);
document.documentElement.style.setProperty("--bg", C.background);

const $ = (id) => document.getElementById(id);
let pdf, N = 0, aspects = [], chapters = [];
let mode = "loading";

// ---------------------------------------------------------------- rendu
// Chaque page est rendue une fois en JPEG (léger en mémoire), puis mise en cache.
const cache = new Map(), pending = new Map();
const targetW = () => Math.min(2400, Math.ceil(Math.max(innerWidth, innerHeight * 0.75) * (devicePixelRatio || 1)));
function renderPage(n) {
  if (cache.has(n)) return Promise.resolve(cache.get(n));
  if (pending.has(n)) return pending.get(n);
  const p = (async () => {
    const page = await pdf.getPage(n);
    const v0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: targetW() / v0.width });
    const cv = document.createElement("canvas");
    cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    try {
      await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error(`page ${n} : conversion JPEG impossible`);
      const url = URL.createObjectURL(blob);
      cache.set(n, url);
      return url;
    } finally {
      cv.width = cv.height = 0; page.cleanup();
    }
  })();
  pending.set(n, p);
  // en cas d'échec, la page pourra être retentée au prochain appel
  p.finally(() => pending.delete(n)).catch(() => {});
  return p;
}
async function prerenderAll() {
  for (let n = 1; n <= N; n++) {
    try { await renderPage(n); } catch (e) { console.warn(`Rendu de la page ${n} impossible`, e); }
  }
}

// ---------------------------------------------------------------- chapitres
async function loadChapters() {
  if (Array.isArray(C.chapters) && C.chapters.length) return C.chapters.map((c) => ({ title: c.title, page: +c.page }));
  const out = [];
  try {
    const outline = await pdf.getOutline();
    for (const item of outline || []) {
      let dest = item.dest;
      if (typeof dest === "string") dest = await pdf.getDestination(dest);
      if (!Array.isArray(dest)) continue;
      const ref = dest[0];
      const page = typeof ref === "number" ? ref + 1 : (await pdf.getPageIndex(ref)) + 1;
      out.push({ title: item.title, page });
    }
  } catch (e) { console.warn("Signets illisibles", e); }
  return out.sort((a, b) => a.page - b.page);
}
const chapterOf = (n) => { let c = null; for (const ch of chapters) if (ch.page <= n) c = ch; return c; };

// ---------------------------------------------------------------- vues
function show(id) {
  for (const v of document.querySelectorAll(".view")) v.classList.toggle("active", v.id === id);
}

// ================================================================ MODE AUTO
let raf = 0, slideTimer = 0, offset = 0, lastT = 0, holdUntil = 0, resetting = false;
// Minuteries de la fin de boucle : annulées par stopAuto() pour qu'un clic pendant
// la pause finale ne déclenche pas un fondu plus tard, en pleine exploration.
const loopTimers = new Set();
const later = (fn, ms) => { const id = setTimeout(() => { loopTimers.delete(id); fn(); }, ms); loopTimers.add(id); };
// Incrémenté à chaque changement de mode : un rendu asynchrone lancé dans un
// mode précédent n'a alors plus le droit de toucher à l'affichage.
let epoch = 0;
const track = $("track"), slide = $("slide"), fade = $("autofade");

function buildTrack() {
  track.innerHTML = "";
  track.style.display = C.autoMode === "scroll" ? "block" : "none";
  slide.style.display = C.autoMode === "pages" ? "block" : "none";
  if (C.autoMode !== "scroll") return;
  for (let n = 1; n <= N; n++) {
    const img = document.createElement("img");
    img.dataset.n = n; img.alt = "";
    img.style.aspectRatio = aspects[n - 1];
    img.style.marginBottom = C.pageGap + "px";
    track.appendChild(img);
  }
}
// charge les images proches de la zone visible
function feedTrack() {
  const lo = offset - innerHeight, hi = offset + innerHeight * 2.5;
  for (const img of track.children) {
    const top = img.offsetTop, bot = top + img.offsetHeight;
    if (bot > lo && top < hi && !img.dataset.req) {
      const n = +img.dataset.n;
      img.dataset.req = "1";
      if (cache.has(n)) img.src = cache.get(n);
      else renderPage(n).then((u) => (img.src = u), (e) => {
        console.warn(`Rendu de la page ${n} impossible`, e);
        delete img.dataset.req; // nouvel essai au prochain passage
      });
    }
  }
}
function scrollLoop(t) {
  raf = requestAnimationFrame(scrollLoop);
  const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0; lastT = t;
  if (t < holdUntil || resetting) return;
  const maxOff = Math.max(0, track.scrollHeight - innerHeight);
  offset += C.scrollSpeed * dt;
  if (offset >= maxOff) {
    offset = maxOff;
    resetting = true;
    later(() => {
      fade.classList.add("out");
      later(() => {
        offset = 0; track.style.transform = "translateY(0)"; feedTrack();
        fade.classList.remove("out"); holdUntil = performance.now() + 2500; resetting = false;
      }, 1000);
    }, C.pauseAtEnd * 1000);
  }
  track.style.transform = `translateY(${-offset}px)`;
  feedTrack();
}
let slidePage = 1;
async function showSlide(n) {
  const e0 = epoch;
  let url;
  try { url = await renderPage(n); } catch (e) { console.warn(`Rendu de la page ${n} impossible`, e); return; }
  if (e0 !== epoch) return;
  const img = document.createElement("img"); img.alt = ""; img.style.opacity = 0; img.src = url;
  slide.appendChild(img);
  await img.decode().catch(() => {});
  if (e0 !== epoch) return;
  requestAnimationFrame(() => (img.style.opacity = 1));
  later(() => { while (slide.children.length > 1) slide.firstChild.remove(); }, 1300);
  renderPage(n % N + 1).catch(() => {}); // préchargement
}
function slideStep() {
  const atEnd = slidePage === N;
  slideTimer = setTimeout(() => {
    slidePage = atEnd ? 1 : slidePage + 1;
    showSlide(slidePage); slideStep();
  }, (C.pageDuration + (atEnd ? C.pauseAtEnd : 0)) * 1000);
}

function startAuto(fromStart = true) {
  stopAuto();
  mode = "auto"; show("auto");
  $("hint").textContent = C.hint; $("hint").style.display = C.clickToExplore ? "" : "none";
  if (C.autoMode === "scroll") {
    if (fromStart) offset = 0;
    track.style.transform = `translateY(${-offset}px)`;
    holdUntil = performance.now() + 2500; lastT = 0; resetting = false;
    feedTrack(); raf = requestAnimationFrame(scrollLoop);
  } else {
    if (fromStart) slidePage = 1;
    slide.innerHTML = ""; showSlide(slidePage); slideStep();
  }
}
function stopAuto() {
  cancelAnimationFrame(raf); clearTimeout(slideTimer); raf = 0;
  for (const id of loopTimers) clearTimeout(id);
  loopTimers.clear();
  fade.classList.remove("out"); resetting = false;
  epoch++;
}
// page la plus visible à l'écran (pour démarrer l'exploration au bon endroit)
function currentAutoPage() {
  if (C.autoMode === "pages") return slidePage;
  const mid = offset + innerHeight / 2;
  for (const img of track.children) if (img.offsetTop + img.offsetHeight > mid) return +img.dataset.n;
  return 1;
}

// ================================================================ MODE EXPLORATION
let cur = 1, busy = false;
const stage = $("stage");

async function goTo(n, dir = 0) {
  n = Math.max(1, Math.min(N, n));
  if (busy || (n === cur && stage.children.length)) return;
  busy = true;
  const e0 = epoch;
  try {
    const url = await renderPage(n);
    const img = document.createElement("img"); img.alt = ""; img.src = url;
    await img.decode().catch(() => {});
    if (e0 !== epoch) return; // on a quitté l'exploration entre-temps
    const old = [...stage.children];
    for (const o of old) { o.classList.add(dir >= 0 ? "leave-next" : "leave-prev"); setTimeout(() => o.remove(), 260); }
    img.style.opacity = 0; img.style.transform = `translateX(${dir > 0 ? 4 : dir < 0 ? -4 : 0}%)`;
    stage.appendChild(img);
    requestAnimationFrame(() => requestAnimationFrame(() => { img.style.opacity = 1; img.style.transform = "none"; }));
    cur = n; updateBar();
  } catch (e) {
    console.warn(`Rendu de la page ${n} impossible`, e); // la navigation reste utilisable
  } finally {
    busy = false;
  }
  if (n < N) renderPage(n + 1).catch(() => {});
  if (n > 1) renderPage(n - 1).catch(() => {});
}
function updateBar() {
  const ch = chapterOf(cur);
  $("info").innerHTML = `Page <b>${cur}</b> / ${N}` + (ch ? `<small>${escapeHtml(ch.title)}</small>` : "");
  $("bprev").disabled = cur <= 1; $("bnext").disabled = cur >= N;
  $("zprev").classList.toggle("disabled", cur <= 1); $("znext").classList.toggle("disabled", cur >= N);
  $("bchap").style.display = chapters.length ? "" : "none";
  for (const li of $("chaplist").children) li.classList.toggle("current", ch && +li.dataset.page === ch.page);
}
function buildChapterList() {
  $("chaplist").innerHTML = chapters.map((c) =>
    `<li data-page="${c.page}"><span>${escapeHtml(c.title)}</span><small>p. ${c.page}</small></li>`).join("");
}
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const toggleChapters = (open) => $("chapters").classList.toggle("open", open ?? !$("chapters").classList.contains("open"));

function startExplore(page) {
  stopAuto();
  mode = "explore"; show("explore"); toggleChapters(false);
  stage.innerHTML = ""; cur = 0; busy = false; goTo(page || 1);
  armInactivity();
}

// ---------------------------------------------------------------- interactions
$("auto").addEventListener("click", () => { if (mode === "auto" && C.clickToExplore) startExplore(currentAutoPage()); });
$("zprev").addEventListener("click", () => goTo(cur - 1, -1));
$("znext").addEventListener("click", () => goTo(cur + 1, 1));
$("bprev").addEventListener("click", () => goTo(cur - 1, -1));
$("bnext").addEventListener("click", () => goTo(cur + 1, 1));
$("bchap").addEventListener("click", () => toggleChapters());
$("chapters").addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (li) { const p = +li.dataset.page; goTo(p, p >= cur ? 1 : -1); }
  toggleChapters(false);
});
let wheelLock = 0;
$("explore").addEventListener("wheel", (e) => {
  e.preventDefault();
  if ($("chapters").classList.contains("open")) return;
  const now = performance.now(); if (now < wheelLock || Math.abs(e.deltaY) < 4) return;
  wheelLock = now + 450;
  e.deltaY > 0 ? goTo(cur + 1, 1) : goTo(cur - 1, -1);
}, { passive: false });

// On compare le caractère (e.key) ET la touche physique (e.code) : sous macOS,
// Option transforme « q » en « œ », et e.key ne vaut alors jamais « q ».
const isCombo = (e) => { const k = C.exitCombo, key = String(k.key).toLowerCase();
  const sameKey = (e.key && e.key.toLowerCase() === key) || e.code === "Key" + key.toUpperCase();
  return sameKey && !!k.ctrl === e.ctrlKey && !!k.alt === e.altKey && !!k.shift === e.shiftKey; };
addEventListener("keydown", (e) => {
  if (isCombo(e)) {
    e.preventDefault();
    if (mode === "explore") startAuto(true);
    else if (mode === "auto") startExplore(currentAutoPage());
    return;
  }
  if (mode === "explore") {
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " ") goTo(cur + 1, 1);
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") goTo(cur - 1, -1);
    else if (k === "Home") goTo(1, -1);
    else if (k === "End") goTo(N, 1);
    e.preventDefault(); // toutes les autres touches sont neutralisées
  } else if (mode === "auto") e.preventDefault();
}, true);
// pas de menu contextuel, de glisser-déposer ni de zoom
addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("dragstart", (e) => e.preventDefault());
addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

// retour automatique (optionnel)
let idleTimer = 0;
function armInactivity() {
  clearTimeout(idleTimer);
  if (mode === "explore" && C.inactivityReturn > 0) idleTimer = setTimeout(() => startAuto(true), C.inactivityReturn * 1000);
}
for (const ev of ["mousemove", "mousedown", "wheel", "keydown"]) addEventListener(ev, armInactivity, { passive: true });

let rT = 0;
addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => { if (mode === "auto") feedTrack(); }, 200); });

// ---------------------------------------------------------------- démarrage
(async function init() {
  try {
    const task = pdfjsLib.getDocument({ url: C.pdf });
    task.onProgress = ({ loaded, total }) => { if (total) $("loadbar").style.width = (60 * loaded / total) + "%"; };
    pdf = await task.promise;
    N = pdf.numPages;
    for (let n = 1; n <= N; n++) {
      const v = (await pdf.getPage(n)).getViewport({ scale: 1 });
      aspects.push(`${v.width} / ${v.height}`);
    }
    chapters = await loadChapters();
    buildChapterList(); buildTrack();
    // on rend les premières pages avant d'afficher, le reste en arrière-plan
    const first = Math.min(N, 3);
    for (let n = 1; n <= first; n++) { await renderPage(n); $("loadbar").style.width = (60 + 40 * n / first) + "%"; }
    startAuto(true);
    prerenderAll();
  } catch (err) {
    console.error(err);
    $("loadmsg").textContent = "Impossible d'ouvrir la BD";
    $("loaderr").textContent = (location.protocol === "file:"
      ? "La page a été ouverte directement, sans passer par le lanceur.\nFermez cette fenêtre et double-cliquez sur « Lancer le kiosque » dans le dossier du kiosque.\n\n"
      : `Vérifiez que le fichier « ${C.pdf} » est bien à côté de index.html.\n\n`) + (err && err.message || err);
  }
})();
