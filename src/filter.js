// 캡처된 canvas에 필름 스타일 효과.
// 카메라 설정(iso/shutter/aperture)에 따라 강도가 달라진다.

/**
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {{ iso: number, shutter: number, aperture: number }} settings
 *   iso: 100..3200 (그레인)
 *   shutter: 초 단위 (예: 1/125 -> 0.008). 노출·모션블러
 *   aperture: 1.4..16 (비네팅 · 심도)
 */
export async function applyFilmFilter(sourceCanvas, settings) {
  const s = settings || {};
  const iso = s.iso ?? 400;
  const shutter = s.shutter ?? 1 / 125;
  const aperture = s.aperture ?? 5.6;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 1) 렌즈 소프트니스 - 조리개 열수록 좀 더 소프트
  const softness = 0.3 + (1.6 / Math.max(1.4, aperture)) * 0.5;
  ctx.filter = `blur(${softness.toFixed(2)}px)`;
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.filter = 'none';

  // 2) 픽셀 조작
  // 셔터 느릴수록 노출 편차 커짐 (블러도 나오지만 여기선 노출만)
  const shutterFactor = Math.min(1.4, 0.6 + Math.sqrt(shutter * 125) * 0.8);
  const exposureJitter = (Math.random() * 2 - 1) * 0.12 * (shutter > 1/60 ? 1.4 : 0.8);
  const exposure = shutterFactor * (1 + exposureJitter);

  const warmR = 8;
  const warmG = 2;
  const warmB = -6;
  const desat = 0.78;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    r *= exposure; g *= exposure; b *= exposure;
    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    r = gray + (r - gray) * desat;
    g = gray + (g - gray) * desat;
    b = gray + (b - gray) * desat;
    r += warmR; g += warmG; b += warmB;
    r = curve(r); g = curve(g); b = curve(b);
    d[i]     = clamp(r);
    d[i + 1] = clamp(g);
    d[i + 2] = clamp(b);
  }
  ctx.putImageData(img, 0, 0);

  // 3) 비네팅: 조리개 열수록 더 강하게
  const vignetteStrength = 0.15 + Math.max(0, (5.6 - aperture) / 5.6) * 0.35;
  drawVignette(ctx, w, h, vignetteStrength);

  // 4) 그레인: ISO 높을수록 강하게
  const grainStrength = Math.min(120, 25 + (iso / 100) * 12);
  drawGrain(ctx, w, h, grainStrength);

  // 5) 랜덤 빛샘 (ISO 높을 때 확률 상승)
  const leakChance = 0.15 + Math.min(0.5, (iso - 100) / 3200 * 0.4);
  if (Math.random() < leakChance) drawLightLeak(ctx, w, h);

  // 6) 날짜 스탬프 (60% 확률)
  if (Math.random() < 0.6) drawDateStamp(ctx, w, h);

  return canvas;
}

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

function curve(v) {
  const x = v / 255;
  const y = x + (x - 0.5) * 0.18 * (1 - Math.abs(x - 0.5) * 2);
  return y * 255;
}

function drawVignette(ctx, w, h, strength) {
  const cx = w / 2, cy = h / 2;
  const outer = Math.hypot(cx, cy);
  const inner = outer * 0.5;
  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.75, `rgba(0,0,0,${(strength * 0.55).toFixed(2)})`);
  grad.addColorStop(1, `rgba(0,0,0,${strength.toFixed(2)})`);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGrain(ctx, w, h, alpha) {
  const nw = Math.max(64, Math.floor(w / 3));
  const nh = Math.max(64, Math.floor(h / 3));
  const nc = document.createElement('canvas');
  nc.width = nw;
  nc.height = nh;
  const nctx = nc.getContext('2d');
  const img = nctx.createImageData(nw, nh);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 100;
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
    d[i + 3] = alpha;
  }
  nctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(nc, 0, 0, w, h);
  ctx.restore();
}

function drawLightLeak(ctx, w, h) {
  const colors = [
    ['rgba(255, 60, 0, 0.55)', 'rgba(255, 120, 40, 0)'],
    ['rgba(255, 180, 50, 0.5)', 'rgba(255, 220, 100, 0)'],
    ['rgba(255, 40, 90, 0.5)', 'rgba(255, 90, 130, 0)'],
    ['rgba(120, 60, 220, 0.4)', 'rgba(160, 100, 255, 0)'],
  ];
  const [c1, c2] = colors[Math.floor(Math.random() * colors.length)];
  const side = Math.floor(Math.random() * 4);
  let x0, y0, x1, y1;
  switch (side) {
    case 0: x0 = 0; y0 = h * Math.random(); x1 = w * 0.6; y1 = y0; break;
    case 1: x0 = w; y0 = h * Math.random(); x1 = w * 0.4; y1 = y0; break;
    case 2: x0 = w * Math.random(); y0 = 0; x1 = x0; y1 = h * 0.6; break;
    default: x0 = w * Math.random(); y0 = h; x1 = x0; y1 = h * 0.4; break;
  }
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawDateStamp(ctx, w, h) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const stamp = `'${yy} ${mm} ${dd}`;
  const fontSize = Math.max(28, Math.floor(w / 42));
  ctx.save();
  ctx.font = `700 ${fontSize}px "Courier New", monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 2;
  ctx.fillStyle = 'rgba(255, 140, 30, 0.95)';
  ctx.fillText(stamp, w - fontSize * 0.7, h - fontSize * 0.5);
  ctx.restore();
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.88) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      type, quality
    );
  });
}
