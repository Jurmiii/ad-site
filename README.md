# Money Calendar

사용자에게 돈의 진정한 가치를 일깨워주는 웹 공개형 머니 캘린더 프로젝트입니다.

## Tech Stack

- 정적 HTML / CSS / JavaScript (빌드 도구 없음)
- Netlify 정적 배포 (`publish = "."`)
- SheetJS(xlsx) — 엑셀 내보내기·복원
- `localStorage` — 브라우저 로컬 데이터

## Getting Started

로컬에서 정적 서버로 루트를 열어 확인합니다.

```bash
npx --yes serve .
```

또는 VS Code / Cursor의 Live Server로 `/index.html`을 엽니다.

## Structure

- `/index.html` — 메인 진입
- `/assets/js/nav-config.js` — 기능 1~16 경로 단일 소스
- `/assets/js/app-shell.js` — 공통 헤더·드로어·즐겨찾기 (런타임 컴포넌트)
- `/assets/css/common.css` — 디자인 토큰 + 공통 UI
- `/assets/css/journal-shell.css` — 기능 페이지 셸
- `/assets/css/style.css` — 홈 전용
- `/assets/components/` — 레이아웃 마크업 참고(미 include)
- `/assets/{feature}/` — 각 기능 페이지

## Core Principle

- 모든 데이터 테이블은 xlsx 추출 기능을 필수로 포함합니다.
- 금액 변동은 1원 단위(+/-)로 시각화합니다.
