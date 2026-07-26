import { initCamera, captureFrame, stopCamera, CameraError } from './camera.js';
import { applyFilmFilter, canvasToBlob } from './filter.js';
import { savePhoto, getAllPhotos, countPhotos, clearPhotos } from './db.js';
import { playShutter, playWind, primeAudio } from './audio.js';
import { makeDial } from './dial.js';
import { ArtCanvas, compositeToBlob } from './art.js';

const TOTAL_EXPOSURES = 27;

// ------- 값 세트 -------
const ISO_VALUES = [100, 200, 400, 800, 1600, 3200];
const SHUTTER_VALUES = [1, 1/2, 1/4, 1/8, 1/15, 1/30, 1/60, 1/125, 1/250, 1/500, 1/1000];
const APERTURE_VALUES = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];

const camSettings = {
  iso: 400,
  shutter: 1/125,
  aperture: 5.6,
};

const el = {
  screens: {
    camera: document.getElementById('screen-camera'),
    lab: document.getElementById('screen-lab'),
    gallery: document.getElementById('screen-gallery'),
  },
  counter: document.getElementById('counter'),
  shutter: document.getElementById('shutter'),
  status: document.getElementById('status'),
  flash: document.getElementById('flash-overlay'),
  labFilmstrip: document.getElementById('filmstrip'),
  labTitle: document.querySelector('.lab__title'),
  labSub: document.querySelector('.lab__sub'),
  toGallery: document.getElementById('to-gallery'),
  galleryGrid: document.getElementById('gallery-grid'),
  newRoll: document.getElementById('new-roll'),
  video: document.getElementById('hidden-video'),
  permissionModal: document.getElementById('permission'),
  permissionMsg: document.getElementById('permission-msg'),
  retry: document.getElementById('retry'),
  rotateHint: document.getElementById('rotate-hint'),
  detail: document.getElementById('detail'),
  detailClose: document.getElementById('detail-close'),
  detailImg: document.getElementById('detail-img'),
  detailDl: document.getElementById('detail-dl'),
  artCanvas: document.getElementById('art-canvas'),
  modes: document.querySelectorAll('#detail .mode[data-mode]'),
};

const blobUrls = new Set();
function objectUrl(blob) {
  const u = URL.createObjectURL(blob);
  blobUrls.add(u);
  return u;
}
function revokeAllUrls() {
  blobUrls.forEach((u) => URL.revokeObjectURL(u));
  blobUrls.clear();
}

let taken = 0;
let capturing = false;
let cameraReady = false;
let art = null;
let currentDetailBlob = null;

function showScreen(name) {
  Object.entries(el.screens).forEach(([k, node]) => {
    if (k === name) {
      node.hidden = false;
      node.classList.add('is-active');
    } else {
      node.hidden = true;
      node.classList.remove('is-active');
    }
  });
}

function setStatus(msg, isError = false) {
  el.status.textContent = msg;
  el.status.classList.toggle('is-error', isError);
}

function setCounter(remaining) {
  el.counter.textContent = String(remaining).padStart(2, '0');
}

function fmtShutter(s) {
  if (s >= 1) return `${s}s`;
  return `1/${Math.round(1 / s)}`;
}
function fmtAperture(a) {
  return `f/${a}`;
}
function updateValueLabel(kind, v) {
  const node = document.querySelector(`[data-dial-value="${kind}"]`);
  if (!node) return;
  if (kind === 'shutter') node.textContent = fmtShutter(v);
  else if (kind === 'aperture') node.textContent = fmtAperture(v);
  else node.textContent = String(v);
}

// ------- 다이얼 초기화 -------
function initDials() {
  const iso = document.querySelector('[data-dial="iso"]');
  const sh  = document.querySelector('[data-dial="shutter"]');
  const ap  = document.querySelector('[data-dial="aperture"]');

  if (iso) makeDial(iso, {
    values: ISO_VALUES,
    initialIndex: ISO_VALUES.indexOf(camSettings.iso),
    degPerStep: 40,
    onChange: (v) => { camSettings.iso = v; updateValueLabel('iso', v); },
  });
  if (sh) makeDial(sh, {
    values: SHUTTER_VALUES,
    initialIndex: SHUTTER_VALUES.indexOf(camSettings.shutter),
    degPerStep: 22,
    onChange: (v) => { camSettings.shutter = v; updateValueLabel('shutter', v); },
  });
  if (ap) makeDial(ap, {
    values: APERTURE_VALUES,
    initialIndex: APERTURE_VALUES.indexOf(camSettings.aperture),
    degPerStep: 18,
    onChange: (v) => { camSettings.aperture = v; updateValueLabel('aperture', v); },
  });
}

