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

Vite에 `@vitejs/plugin-basic-ssl`을 붙여놨기 때문에 dev 서버가
**자동으로 자체 서명 HTTPS**로 뜹니다:

```
➜  Local:   https://localhost:5173/
➜  Network: https://192.168.x.x:5173/   ← 폰에서 이 주소로 접속
```

## 📱 폰에서 실행하기 (메인 시나리오)

1. PC와 폰이 **같은 Wi-Fi**에 붙어 있어야 합니다.
2. PC에서 `npm run dev` 후, 콘솔에 뜬 **Network 주소**를 폰 브라우저에 입력.
   - iPhone: Safari
   - Android: Chrome
3. 자체 서명 인증서라 **보안 경고**가 뜹니다. 우회 방법:
   - **iOS Safari** — "자세히 보기" → "이 웹사이트 방문" → "웹사이트 방문"
   - **Android Chrome** — "고급" → "안전하지 않음(사이트 이름)으로 이동"
4. 카메라 권한 허용 → 촬영 시작.

> 개발 목적의 자체 서명 인증서를 신뢰하는 것뿐이니 걱정 마세요.
> 배포판(Vercel/Netlify/Cloudflare Pages 등)에서는 정식 인증서를 씁니다.

### PC에서만 확인하고 싶다면

`http://localhost:5173`도 동작합니다 (브라우저는 `localhost`를 보안 컨텍스트로 인정).
HTTPS를 완전히 끄고 싶다면:

```bash
NO_HTTPS=1 npm run dev
```

### 폰에서 인증서 경고를 아예 피하고 싶다면 (선택)

터널 서비스를 쓰면 진짜 HTTPS 도메인이 부여되어 경고가 안 뜹니다:

```bash
npx cloudflared tunnel --url http://localhost:5173
# 또는
npx localtunnel --port 5173
```

## ⚠️ 왜 HTTPS가 필요한가

브라우저는 보안 컨텍스트(**HTTPS 또는 `localhost`**)에서만
`getUserMedia`(웹캠 접근)를 허용합니다. LAN IP로 폰에서 HTTP로 붙으면
카메라 권한 프롬프트조차 뜨지 않으니 반드시 HTTPS로 접속하세요.

## 빌드 / 배포

```bash
npm run build
```

정적 파일이 `dist/`에 생성됩니다. 아무 정적 호스팅(HTTPS 지원)에 올리면 됩니다.

### GitHub Pages 자동 배포 (권장)

이 저장소에는 `.github/workflows/deploy.yml`이 포함되어 있어
**`main` 또는 `claude/**` 브랜치에 push되면 자동으로 GitHub Pages에 배포**됩니다.

**최초 1회만 해줄 것:**

1. GitHub 저장소 → **Settings** → **Pages**
2. **Source**를 **GitHub Actions**로 변경 → Save
3. Actions 탭에서 워크플로 성공 확인
4. 배포 URL: `https://<GitHub유저이름>.github.io/-/`

이후엔 main에 merge할 때마다 자동 재배포됩니다.

> Pages 서빙 경로가 `/-/` 하위이므로 워크플로가 `BASE_PATH=/-/`로 빌드합니다.
> repo 이름을 바꿀 경우 `.github/workflows/deploy.yml`의 `BASE_PATH` 값을 함께 수정하세요.

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
