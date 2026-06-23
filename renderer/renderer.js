'use strict';
(async () => {
  const canvas = document.getElementById('mascot');
  const ctx    = canvas.getContext('2d');

  let character = 'clawd';
  let state     = 'idle';
  let frame     = 0;
  let dragging  = false;

  // ── Init ──────────────────────────────────────────────────────────────
  const settings = await window.clawd.getSettings();
  character = settings.theme || 'clawd';

  window.clawd.onInit(d => { character = d.theme || 'clawd'; });

  window.clawd.onStateChange(next => {
    if (next === state) return;
    if (state === 'sleeping' && next !== 'sleeping') {
      // Brief waking animation before settling into new state
      state = 'waking'; frame = 0;
      setTimeout(() => { state = next; frame = 0; }, 1800);
    } else {
      state = next; frame = 0;
    }
  });

  window.clawd.onThemeChange(t => { character = t; });

  // ── Animation loop ────────────────────────────────────────────────────
  function tick() {
    Sprites.draw(ctx, character, state, frame);
    frame = (frame + 1) % 360;
    requestAnimationFrame(tick);
  }
  tick();

  // ── Click-through: ignore transparent pixels ──────────────────────────
  // With forward:true Electron still delivers mousemove so we can hit-test.
  window.clawd.setIgnoreMouse(true); // start pass-through

  document.addEventListener('mousemove', e => {
    if (dragging) return;
    try {
      const px = ctx.getImageData(e.clientX, e.clientY, 1, 1).data;
      window.clawd.setIgnoreMouse(px[3] < 15); // pass-through on transparent areas
    } catch (_) {}
  });
  document.addEventListener('mouseleave', () => {
    if (!dragging) window.clawd.setIgnoreMouse(true);
  });

  // ── Drag ──────────────────────────────────────────────────────────────
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragging = true;
    window.clawd.setIgnoreMouse(false);
    window.clawd.dragStart();
  });
  window.addEventListener('mousemove', () => {
    if (dragging) window.clawd.dragMove();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    window.clawd.dragEnd();
  });

  // ── Right-click ───────────────────────────────────────────────────────
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    window.clawd.showMenu();
  });
})();
