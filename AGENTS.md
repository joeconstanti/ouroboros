# AGENTS.md

This guide is for agentic coding tools working in this repo.
It captures build/lint/test commands and the expected code style.

## Repository overview
- Primary code lives in `cli/` (TypeScript, Bun runtime).
- Root scripts are shell utilities (`ouroboros.sh`) and docs.
- No Cursor or Copilot instruction files were found.

## Setup
- Install dependencies: `bun install` (run from `cli/`).
- Node >= 18 is required (see `cli/package.json`).

## Build commands
Run from `cli/` unless noted.

- Dev entrypoint: `bun run dev`
- Build binary (current platform): `bun run build`
- Build all platform binaries: `bun run build:all`
- Platform-specific builds:
  - `bun run build:darwin-arm64`
  - `bun run build:darwin-x64`
  - `bun run build:linux-x64`
  - `bun run build:linux-arm64`
  - `bun run build:windows-x64`

## Lint/format commands
- Primary check: `bun run check`
  - Runs `biome check --write .`
  - Treats formatting and linting as one step.

## Test commands
- No test runner is configured in `cli/package.json`.
- There is no standard single-test command yet.
- If tests are added later, document:
  - Full suite command
  - Single file/test command with an example

## Single-task execution (project usage)
- Run one task in a repo: `./ouroboros.sh "add login button"`
- Run PRD loop: `./ouroboros.sh --prd PRD.md`
- These are not build/test commands, but are core usage flows.

## Experiment mode (autoresearch-style)
- Bash: `./ouroboros.sh --experiment` with `.ouroboros/experiment.yaml` (see `examples/autoresearch/`).
- CLI: `bun run dev -- --experiment` (optional `--experiment-file <path>`).
- Evaluators: `scripts/eval.sh` (generic), `scripts/eval-ouroboros.sh` (this repo).
- Logs: `.ouroboros/experiments/results.tsv` (gitignored local dir).

## Source layout
- CLI entrypoint: `cli/src/index.ts`
- CLI arg parsing: `cli/src/cli/args.ts`
- Task runners: `cli/src/cli/commands/*.ts`
- Configuration: `cli/src/config/*.ts` (includes `experiment-loader.ts` for `.ouroboros/experiment.yaml`)
- Engine integrations: `cli/src/engines/*.ts`
- Git utilities: `cli/src/git/*.ts`
- UI/logging: `cli/src/ui/*.ts`

## Code style guidelines

### Formatting
- Use Biome formatting (`bun run check`) before committing.
- Keep line length reasonable; prefer wrapping long args.
- Prefer tabs for indentation (current files use tabs).

### Imports
- Use ES module syntax (`import ... from ...`).
- Prefer type-only imports with `import type`.
- Order imports by source groups:
  1. External packages
  2. Internal modules
  3. Relative modules
- Keep import paths explicit with file extensions (`.ts`).

### Naming conventions
- Functions/variables: `camelCase`.
- Classes/types/interfaces: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE` only for true constants.
- File names: `kebab-case.ts` for commands; otherwise match folder style.
- CLI flags: `kebab-case` (see `cli/src/cli/args.ts`).

### Types and interfaces
- Use explicit return types for exported functions.
- Prefer `type` aliases for unions and data structures.
- Use `interface` only when extending or merging types.
- Keep runtime validation in `zod` schemas aligned with TypeScript types.

### Error handling
- Wrap top-level command flows with `try/catch` and log user-friendly errors.
- Use `logError` from `cli/src/ui/logger.ts` for consistent formatting.
- Re-throw or return after logging if the error is fatal.
- Avoid swallowing errors; surface actionable messages.

### Logging and user output
- Use `logInfo`, `logSuccess`, `logWarn`, `logError` for console output.
- Use `logDebug` only when verbosity is enabled.
- Keep output concise and task-focused.

### CLI options and defaults
- Centralize option defaults in `cli/src/config/types.ts`.
- Add new flags in `cli/src/cli/args.ts` and map them into `RuntimeOptions`.
- Preserve existing flag naming patterns and descriptions.

### Configuration files
- `.ouroboros/config.yaml` is the user-facing config file.
- Respect `boundaries.never_touch` when executing tasks.
- When adding new config fields:
  - Update Zod schemas
  - Update the writer and loader
  - Provide safe defaults

### File edits and safety
- Prefer editing existing files over creating new ones.
- Avoid touching generated binaries in `cli/dist` unless required.
- If a change affects build outputs, update the source only.

## Engine integrations
- Each engine lives in `cli/src/engines/<name>.ts`.
- Follow existing patterns for command construction and output parsing.
- Keep user-facing messages neutral and consistent.

## Git and worktrees
- Worktree and branch helpers live in `cli/src/git/`.
- Avoid destructive git operations.
- When adding git automation, use `simple-git` utilities.

## Documentation rules
- Do not introduce new docs unless requested.
- When updating docs, keep wording concise and usage-driven.

## Quality checks before shipping
- `bun run check`
- `bun run build` (or `bun run build:all` for release)
- Verify CLI entrypoint still runs: `bun run dev --help`

## Notes for agents
- No Cursor/Copilot rules are present.
- If new rules are added, update this file to include them.
