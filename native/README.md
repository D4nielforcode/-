# 🥠 흔들어! 포춘쿠키 (네이티브 앱)

Expo / React Native + 커스텀 네이티브 모듈로 만든 iOS/Android 앱.
**진짜 백그라운드 흔들기 감지를 지원합니다.**

## 실행 방법

Expo Go가 아닌 **Dev Client** 또는 자체 빌드가 필요합니다 (커스텀 네이티브 모듈 때문).

```bash
cd native
npm install
npx expo prebuild        # ios/, android/ 폴더 생성
npx expo run:ios         # 또는 run:android
```

## 백그라운드 흔들기 감지 — 어떻게 동작하는가

### Android (정공법)
**Foreground Service** + `SensorEventListener`로 가속도계를 항시 모니터링합니다.
- 상단에 "🥠 포춘쿠키 대기 중" 알림이 지속 표시됨 (Android OS 요구사항)
- 앱을 종료해도 서비스가 계속 동작
- 흔들기 감지 시 별도 알림으로 운세 발송
- 코드: `modules/shake-bg/android/.../ShakeService.kt`

### iOS (위치 백그라운드 모드 트릭)
iOS는 OS 정책상 백그라운드에서 순수 가속도계 작업을 허용하지 않습니다.
**해결책:** `CLLocationManager`의 백그라운드 위치 업데이트를 켜서 앱을 깨어 있게 유지하고,
그 위에서 `CMMotionManager` 가속도계를 돌립니다 (피트니스 앱들이 쓰는 표준 기법).

- "위치 정보 항상 허용" 권한 필요 (실제 위치는 사용·저장하지 않음, 단순 keepalive 용도)
- 상단바에 위치 사용 인디케이터(파란 화살표/알약)가 표시될 수 있음
- 코드: `modules/shake-bg/ios/ShakeBgModule.swift`

### 주의사항 / 트레이드오프
- **배터리 소모 증가** — 가속도계가 항시 켜지므로 불가피
- **iOS 앱스토어 심사** — 위치 백그라운드 모드를 흔들기용으로 쓰는 것은 회색지대.
  심사 통과를 위해 앱 설명에 흔들기 감지가 핵심 기능임을 명시 필요
- **Android 14+** — `FOREGROUND_SERVICE_SPECIAL_USE` 타입 필요 (이미 설정됨)

## 파일 구조

- `App.js` — UI + 포그라운드 흔들기 + 백그라운드 토글
- `fortunes.js` — 운세 30개
- `modules/shake-bg/` — 커스텀 네이티브 모듈
  - `android/.../ShakeService.kt` — Foreground Service
  - `android/.../ShakeBgModule.kt` — JS ↔ Native 브리지
  - `ios/ShakeBgModule.swift` — Location + Motion 결합
- `app.json` — 권한 / 백그라운드 모드 / 번들 ID

## 사용 흐름

1. 앱 실행 → "알림 허용하고 시작하기" (포그라운드 감지 시작)
2. "🌙 백그라운드 감지 켜기" → 권한 안내 → 켜기
3. 앱을 백그라운드/종료해도 흔들면 푸쉬 알림 도착
4. 다시 탭해서 끄기

## 스토어 배포

```bash
npm install -g eas-cli
eas login
eas build --platform ios       # 또는 android
```
