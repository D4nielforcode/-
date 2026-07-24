import { initCamera, captureFrame, stopCamera, CameraError } from './camera.js';
import { applyFilmFilter, canvasToBlob } from './filter.js';
import { savePhoto, getAllPhotos, countPhotos, clearPhotos } from './db.js';
import { playShutter, playWind, primeAudio } from './audio.js';

const TOTAL_EXPOSURES = 27;

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
  windWheel: document.querySelector('.camera__wind-wheel'),
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
};

// URL.createObjectURL로 만든 리소스를 정리하기 위해 저장
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

let taken = 0;         // 이번 롤에서 찍은 컷 수
let capturing = false; // 셔터 중복 방지
let cameraReady = false;

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

async function boot() {
  const existing = await countPhotos();

  if (existing >= TOTAL_EXPOSURES) {
    // 이미 다 찍은 필름이 저장돼 있다면 바로 갤러리
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
      ? '셔터를 눌러 촬영을 시작하세요'
      : `이어서 찍기 · ${TOTAL_EXPOSURES - taken}컷 남음`
  );

  // 카메라 초기화는 사용자 제스처 없이도 가능하지만,
  // iOS Safari의 AudioContext는 사용자 제스처가 필요하므로 첫 탭에서 prime.
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
    setStatus('셔터를 눌러 촬영을 시작하세요');
  } catch (err) {
    handleCameraError(err);
  }
});

// 셔터 클릭
el.shutter.addEventListener('click', onShutter);
// 스페이스바로도 촬영 (데스크톱 편의)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && el.screens.camera.classList.contains('is-active')) {
    e.preventDefault();
    onShutter();
  }
});

async function onShutter() {
  if (capturing) return;
  if (!cameraReady) {
    setStatus('카메라가 준비되지 않았습니다', true);
    return;
  }
  if (taken >= TOTAL_EXPOSURES) return;

  capturing = true;
  el.shutter.disabled = true;
  el.shutter.classList.add('is-pressed');

  try {
    primeAudio();
    playShutter();

    // 셔터 플래시(화면 흰색 반짝)
    el.flash.classList.remove('is-flash');
    // 강제 리플로우로 애니메이션 리셋
    void el.flash.offsetWidth;
    el.flash.classList.add('is-flash');

    // 실제 프레임 캡처
    const raw = captureFrame();

    // 필터 적용
    const filtered = await applyFilmFilter(raw);

    // JPEG blob으로 저장
    const blob = await canvasToBlob(filtered, 'image/jpeg', 0.88);
    await savePhoto(blob);

    taken += 1;
    const remaining = TOTAL_EXPOSURES - taken;
    setCounter(remaining);

    // 와인딩
    setTimeout(() => {
      playWind();
      el.windWheel.classList.remove('is-winding');
      void el.windWheel.offsetWidth;
      el.windWheel.classList.add('is-winding');
    }, 180);

    if (remaining === 0) {
      setStatus('필름을 다 썼습니다. 현상소로 이동합니다…');
      el.shutter.classList.remove('is-pressed');
      setTimeout(() => startDeveloping(), 900);
      return;
    }

    setStatus(`찰칵 · ${remaining}컷 남음`);

    // 셔터를 살짝 잠갔다가 풀기 (연사 방지 + 감각)
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

async function startDeveloping() {
  stopCamera();
  cameraReady = false;
  showScreen('lab');
  el.labTitle.classList.remove('is-done');
  el.labTitle.textContent = 'DEVELOPING';
  el.labSub.textContent = '암실에서 필름을 현상 중입니다';
  el.labFilmstrip.innerHTML = '';
  el.toGallery.hidden = true;

  const photos = await getAllPhotos();
  // 프레임 슬롯을 먼저 27개 만들어 스트립 느낌
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

  // 한 장씩 등장
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
  el.labSub.textContent = '현상 완료. 필름이 마르는 중…';
  await sleep(500);
  el.toGallery.hidden = false;
}

el.toGallery.addEventListener('click', () => {
  openGallery();
});

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
        <span class="photo__num">#${String(i + 1).padStart(2, '0')}</span>
        <a class="photo__dl" href="${url}" download="filmcam_${String(i + 1).padStart(2, '0')}.jpg">SAVE</a>
      </div>
    `;
    el.galleryGrid.appendChild(card);
  });

  showScreen('gallery');
}

el.newRoll.addEventListener('click', async () => {
  const ok = window.confirm(
    '새 필름을 넣으면 현재 롤의 사진이 모두 삭제됩니다. 계속하시겠어요?'
  );
  if (!ok) return;

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 앱 전환/종료 시 자원 정리
window.addEventListener('pagehide', () => {
  stopCamera();
});

boot();
