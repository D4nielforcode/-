// 드래그로 값을 순환 선택하는 다이얼.
// 카메라의 물리 다이얼처럼 상단 회전 시 값이 커지거나 작아진다.

/**
 * @param {HTMLElement} el - 다이얼 컨테이너 (dial__rotor를 자식으로 가짐)
 * @param {{ values: any[], initialIndex: number, degPerStep?: number, onChange: (value, index) => void }} opts
 */
export function makeDial(el, opts) {
  const rotor = el.querySelector('.dial__rotor') || el;
  const values = opts.values;
  let idx = Math.max(0, Math.min(values.length - 1, opts.initialIndex ?? 0));
  const degPerStep = opts.degPerStep ?? Math.min(30, 360 / values.length);
  let rotation = idx * degPerStep;
  applyRotation();

  let dragging = false;
  let lastAngle = 0;
  let accumulatedDeg = 0;
  let didStep = false;

  function getPointerAngle(clientX, clientY) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }

  function onDown(e) {
    dragging = true;
    didStep = false;
    const p = pointFrom(e);
    lastAngle = getPointerAngle(p.x, p.y);
    accumulatedDeg = 0;
    if (e.cancelable) e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
  }

  function onMove(e) {
    if (!dragging) return;
    const p = pointFrom(e);
    const angle = getPointerAngle(p.x, p.y);
    let delta = angle - lastAngle;
    // 각도 랩어라운드
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    lastAngle = angle;
    accumulatedDeg += delta;

    // step 단위로 값 이동
    while (accumulatedDeg >= degPerStep) {
      idx = Math.min(values.length - 1, idx + 1);
      rotation += degPerStep;
      accumulatedDeg -= degPerStep;
      didStep = true;
      opts.onChange?.(values[idx], idx);
    }
    while (accumulatedDeg <= -degPerStep) {
      idx = Math.max(0, idx - 1);
      rotation -= degPerStep;
      accumulatedDeg += degPerStep;
      didStep = true;
      opts.onChange?.(values[idx], idx);
    }
    applyRotation();
    if (e.cancelable) e.preventDefault();
  }

  function onUp() {
    dragging = false;
  }

  function applyRotation() {
    rotor.style.transform = `rotate(${rotation}deg)`;
  }

  function pointFrom(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  // pointer events 우선, fallback으로 touch/mouse
  if (window.PointerEvent) {
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  } else {
    el.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // 클릭(짧게 탭)으로 다음 값 이동 - 접근성/데스크톱 편의
  let downTime = 0, downX = 0, downY = 0;
  el.addEventListener('pointerdown', (e) => {
    downTime = Date.now();
    downX = e.clientX;
    downY = e.clientY;
  });
  el.addEventListener('pointerup', (e) => {
    if (didStep) return;
    const dt = Date.now() - downTime;
    const dx = Math.abs(e.clientX - downX);
    const dy = Math.abs(e.clientY - downY);
    if (dt < 220 && dx < 6 && dy < 6) {
      idx = (idx + 1) % values.length;
      rotation = idx * degPerStep;
      applyRotation();
      opts.onChange?.(values[idx], idx);
    }
  });

  // 초기 콜백
  opts.onChange?.(values[idx], idx);

  return {
    get value() { return values[idx]; },
    get index() { return idx; },
    setIndex(i) {
      idx = Math.max(0, Math.min(values.length - 1, i));
      rotation = idx * degPerStep;
      applyRotation();
      opts.onChange?.(values[idx], idx);
    },
  };
}
