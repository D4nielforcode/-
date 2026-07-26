// 갤러리 상세 뷰의 인터랙티브 아트 캔버스.
// - bokeh: 부유하는 소프트 글로우 원, 커서에 살짝 끌림
// - rays: 커서에서 방사되는 광선 (마우스 이동 궤적을 따라)
// - aurora: 흐르는 리본 3개, 커서로 밀어낼 수 있음
// - fireflies: 반딧불이 무리, 커서에 몰림
// 하나만 활성. mode='off' 이면 캔버스 비움.

export class ArtCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.mode = 'off';
    this.running = false;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = 0;
    this.height = 0;

    this.pointer = { x: 0, y: 0, vx: 0, vy: 0, prev: { x: 0, y: 0 }, active: false, t: 0 };

    // per-mode state
    this.bokeh = [];
    this.rays = [];
    this.ribbons = [];
    this.fireflies = [];

    this._onResize = this._onResize.bind(this);
    this._onPointer = this._onPointer.bind(this);
    this._tick = this._tick.bind(this);

    window.addEventListener('resize', this._onResize);
    canvas.addEventListener('pointermove', this._onPointer);
    canvas.addEventListener('pointerdown', this._onPointer);
    canvas.addEventListener('pointerup', () => (this.pointer.active = false));
    canvas.addEventListener('pointerleave', () => (this.pointer.active = false));

    this._onResize();
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'off') {
      this.stop();
      this._clear();
      return;
    }
    this._reset(mode);
    this.start();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    requestAnimationFrame(this._tick);
  }
  stop() { this.running = false; }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
  }

  _clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  _onResize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.mode !== 'off') this._reset(this.mode);
  }

  _onPointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.pointer.prev.x = this.pointer.x;
    this.pointer.prev.y = this.pointer.y;
    this.pointer.vx = x - this.pointer.x;
    this.pointer.vy = y - this.pointer.y;
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = true;
    this.pointer.t = performance.now();

    if (this.mode === 'rays' && this.running) {
      // 이동한 지점마다 광선 시드
      const speed = Math.hypot(this.pointer.vx, this.pointer.vy);
      if (speed > 1) {
        this.rays.push({
          x, y,
          angle: Math.atan2(this.pointer.vy, this.pointer.vx),
          length: 60 + Math.min(220, speed * 8),
          life: 1,
          hue: 30 + Math.random() * 30,
        });
        if (this.rays.length > 80) this.rays.shift();
      }
    }
  }

  _reset(mode) {
    const w = this.width, h = this.height;
    if (mode === 'bokeh') {
      const count = Math.max(20, Math.min(60, Math.floor((w * h) / 20000)));
      const palette = [
        [255, 210, 140], [255, 170, 190], [180, 220, 255],
        [255, 240, 200], [220, 180, 255],
      ];
      this.bokeh = Array.from({ length: count }, () => {
        const c = palette[Math.floor(Math.random() * palette.length)];
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: 12 + Math.random() * 40,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          alpha: 0.15 + Math.random() * 0.35,
          color: c,
          phase: Math.random() * Math.PI * 2,
        };
      });
    } else if (mode === 'aurora') {
      this.ribbons = [
        { hue: 160, offset: 0,       amp: 60,  speed: 0.0006, y: h * 0.35 },
        { hue: 280, offset: 100,     amp: 90,  speed: 0.0004, y: h * 0.55 },
        { hue: 200, offset: 500,     amp: 70,  speed: 0.0008, y: h * 0.7  },
      ];
    } else if (mode === 'fireflies') {
      const count = Math.max(30, Math.min(90, Math.floor((w * h) / 15000)));
      this.fireflies = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 1 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.05,
      }));
    } else if (mode === 'rays') {
      this.rays = [];
    }
  }

  _tick(now) {
    if (!this.running) return;
    const dt = Math.min(64, now - (this._last || now));
    this._last = now;
    const { ctx, width: w, height: h } = this;

    if (this.mode === 'bokeh')      this._drawBokeh(ctx, w, h, dt, now);
    else if (this.mode === 'rays')  this._drawRays(ctx, w, h, dt, now);
    else if (this.mode === 'aurora') this._drawAurora(ctx, w, h, dt, now);
    else if (this.mode === 'fireflies') this._drawFireflies(ctx, w, h, dt, now);

    requestAnimationFrame(this._tick);
  }

  _drawBokeh(ctx, w, h, dt, now) {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bokeh) {
      // 살짝 커서로 끌림
      if (this.pointer.active) {
        const dx = this.pointer.x - b.x;
        const dy = this.pointer.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 60000) {
          const f = 0.0004;
          b.vx += dx * f;
          b.vy += dy * f;
        }
      }
      b.vx *= 0.985;
      b.vy *= 0.985;
      b.x += b.vx * dt * 0.06;
      b.y += b.vy * dt * 0.06;
      b.phase += 0.003 * dt;
      if (b.x < -60) b.x = w + 60;
      if (b.x > w + 60) b.x = -60;
      if (b.y < -60) b.y = h + 60;
      if (b.y > h + 60) b.y = -60;

      const wobble = 1 + Math.sin(b.phase) * 0.15;
      const rr = b.r * wobble;
      const [r, g, bl] = b.color;
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
      grad.addColorStop(0, `rgba(${r},${g},${bl},${b.alpha})`);
      grad.addColorStop(0.5, `rgba(${r},${g},${bl},${b.alpha * 0.35})`);
      grad.addColorStop(1, `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  _drawRays(ctx, w, h, dt, now) {
    // 부드러운 페이드 (누적 렌더)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = this.rays.length - 1; i >= 0; i--) {
      const r = this.rays[i];
      r.life -= dt * 0.0012;
      if (r.life <= 0) {
        this.rays.splice(i, 1);
        continue;
      }
      const alpha = Math.max(0, r.life);
      const grad = ctx.createLinearGradient(
        r.x, r.y,
        r.x + Math.cos(r.angle) * r.length,
        r.y + Math.sin(r.angle) * r.length
      );
      grad.addColorStop(0, `hsla(${r.hue}, 90%, 70%, ${alpha * 0.85})`);
      grad.addColorStop(0.5, `hsla(${r.hue + 8}, 90%, 75%, ${alpha * 0.35})`);
      grad.addColorStop(1, `hsla(${r.hue}, 90%, 70%, 0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2 + alpha * 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + Math.cos(r.angle) * r.length, r.y + Math.sin(r.angle) * r.length);
      ctx.stroke();
    }

    // 커서 위치에 소프트 글로우
    if (this.pointer.active) {
      const g = ctx.createRadialGradient(this.pointer.x, this.pointer.y, 0, this.pointer.x, this.pointer.y, 60);
      g.addColorStop(0, 'rgba(255,220,150,0.7)');
      g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.pointer.x, this.pointer.y, 60, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  _drawAurora(ctx, w, h, dt, now) {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen';

    for (const ribbon of this.ribbons) {
      ribbon.offset += ribbon.speed * dt * 60;
      const steps = 32;
      const path = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = t * w;
        // 커서에 의한 로컬 왜곡
        let bend = 0;
        if (this.pointer.active) {
          const dx = x - this.pointer.x;
          const dyRef = ribbon.y - this.pointer.y;
          const d = Math.hypot(dx, dyRef);
          if (d < 200) {
            bend = -dyRef * (1 - d / 200) * 0.6;
          }
        }
        const noise = Math.sin(t * 3 + ribbon.offset) * ribbon.amp
                    + Math.sin(t * 7 + ribbon.offset * 0.7) * (ribbon.amp * 0.3);
        path.push({ x, y: ribbon.y + noise + bend });
      }

      // 리본 채우기 (두 곡선 사이)
      const thickness = 80;
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, `hsla(${ribbon.hue}, 90%, 55%, 0)`);
      grad.addColorStop(0.5, `hsla(${ribbon.hue}, 90%, 60%, 0.55)`);
      grad.addColorStop(1, `hsla(${ribbon.hue}, 90%, 55%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y - thickness / 2);
      for (const p of path) ctx.lineTo(p.x, p.y - thickness / 2);
      for (let i = path.length - 1; i >= 0; i--) ctx.lineTo(path[i].x, path[i].y + thickness / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  _drawFireflies(ctx, w, h, dt, now) {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fireflies) {
      // 커서로 끌림
      if (this.pointer.active) {
        const dx = this.pointer.x - f.x;
        const dy = this.pointer.y - f.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 40000) {
          f.vx += dx * 0.0006;
          f.vy += dy * 0.0006;
        }
      }
      f.vx *= 0.96;
      f.vy *= 0.96;
      f.x += f.vx * dt * 0.1 + Math.sin(now * f.speed + f.phase) * 0.4;
      f.y += f.vy * dt * 0.1 + Math.cos(now * f.speed * 1.3 + f.phase) * 0.4;
      if (f.x < 0) f.x = w;
      if (f.x > w) f.x = 0;
      if (f.y < 0) f.y = h;
      if (f.y > h) f.y = 0;

      const twinkle = 0.5 + Math.sin(now * 0.003 + f.phase) * 0.5;
      const rr = f.r * 6;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr);
      g.addColorStop(0, `rgba(255,240,150,${0.9 * twinkle})`);
      g.addColorStop(0.4, `rgba(255,200,80,${0.35 * twinkle})`);
      g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, rr, 0, Math.PI * 2);
      ctx.fill();
      // core
      ctx.fillStyle = `rgba(255,255,220,${twinkle})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

/**
 * 사진 이미지 + 아트 캔버스를 합성해서 blob으로 저장.
 */
export async function compositeToBlob(imgEl, artCanvas) {
  const w = imgEl.naturalWidth;
  const h = imgEl.naturalHeight;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, w, h);

  // 아트 캔버스가 활성 상태면 위에 얹기
  if (artCanvas && artCanvas.mode !== 'off') {
    // 비율 유지하며 스케일업
    ctx.drawImage(artCanvas.canvas, 0, 0, w, h);
  }

  return new Promise((resolve) => {
    out.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
  });
}
