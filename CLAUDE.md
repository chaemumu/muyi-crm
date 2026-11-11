# MUYI CRM — 영업 관리 내부 툴

## 프로젝트 정체성
- 무이코퍼레이션 영업팀 내부 CRM (가망 DB · 콜 기록 · 일정 · 팀 관리)
- 원칙: **효율 > 디자인**. 빠른 입력, 데이터 명확성, 단순한 UI
- 배포: Vercel `muyi-crm` → https://muyi-crm.vercel.app (main 푸시 시 자동 배포)
- 같은 회사의 다른 프로젝트와 혼동 금지
  - `muyi-homepage`: 홈페이지 + 문의함(`/admin`), Supabase `pacyhanuwuizcxwoggen`
  - MUYI Lab: 별도 대시보드 (이 저장소 아님) — CRM UI 디자인 기준

## 스택
- 빌드 없는 정적 사이트: `index.html` + `js/*.js` (전역 스코프, 프레임워크 없음)
- Supabase JS v2 (CDN), Chart.js 4.4, SheetJS 0.18 (엑셀)
- Supabase 프로젝트: `npkpxlbcwmwlxqauevyv` (MUYI CRM, Free 플랜, 서울)

## 파일 구조
| 파일 | 역할 |
|---|---|
| `index.html` | 전체 화면(페이지·모달) + CSS. 페이지 전환은 `goPage('dash'|'crm'|'calendar'|'announce'|'admin'|'manual'|'mypage')` — `master`는 `관리 > 마스터` 탭으로 리다이렉트 |
| `js/supabase.js` | 클라이언트 생성, 인증/프로필(`AU`, `PR` 전역), **장애 감시(monitoredFetch · crmAlert)** |
| `js/crm.js` | 가망 DB 목록·등록·단계(`STAGES`)·일괄 처리 |
| `js/detail.js` | 업체 상세 모달 |
| `js/call.js` | 콜 기록(`call_logs`) |
| `js/main.js` | 대시보드·관리·마스터 설정·공지·일정 등 나머지 |
| `reset-password.html` | 비밀번호 재설정 메일 링크 착지 페이지 |
| `logo-blue.webp` / `logo-white.webp` | 로그인 / 사이드바 로고 (Base64 인라인 금지) |

## 데이터 (public)
- 핵심: `prospects`(가망 DB), `calls`, `call_logs`, `users`(role·name, Auth와 id 공유)
- 운영: `system_settings`(카카오워크 웹훅 등), `blocked_stores`, `goals`, `call_templates`, `announcements`, `upload_approvals`, `db_assignments`, `daily_badges`, `user_settings`
- 권한(`users.role`): `master` > `admin` > 일반 영업 / `inactive`는 로그인 차단. 권한 검사는 RLS + Edge Function에서도 반드시 수행
- 영업 단계: 가망 → 컨택중 → 검토중 → 미팅확정 → 계약완료 / 영업종결

## Edge Functions (CRM 프로젝트)
- `create-user`(마스터 검증 후 service_role 계정 생성), `reset-user-password`(마스터 전용), `kakaowork-notify`(계약·공지·alert 알림), `naver-place`(네이버 지도 URL 파싱)
- `temp-reset-master`: **보안상 비활성화(410)됨 — 재활성화 금지**
- 새 함수는 `verify_jwt: true` 기본. 끌 경우 함수 내부에서 직접 인증

## 장애 알림 (절대 제거 금지)
- 브라우저: `js/supabase.js`의 `monitoredFetch`가 네트워크 오류·5xx·쓰기 4xx·자체 스크립트 오류를 카카오워크로 전송
  - 1차 CRM `kakaowork-notify` → 실패 시 홈페이지 Supabase `notify-alert` (서로 다른 프로젝트라 한쪽 장애에도 도달)
  - 로그인 실패(auth 4xx), 외부 CDN 오류는 제외. 같은 알림 60초 중복 차단
- 서버: `.github/workflows/crm-health.yml` 30분 점검 (CRM 사이트·DB·Auth + 홈페이지·DB·문의 접수 함수)
  - Supabase Free 자동 일시정지 방지 역할도 겸함 → 삭제·주기 완화 금지
- 새 기능에서 Supabase 호출은 반드시 `sb` 클라이언트를 거칠 것 (감시 우회 금지)

## 개발 규칙
- 요청된 부분만 수정, 기존 구조 유지. 전역 함수명 변경 시 `onclick=` 참조까지 함께 수정
- 키: anon 키만 클라이언트에 허용. service_role 키는 Edge Function 환경변수에서만
- 이미지: 표시 크기 3배 이내 WebP. HTML에 Base64 이미지 금지
- 인라인 `style=""` 추가 금지 → CSS 클래스로 (기존 299개는 점진 정리 대상)
- 커밋 전: `node --check js/*.js`, 로컬 서버(`python3 -m http.server`)로 화면 확인

## UX 개선 로드맵 (2026-11 기준)
1. ✅ 로고 Base64 제거 (index.html 792KB → 152KB)
2. ✅ 영업 관리: 목록 중심 + 등록·중복확인 우측 드로어, 전화번호 실시간 중복 검사
3. ✅ 운영관리 + 마스터 설정 → `관리` 단일 메뉴 (탭: 계정관리[admin] / 데이터관리 / 운영관리 / 마스터[master]) — 탭 정의는 `js/main.js` `ADMIN_MAIN_TABS`·`ADMIN_SUB_TABS`
4. MUYI Lab 디자인 시스템 적용 (아이콘 통일·디자인 토큰) — ✅ 다크모드 버튼은 사이드바 하단 1개로 통일 완료
5. 홈페이지 문의 → CRM `prospects` 자동 등록
