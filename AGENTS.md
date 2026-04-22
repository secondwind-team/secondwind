# secondwind — 에이전트 지시문 (Codex / 기타)

이 파일은 `CLAUDE.md` 와 동일한 팀 원칙을 Codex 및 AGENTS.md 를 읽는 에이전트 관점으로 작성한 문서입니다.

- Claude Code 라면 `CLAUDE.md` 를 읽으세요.
- Codex 또는 기타 에이전트는 아래가 적용됩니다.

---

## 도구 환경

이 프로젝트는 [gstack](./GSTACK.md) 을 공용 워크플로 레이어로 사용합니다. Codex 에서 gstack 스킬은 `gstack-` 접두사가 붙습니다 (예: `/gstack-qa`, `/gstack-ship`).

전체 명령어 목록·설치·트러블슈팅은 `GSTACK.md` 와 `~/.codex/skills/gstack/AGENTS.md` 를 참조하세요.

---

## 현재 단계

**v0 스캐폴딩 진입 (2026-04-22).** Next.js 15 + App Router + Tailwind + TypeScript. 첫 서비스는 `/travel`. 거절한 리뷰 챌린지·수용한 리스크는 `docs/decisions/0001-v0-stack-and-accepted-risks.md` 참고.

- `npm install` · Gemini API 키 · PWA · 실제 플랜 생성 흐름은 아직 미연결 (다음 이터레이션).
- Dogfooding gate (2026-05-06 여행 날짜) 오픈. 해결 실패 시 Plan A/B.
- Cross-service 직접 import 금지 — 공유는 `components/common` · `lib/common`.
- 새 패키지 추가는 사용자 확인 후. sovereignty 결정 (공유 `/api/gemini`, "70%" 카피, 3-4 주말 스코프) 존중.

---

## 팀 원칙 (매 세션 적용)

도구와 무관하게 지켜야 할 원칙:

1. **재현이 먼저, 수정은 그 다음.** (`/gstack-investigate`)
2. **편집 제한 영역 존중.** freeze 된 경로는 수정하지 않는다. 파괴적 명령은 사용자에게 먼저 확인. (`/gstack-freeze`, `/gstack-careful`)
3. **작은, 리뷰 가능한 PR.** `/gstack-ship` 으로 테스트·커버리지 거쳐 연다.
4. **비개발자 청중 고려.** 변경 설명은 *사용자가 보게 될 것* 이 먼저, 코드 변경은 그 다음.
5. **프로토타입에도 프로덕션 기준.** `/gstack-review` + `/gstack-qa` 를 `/gstack-ship` 전에 반드시.

---

## 커밋 메시지 규칙

AI 가 `git commit` 을 생성할 때:

- **제목과 본문 모두 한글** 로 작성. 기술 용어·파일명·명령어(예: `pre-commit`, `CODEOWNERS`, `.github/workflows/`)는 원문 유지 가능.
- **`Co-Authored-By:` trailer 넣지 말 것.** AI 모델 서명 (`Claude ... <noreply@anthropic.com>`, `Codex ... <noreply@openai.com>` 등) 은 GitHub UI 에서 봇 아바타가 붙어 커밋 저자가 혼잡해 보이므로 이 프로젝트에서는 생략. 사용자(akushig) 단독 author 로 깨끗하게.
- 사람 팀원이 직접 커밋하는 경우는 자유 (이 규칙은 AI 에이전트 대상)

---

## Git identity 규칙 (중요)

이 프로젝트는 **개인 GitHub 계정만** 허용합니다. 회사 계정/이메일 (`*@woowahan.com`, GitLab 등) 은 **절대** 커밋·원격·설정에 섞이지 않게 합니다.

- 커밋 전 `git config user.email` 이 개인 이메일인지 확인
- 회사 도메인 흔적 발견 시 즉시 멈추고 사용자에게 알림
- 원격 URL 도 `github.com` 만 허용 (gitlab·사내 호스트는 거부)
- `scripts/setup-git-hooks.sh` 로 `pre-commit` 훅이 회사 도메인을 자동 차단함 — clone 후 반드시 한 번 실행

---

## 문서 작성 규칙 (`docs/`)

폴더 구조·파일명 규칙은 `docs/README.md` 참고. **frontmatter 는 쓰지 않는다** — 문서가 지저분해져서 규칙에서 제외함.

---

## 반드시 개발자 확인을 받아야 하는 작업

다음 작업은 비개발자 팀원이 아니라 **개발자 본인** 에게 확인받고 진행:

- 스키마 마이그레이션, 파괴적 DB 작업
- `.github/`, `scripts/`, `package.json`, 락파일, CI 설정 변경
- Secret / API 키 / OAuth 설정 추가 또는 변경
- Force push, 공유 브랜치의 rebase, `git reset --hard`

재작성보다 추가 변경 선호. 애매하면 `/gstack-plan-eng-review` 먼저.

---

## 일반적 워크플로

```
/gstack-office-hours  →  /gstack-autoplan  →  구현
    →  /gstack-review  →  /gstack-qa  →  /gstack-ship
    →  /gstack-land-and-deploy  →  /gstack-canary
```
