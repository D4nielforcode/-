// 캡처된 canvas에 일회용 필름 스타일 효과 적용.
// - 채도 저하 + 색조 시프트(warm shift)
// - 노출 랜덤 ±10%
// - 그레인 (필름 입자)
// - 비네팅
// - 랜덤 빛샘 (light leak) - 20% 확률
// - 살짝 블러 (렌즈 저품질 시뮬)

export async function applyFilmFilter(sourceCanvas) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 1) 살짝 블러로 저품질 렌즈 시뮬
  ctx.filter = 'blur(0.6px)';
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.filter = 'none';

  // 2) 픽셀 조작: 채도, 색조, 노출
  const exposure = 1 + (Math.random() * 0.2 - 0.1); // ±10%
  const warmR = 8;   // R에 더함
  const warmG = 2;   // G에 살짝
  const warmB = -6;  // B는 줄임 (warm shift)
  const desat = 0.75; // 채도 유지 비율 (1 = 원본, 0 = 흑백)

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    // 노출
    r *= exposure;
    g *= exposure;
    b *= exposure;

    // 채도 저하 (grey mix)
    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    r = gray + (r - gray) * desat;
    g = gray + (g - gray) * desat;
    b = gray + (b - gray) * desat;

    // warm shift
    r += warmR;
    g += warmG;
    b += warmB;

    // 컨트라스트 살짝 상승 (S-curve 근사)
    r = curve(r);
    g = curve(g);
    b = curve(b);

    d[i]     = clamp(r);
    d[i + 1] = clamp(g);
    d[i + 2] = clamp(b);
  }
  ctx.putImageData(img, 0, 0);

  // 3) 비네팅
  drawVignette(ctx, w, h);

  // 4) 그레인 (필름 입자) - additive noise 텍스처
  drawGrain(ctx, w, h);

  // 5) 랜덤 빛샘 (light leak) - 25% 확률
  if (Math.random() < 0.25) {
    drawLightLeak(ctx, w, h);
  }

  // 6) 날짜 스탬프 (오른쪽 아래, 오렌지, 확률 60%)
  if (Math.random() < 0.6) {
    drawDateStamp(ctx, w, h);
  }

  return canvas;
}

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function curve(v) {
  // 매우 부드러운 S-curve: 0.5 근처를 살짝 밀어냄
  const x = v / 255;
  const y = x + (x - 0.5) * 0.15 * (1 - Math.abs(x - 0.5) * 2);
  return y * 255;
}

function drawVignette(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const outer = Math.hypot(cx, cy);
  const inner = outer * 0.55;
  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.75, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawGrain(ctx, w, h) {
  // 저해상도 노이즈 텍스처를 만들어 스케일업하면 좀 더 필름스러운 크런치가 남
  const nw = Math.max(64, Math.floor(w / 3));
  const nh = Math.max(64, Math.floor(h / 3));
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = nw;
  noiseCanvas.height = nh;
  const nctx = noiseCanvas.getContext('2d');
  const nimg = nctx.createImageData(nw, nh);
  const nd = nimg.data;
  for (let i = 0; i < nd.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 90;
    nd[i] = v;
    nd[i + 1] = v;
    nd[i + 2] = v;
    nd[i + 3] = 55; // opacity
  }
  nctx.putImageData(nimg, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(noiseCanvas, 0, 0, w, h);
  ctx.restore();
}

function drawLightLeak(ctx, w, h) {
  // 가장자리 중 랜덤 한쪽에서 색상 있는 빛샘
  const colors = [
    ['rgba(255, 60, 0, 0.55)',  'rgba(255, 120, 40, 0)'],
    ['rgba(255, 180, 50, 0.5)', 'rgba(255, 220, 100, 0)'],
    ['rgba(255, 40, 90, 0.5)',  'rgba(255, 90, 130, 0)'],
  ];
  const [c1, c2] = colors[Math.floor(Math.random() * colors.length)];
  const side = Math.floor(Math.random() * 4); // 0=L, 1=R, 2=T, 3=B
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
  // 화이트에 오렌지 오버레이 느낌
  ctx.fillStyle = 'rgba(255, 140, 30, 0.95)';
  ctx.fillText(stamp, w - fontSize * 0.7, h - fontSize * 0.5);
  ctx.restore();
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.88) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      type,
      quality
    );
  });
}
