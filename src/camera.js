// 웹캠 접근. 프리뷰는 절대 화면에 노출하지 않는다.
// hidden video 요소에만 스트림을 붙이고, 셔터 시점에 canvas로 프레임을 캡처.

let stream = null;
let videoEl = null;

export async function initCamera(videoElement) {
  videoEl = videoElement;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new CameraError(
      'unsupported',
      '이 브라우저는 카메라를 지원하지 않습니다.'
    );
  }

  // 모바일: 후면 카메라 우선. 데스크톱은 알아서 하나 잡힘.
  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1440 },
    },
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    // facingMode 실패 시 재시도 없이 general video로
    if (err && (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    } else if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
      throw new CameraError('denied', '카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
    } else if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
      throw new CameraError('notfound', '카메라 장치를 찾을 수 없습니다.');
    } else if (err && err.name === 'NotReadableError') {
      throw new CameraError('busy', '다른 앱이 카메라를 사용 중입니다.');
    } else {
      throw new CameraError('unknown', '카메라를 여는 데 실패했습니다: ' + (err?.message || err));
    }
  }

  videoEl.srcObject = stream;
  videoEl.setAttribute('playsinline', 'true');
  videoEl.muted = true;
  await videoEl.play().catch(() => {});

  // metadata가 준비될 때까지 대기 (뷰의 width/height가 유효해야 캡처 가능)
  if (!videoEl.videoWidth) {
    await new Promise((resolve) => {
      const on = () => {
        videoEl.removeEventListener('loadedmetadata', on);
        resolve();
      };
      videoEl.addEventListener('loadedmetadata', on);
      // 안전장치
      setTimeout(resolve, 2000);
    });
  }
}

export function captureFrame() {
  if (!videoEl || !videoEl.videoWidth) {
    throw new CameraError('notready', '카메라가 준비되지 않았습니다.');
  }

  // 필름 프레임에 맞게 4:3으로 crop
  const targetAspect = 4 / 3;
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const videoAspect = vw / vh;

  let sx, sy, sw, sh;
  if (videoAspect > targetAspect) {
    // 원본이 더 넓음 → 가로 crop
    sh = vh;
    sw = Math.round(vh * targetAspect);
    sx = Math.round((vw - sw) / 2);
    sy = 0;
  } else {
    // 원본이 더 좁음 → 세로 crop
    sw = vw;
    sh = Math.round(vw / targetAspect);
    sx = 0;
    sy = Math.round((vh - sh) / 2);
  }

  // 최종 출력은 1600x1200으로 정규화
  const outW = 1600;
  const outH = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas;
}

export function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
  }
}

export class CameraError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CameraError';
    this.code = code;
  }
}
