# 의료기술직 매일 모의고사

- 수험생: https://inaeternum1.github.io/medtech/
- 수험생 앱 받기(안드로이드): https://inaeternum1.github.io/medtech/app.html
- 선생님: 레벨 테스트 관리 앱의 채점 화면에서 '의료기술직 채점'으로 이동 (같은 교사 키)

| 위치 | 내용 |
|---|---|
| `index.html` | 수험생 풀이·결과, 채점 화면(`#teacher=키`, 앱은 `#app`) |
| `app.html` | 수험생 앱(APK) 다운로드 페이지 |
| `supabase/functions/medtech/index.ts` | 서버 API (Supabase Edge Function `medtech`, 레벨 테스트와 같은 프로젝트) |
| `content/RULES.md` | 매일 출제 규칙 |
| `android/` | 앱 원본. 바뀌면 GitHub Actions가 `medtech.apk`를 다시 만든다 |

데이터: Supabase `leveltest` 프로젝트의 `medtech_sets`(날짜별 30문항), `submissions`(page = 'medtech').
