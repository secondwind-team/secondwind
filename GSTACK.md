# GSTACK — 이 프로젝트에서의 gstack 사용 가이드

[gstack](https://github.com/garrytan/gstack) 은 Garry Tan 이 만든 Claude Code 용 스킬·워크플로 툴킷입니다. secondwind 는 이걸 팀 공용 워크플로 레이어로 사용합니다 — 1인 개발자 + 2인 비개발자 팀에서 같은 명령어·리뷰 절차를 공유하기 위해.

**이 문서의 역할:** 우리 팀이 gstack 을 어떻게 설치·사용·유지하는지 정리. 프로젝트 자체(제품·팀 원칙) 는 `README.md`, `CLAUDE.md`, `AGENTS.md` 를 참조하세요.

---

## 사전 조건

- **Git**
- **Bash 환경** — macOS / Linux 는 기본 제공. Windows 는 WSL2 또는 Git Bash 필요 (아래 Windows 섹션 참고).
- **AI CLI 중 하나 이상**
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — 개발자 권장
  - [Codex CLI](https://github.com/openai/codex) — 비개발자 현재 사용

> Bun 은 bootstrap 스크립트가 없는 경우 자동 설치합니다.

---

## 설치

저장소를 클론한 뒤 프로젝트 루트에서 한 번만 실행하면 됩니다.

```bash
git clone https://github.com/akushig/secondwind.git secondwind
cd secondwind
./scripts/bootstrap.sh          # Claude Code + Codex 둘 다 설치
```

스크립트는 idempotent — 다시 실행해도 안전합니다. gstack 설치와 함께 **repo-local git hook 도 같이 설치** 합니다 (회사 도메인 / main 직접 commit / 에이전트 prefix 차단 — 상세는 `GIT.md`).

| 상황 | 명령 |
|---|---|
| Claude Code 만 사용 | `./scripts/bootstrap.sh claude` |
| Codex 만 사용 | `./scripts/bootstrap.sh codex` |
| 둘 다 사용 (기본) | `./scripts/bootstrap.sh` |

설치 후 Claude Code / Codex CLI 를 **재시작** 해야 새 스킬이 인식됩니다.

---

## 꼭 알아야 할 5개 명령어

| 명령 | 언제 쓰는가 |
|---|---|
| `/office-hours` | "아이디어가 있는데 어디서부터 시작할지 모르겠다." YC 스타일 6가지 질문으로 아이디어를 다듬음. |
| `/autoplan` | 아이디어가 명확해졌을 때. CEO → 디자인 → 엔지니어링 리뷰를 한 번에 돌려 구체적 계획 생성. |
| `/qa` | 뭔가 만들고 나서. 실제 브라우저를 열어 테스트하고 버그를 자동 수정. |
| `/ship` | 큰 PR·복합 릴리스·강한 release audit 이 필요할 때 사용. 일상적인 push/PR 은 `GIT.md` 의 간소 Ship 체크리스트를 기본으로 한다. |
| `/freeze <경로>` | "이 폴더는 건드리지 마." 지정 경로는 `/unfreeze` 전까지 편집 금지. |

Codex 에서는 전부 `gstack-` 접두사가 붙습니다 — 예: `/gstack-qa`, `/gstack-ship`.

전체 스킬 목록 (23 스킬 + 8 파워 툴):
- Claude Code: `~/.claude/skills/gstack/docs/skills.md`
- Codex: `~/.codex/skills/gstack/docs/skills.md`

---

## Windows 환경

gstack 은 **네이티브 Windows (CMD / PowerShell) 에서 직접 동작하지 않습니다.** SKILL.md 들이 bash 프리앰블을 실행하고, `/browse`·`/qa`·`/design-review` 같은 핵심 기능이 Chromium / Playwright 에 의존하기 때문입니다. 아래 두 경로 중 하나 필수.

### 권장: WSL2 (Ubuntu)

macOS 와 거의 동일한 경험. 가장 안정적.

1. Windows 에서 WSL2 + Ubuntu 설치 (Microsoft 공식 가이드 참고).
2. Ubuntu 안에서 `git`, `node` 설치.
3. Ubuntu 쉘에서 프로젝트 클론 후 `./scripts/bootstrap.sh` 실행.
4. Claude Code / Codex CLI 도 WSL 안에서 실행.

### 대안: Git Bash (Git for Windows)

가능은 하지만 제약 있음. gstack 공식 문서의 명시적 추가 요구사항:

> *"gstack works on Windows 11 via Git Bash or WSL. Node.js is required in addition to Bun — Bun has a known bug with Playwright's pipe transport on Windows. Make sure both `bun` and `node` are on your PATH."*

필요한 것:
1. **Git for Windows** (Git Bash 포함)
2. **Node.js** — Bun 단독으로는 `/browse`·`/qa` 가 Playwright 버그로 깨짐. Node.js 폴백 필수.
3. Bun — bootstrap 이 자동 설치. `~/.bashrc` 에 `export PATH="$HOME/.bun/bin:$PATH"` 를 직접 추가해야 다음 세션부터 인식됨.

---

## Codex 에서 Claude Code 로 옮겨가기

비개발자 팀원이 나중에 Codex → Claude Code 로 이전해도 근육 기억이 거의 그대로 이어집니다 — **슬래시 명령 이름이 같고**, `gstack-` 접두사만 빠집니다. 그 시점에 한 번만 실행:

```bash
./scripts/bootstrap.sh claude
```

---

## 업그레이드

gstack 은 자주 업데이트됩니다. 다시 당기려면:

```bash
./scripts/bootstrap.sh
```

스크립트가 `git pull --ff-only` 로 최신 gstack 을 가져온 뒤 `./setup` 을 다시 돌립니다.

또는 Claude Code 세션 안에서 `/gstack-upgrade` 를 실행해도 됩니다.

---

## 트러블슈팅

| 문제 | 해결 |
|---|---|
| `bun: command not found` | 쉘 재시작. 안 되면 `export PATH="$HOME/.bun/bin:$PATH"` |
| Claude Code 에 슬래시 명령이 안 보임 | bootstrap 뒤 Claude Code **재시작** 필요 |
| Codex 에 `gstack-*` 명령이 없음 | `ls ~/.codex/skills/` 확인. 비어 있으면 `./scripts/bootstrap.sh codex` 재실행 |
| "gstack is outdated" 메시지 | `./scripts/bootstrap.sh` 재실행 (pull + setup) |
| `/browse` 가 실패 | `cd ~/.claude/skills/gstack && bun install && bun run build` |
| Codex 가 `"Skipped loading skill(s) due to invalid SKILL.md"` 경고 | `cd ~/.codex/skills/gstack && git pull && ./setup --host codex` |

---

## 왜 gstack 을 선택했는가 (설계 맥락)

- **1인 개발자 + 2인 비개발자** 구조에서 *같은 명령어 이름* 을 공유하면 의사소통 비용이 크게 줄어든다.
- gstack 의 `/office-hours`, `/autoplan`, `/qa` 는 **제품이 없는 초기 단계** 에서 아이디어 → 계획 → 실행까지 가이드해 준다.
- `/review`, `/qa`, `/land-and-deploy` 로 PR 전후 품질 기준을 유지한다. `/ship` 은 매번 쓰는 기본 PR 경로가 아니라, 릴리스 감사가 실제로 필요한 큰 변경에 선택적으로 사용한다.
- 비개발자가 Codex → Claude Code 로 옮겨가도 **슬래시 명령 이름이 같음** (접두사만 빠짐). 전환 비용 최소.

상세한 설계 철학은 `~/.claude/skills/gstack/CLAUDE.md` 참고.
