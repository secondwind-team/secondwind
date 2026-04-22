# 0001 — v0 스택 결정 및 수용한 리스크

> 작성: 2026-04-22 · 상태: Accepted
> 근거 문서:
> - 설계: `~/.gstack/projects/akushig-secondwind/akushi-main-design-20260422-102616.md`
> - 테스트 플랜: `~/.gstack/projects/akushig-secondwind/akushi-main-test-plan-20260422-224653.md`

## 결정

secondwind 는 하나의 Next.js 15 App Router 모노 앱으로 시작한다. 첫 서비스는 `/travel`.

- **프레임워크:** Next.js 15 + React 19 + TypeScript
- **스타일:** Tailwind CSS 3.4
- **LLM:** Gemini 2.5 Flash Lite (무료 티어), REST 직접 호출 (`lib/common/llm.ts` 얇은 래퍼)
- **저장:** v0 는 localStorage 만. Vercel KV / Upstash 는 v0.5 이후.
- **배포:** Vercel 무료 티어 (커스텀 도메인 검토)
- **공유 API 프록시:** `/api/gemini` 한 개로 3개 서비스 공유 (SPOF 리스크 수용)
- **파일 구조:** `app/(site)/{travel,diary,experiment-3}` · `components/common` · `lib/common`

## 의식적으로 거절한 리뷰어 권고 (sovereignty)

/autoplan Eng Review 의 CRITICAL 권고 4건을 akushi 가 직접 거절. 속도·학습 우선의 사이드 프로젝트 맥락 존중.

| # | 권고 | 결정 | 재검토 조건 |
|---|---|---|---|
| 1 | chat 부분 수정 → v0.5 로 미루기 | 거절 · v0 포함 유지 | destructive overwrite 사고 발생 시 |
| 2 | `/api/gemini` → per-service endpoint 분리 | 거절 · 공유 프록시 유지 | 한 서비스 quota 소진으로 타 서비스 정전 시 |
| 3 | "이 정도면 70% 만족" 카피 교체 | 거절 · 원안 유지 | 실 사용자 피드백이 "가짜 같다" 일 때 |
| 4 | v0 스코프 확장 (validator + rate limit + Upstash + Sentry + eval) | 거절 · 원래 3-4 주말 범위 유지 | 위 사고 중 하나라도 발생 시 |

## 의식적으로 건너뛴 블로커

**Pre-code exit criteria 6개 항목 (골든셋 30개, validator 명세, failure state UI copy, rate limit 설계, prompt version env var 방식, CODEOWNERS + ESLint boundaries)** 를 스캐폴딩 이전 블로커로 두지 않는다.

- CODEOWNERS · ESLint boundaries 는 최소본으로 동봉 (`no-restricted-imports` 로 cross-service import 금지).
- 나머지는 첫 eval 루프에 부딪히기 전까지 보류.

## 수용한 리스크 (운영으로 모니터)

1. **[CRITICAL] Dogfooding gate 우회.** akushi 가 14일 내 실제 여행 날짜 확보 전에 스캐폴딩 진입. Primary user 가 아직 허구. Deadline: 2026-05-06 까지 날짜 확보 못 하면 Plan A (travel-first 포기 후 `/office-hours` 재실행) 또는 Plan B (지인 1명으로 primary user 교체).
2. **[CRITICAL] Team alignment.** 태훈·덕우와 모노 플랫폼 동의가 암묵적. 두 사람이 별도 repo 선호로 돌아서면 전체 아키텍처 재논의.
3. **[CRITICAL] LLM hallucination.** Grounding 부재. POI/영업시간/이동시간이 허구일 가능성. v0 마이크로카피로만 완화 ("실제 방문 전 확인 권장"). v1 에 Naver/Kakao grounding 고려.
4. **[HIGH] Public endpoint abuse.** `/api/gemini` 는 session HMAC·rate limit 없이 POST 허용. adversary 가 하루 quota 를 분 단위로 소진 가능. Kill switch 환경변수 (`GEMINI_DISABLED=1`) 만 우선 구비.
5. **[HIGH] Eval 부재.** 프롬프트 회귀 탐지 수단 없음. 첫 회귀 체감 시 골든셋 도입 검토.

## 포싱 이벤트

여행 날짜 확보는 2026-05-06 을 마지노선으로 삼는다. 그 날까지 확정 실패 시 이 ADR 을 업데이트하고 Plan A 또는 Plan B 로 이동.
