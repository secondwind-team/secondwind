# secondwind

A 3-person vibe-coding project: 1 developer + 2 non-developers. Shared AI workflow powered by [gstack](https://github.com/garrytan/gstack).

---

## Setup (for every teammate)

Run these 3 commands in the project root after cloning.

```bash
git clone <this-repo-url> secondwind
cd secondwind
./scripts/bootstrap.sh          # installs Bun + gstack for Claude Code and Codex
```

That's it. The script is idempotent — safe to re-run.

**If you only use Codex**, run `./scripts/bootstrap.sh codex` to skip the Claude Code step.
**If you only use Claude Code**, run `./scripts/bootstrap.sh claude`.

---

## The 5 commands you need to know

| Command | When to use it |
|---|---|
| `/office-hours` | "I have an idea but don't know where to start." The AI asks you 6 YC-style questions and sharpens the idea. |
| `/autoplan` | Idea is clear. Runs CEO review → design review → engineering review in one shot. Produces a concrete plan. |
| `/qa` | You finished building something. Opens a real browser, tests it, and auto-fixes bugs. |
| `/ship` | Ready to hand off. Runs tests, audits coverage, opens a pull request. |
| `/freeze <path>` | "Don't touch this folder." Protects it from accidental edits until you `/unfreeze`. |

On Codex these are prefixed with `gstack-` — e.g., `/gstack-qa`, `/gstack-ship`.

Full command list (23 skills + 8 power tools): `.agents/skills/gstack/docs/skills.md`.

---

## Happy path

```
/office-hours   →   /autoplan   →   build   →   /qa   →   /ship
```

That's the 5-minute-to-deploy loop. Everything else is optional.

---

## Team conventions

Written for the AI agent, not humans, but worth skimming:
- **Claude Code** reads `CLAUDE.md`
- **Codex / others** read `AGENTS.md`

Both files contain the same rules (investigate before patching, respect `/freeze`, stop before destructive ops, etc.).

---

## Switching from Codex to Claude Code later

Your muscle memory transfers — same slash command names (drop the `gstack-` prefix). Re-run `./scripts/bootstrap.sh claude` once and you're set.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `bun: command not found` | Restart shell, or `export PATH="$HOME/.bun/bin:$PATH"` |
| Slash commands not showing in Claude Code | Restart Claude Code after `bootstrap.sh` |
| Slash commands not showing in Codex | `ls ~/.codex/skills/` — should contain `gstack-*` entries. Re-run bootstrap if missing. |
| "gstack is outdated" | `cd .agents/skills/gstack && git pull && ./setup --quiet` |
