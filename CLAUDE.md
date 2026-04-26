# secondwind — Claude Code 지시문

Claude Code 가 매 세션 자동으로 읽는 파일. Codex 등 다른 에이전트는 동일 라우팅 구조의 `AGENTS.md` 를 읽음.

---

## 공통 규칙 — 반드시 따른다

작업 전 다음 파일들을 읽고 그 규칙을 따른다.

- **프로젝트 현황·팀 원칙·가드레일**: `PROJECT.md`
- **Git 작업 (브랜치·commit·PR·main 보호)**: `GIT.md` — git 관련 작업 전 반드시 먼저 읽을 것
- **gstack 도구 명령어**: `GSTACK.md`
- **문서 작성 규칙 (`docs/`)**: `docs/README.md`

세션 시작 시 `CLAUDE.md` 만 자동 컨텍스트에 로드됨. 위 파일들은 능동적으로 Read 해야 보임 — 작업 시작 전 반드시 읽을 것.

---

## Claude Code 전용 사항

### gstack 스킬 이름

Claude Code 에서 gstack 스킬은 **prefix 없이** 호출:

```
/office-hours, /autoplan, /investigate, /freeze, /careful,
/review, /qa, /ship, /land-and-deploy, /canary,
/plan-eng-review, /plan-design-review, /codex …
```

(Codex 환경에선 `/gstack-` 접두사가 붙음 — `AGENTS.md` 참조)

### 프로젝트 공용 스킬

`./scripts/bootstrap.sh` 실행 후 repo-local 스킬이 Claude Code 로 설치됨.

- **`/feature`**: `docs/plans/2026-04-26-feature-inventory.md` 를 기준으로 feature 목록 조회, 상세 보기, 추가, 수정, 삭제/폐기 표시, 구현 시작을 돕는다.
- **`/feedback`**: 운영 환경 사용자 피드백·버그리포트를 admin endpoint 로 받아 로컬 캐시 (`docs/feedback/feedback.local.json`) 에서 조회·분석·수정한다. prod KV 토큰을 로컬에 두지 않는다 (TRAVEL-FEEDBACK-01). 자세한 워크플로는 `docs/feedback/README.md`.
- 도움말: `/feature help`, `/feedback help`

### 도구별 quirk

- gstack skill 본체는 `~/.claude/skills/gstack/<skill>/SKILL.md`.
- 프로젝트 공용 skill 원본은 `.agents/skills/<name>/SKILL.md`, Claude Code 설치본은 `~/.claude/skills/<name>/SKILL.md` (현재: `feature`, `feedback`).
- Claude Code 는 conversation 시작 시 `CLAUDE.md` 만 자동 로드 — 다른 .md 파일은 명시적 Read 필요.
