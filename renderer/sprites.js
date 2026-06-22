'use strict';
// Canvas: 160×160. Characters drawn at roughly (cx=80, cy=105).

// ── Shared helpers ────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function sin(frame, freq, amp) { return Math.sin(frame * freq) * amp; }

function drawBubble(ctx, x, y, char, bg = '#FFFDF0') {
  const r = 13;
  // Circle
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
  // Tail pointing down-left
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(x - 5, y + r - 2);
  ctx.lineTo(x - 12, y + r + 8);
  ctx.lineTo(x + 3, y + r - 3);
  ctx.closePath(); ctx.fill();
  // Character
  ctx.fillStyle = '#222'; ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(char, x, y + 1);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawSweatDrop(ctx, x, y) {
  ctx.fillStyle = '#5BC8F5';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + 5, y + 4, x + 6, y + 9, x, y + 11);
  ctx.bezierCurveTo(x - 6, y + 9, x - 5, y + 4, x, y);
  ctx.fill();
}

function drawSparkles(ctx, cx, cy, frame) {
  const pts = [
    [-28, -20], [28, -18], [-20, 10], [26, 12], [0, -32],
  ];
  ctx.fillStyle = '#FFD700';
  pts.forEach(([dx, dy], i) => {
    const pulse = 0.6 + 0.4 * Math.sin(frame * 0.12 + i * 1.3);
    const sz = 5 * pulse;
    const x = cx + dx + sin(frame, 0.05, 3);
    const y = cy + dy + sin(frame, 0.07, 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(frame * 0.06 + i);
    ctx.beginPath();
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2;
      j === 0 ? ctx.moveTo(Math.cos(a) * sz, Math.sin(a) * sz)
              : ctx.lineTo(Math.cos(a) * sz, Math.sin(a) * sz);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  });
}

function drawZzz(ctx, x, y, frame) {
  const chars = ['z', 'z', 'Z'];
  chars.forEach((ch, i) => {
    const t = ((frame * 0.6 + i * 25) % 75) / 75;
    const alpha = t < 0.6 ? t / 0.6 : (1 - t) / 0.4;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = '#90B8D8';
    ctx.font = `bold ${9 + i * 3}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(ch, x + i * 9 + t * 6, y - t * 22 - i * 9);
  });
  ctx.globalAlpha = 1;
}

// ── CLAWD (Orange Crab) ───────────────────────────────────────────────────
const CC = {
  body:  '#FF6B35', dark: '#C94410', shell: '#FF8C5A',
  outline:'#8B2500', eye: '#1A0800', white: '#FFFFFF',
  blush: '#FF9966', leg: '#DD5520',
};

function drawClawd(ctx, state, frame) {
  const cx = 80;
  let cy = 108;

  // State-specific Y offsets
  if (state === 'idle')    cy += sin(frame, 0.06, 2);
  if (state === 'happy')   cy += sin(frame, 0.14, 5);
  if (state === 'sleeping') cy = 112;
  if (state === 'waking')  cy = lerp(112, 108, ease(Math.min(frame / 50, 1)));

  // ── Legs (behind body) ──
  ctx.strokeStyle = CC.leg; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const legXs = [-22, -14, 14, 22];
  legXs.forEach((lx, i) => {
    const sway = state === 'working' ? sin(frame, 0.22, 4) * (i % 2 === 0 ? 1 : -1) : 0;
    ctx.beginPath();
    ctx.moveTo(cx + lx, cy + 14);
    ctx.lineTo(cx + lx + (lx > 0 ? 10 : -10), cy + 26 + sway);
    ctx.stroke();
  });

  // ── Left claw ──
  drawClawClawd(ctx, cx, cy, -1, state, frame);
  // ── Right claw ──
  drawClawClawd(ctx, cx, cy, 1, state, frame);

  // ── Body ──
  ctx.fillStyle = CC.body;
  ctx.beginPath(); ctx.ellipse(cx, cy, 30, 22, 0, 0, Math.PI * 2); ctx.fill();

  // Shell texture
  ctx.strokeStyle = CC.dark; ctx.lineWidth = 1.5;
  [[-10, -0.25], [0, 0], [10, 0.25]].forEach(([ox, rot]) => {
    ctx.save(); ctx.translate(cx + ox, cy - 4); ctx.rotate(rot);
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0, -Math.PI * 0.6, Math.PI * 0.6); ctx.stroke();
    ctx.restore();
  });

  // ── Eye stalks ──
  const eyeXs = [-11, 11];
  eyeXs.forEach(ex => {
    ctx.fillStyle = CC.body;
    ctx.beginPath(); ctx.ellipse(cx + ex, cy - 18, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
  });

  // ── Eyes ──
  eyeXs.forEach(ex => {
    const eyeX = cx + ex;
    const eyeY = cy - 26;

    if (state === 'sleeping') {
      // Closed arc
      ctx.fillStyle = CC.dark;
      ctx.beginPath(); ctx.ellipse(eyeX, eyeY, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = CC.body; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(eyeX, eyeY, 5, Math.PI, 0); ctx.stroke();
      return;
    }

    // White sclera
    ctx.fillStyle = CC.white;
    ctx.beginPath(); ctx.arc(eyeX, eyeY, 7, 0, Math.PI * 2); ctx.fill();

    // Pupil
    ctx.fillStyle = CC.eye;
    const pupilR = state === 'worried' ? 5.5 : 4.5;
    let pdy = state === 'notification' ? -2 : 0;
    ctx.beginPath(); ctx.arc(eyeX, eyeY + pdy, pupilR, 0, Math.PI * 2); ctx.fill();

    // Shine
    ctx.fillStyle = CC.white;
    ctx.beginPath(); ctx.arc(eyeX + 2, eyeY + pdy - 2, 1.5, 0, Math.PI * 2); ctx.fill();

    // Worried wide eyes — red corners
    if (state === 'worried') {
      ctx.fillStyle = '#FF4444'; ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.arc(eyeX, eyeY, 7, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = CC.eye;
      ctx.beginPath(); ctx.arc(eyeX, eyeY, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = CC.white;
      ctx.beginPath(); ctx.arc(eyeX + 2, eyeY - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  });

  // ── State overlays ──
  if (state === 'thinking')     drawBubble(ctx, cx + 34, cy - 52, '?');
  if (state === 'notification') drawBubble(ctx, cx + 34, cy - 52, '!', '#FFF0F0');
  if (state === 'worried')      drawSweatDrop(ctx, cx + 38, cy - 10);
  if (state === 'happy')        drawSparkles(ctx, cx, cy, frame);
  if (state === 'sleeping')     drawZzz(ctx, cx + 18, cy - 40, frame);

  // ── Working: tiny keyboard below ──
  if (state === 'working') {
    ctx.fillStyle = '#555'; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.roundRect(cx - 22, cy + 28, 44, 12, 3); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawClawClawd(ctx, cx, cy, side, state, frame) {
  const bx = cx + side * 38;
  const by = cy - 4;

  let angle = 0;
  if (state === 'thinking' && side === 1)  angle = -0.45;
  if (state === 'working')                 angle = sin(frame, 0.2, 0.3) * side;
  if (state === 'happy')                   angle = sin(frame, 0.13, 0.4) * side;
  if (state === 'waking' && side === 1)    angle = -Math.PI * 0.5 * ease(Math.min(frame / 55, 1));

  ctx.save(); ctx.translate(bx, by); ctx.rotate(angle);

  ctx.fillStyle = CC.body;
  // Claw base
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
  // Upper pincer
  ctx.beginPath(); ctx.ellipse(side * 9, -5, 8, 6, side * 0.4, 0, Math.PI * 2); ctx.fill();
  // Lower pincer
  ctx.beginPath(); ctx.ellipse(side * 9, 4, 7, 5, -side * 0.3, 0, Math.PI * 2); ctx.fill();
  // Gap between pincers
  ctx.fillStyle = '#00000022';
  ctx.beginPath(); ctx.ellipse(side * 12, 0, 3, 4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// ── CALICO (Tri-colour Cat) ───────────────────────────────────────────────
const CAT = {
  body:  '#F5DEB3', patch1: '#CC5500', patch2: '#1A1A1A',
  eye:   '#228B22', slit: '#111',      outline: '#5C3A1E',
  nose:  '#FFB6C1', whisker: '#9B8877',
};

function drawCalico(ctx, state, frame) {
  const cx = 80;
  let cy = 102;

  if (state === 'idle')     cy += sin(frame, 0.05, 1.5);
  if (state === 'happy')    cy += sin(frame, 0.12, 4);
  if (state === 'sleeping') cy = 108;
  if (state === 'waking')   cy = lerp(108, 102, ease(Math.min(frame / 50, 1)));

  // ── Tail ──
  const tailSwing = state === 'sleeping' ? 3
                  : state === 'happy'    ? sin(frame, 0.12, 18)
                  : sin(frame, 0.05, 10);
  ctx.strokeStyle = CAT.body; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 18, cy + 22);
  ctx.quadraticCurveTo(cx + 44, cy + 16, cx + 42 + tailSwing * 0.6, cy - 2);
  ctx.stroke();
  // Tail tip
  ctx.strokeStyle = '#FFF5E0'; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx + 42, cy + 2); ctx.lineTo(cx + 42 + tailSwing * 0.6, cy - 2);
  ctx.stroke();

  // ── Body (loaf) ──
  ctx.fillStyle = CAT.body;
  ctx.beginPath(); ctx.ellipse(cx, cy + 6, 26, 28, 0, 0, Math.PI * 2); ctx.fill();

  // Body patches
  ctx.fillStyle = CAT.patch1;
  ctx.beginPath(); ctx.ellipse(cx - 10, cy + 4, 11, 14, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = CAT.patch2;
  ctx.beginPath(); ctx.ellipse(cx + 9, cy + 16, 9, 10, 0.2, 0, Math.PI * 2); ctx.fill();

  // ── Head ──
  ctx.fillStyle = CAT.body;
  ctx.beginPath(); ctx.ellipse(cx, cy - 16, 22, 20, 0, 0, Math.PI * 2); ctx.fill();

  // Head patches
  ctx.fillStyle = CAT.patch1;
  ctx.beginPath(); ctx.ellipse(cx + 7, cy - 20, 10, 8, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = CAT.patch2;
  ctx.beginPath(); ctx.ellipse(cx - 10, cy - 14, 7, 6, -0.2, 0, Math.PI * 2); ctx.fill();

  // ── Ears ──
  const earTilt = state === 'worried' ? 0.35 : 0;
  [[-1, 1], [1, -1]].forEach(([side, _]) => {
    ctx.save(); ctx.translate(cx + side * 14, cy - 30); ctx.rotate(side * (0.15 + earTilt));
    ctx.fillStyle = CAT.body;
    ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(0, -17); ctx.lineTo(7, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = CAT.nose; ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(0, -10); ctx.lineTo(4, 2); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  });

  // ── Eyes ──
  const eyeY = cy - 18;
  [-9, 9].forEach(ex => {
    const x = cx + ex;
    if (state === 'sleeping') {
      ctx.strokeStyle = CAT.slit; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, eyeY, 5, Math.PI, 0); ctx.stroke();
      return;
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(x, eyeY, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CAT.eye;
    ctx.beginPath(); ctx.ellipse(x, eyeY, 3, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    // Vertical slit pupil
    const slitW = state === 'worried' ? 3.5 : 1.5;
    ctx.fillStyle = CAT.slit;
    ctx.beginPath(); ctx.ellipse(x, eyeY, slitW, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(x + 2, eyeY - 2, 1.5, 0, Math.PI * 2); ctx.fill();
  });

  // ── Nose & mouth ──
  ctx.fillStyle = CAT.nose;
  ctx.beginPath(); ctx.moveTo(cx, eyeY + 11); ctx.lineTo(cx - 3, eyeY + 14); ctx.lineTo(cx + 3, eyeY + 14); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = CAT.outline; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(cx, eyeY + 14); ctx.lineTo(cx - 4, eyeY + 17); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, eyeY + 14); ctx.lineTo(cx + 4, eyeY + 17); ctx.stroke();

  // ── Whiskers ──
  if (state !== 'sleeping') {
    ctx.strokeStyle = CAT.whisker; ctx.lineWidth = 0.8;
    [-1, 1].forEach(side => {
      [-3, 0, 3].forEach(yoff => {
        ctx.beginPath();
        ctx.moveTo(cx + side * 3, eyeY + 13 + yoff);
        ctx.lineTo(cx + side * 22, eyeY + 13 + yoff + side * yoff * 0.2);
        ctx.stroke();
      });
    });
  }

  // ── Paws (working state) ──
  if (state === 'working') {
    [-10, 10].forEach(px => {
      const py = cy + 34 + sin(frame, 0.22, 5) * (px > 0 ? 1 : -1);
      ctx.fillStyle = CAT.body;
      ctx.beginPath(); ctx.ellipse(cx + px, py, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = CAT.nose; ctx.globalAlpha = 0.65;
      [-3, 0, 3].forEach(tx => {
        ctx.beginPath(); ctx.arc(cx + px + tx, py + 2, 2, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    });
    // Keyboard hint
    ctx.fillStyle = '#555'; ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.roundRect(cx - 22, cy + 42, 44, 10, 3); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── State overlays ──
  if (state === 'thinking')     drawBubble(ctx, cx + 30, cy - 50, '?');
  if (state === 'notification') drawBubble(ctx, cx + 30, cy - 50, '!', '#FFF0F0');
  if (state === 'worried')      drawSweatDrop(ctx, cx + 30, cy - 24);
  if (state === 'happy')        drawSparkles(ctx, cx, cy - 10, frame);
  if (state === 'sleeping')     drawZzz(ctx, cx + 16, cy - 38, frame);
}

// ── Public API ────────────────────────────────────────────────────────────
window.Sprites = {
  draw(ctx, character, state, frame) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (character === 'clawd')  drawClawd(ctx, state, frame);
    if (character === 'calico') drawCalico(ctx, state, frame);
  },
};
