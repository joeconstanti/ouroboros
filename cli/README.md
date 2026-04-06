# Ouroboros CLI (TypeScript)

TypeScript implementation of Ouroboros - an agentic coding loop optimized for OpenCode.

## Installation

```bash
# Global install
npm install -g ouroboros
# or
bun add -g ouroboros

# Then use anywhere
ouroboros "add a button"
```

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run dev "add a button"
bun run dev --help

# Build binary
bun run build

# Build for all platforms
bun run build:all
```

## Usage

```bash
# Single task mode
ouroboros "add dark mode toggle"
ouroboros "fix the login bug" --cursor

# PRD mode (task lists)
ouroboros --prd PRD.md
ouroboros --yaml tasks.yaml
ouroboros --github owner/repo

# With options
ouroboros --parallel --max-parallel 4
ouroboros --branch-per-task --create-pr
ouroboros --opencode --dry-run

# Experiment mode (eval-driven keep/discard; see repo examples/autoresearch/)
ouroboros --experiment
ouroboros --experiment-file .ouroboros/experiment.yaml
```

## Supported AI Engines

- `--opencode` - OpenCode (default)
- `--claude` - Claude Code
- `--cursor` - Cursor Agent
- `--codex` - Codex CLI
- `--qwen` - Qwen-Code
- `--droid` - Factory Droid

## Configuration

Initialize config:
```bash
ouroboros --init
```

This creates `.ouroboros/config.yaml` with auto-detected project settings.

## License

MIT
