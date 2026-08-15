# Contributing

Thanks for working on UTL-AcademyOS. This document covers the conventions the repo enforces.

## Branching

- `main` is the trunk. All work happens on feature branches.
- Branch names: `feat/<short-slug>`, `fix/<short-slug>`, `chore/<short-slug>`, `docs/<short-slug>`.
- Open a PR into `main`. Squash-merge is the default.

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/). `commitlint` runs on every commit via a Husky `commit-msg` hook.

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

```
feat(auth): add refresh token rotation
fix(exam): prevent double-submit on flaky network
docs(readme): document local Docker stack
```

## Code Style

- **Formatter:** Prettier (config at repo root)
- **Linter:** ESLint (base config at root, workspace configs may extend)
- `lint-staged` runs both on staged files during `git commit`

Run manually:

```bash
npm run format          # format the whole repo
npm run lint            # lint every workspace
npm run typecheck       # typecheck every workspace
```

## Tests

- Unit + integration: Vitest (backend) / Vitest + React Testing Library (frontend)
- E2E: Playwright (frontend)
- Every non-trivial PR ships with tests. Bug fixes ship with a regression test.

```bash
npm run test            # runs tests across all workspaces
```

## Adding a Package

1. Create the directory under `packages/<name>/` or a top-level app.
2. Add its glob to the `workspaces` field in the root `package.json` if not already covered.
3. Ship a workspace-scoped `package.json`, `tsconfig.json`, and `src/`.
4. Prefix internal packages as `@utl/<name>` (e.g. `@utl/shared`).

## Pull Requests

- Keep PRs focused. One concern per PR.
- Describe the change and link the phase / task it addresses (e.g., "Phase 1.3 — auth").
- Wait for CI to pass. Reviewer will squash-merge.

## Security

Do not commit secrets. `.env` files are gitignored; use `.env.example` to document required variables.
