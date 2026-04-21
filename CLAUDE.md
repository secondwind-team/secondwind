# secondwind — Team Conventions for AI Agents

This project uses **[gstack](https://github.com/garrytan/gstack)** (Garry Tan's Claude Code toolkit) as the shared workflow layer across the team.

The team has 3 people:
- 1 developer (Claude Code)
- 2 non-developers (Codex today, Claude Code later)

## For the AI agent (read this every session)

1. **Follow gstack conventions.** Full rules live in `.agents/skills/gstack/CLAUDE.md` and individual `SKILL.md` files under `.agents/skills/gstack/`. Read them on demand; do not re-state them here.
2. **Investigation before modification.** Never patch without reproducing or tracing the root cause (`/investigate`).
3. **Respect `/freeze` and `/careful`.** If a path is frozen, do not edit it. If a command is destructive, confirm with the user first.
4. **Small, reviewable changes.** Prefer one concern per PR. Use `/ship` to open PRs — it runs tests and a coverage audit first.
5. **Non-developer audience.** Two teammates cannot read diffs fluently. When explaining changes, lead with *what the user will see* before *how the code changed*.
6. **Production-grade defaults.** Even for prototypes, enforce `/review` (bug sweep) and `/qa` (real browser) before `/ship`.

## Typical workflow (happy path)

```
/office-hours          ← clarify the idea
     ↓
/autoplan              ← CEO + design + engineering review chained
     ↓
implement              ← you write code, guided by the plan
     ↓
/review                ← AI bug sweep
     ↓
/qa                    ← real Chromium test + auto-fix
     ↓
/ship                  ← open PR
     ↓
/land-and-deploy       ← merge + CI + production verify
     ↓
/canary                ← post-deploy monitoring
```

## Guardrails for non-developer teammates

- Any edit that touches `.github/`, `scripts/`, `package.json`, lockfiles, or CI config should be paired with a human-readable explanation of the risk.
- If a plan includes a schema migration, database operation, or external API key change, **stop and ask the developer** before proceeding.
- Prefer additive changes over rewrites. When in doubt, `/plan-eng-review` first.
