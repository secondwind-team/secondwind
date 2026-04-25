#!/usr/bin/env bash
# secondwind team bootstrap — installs gstack for Claude Code and/or Codex.
# Run once per teammate after cloning this repo.
#
# Usage:
#   ./scripts/bootstrap.sh            # installs for both Claude Code and Codex
#   ./scripts/bootstrap.sh claude     # Claude Code only
#   ./scripts/bootstrap.sh codex      # Codex only

set -e

HOST="${1:-both}"
GSTACK_HOME="$HOME/.claude/skills/gstack"

# ── 1. Ensure Bun is installed ────────────────────────────────
if ! command -v bun >/dev/null 2>&1; then
  if [ -x "$HOME/.bun/bin/bun" ]; then
    export PATH="$HOME/.bun/bin:$PATH"
  else
    echo "Bun not found. Installing prebuilt binary (~60 MB)…"
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
    echo "Bun installed. You may need to restart your shell for 'bun' to be on PATH by default."
  fi
fi

echo "Bun: $(bun --version)"

# ── 2. Clone (or update) gstack at the official path ──────────
mkdir -p "$(dirname "$GSTACK_HOME")"
if [ ! -d "$GSTACK_HOME/.git" ]; then
  echo "Cloning gstack to $GSTACK_HOME …"
  git clone --depth=1 https://github.com/garrytan/gstack.git "$GSTACK_HOME"
else
  echo "gstack already installed — pulling latest…"
  (cd "$GSTACK_HOME" && git pull --ff-only || true)
fi

# ── 3. Run gstack setup for the requested host(s) ─────────────
cd "$GSTACK_HOME"
case "$HOST" in
  claude)
    ./setup --quiet
    ;;
  codex)
    ./setup --host codex --quiet
    ;;
  both|"")
    ./setup --quiet
    ./setup --host codex --quiet
    ;;
  *)
    echo "Unknown host: $HOST (expected: claude, codex, both)" >&2
    exit 1
    ;;
esac

# ── 4. Install repo-local git hooks ───────────────────────────
# Returns to the repo root since the gstack setup above changed cwd.
REPO_ROOT="$(dirname "$(dirname "$(realpath "$0")")")"
cd "$REPO_ROOT"
if [ -x "scripts/setup-git-hooks.sh" ]; then
  echo ""
  echo "Installing git hooks…"
  bash scripts/setup-git-hooks.sh
else
  echo "⚠️  scripts/setup-git-hooks.sh not found or not executable — git hooks not installed." >&2
fi

echo ""
echo "Done. Next session, try these in your AI coding tool:"
echo "  /office-hours        — start an ideation session"
echo "  /autoplan            — plan + design + engineering review"
echo "  /qa                  — browser-based QA with auto-fix"
echo "  /ship                — open a PR"
echo "  /freeze <path>       — lock a folder from edits"
echo ""
echo "(In Codex these are prefixed: /gstack-office-hours, /gstack-qa, etc.)"
