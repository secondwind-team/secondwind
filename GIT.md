# secondwind — Git workflow

이 파일은 git 작업(브랜치 생성·commit·push·PR·merge)의 모든 규칙을 정의합니다. **AI 에이전트는 git 관련 작업 전 반드시 이 파일을 읽고 따라야 합니다.**

---

## 절대 규칙

- **`main` 브랜치에 직접 commit/push 금지.** 모든 변경은 새 브랜치 → PR → merge.
- **PR 없이 main 에 합치지 않는다.** 사람도 AI 도 예외 없음.
- **회사 계정/이메일 (`*@woowahan.com`, GitLab 등) 절대 금지.** 개인 GitHub `akushig` 만 사용.

---

## 브랜치 워크플로

### 새 작업 시작 — 즉시 새 브랜치

```bash
git checkout main
git pull
git checkout -b <type>/<scope>-<desc>
```

main 에서 작업하지 않습니다. 코드 한 줄 고치기 전에 브랜치부터.

### 브랜치명 컨벤션

형식: **`<type>/<scope>-<short-kebab-desc>`**

**Type prefix (5종):**

| Prefix | 언제 |
|---|---|
| `feat/` | 새 기능, 사용자가 보는 변화 |
| `fix/` | 버그 수정 |
| `docs/` | 문서·README·CHANGELOG 만 변경 |
| `refactor/` | 동작 무변경, 내부 구조만 |
| `chore/` | 의존성·CI·스크립트·tooling |

**Scope** = 서비스명·영역명(`travel`, `diary`, `common`, `infra`, `agent-rules` 등). 어느 영역의 변경인지 브랜치명만 보고 알 수 있게.

**예시 (실제 사용된 것 + 권장):**
```
feat/travel-share-links
fix/transit-missing-row
docs/todos-prompt-eval
refactor/quota-store-extract
chore/eslint-restricted-imports
```

**금지 패턴:**

| 금지 | 이유 |
|---|---|
| `main` / `master` 직접 commit | 모든 변경은 PR 경유 |
| `codex-*`, `claude-*`, `<agent>-*` | 누가 작성했는지가 아니라 **무엇을 하는지** 가 브랜치 정체성 |
| 한글 브랜치명 | CLI·CI·일부 도구 호환성 |
| 이슈 번호 단독 (`pr-19`, `issue-42`) | 의미 없음, history 추적 불가 |
| 50자 초과 | 터미널·UI 잘림 |

---

## Commit 메시지 규칙

AI 가 `git commit` 을 생성할 때:

- **제목과 본문 모두 한글** 로 작성. 기술 용어·파일명·명령어(예: `pre-commit`, `CODEOWNERS`, `.github/workflows/`) 는 원문 유지 가능.
- **`Co-Authored-By:` trailer 넣지 말 것.** AI 모델 서명 (`Claude Opus ... <noreply@anthropic.com>`, `Codex ... <noreply@openai.com>` 등) 은 GitHub UI 에서 봇 아바타가 붙어 커밋 저자가 혼잡해 보임. 사용자(akushig) 단독 author 로 깨끗하게.
- 사람 팀원이 직접 커밋하는 경우는 자유 (이 규칙은 AI 에이전트 대상).

---

## Git identity 규칙

이 프로젝트는 **개인 GitHub 계정만** 허용합니다.

- 커밋 전 `git config user.email` 이 개인 이메일인지 확인
- 회사 도메인 흔적 (`*@woowahan.com`, GitLab 등) 발견 시 즉시 멈추고 사용자에게 알림
- 원격 URL 도 `github.com` 만 허용 (gitlab·사내 호스트는 거부)
- `scripts/setup-git-hooks.sh` 로 `pre-commit` 훅이 회사 도메인을 자동 차단함 — clone 후 반드시 한 번 실행

---

## PR 워크플로

### 일반 흐름

```
1. 브랜치 따고 작업      → git checkout -b <type>/<scope>-<desc>
2. PR 올림              → sync 없이 바로 (main 이 안 움직였을 수 있음)
3. 리뷰 받음            → main 이 움직였으면 GitHub "Update branch" 버튼 누름
4. Merge 직전           → "Update branch" 한 번 더 → CI 통과 확인 → merge
```

### Merge 직전 main sync 는 필수

Vercel preview 가 "**진짜 main + 내 변경**" 으로 한 번 더 검증되도록.

이유: Vercel preview 는 내 브랜치 HEAD 만 빌드하기 때문에, main 의 최신 환경변수·레이아웃 수정이 안 들어가 있을 수 있음. Sync 안 하면 "preview 는 멀쩡 → production 깨짐" 가능.

권장: GitHub repo Settings → "Require branches to be up to date before merging" 체크 — merge 직전 sync 가 강제됨.

### Rebase vs Merge

이 팀 규모(2명 + AI)에선 **merge commit 그대로** 두는 쪽. Rebase + force-push 는 commit history 가 갈려서 리뷰 코멘트 추적이 어려워짐.

---

## main 머지 후 자동 배포

`main` 브랜치에 merge → **Vercel production 자동 배포** (`https://secondwind-mu.vercel.app`).
Feature 브랜치 push → Vercel preview 자동 배포 (브랜치별 URL).

PR merge 전 Vercel preview 확인 필수. 운영 환경변수·도메인 정보는 `TODOS.md` 참조.

---

## 강제 메커니즘

| 레이어 | 도구 | 차단 항목 |
|---|---|---|
| 문서 | `GIT.md` (이 파일) | AI 에이전트가 읽고 따름 |
| 로컬 hook | `scripts/setup-git-hooks.sh` 가 설치하는 `pre-commit` | 회사 도메인 / main·master 직접 commit / 에이전트 prefix(`codex-*`, `claude-*` 등) |
| 서버 | GitHub branch protection on `main` | direct push 금지, PR 필수, 우회 불가 |

clone 후 반드시 `bash scripts/setup-git-hooks.sh` 한 번 실행.

### Hook 우회

`--no-verify` 로 hook 을 건너뛸 수 있습니다 (`git commit --no-verify`). 하지만 이는 **의식적인 결정** 으로만 사용:

- ✅ **정당한 케이스**: hook 자체에 버그가 있어 정상 commit 이 막히는 경우
- ❌ **금지**: main 에 commit 이 안 된다고 우회 / 회사 도메인이 떠서 우회

서버 측 branch protection 은 우회 불가 — 그래서 hook + protection 양쪽이 다 필요합니다.