// ------- boot -------
async function boot() {
  initDials();
  updateOrientation();

  const existing = await countPhotos();
  if (existing >= TOTAL_EXPOSURES) {
    taken = existing;
    setCounter(0);
    await openGallery();
    return;
  }
  taken = existing;
  setCounter(TOTAL_EXPOSURES - taken);
  showScreen('camera');
  setStatus(
    taken === 0
      ? '다이얼을 돌려 감도 · 셔터 · 조리개를 맞추고 촬영하세요'
      : `이어서 찍기 · ${TOTAL_EXPOSURES - taken}컷 남음`
  );

  try {
    await initCamera(el.video);
    cameraReady = true;
  } catch (err) {
    handleCameraError(err);
  }
}

function handleCameraError(err) {
  cameraReady = false;
  let msg = '카메라를 여는 데 실패했습니다.';
  if (err instanceof CameraError) msg = err.message;
  el.permissionMsg.textContent = msg;
  el.permissionModal.hidden = false;
}

el.retry.addEventListener('click', async () => {
  el.permissionModal.hidden = true;
  try {
    await initCamera(el.video);
    cameraReady = true;
    setStatus('셔터를 눌러 촬영하세요');
  } catch (err) {
    handleCameraError(err);
  }
});

// ------- 셔터 -------
el.shutter.addEventListener('click', onShutter);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && el.screens.camera.classList.contains('is-active')) {
    e.preventDefault();
    onShutter();
  }
});

async function onShutter() {
  if (capturing) return;
  if (!cameraReady) { setStatus('카메라가 준비되지 않았습니다', true); return; }
  if (taken >= TOTAL_EXPOSURES) return;

  capturing = true;
  el.shutter.disabled = true;
  el.shutter.classList.add('is-pressed');

  try {
    primeAudio();
    playShutter();

    el.flash.classList.remove('is-flash');
    void el.flash.offsetWidth;
    el.flash.classList.add('is-flash');

    const raw = captureFrame();
    const filtered = await applyFilmFilter(raw, { ...camSettings });
    const blob = await canvasToBlob(filtered, 'image/jpeg', 0.88);
    await savePhoto(blob);

    taken += 1;
    const remaining = TOTAL_EXPOSURES - taken;
    setCounter(remaining);

    setTimeout(() => playWind(), 180);

    if (remaining === 0) {
      setStatus('필름을 다 썼습니다. 현상소로 이동합니다…');
      el.shutter.classList.remove('is-pressed');
      setTimeout(() => startDeveloping(), 900);
      return;
    }

    setStatus(`찰칵 · ${remaining}컷 남음  ·  ISO ${camSettings.iso} · ${fmtShutter(camSettings.shutter)} · ${fmtAperture(camSettings.aperture)}`);

    setTimeout(() => {
      el.shutter.disabled = false;
      el.shutter.classList.remove('is-pressed');
      capturing = false;
    }, 900);
  } catch (err) {
    console.error(err);
    setStatus('촬영 실패: ' + (err?.message || err), true);
    el.shutter.disabled = false;
    el.shutter.classList.remove('is-pressed');
    capturing = false;
  }
}

// ------- 현상소 -------
async function startDeveloping() {
  stopCamera();
  cameraReady = false;
  showScreen('lab');
  el.labTitle.classList.remove('is-done');
  el.labTitle.textContent = 'DEVELOPING';
  el.labSub.textContent = '암실에서 필름을 현상 중입니다 · 화면을 문질러 저어보세요';
  el.labFilmstrip.innerHTML = '';
  el.toGallery.hidden = true;

  startSafelight();

  const photos = await getAllPhotos();
  const frames = [];
  for (let i = 0; i < photos.length; i++) {
    const frame = document.createElement('div');
    frame.className = 'film-frame';
    const idx = document.createElement('div');
    idx.className = 'film-frame__index';
    idx.textContent = String(i + 1).padStart(2, '0');
    frame.appendChild(idx);
    el.labFilmstrip.appendChild(frame);
    frames.push({ frame, blob: photos[i].blob });
  }

  for (let i = 0; i < frames.length; i++) {
    await sleep(220 + Math.random() * 120);
    const { frame, blob } = frames[i];
    const img = document.createElement('img');
    img.className = 'film-frame__img';
    img.alt = `photo ${i + 1}`;
    img.src = objectUrl(blob);
    frame.appendChild(img);
    frame.classList.add('is-visible');
  }

  await sleep(900);
  el.labTitle.textContent = 'DONE';
  el.labTitle.classList.add('is-done');
  el.labSub.textContent = '현상 완료. 갤러리에서 인터랙티브 아트를 시도해보세요.';
  await sleep(400);
  el.toGallery.hidden = false;
}

