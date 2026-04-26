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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

install_project_skill() {
  local host="$1"
  local skill_name="$2"
  local source_dir="$3"
  local target_root

  case "$host" in
    claude)
      target_root="$HOME/.claude/skills"
      ;;
    codex)
      target_root="$HOME/.codex/skills"
      ;;
    *)
      echo "Unknown project skill host: $host" >&2
      exit 1
      ;;
  esac

  if [ ! -d "$source_dir" ]; then
    return
  fi

  mkdir -p "$target_root"
  rm -rf "$target_root/$skill_name"
  cp -R "$source_dir" "$target_root/$skill_name"
  echo "Installed /$skill_name skill for $host -> $target_root/$skill_name"
}

install_project_skill_for_hosts() {
  local skill_name="$1"
  local source_dir="$2"
  case "$HOST" in
    claude)
      install_project_skill claude "$skill_name" "$source_dir"
      ;;
    codex)
      install_project_skill codex "$skill_name" "$source_dir"
      ;;
    both|"")
      install_project_skill claude "$skill_name" "$source_dir"
      install_project_skill codex "$skill_name" "$source_dir"
      ;;
  esac
}

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
cd "$REPO_ROOT"
if [ -x "scripts/setup-git-hooks.sh" ]; then
  echo ""
  echo "Installing git hooks…"
  bash scripts/setup-git-hooks.sh
else
  echo "⚠️  scripts/setup-git-hooks.sh not found or not executable — git hooks not installed." >&2
fi

# ── 5. Install project-local team skills ──────────────────────
PROJECT_SKILLS_ROOT="$REPO_ROOT/.agents/skills"
if [ -d "$PROJECT_SKILLS_ROOT" ]; then
  echo ""
  echo "Installing project skills…"
  for skill_dir in "$PROJECT_SKILLS_ROOT"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name="$(basename "$skill_dir")"
    install_project_skill_for_hosts "$skill_name" "${skill_dir%/}"
  done
fi

echo ""
echo "Done. Next session, try these in your AI coding tool:"
echo "  /feature help        — manage the shared feature inventory"
echo "  /feedback help       — view & investigate user feedback safely"
echo "  /office-hours        — start an ideation session"
echo "  /autoplan            — plan + design + engineering review"
echo "  /qa                  — browser-based QA with auto-fix"
echo "  /ship                — open a PR"
echo "  /freeze <path>       — lock a folder from edits"
echo ""
echo "(In Codex these are prefixed: /gstack-office-hours, /gstack-qa, etc.)"
