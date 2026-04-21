#!/usr/bin/env bash
# secondwind team bootstrap — installs gstack for Claude Code and Codex.
# Run once per teammate after cloning this repo.
#
# Usage:
#   ./scripts/bootstrap.sh            # installs for both Claude Code and Codex
#   ./scripts/bootstrap.sh claude     # Claude Code only
#   ./scripts/bootstrap.sh codex      # Codex only

set -e

HOST="${1:-both}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GSTACK_DIR="$REPO_ROOT/.agents/skills/gstack"

# ── 1. Ensure Bun is installed ────────────────────────────────
if ! command -v bun >/dev/null 2>&1; then
  if [ -x "$HOME/.bun/bin/bun" ]; then
    export PATH="$HOME/.bun/bin:$PATH"
  else
    echo "Bun not found. Installing (prebuilt binary, ~60MB)…"
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
    echo "Bun installed. Restart your shell later so 'bun' is on PATH by default."
  fi
fi

echo "Bun: $(bun --version)"

# ── 2. Clone gstack if missing ────────────────────────────────
if [ ! -d "$GSTACK_DIR/.git" ]; then
  echo "Cloning gstack into .agents/skills/gstack…"
  mkdir -p "$(dirname "$GSTACK_DIR")"
  git clone --depth=1 https://github.com/garrytan/gstack.git "$GSTACK_DIR"
else
  echo "gstack already present — pulling latest…"
  (cd "$GSTACK_DIR" && git pull --ff-only || true)
fi

# ── 3. Run gstack setup for requested host(s) ─────────────────
cd "$GSTACK_DIR"
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

echo ""
echo "Done. Try these in your AI coding tool:"
echo "  /office-hours      — start an ideation session"
echo "  /autoplan          — plan + design + engineering review"
echo "  /qa                — browser-based QA with auto-fix"
echo "  /ship              — open a PR"
echo "  /freeze <path>     — lock a folder from edits"