// 안전등(safelight) 파티클 - 붉은 미세한 부유물이 은은하게 흐름
let safeRaf = 0;
function startSafelight() {
  const cvs = document.getElementById('safelight');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w, h;
  const resize = () => {
    w = cvs.width = window.innerWidth * dpr;
    h = cvs.height = window.innerHeight * dpr;
    cvs.style.width = window.innerWidth + 'px';
    cvs.style.height = window.innerHeight + 'px';
  };
  resize();
  window.addEventListener('resize', resize);
  const dust = Array.from({ length: 60 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.5 + 0.4,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -Math.random() * 0.4 - 0.1,
    alpha: Math.random() * 0.4 + 0.1,
  }));
  const loop = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of dust) {
      p.x += p.vx * dpr;
      p.y += p.vy * dpr;
      if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
      if (p.x < -5) p.x = w + 5;
      if (p.x > w + 5) p.x = -5;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 12 * dpr);
      g.addColorStop(0, `rgba(255,120,80,${p.alpha})`);
      g.addColorStop(1, 'rgba(255,80,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 12 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    safeRaf = requestAnimationFrame(loop);
  };
  cancelAnimationFrame(safeRaf);
  loop();
}

el.toGallery.addEventListener('click', () => openGallery());

// ------- 갤러리 -------
async function openGallery() {
  const photos = await getAllPhotos();
  el.galleryGrid.innerHTML = '';

  photos.forEach((p, i) => {
    const url = objectUrl(p.blob);
    const card = document.createElement('div');
    card.className = 'photo';
    card.innerHTML = `
      <img class="photo__img" src="${url}" alt="photo ${i + 1}" />
      <div class="photo__foot">
        <span>#${String(i + 1).padStart(2, '0')}</span>
      </div>
    `;
    card.addEventListener('click', () => openDetail(p.blob, i + 1));
    el.galleryGrid.appendChild(card);
  });

  showScreen('gallery');
}

el.newRoll.addEventListener('click', async () => {
  if (!window.confirm('현재 필름의 사진이 모두 삭제됩니다. 계속하시겠어요?')) return;
  revokeAllUrls();
  await clearPhotos();
  taken = 0;
  setCounter(TOTAL_EXPOSURES);
  setStatus('새 필름을 장전했습니다. 셔터를 눌러 시작하세요');
  el.galleryGrid.innerHTML = '';
  el.labFilmstrip.innerHTML = '';
  showScreen('camera');
  try {
    await initCamera(el.video);
    cameraReady = true;
  } catch (err) {
    handleCameraError(err);
  }
});

// ------- 디테일 & 아트 -------
function ensureArt() {
  if (!art) art = new ArtCanvas(el.artCanvas);
  return art;
}

function openDetail(blob, num) {
  currentDetailBlob = blob;
  const url = objectUrl(blob);
  el.detailImg.src = url;
  el.detailImg.dataset.num = num;
  el.detailDl.href = url;
  el.detailDl.download = `filmcam_${String(num).padStart(2, '0')}.jpg`;
  el.detail.hidden = false;
  setActiveMode('off');
  ensureArt();
  // 캔버스 사이즈 다시 계산
  setTimeout(() => art?._onResize(), 60);
}

el.detailClose.addEventListener('click', closeDetail);
el.detail.addEventListener('click', (e) => {
  if (e.target === el.detail) closeDetail();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !el.detail.hidden) closeDetail();
});

function closeDetail() {
  el.detail.hidden = true;
  art?.setMode('off');
}

function setActiveMode(mode) {
  el.modes.forEach((btn) => {
    btn.setAttribute('aria-selected', btn.dataset.mode === mode ? 'true' : 'false');
  });
  ensureArt().setMode(mode);
  // 저장 시 오버레이도 함께 저장하려면 composite 사용
  updateDownloadLink(mode);
}

el.modes.forEach((btn) => {
  btn.addEventListener('click', () => setActiveMode(btn.dataset.mode));
});

async function updateDownloadLink(mode) {
  if (mode === 'off' || !currentDetailBlob) {
    // 원본 그대로
    el.detailDl.href = objectUrl(currentDetailBlob);
    return;
  }
  // 잠깐 대기 후 composite (아트 캔버스가 렌더링될 시간)
  await new Promise((r) => setTimeout(r, 800));
  const composite = await compositeToBlob(el.detailImg, art);
  if (composite) {
    const url = objectUrl(composite);
    el.detailDl.href = url;
  }
}

// ------- 가로 안내 -------
function updateOrientation() {
  const isPortrait = window.matchMedia('(orientation: portrait) and (max-width: 700px)').matches;
  el.rotateHint.hidden = !isPortrait;
}
window.addEventListener('resize', updateOrientation);
window.addEventListener('orientationchange', () => setTimeout(updateOrientation, 100));

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

window.addEventListener('pagehide', () => stopCamera());

boot();
