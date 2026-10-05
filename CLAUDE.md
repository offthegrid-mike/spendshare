# SpendShare — agent instructions

## Git workflow

**Always check PR and branch status before doing any work — including before
committing, pushing, or starting a follow-up change.**

```bash
git fetch origin --prune
git log --oneline -3 origin/main
gh pr list --state open
gh pr view <n> --json state,mergedAt   # if a PR exists for the current branch
```

A branch whose PR has merged is finished. Never push to it again: the commit
lands on a closed PR, is invisible to review, and never reaches `main`. Branch
fresh from `origin/main` for the next change instead.

Confirm where a commit actually is before reporting it as delivered:

```bash
git merge-base --is-ancestor <sha> origin/main && echo "in main" || echo "NOT in main"
```

Other standing rules:

- Never commit directly to `main` — always a feature branch and a PR.
- When a branch is finished, always push it and open a PR against `main`.
  Never merge a branch into `main` locally, even when a workflow or skill
  offers that option.
- Run the `code-review` skill before merging a milestone PR.

## Testing

- Write failing tests first for any implementation work.
- Use Node 20+ (`nvm use 22`); the default Node 18 shell fails vitest startup
  with a `styleText` error.
- Verification before claiming done: `npm run typecheck && npm run lint && npm run test`.

## Code conventions

- Data hooks in `src/hooks/` derive `loading` by comparing a stored `loadedKey`
  against the current key. The `react-hooks/set-state-in-effect` lint rule fails
  the build on any synchronous `setState` in an effect body, and `npm run lint`
  runs with `--max-warnings 0`.
- In tests for hooks that `Promise.all` several queries, reject one query at a
  time. Vitest reports the second rejection of a `Promise.all` as unhandled and
  fails the file, even when the code catches it correctly.
