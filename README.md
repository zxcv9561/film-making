# FILM MAKING — 핫시트 목업

규칙서 v2 검증용 브라우저 목업. 빌드 없이 정적 파일만으로 동작합니다.

## GitHub Pages 배포
1. 새 저장소를 만들고 이 폴더의 파일을 **저장소 루트**에 그대로 올립니다 (`index.html`이 루트에 있어야 함).
2. 저장소 → Settings → Pages → Source: **Deploy from a branch** → Branch: `main` / `/ (root)` → Save.
3. 1~2분 뒤 `https://<계정>.github.io/<저장소>/` 에서 열립니다.

로컬에서 열 때는 `cards.json`을 fetch하기 때문에 파일을 더블클릭하면 안 되고, 간단한 서버가 필요합니다:
```
python3 -m http.server 8000   # → http://localhost:8000
```

## 파일
| 파일 | 역할 |
|---|---|
| index.html | 화면 뼈대 |
| style.css, fm-cards.css | 레이아웃 · 카드 스타일 |
| cards.json | 모든 카드 데이터 — 수치 수정은 여기서만 |
| js/rules.js | 상태 기계 · 정산 8단계 · 종료 판정. 맨 위 `RULES`에 미정 규칙 기본값 |
| js/bot.js | 탐욕 봇 (화면 없이 rules.js만 사용) |
| js/ui.js | 렌더링 · 클릭 처리 · CSV 내보내기 |

## 봇
준비 화면에서 플레이어마다 **사람 / 봇**을 토글합니다. 상단 `봇 ▶ / ▶▶` 버튼으로 속도를 바꿉니다. 모든 플레이어를 봇으로 두면 자동 시뮬레이션이 됩니다.

## 저장
진행 중인 게임은 브라우저 localStorage에 자동 저장됩니다 (테스터별·브라우저별로 따로).
