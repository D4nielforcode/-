# 🥠 흔들어! 포춘쿠키 (네이티브 앱)

Expo / React Native로 만든 iOS/Android 네이티브 앱.

## 실행 방법

```bash
cd native
npm install
npx expo start
```

- iOS: Expo Go 앱으로 QR 스캔 또는 `npm run ios`
- Android: Expo Go 앱으로 QR 스캔 또는 `npm run android`

## 빌드 (스토어 배포용)

```bash
npm install -g eas-cli
eas login
eas build --platform ios       # 또는 android
```

## 기능

- **흔들기 감지** — `expo-sensors`의 Accelerometer (앱이 포그라운드일 때)
- **푸쉬 알림** — `expo-notifications` 로컬 알림
- **햅틱 피드백** — 흔들기 성공 시 진동
- **다크 테마 UI** — 포춘쿠키 흔들기 애니메이션

## 백그라운드 흔들기 감지에 대해

iOS/Android 모두 OS 정책상 **앱이 백그라운드일 때 가속도계를 지속 모니터링하는 것은 제한적**입니다.
- iOS: 백그라운드 모션 감지는 CoreMotion의 일부 모드만 허용되며 배터리 소모/심사 거부 위험.
- Android: Foreground Service로 가능 (별도 구현 필요).

현재 구현은 **앱 실행 중**에만 흔들기를 감지합니다. 진정한 항시 백그라운드 감지가 필요하면
Android Foreground Service + iOS Significant Motion API로 추가 작업이 필요합니다.

## 파일

- `App.js` — 메인 화면 + 가속도계 + 알림 로직
- `fortunes.js` — 운세 멘트 배열
- `app.json` — Expo 앱 설정 (권한, 아이콘, 번들 ID)
- `assets/icon.png` — 앱 아이콘
