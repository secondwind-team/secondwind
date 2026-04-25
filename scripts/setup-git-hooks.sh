#!/usr/bin/env bash
# secondwind — git hook 설치 스크립트.
#
# 목적:
#   1. 회사 이메일이 실수로 섞이는 것 차단
#   2. main/master 직접 commit 차단 (모든 변경은 PR 경유)
#   3. 에이전트 이름 prefix 브랜치 차단 (codex-*, claude-* 등)
#   4. repo-local git identity 가 비어 있으면 경고
#
# 사용:
#   ./scripts/setup-git-hooks.sh
#
# 각 팀원이 clone 후 한 번만 실행하면 됩니다. 이미 설치돼 있어도 안전 (덮어씀).
# 상세 규칙은 GIT.md 참조.

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_PATH="$REPO_ROOT/.git/hooks/pre-commit"

mkdir -p "$REPO_ROOT/.git/hooks"

cat > "$HOOK_PATH" <<'HOOK'
#!/bin/sh
# secondwind pre-commit hook.
#
# Source of truth: scripts/setup-git-hooks.sh (이 hook 은 거기서 생성됨)
# 규칙 상세: GIT.md
#
# 우회가 정말 필요하면: git commit --no-verify
# (의식적인 결정으로만 — 회사 도메인·main commit 같은 위험은 차단 의도가 명확함)

EMAIL=$(git config user.email)
NAME=$(git config user.name)
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")

# 1. identity 비어 있으면 차단
if [ -z "$EMAIL" ] || [ -z "$NAME" ]; then
  echo "❌ git user.name 또는 user.email 이 설정되어 있지 않습니다." >&2
  echo "   repo-local 로 설정하세요:" >&2
  echo "     git config user.name <이름>" >&2
  echo "     git config user.email <개인-이메일>" >&2
  exit 1
fi

# 2. 회사 도메인 차단
case "$EMAIL" in
  *woowahan*|*@*.work|*@corp.*|*@*internal*)
    echo "❌ 회사성 이메일이 감지되었습니다: $EMAIL" >&2
    echo "   secondwind 은 개인 GitHub 계정만 허용합니다." >&2
    echo "   변경: git config user.email <개인-이메일>" >&2
    exit 1
    ;;
esac

# 3. main/master 직접 commit 차단
case "$BRANCH" in
  main|master)
    echo "❌ '$BRANCH' 브랜치에 직접 commit 할 수 없습니다." >&2
    echo "   모든 변경은 새 브랜치 → PR → merge 입니다 (GIT.md)." >&2
    echo "" >&2
    echo "   새 브랜치 만들기:" >&2
    echo "     git checkout -b <type>/<scope>-<desc>" >&2
    echo "     예: git checkout -b feat/travel-share-links" >&2
    echo "" >&2
    echo "   type: feat | fix | docs | refactor | chore" >&2
    exit 1
    ;;
esac

# 4. 에이전트 이름 prefix 차단
case "$BRANCH" in
  codex-*|claude-*|gpt-*|gemini-*|*-bot-*|bot-*)
    echo "❌ 에이전트 이름 prefix 는 브랜치명에 쓸 수 없습니다: $BRANCH" >&2
    echo "   브랜치는 '누가' 가 아니라 '무엇을' 로 이름 짓습니다 (GIT.md)." >&2
    echo "" >&2
    echo "   브랜치명 변경:" >&2
    echo "     git branch -m <type>/<scope>-<desc>" >&2
    echo "     예: git branch -m feat/travel-ui-refresh" >&2
    exit 1
    ;;
esac

# 5. 권장 형식 — 위반 시 warning (통과시킴)
case "$BRANCH" in
  feat/*|fix/*|docs/*|refactor/*|chore/*)
    : # OK
    ;;
  *)
    echo "⚠️  권장 브랜치 형식이 아닙니다: $BRANCH" >&2
    echo "   권장: <type>/<scope>-<desc> (kebab-case)" >&2
    echo "   type: feat | fix | docs | refactor | chore" >&2
    echo "   상세: GIT.md" >&2
    echo "" >&2
    echo "   (commit 은 통과시킵니다 — 다음 작업부터 적용해 주세요)" >&2
    echo "" >&2
    ;;
esac

exit 0
HOOK

chmod +x "$HOOK_PATH"

echo "✅ pre-commit hook 설치 완료: $HOOK_PATH"
echo "   현재 identity: $(git config user.name) <$(git config user.email)>"
echo "   현재 브랜치:   $(git symbolic-ref --short HEAD 2>/dev/null || echo '(none)')"
echo ""
echo "   차단 규칙: 회사 도메인 / main 직접 commit / 에이전트 prefix"
echo "   상세: GIT.md"
