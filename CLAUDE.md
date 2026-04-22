# secondwind — Claude Code 용 프로젝트 지시문

이 파일은 Claude Code 가 매 세션마다 자동으로 읽는 팀 규칙입니다.
다른 에이전트(Codex 등) 는 같은 내용의 `AGENTS.md` 를 읽습니다.

---

## 현재 단계 — 이 섹션부터 먼저 읽을 것

**v0 스캐폴딩 진입 (2026-04-22).** Next.js 15 + App Router + Tailwind + TypeScript 기본 골격 작성 완료. 첫 서비스는 `/travel`. 제품 방향·거절한 챌린지·수용한 리스크는 `docs/decisions/0001-v0-stack-and-accepted-risks.md` 를 먼저 읽을 것.

**아직 없는 것:** `npm install` 미실행 (`node_modules` 없음), Gemini API 키 미설정, PWA manifest·서비스 워커 미작성, travel 폼 제출이 아직 `/api/gemini` 로 연결되지 않음 (scaffold 상태).

**오픈 블로커 (사용자 sovereignty 하에 진행):**
- **Dogfooding gate 미해결** — 2026-05-06 까지 실제 여행 날짜 확보 못 하면 Plan A/B 재검토 (ADR 0001 참고).
- Pre-code exit criteria 의 골든셋·validator·rate limit 설계 등은 의식적으로 건너뜀 (ADR 0001).

**이 단계에서의 에이전트 행동 규칙:**
- Cross-service 직접 import 금지 (ESLint `no-restricted-imports` 로 차단). 공유 코드는 `components/common` · `lib/common`.
- 설계 문서와 ADR 0001 에 명시된 sovereignty 결정을 존중 (공유 `/api/gemini` 프록시, "70%" 카피, chat edit v0 포함, 3-4 주말 스코프).
- 새 패키지 추가는 사용자 확인 후. 가능한 한 의존성 최소.
- `README.md`, `CLAUDE.md`, `AGENTS.md`, `GSTACK.md`, `scripts/`, `docs/` 는 팀 세팅 보강 목적으로 자유롭게 수정 가능.

---

## 팀 원칙 (매 세션 적용)

아래는 **도구와 무관하게** 이 팀에서 지켜야 할 기본 원칙입니다. 사용 도구(gstack) 의 구체적 명령어·사용법은 `GSTACK.md` 와 `~/.claude/skills/gstack/CLAUDE.md` 를 참조하세요.

1. **재현이 먼저, 수정은 그 다음.** 원인을 파악하지 못한 채 패치하지 않는다. (도움: `/investigate`)
2. **편집 제한 영역 존중.** 경로가 freeze 되어 있으면 수정하지 않는다. 파괴적 명령은 사용자에게 먼저 확인. (`/freeze`, `/careful`)
3. **작은, 리뷰 가능한 변경.** 한 PR 에 한 관심사. PR 은 `/ship` 으로 연다 (테스트·커버리지 자동 체크).
4. **비개발자 청중 고려.** 팀원 중 2명은 diff 를 해석하지 못한다. 변경을 설명할 때는 *사용자가 보게 될 것* 을 먼저, *코드가 어떻게 바뀌었는지* 는 그 다음에.
5. **프로토타입에도 프로덕션 기준.** `/review` (버그 스윕) + `/qa` (실제 브라우저) 를 `/ship` 전에 반드시 돌린다.

---

## 커밋 메시지 규칙

AI 가 `git commit` 을 생성할 때:

- **제목과 본문 모두 한글** 로 작성. 기술 용어·파일명·명령어(예: `pre-commit`, `CODEOWNERS`, `.github/workflows/`)는 원문 유지 가능.
- **`Co-Authored-By:` trailer 넣지 말 것.** AI 모델 서명 (`Claude Opus ... <noreply@anthropic.com>` 등) 은 GitHub UI 에서 봇 아바타가 붙어 커밋 저자가 혼잡해 보이므로 이 프로젝트에서는 생략. 사용자(akushig) 단독 author 로 깨끗하게.
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

## 비개발자 팀원을 위한 가드레일

- `.github/`, `scripts/`, `package.json`, 락파일, CI 설정을 건드리는 변경에는 **사람이 읽을 수 있는 위험 설명** 을 반드시 같이 남긴다.
- 스키마 마이그레이션, DB 작업, 외부 API 키 변경이 계획에 포함되면 **개발자에게 먼저 질문**.
- 재작성보다 **추가 변경을 선호**. 애매하면 `/plan-eng-review` 를 먼저 돌린다.

---

## 일반적 워크플로 (happy path)

```
/office-hours  →  /autoplan  →  구현  →  /review  →  /qa
    →  /ship  →  /land-and-deploy  →  /canary
```

개별 명령어의 상세 사용법은 `GSTACK.md` 와 `~/.claude/skills/gstack/<skill>/SKILL.md` 참조.
