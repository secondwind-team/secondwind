# secondwind — Agent Instructions (Codex / Claude Code / others)

This file mirrors `CLAUDE.md` so that Codex and other AGENTS.md-aware agents follow the same rules as Claude Code.

If you are Claude Code, read `CLAUDE.md` instead.
If you are Codex or another agent, the instructions below apply.

---

## Workflow layer: gstack

This project uses [gstack](https://github.com/garrytan/gstack) for shared slash commands and conventions. The full ruleset lives in `~/.claude/skills/gstack/AGENTS.md` and per-skill `SKILL.md` files. Read them on demand.

In Codex, gstack skills are namespaced with `gstack-` prefix (e.g., `/gstack-qa`, `/gstack-ship`).

## Rules for every session

1. **Investigate before modifying.** Never patch without reproducing or tracing the root cause (`/gstack-investigate`).
2. **Respect `/gstack-freeze` and `/gstack-careful`.** Do not edit frozen paths. Confirm before destructive commands.
3. **Small, reviewable PRs.** Use `/gstack-ship` — it runs tests and coverage before opening a PR.
4. **Non-developer audience.** Two teammates cannot read diffs fluently. Lead explanations with *what the user will see* before *how the code changed*.
5. **Production-grade defaults.** Run `/gstack-review` + `/gstack-qa` before `/gstack-ship`.

## Typical workflow

```
/gstack-office-hours   →  /gstack-autoplan  →  implement
       →  /gstack-review  →  /gstack-qa  →  /gstack-ship
       →  /gstack-land-and-deploy  →  /gstack-canary
```

## Stop-and-ask triggers

Stop and ask the developer (not the non-dev teammates) before:
- Schema migrations or destructive DB operations
- Changes under `.github/`, `scripts/`, `package.json`, lockfiles, CI config
- Adding or rotating secrets, API keys, OAuth config
- Force-pushes, rebases of shared branches, or `git reset --hard`

Prefer additive changes over rewrites. When unsure, run `/gstack-plan-eng-review` first.
