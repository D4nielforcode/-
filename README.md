# FILM CAM 27 — 일회용 필름카메라 시뮬레이터

브라우저에서 돌아가는 일회용 필름카메라 웹앱입니다. 실시간 프리뷰 없이
"셔터를 누르는 순간까지 어떻게 찍혔는지 모르는" 감각을 재현합니다.

## 특징

- **프리뷰 없음.** 카메라 외형(뷰파인더 창, 셔터 버튼, 필름 카운터)만 표시.
- **27컷 제한.** 다 쓰기 전엔 갤러리를 열 수 없습니다.
- **필름 필터.** 그레인, 채도 저하, 웜 시프트, 비네팅, 랜덤 빛샘, 노출 흔들림.
- **현상소 애니메이션.** 27컷을 다 찍으면 암실 화면에서 필름이 한 장씩 나타납니다.
- **완전 클라이언트 사이드.** IndexedDB에 저장. 서버 업로드 없음.
- **WebAudio 합성 사운드.** 셔터/와인딩 소리는 외부 파일 없이 오실레이터로 만듭니다.
- **모바일 우선.** 폰 후면 카메라로 촬영하도록 `facingMode: environment` 지정.

## 개발 / 실행

```bash
npm install
npm run dev
```

`npm run dev`는 `http://localhost:5173`에서 뜹니다.
같은 폰에서 테스트하려면 같은 네트워크에서 `http://<PC의 로컬 IP>:5173`으로 접속.

## ⚠️ HTTPS가 필요합니다

브라우저는 보안 컨텍스트(**HTTPS 또는 `localhost`**)에서만
`getUserMedia`(웹캠 접근)를 허용합니다.

- **PC에서 localhost 접속:** HTTP여도 동작 (`http://localhost:5173`).
- **모바일에서 PC를 IP로 접속:** HTTP 사용 시 카메라 권한이 거부됩니다.
- **배포 시:** 반드시 HTTPS로 서빙하세요 (Vercel/Netlify/Cloudflare Pages 등은 기본 HTTPS).

### 폰에서 개발 서버를 테스트하려면

가장 쉬운 방법 두 가지:

1. **`localhost` 터널** (권장)
   ```bash
   npx localtunnel --port 5173
   # 또는
   npx cloudflared tunnel --url http://localhost:5173
   ```
   발급받은 `https://…` URL을 폰에서 여세요.

2. **로컬 HTTPS**
   `mkcert`로 로컬 인증서를 만든 뒤 `vite.config.js`에 아래처럼 추가:
   ```js
   import fs from 'node:fs'
   export default defineConfig({
     server: {
       host: true,
       https: {
         key: fs.readFileSync('./localhost-key.pem'),
         cert: fs.readFileSync('./localhost.pem'),
       },
     },
   })
   ```

## 빌드 / 배포

```bash
npm run build
```

정적 파일이 `dist/`에 생성됩니다. 아무 정적 호스팅(HTTPS 지원)에 올리면 됩니다.

## 조작

- **셔터 버튼(빨간 원)** 또는 데스크톱에서는 **스페이스바** — 촬영
- **와인딩 휠** — 촬영 후 자동으로 감김 (한 컷당 약 1초)
- **현상소 → 갤러리 열기** — 27컷을 다 쓴 뒤에만 표시
- **새 필름 넣기** — 현재 롤 삭제 후 다시 시작

## 파일 구조

```
├── index.html          # 카메라/현상소/갤러리 3개 스크린
├── src/
│   ├── main.js         # 상태 머신 + UI 이벤트
│   ├── camera.js       # getUserMedia + 프레임 캡처 (프리뷰 절대 미노출)
│   ├── filter.js       # Canvas 픽셀 처리 (그레인/비네팅/빛샘)
│   ├── audio.js        # WebAudio로 셔터/와인딩 합성
│   ├── db.js           # IndexedDB (photos store)
│   └── styles.css      # 코닥 FunSaver 느낌의 스킨
├── vite.config.js
└── package.json
```

## 제약

- 유료 API 없음, 서버 없음, 전부 브라우저에서 처리.
- `<video>` 요소는 스트림 캡처용으로만 DOM에 존재하며 오프스크린으로 숨김.
  화면에는 어떤 상황에서도 라이브 프리뷰가 노출되지 않습니다.
- 저장소는 IndexedDB. 브라우저 데이터를 지우면 롤도 함께 삭제됩니다.
