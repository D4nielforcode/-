// 셔터/와인더 사운드를 WebAudio로 합성한다. (외부 파일 없음)

let ctx = null;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // iOS/Safari: 사용자 제스처 이후에만 재개 가능
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function primeAudio() {
  // 첫 셔터 전에 사용자 상호작용 시점에 호출
  ac();
}

/**
 * "찰칵" - 셔터 소리
 * 짧은 화이트노이즈 버스트 2번(click + clack)에 밴드패스 필터.
 */
export function playShutter() {
  const a = ac();
  const now = a.currentTime;

  // 1) click - 짧고 딱딱
  clickBurst(a, now, {
    duration: 0.045,
    freq: 2400,
    q: 6,
    gain: 0.55,
  });

  // 2) clack - 약간 낮게, 살짝 늦게
  clickBurst(a, now + 0.06, {
    duration: 0.09,
    freq: 900,
    q: 4,
    gain: 0.45,
  });

  // 3) 셔터 스프링 잔향(사인 스윕)
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now + 0.06);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.18);
  g.gain.setValueAtTime(0.001, now + 0.06);
  g.gain.exponentialRampToValueAtTime(0.08, now + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(g).connect(a.destination);
  osc.start(now + 0.06);
  osc.stop(now + 0.22);
}

/**
 * "지지지직" - 필름 와인딩 소리 (반복 클릭)
 */
export function playWind() {
  const a = ac();
  const now = a.currentTime;
  const clicks = 18;
  const interval = 0.028;
  for (let i = 0; i < clicks; i++) {
    const t = now + i * interval;
    clickBurst(a, t, {
      duration: 0.015,
      freq: 1600 + Math.random() * 400,
      q: 8,
      gain: 0.18 + Math.random() * 0.07,
    });
  }
  // 라쳇 끝 톤
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, now + clicks * interval);
  g.gain.setValueAtTime(0.001, now + clicks * interval);
  g.gain.exponentialRampToValueAtTime(0.05, now + clicks * interval + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, now + clicks * interval + 0.15);
  osc.connect(g).connect(a.destination);
  osc.start(now + clicks * interval);
  osc.stop(now + clicks * interval + 0.2);
}

function clickBurst(a, when, { duration, freq, q, gain }) {
  const bufSize = Math.max(128, Math.floor(a.sampleRate * duration));
  const buf = a.createBuffer(1, bufSize, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    // 감쇠하는 화이트노이즈
    const env = 1 - i / bufSize;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = a.createBufferSource();
  src.buffer = buf;

  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;

  const g = a.createGain();
  g.gain.value = gain;

  src.connect(filter).connect(g).connect(a.destination);
  src.start(when);
  src.stop(when + duration + 0.02);
}
