# Ouroboros

![Ouroboros](assets/ouroboros.png)

```text
 ██████╗ ██╗   ██╗██████╗  ██████╗ ██████╗  ██████╗ ██████╗  ██████╗ ███████╗
██╔═══██╗██║   ██║██╔══██╗██╔═══██╗██╔══██╗██╔═══██╗██╔══██╗██╔═══██╗██╔════╝
██║   ██║██║   ██║██████╔╝██║   ██║██████╔╝██║   ██║██████╔╝██║   ██║███████╗
██║   ██║██║   ██║██╔══██╗██║   ██║██╔══██╗██║   ██║██╔══██╗██║   ██║╚════██║
╚██████╔╝╚██████╔╝██║  ██║╚██████╔╝██████╔╝╚██████╔╝██║  ██║╚██████╔╝███████║
 ╚═════╝  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
 ```

[![Stars](https://img.shields.io/github/stars/fromtheroot/ouroboros?style=flat-square)](https://github.com/fromtheroot/ouroboros/stargazers)
[![Issues](https://img.shields.io/github/issues/fromtheroot/ouroboros?style=flat-square)](https://github.com/fromtheroot/ouroboros/issues)
[![License](https://img.shields.io/github/license/fromtheroot/ouroboros?style=flat-square)](https://github.com/fromtheroot/ouroboros/blob/main/LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/fromtheroot/ouroboros?style=flat-square)](https://github.com/fromtheroot/ouroboros/commits/main)
[![OpenCode](https://img.shields.io/badge/OpenCode-enabled-0b5fff?style=flat-square)](https://opencode.ai)

Ouroboros is an agentic coding loop built for OpenCode. Feed it tasks, and it keeps running until the work is done.

## What It Does

- Runs tasks inside your existing git repo using your installed AI CLI (OpenCode by default).
- Iterates on each task: implement changes, run checks, commit (unless `--no-commit`), and update progress.
- Works in single-task mode or loops a PRD until everything is complete.

## Quick Start

```bash
git clone https://github.com/fromtheroot/ouroboros.git
cd ouroboros
chmod +x ouroboros.sh

# Single task
./ouroboros.sh "add login button"

# Or use a task list
./ouroboros.sh --prd PRD.md
```

## How It Works

- **Single task mode** runs one focused change inside your current repo.
- **PRD mode** loops through a task list until it is complete.
- **OpenCode-first** defaults to OpenCode for execution; other engines are available.
- **Git-required** expects a git repo so it can commit and track progress.

## Two Modes

**Single task**
```bash
./ouroboros.sh "add dark mode"
./ouroboros.sh "fix the auth bug"
```

**Task list**
```bash
./ouroboros.sh              # uses PRD.md
./ouroboros.sh --prd tasks.md
```

## Project Config

Optional rules and project context that are injected into every task.

```bash
./ouroboros.sh --init              # auto-detects project settings
./ouroboros.sh --config            # view config
./ouroboros.sh --add-rule "use TypeScript strict mode"
```

Creates `.ouroboros/config.yaml`:
```yaml
project:
  name: "my-app"
  language: "TypeScript"
  framework: "Next.js"

commands:
  test: "npm test"
  lint: "npm run lint"
  build: "npm run build"

rules:
  - "use server actions not API routes"
  - "follow error pattern in src/utils/errors.ts"

boundaries:
  never_touch:
    - "src/legacy/**"
    - "*.lock"
```

Rules apply to all tasks (single or PRD).

## AI Engines

```bash
./ouroboros.sh              # OpenCode (default)
./ouroboros.sh --opencode   # OpenCode (explicit)
./ouroboros.sh --cursor     # Cursor
./ouroboros.sh --codex      # Codex
./ouroboros.sh --qwen       # Qwen-Code
./ouroboros.sh --droid      # Factory Droid
./ouroboros.sh --claude     # Claude Code
```

## Task Sources

**Markdown** (default):
```bash
./ouroboros.sh --prd PRD.md
```
```markdown
## Tasks
- [ ] create auth
- [ ] add dashboard
- [x] done task (skipped)
```

**YAML**:
```bash
./ouroboros.sh --yaml tasks.yaml
```
```yaml
tasks:
  - title: create auth
    completed: false
  - title: add dashboard
    completed: false
```

**GitHub Issues**:
```bash
./ouroboros.sh --github owner/repo
./ouroboros.sh --github owner/repo --github-label "ready"
```

## Parallel Execution

```bash
./ouroboros.sh --parallel                  # 3 agents default
./ouroboros.sh --parallel --max-parallel 5 # 5 agents
```

Each agent gets isolated worktree + branch:
```
Agent 1 → /tmp/xxx/agent-1 → ouroboros/agent-1-create-auth
Agent 2 → /tmp/xxx/agent-2 → ouroboros/agent-2-add-dashboard
Agent 3 → /tmp/xxx/agent-3 → ouroboros/agent-3-build-api
```

Without `--create-pr`: auto-merges back, AI resolves conflicts.
With `--create-pr`: keeps branches, creates PRs.

**YAML parallel groups** - control execution order:
```yaml
tasks:
  - title: Create User model
    parallel_group: 1
  - title: Create Post model
    parallel_group: 1  # same group = runs together
  - title: Add relationships
    parallel_group: 2  # runs after group 1
```

## Branch Workflow

```bash
./ouroboros.sh --branch-per-task                # branch per task
./ouroboros.sh --branch-per-task --create-pr    # + create PRs
./ouroboros.sh --branch-per-task --draft-pr     # + draft PRs
./ouroboros.sh --base-branch main               # branch from main
```

Branch naming: `ouroboros/<task-slug>`

## Options

| Flag | What it does |
|------|--------------|
| `--prd FILE` | task file (default: PRD.md) |
| `--yaml FILE` | YAML task file |
| `--github REPO` | use GitHub issues |
| `--github-label TAG` | filter issues by label |
| `--parallel` | run parallel |
| `--max-parallel N` | max agents (default: 3) |
| `--branch-per-task` | branch per task |
| `--base-branch NAME` | base branch |
| `--create-pr` | create PRs |
| `--draft-pr` | draft PRs |
| `--no-tests` | skip tests |
| `--no-lint` | skip lint |
| `--fast` | skip tests + lint |
| `--no-commit` | don't auto-commit |
| `--max-iterations N` | stop after N tasks |
| `--max-retries N` | retries per task (default: 3) |
| `--retry-delay N` | seconds between retries |
| `--dry-run` | preview only |
| `-v, --verbose` | debug output |
| `--init` | setup .ouroboros/ config |
| `--config` | show config |
| `--add-rule "rule"` | add rule to config |

## Requirements

**Required:**
- AI CLI: [OpenCode](https://opencode.ai/docs/) (primary), [Claude Code](https://github.com/anthropics/claude-code), [Cursor](https://cursor.com), Codex, Qwen-Code, or [Factory Droid](https://docs.factory.ai/cli/getting-started/quickstart)
- `jq`

**Optional:**
- `yq` - for YAML tasks
- `gh` - for GitHub issues / `--create-pr`
- `bc` - for cost calc

## Engine Details

| Engine | CLI | Permissions | Output |
|--------|-----|-------------|--------|
| OpenCode | `opencode` | `full-auto` | tokens + cost |
| Claude | `claude` | `--dangerously-skip-permissions` | tokens + cost |
| Codex | `codex` | N/A | tokens |
| Cursor | `agent` | `--force` | duration |
| Qwen | `qwen` | `--approval-mode yolo` | tokens |
| Droid | `droid exec` | `--auto medium` | duration |

---

## Changelog

### v1.0.0
- initial release

## Credits

Inspired by the original Ralphy project: https://github.com/michaelshimeles/ralphy

## License

MIT
