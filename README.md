# Ouroboros

<div align="center">

![Ouroboros](assets/ouroboros.png)

![Made by Joe](https://img.shields.io/badge/Made%20by-Joe-red?style=for-the-badge)
![Agentic Coding](https://img.shields.io/badge/Agentic-Coding-orange?style=for-the-badge)
![OpenCode First](https://img.shields.io/badge/OpenCode-First-blue?style=for-the-badge)
![Bun](https://img.shields.io/badge/Runtime-Bun-000000?style=for-the-badge&logo=bun&logoColor=white)

[![Quality](https://github.com/joeconstanti/ouroboros/actions/workflows/quality.yml/badge.svg)](https://github.com/joeconstanti/ouroboros/actions/workflows/quality.yml)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](#license)

---

**An agentic coding loop for your existing Git repositories. Run one task, work through a PRD, or improve a metric with an autoresearch-style experiment.**

[Commands](#commands) • [Quick Start](#quick-start) • [Agent Support](#agent-support) • [Report Bug](https://github.com/joeconstanti/ouroboros/issues)

</div>

## Features

<div align="center">

| Feature | What it does |
|---------|--------------|
| **Single tasks and PRDs** | Runs a focused change or works through a Markdown, YAML or GitHub Issues task list |
| **Six agent integrations** | Uses OpenCode by default, with Claude Code, Codex, Cursor, Qwen-Code and Factory Droid options |
| **Project context** | Includes configured rules, commands and file boundaries in task prompts |
| **Parallel execution** | Runs independent tasks in separate Git worktrees and branches |
| **Branch and PR workflows** | Creates task branches and optionally opens pull requests |
| **Metric-driven experiments** | Evaluates a baseline, tests one committed hypothesis, and keeps or discards the candidate |
| **Experiment safeguards** | Checks path boundaries, evaluator success and finite metrics; restores rejected attempts |
| **Reproducible evidence** | Saves experiment manifests, evaluator logs, candidate commits and hypotheses per run |
| **Shared project skills** | Discovers focused research, debugging and skill-evaluation instructions on demand |

</div>

## Commands

Run these from the repository you want Ouroboros to work on. Use the absolute path
to `ouroboros.sh` when the checkout lives elsewhere.

| Command | Outcome | Side effects |
|---------|---------|--------------|
| `./ouroboros.sh "add dark mode"` | Implements one task | Source edits and a commit by default |
| `./ouroboros.sh --prd PRD.md` | Works through unfinished tasks | Source edits, commits and task progress |
| `./ouroboros.sh --yaml tasks.yaml` | Uses a YAML task list | Same task workflow; supports parallel groups |
| `./ouroboros.sh --github owner/repo` | Uses GitHub Issues as tasks | Reads the selected repository and runs its tasks |
| `./ouroboros.sh --init` | Detects project settings | Creates `.ouroboros/` configuration |
| `./ouroboros.sh --config` | Displays project configuration | Read-only output |
| `./ouroboros.sh --add-rule "use strict TypeScript"` | Adds a project rule | Updates project configuration |
| `./ouroboros.sh --parallel` | Runs independent tasks concurrently | Creates worktrees and branches; merges results unless PR mode is enabled |
| `./ouroboros.sh --branch-per-task --create-pr` | Opens task pull requests | Publishes branches and PRs; requires GitHub CLI access |
| `./ouroboros.sh --experiment` | Runs bounded metric optimization | Creates an experiment branch, evaluates candidates and restores rejected changes |
| `./ouroboros.sh --experiment --dry-run` | Displays the experiment protocol | No branch changes, agent execution or evaluation |

Ordinary task boundaries are instructions in the agent prompt. Experiment mode
also checks candidate file changes against configured allowlists and forbidden
paths before evaluation. Agent CLIs run with the automation settings defined by
each integration; review the scope of a task before starting it.

## Technologies Used

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white)
![Bash](https://img.shields.io/badge/Bash-4EAA25?style=flat-square&logo=gnubash&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=flat-square&logo=git&logoColor=white)

</div>

| Technology | Purpose |
|------------|---------|
| **TypeScript + Bun** | CLI, agent integrations, experiment orchestration and regression tests |
| **Bash** | Shell entrypoint and task workflows; experiment mode delegates to the Bun runner |
| **Commander** | CLI argument parsing |
| **Zod + YAML** | Configuration validation and parsing |
| **simple-git** | CLI branch, worktree and repository operations |
| **Biome** | TypeScript formatting and linting |
| **Markdown + SKILL.md** | Shared project instructions with metadata-only prompt discovery |

## Project Structure

```text
ouroboros/
├── ouroboros.sh              # Shell entrypoint
├── cli/
│   ├── src/
│   │   ├── cli/              # Arguments and commands
│   │   ├── config/           # Configuration schemas, loaders and skill catalog
│   │   ├── engines/          # Six agent CLI integrations
│   │   ├── execution/        # Task runners and experiment lifecycle
│   │   ├── git/              # Branch, worktree and PR helpers
│   │   ├── tasks/            # Markdown, YAML and GitHub task sources
│   │   └── ui/               # Logging and notifications
│   └── package.json          # Build, lint and test commands
├── .agents/skills/           # Canonical project skills
├── .claude/skills            # Link to shared skills
├── .cursor/skills            # Link to shared skills
├── .opencode/skills          # Link to shared skills
├── examples/autoresearch/    # Experiment configuration and protocol
├── scripts/                 # Generic and self-host evaluators
└── .github/workflows/        # Ubuntu quality checks
```

Runtime configuration and progress live in `.ouroboros/` inside the target
repository. Experiment artifacts are local and should be ignored by Git.

## Local Development

### Quick Start

Clone Ouroboros beside your projects and install the CLI dependencies:

```sh
git clone https://github.com/joeconstanti/ouroboros.git
cd ouroboros
(cd cli && bun install)
./ouroboros.sh --help
```

Then run a task from the target Git repository:

```sh
cd /absolute/path/to/your-project
/absolute/path/to/ouroboros/ouroboros.sh --init
/absolute/path/to/ouroboros/ouroboros.sh "add a dark mode toggle"
```

OpenCode is the default engine. Add `--claude`, `--codex`, `--cursor`, `--qwen` or
`--droid` to select another installed, authenticated agent CLI.

The TypeScript entrypoint can also run from the target repository:

```sh
bun /absolute/path/to/ouroboros/cli/src/index.ts "add a dark mode toggle"
```

### Requirements

| Requirement | When needed |
|-------------|-------------|
| **Git** | Repository state, commits, branches and worktrees |
| **Installed and authenticated agent CLI** | Executing coding tasks and experiments |
| **Bash + jq** | Shell task workflows |
| **Bun + CLI dependencies** | TypeScript CLI and both experiment entrypoints |
| **mikefarah/yq** | Shell YAML task sources and the generic evaluator |
| **GitHub CLI (`gh`)** | Shell GitHub Issues and PR workflows |
| **bc** | Optional shell cost calculations |

The CLI package declares Node.js 18+ compatibility; running its TypeScript source
and the documented development commands requires Bun.

### Agent Support

| Agent | Selection flag | Executable |
|-------|----------------|------------|
| **OpenCode** | `--opencode` (default) | `opencode` |
| **Claude Code** | `--claude` | `claude` |
| **Codex** | `--codex` | `codex` |
| **Cursor** | `--cursor` | `agent` |
| **Qwen-Code** | `--qwen` | `qwen` |
| **Factory Droid** | `--droid` | `droid` |

These integrations call your installed tools. Output, token accounting and
permission behavior depend on the integration and agent version.

### Quality Checks

Run from `cli/`:

```sh
bun run check       # Format and lint; writes fixes
bun run check:ci    # Read-only format and lint check
bun test
bun run build
bun run dev --help
```

Run one regression file with `bun test src/execution/evaluation.test.ts`.
Use `bun run build:all` to compile all configured platform binaries. From the
repository root, check shell syntax with:

```sh
(
  for script in ouroboros.sh scripts/eval.sh scripts/eval-ouroboros.sh; do
    bash -n "$script" || exit 1
  done
)
```

CI runs the regression suite, read-only lint, build, CLI help and shell syntax on
Ubuntu. Deterministic fake-agent tests verify orchestration; they do not
establish real-model quality gains or every agent's native discovery behavior.

CI uses Bun 1.3.6 and `bun install --frozen-lockfile`. Pull requests validate
proposed changes; pushes validate merged `main`. Feature-branch pushes do not
create duplicate runs. A newer run cancels superseded runs for the same PR or
ref, while unrelated PRs retain separate checks. Each validation stage is named
so failures identify the command that needs attention.

Git/process integration tests use Bun's five-second default test timeout. On a
heavily loaded development host, run heavy verification one project at a time;
start with a focused command such as `bun test src/execution/experiment-loop.test.ts`.
If a timeout occurs, retain the failed output and compare unchanged default-branch
behavior before attributing it to a change. Do not increase timeouts, drop
assertions, or repeatedly rerun unchanged failures to obtain a green result.
Generic PR validation requires the Ubuntu job; it does not require a hosted
macOS runner. The POSIX process-group timeout tests run on Linux. When changing
platform-sensitive process or launcher behavior, optionally run the same checks
locally on macOS when capacity is available. CI builds one native Linux x64 binary with `bun run build:linux-x64` and runs
`node bin.js --help` through the packaged launcher. The separate source-help
check verifies the development entrypoint. `bun run build` retains its Darwin
ARM64 target for local development; use the appropriate platform build script. Ubuntu CI does not prove macOS binary
execution, notification delivery, or Windows process-tree termination. Verify
relevant platform behavior separately before making platform-specific claims.

The single Ubuntu job runs cheap shell syntax first, installs dependencies once,
then checks formatting/lint, regression behavior and source CLI startup. The
native build and launcher smoke test run last to verify binary packaging. The
final Git diff check detects tracked-file mutations. Each gate checks a distinct
contract; there is no release, deployment or all-platform packaging job in PR CI.

## Task Workflows

### Task Sources

Markdown tasks use checkboxes; completed tasks are skipped:

```markdown
## Tasks
- [ ] Create authentication
- [ ] Add a dashboard
- [x] Set up the project
```

```sh
./ouroboros.sh --prd PRD.md
```

YAML tasks can group independent work:

```yaml
tasks:
  - title: Create User model
    completed: false
    parallel_group: 1
  - title: Create Post model
    completed: false
    parallel_group: 1
  - title: Add relationships
    completed: false
    parallel_group: 2
```

```sh
./ouroboros.sh --yaml tasks.yaml --parallel
./ouroboros.sh --github owner/repo --github-label ready
```

### Branches and Parallel Work

```sh
./ouroboros.sh --parallel --max-parallel 3
./ouroboros.sh --branch-per-task --create-pr
./ouroboros.sh --branch-per-task --create-pr --draft-pr
./ouroboros.sh --base-branch main
```

Parallel agents receive separate worktrees and branches. Without `--create-pr`,
results are merged back and the workflow can ask an agent to resolve conflicts.
With `--create-pr`, branches are retained for pull requests. Task branches use
`ouroboros/<task-slug>` names.

## Experiment Workflow

Inspired by [Karpathy's autoresearch](https://github.com/karpathy/autoresearch),
experiment mode establishes a baseline, asks for one hypothesis and one commit,
then evaluates the candidate and keeps or discards it.

From the Ouroboros repository root:

```sh
mkdir -p .ouroboros/programs
cp examples/autoresearch/experiment.yaml .ouroboros/experiment.yaml
cp examples/autoresearch/programs/autoresearch.md .ouroboros/programs/autoresearch.md
```

Edit the experiment configuration to choose the evaluator, metric direction,
minimum improvement, attempt/time budgets, editable paths and frozen paths.
For another target repository, copy the examples and required evaluator there
and adjust paths to that repository.

```sh
./ouroboros.sh --experiment --dry-run
./ouroboros.sh --experiment
# Equivalent source entrypoint from the Ouroboros root:
bun cli/src/index.ts --experiment
```

Real runs require a clean working tree, commits enabled, and
`.ouroboros/experiments/` ignored by Git. The runner rejects failed evaluator
processes, unsuccessful quality status, malformed metrics, boundary violations
and uncommitted candidates. It restores rejected attempt changes to the best
commit and stops if the agent switches branches or changes frozen configuration.

| Evaluator | Purpose |
|-----------|---------|
| [`scripts/eval.sh`](scripts/eval.sh) | Runs configured test/lint/build commands; fails if configuration, YAML tooling or runnable checks are missing |
| [`scripts/eval-ouroboros.sh`](scripts/eval-ouroboros.sh) | Checks Ouroboros with read-only Biome, Bun tests/build and Bash syntax |

Evaluators emit `OUROBOROS_EVAL_STATUS`, `OUROBOROS_EVAL_PRIMARY` and optionally
`OUROBOROS_EVAL_DURATION_MS`. A usable score requires exit code zero, status `ok`
and a finite numeric primary metric. Freeze the evaluator and its fixtures in
`forbidden_paths`; use a narrow `allowed_paths` list.

Each run saves `.ouroboros/experiments/runs/<run-id>/` with `manifest.json`,
`results.tsv`, a baseline log and candidate evaluator logs. The ledger records
candidate commits and hypotheses even when their changes are discarded.

Evaluator timeouts terminate process groups on POSIX; Windows currently terminates
the direct child only. The wall budget is checked between attempts and does not
interrupt a running agent. Repeat matched baseline/candidate measurements before
claiming gains on noisy metrics.

## Customization

Initialize or inspect project configuration:

```sh
./ouroboros.sh --init
./ouroboros.sh --config
./ouroboros.sh --add-rule "use TypeScript strict mode"
```

`.ouroboros/config.yaml` supplies project context for single tasks and PRD runs:

```yaml
project:
  name: my-app
  language: TypeScript
  framework: Next.js

commands:
  test: npm test
  lint: npm run lint
  build: npm run build

rules:
  - use server actions rather than API routes
  - follow the error pattern in src/utils/errors.ts

boundaries:
  never_touch:
    - src/legacy/**
    - '*.lock'
```

### Project Skills

Canonical instructions live in `.agents/skills/`, with shared discovery links for
Claude Code, Cursor and OpenCode. Codex can discover the canonical directory.
Task and experiment prompts include only skill names, descriptions and paths;
matching skill bodies are read when relevant.

| Skill | Use it for |
|-------|------------|
| [`autoresearch`](.agents/skills/autoresearch/SKILL.md) | Experiment setup, frozen evaluators and trustworthy metric optimization |
| [`evidence-debugging`](.agents/skills/evidence-debugging/SKILL.md) | Reproducing agent/evaluator failures and verifying root-cause fixes |
| [`skill-evaluation`](.agents/skills/skill-evaluation/SKILL.md) | Matched tasks and held-out checks before promoting skill changes |

These are original project-specific instructions informed by the sources below.
Their packaging and prompt discovery are tested; real-agent efficacy remains to
be measured with paired evaluations.

### Runtime Options

| Flag | What it does |
|------|--------------|
| `--prd FILE` | Markdown task file; defaults to `PRD.md` |
| `--yaml FILE` | YAML task file |
| `--github REPO` | GitHub Issues task source |
| `--github-label TAG` | Filters GitHub Issues |
| `--parallel` | Runs independent tasks in worktrees |
| `--max-parallel N` | Maximum parallel agents; defaults to 3 |
| `--branch-per-task` | Creates a branch for each task |
| `--base-branch NAME` | Selects the base branch |
| `--create-pr` | Creates pull requests |
| `--draft-pr` | Marks created PRs as drafts; combine with `--create-pr` |
| `--no-tests` | Skips task tests |
| `--no-lint` | Skips task lint |
| `--fast` | Skips task tests and lint |
| `--no-commit` | Disables ordinary task commits; incompatible with experiment mode |
| `--max-iterations N` | Limits task iterations; 0 means unlimited |
| `--max-retries N` | Configures retries; defaults to 3 |
| `--retry-delay N` | Delay between retries in seconds; defaults to 5 |
| `--experiment`, `--autoresearch` | Runs metric-driven experiments |
| `--experiment-file FILE` | Alternate experiment configuration |
| `--dry-run` | Previews execution; experiment previews are read-only |
| `-v, --verbose` | Enables debug output |
| `-h, --help` | Lists commands and options |

## Contributing

<div align="center">

![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen?style=for-the-badge)
[![Issues](https://img.shields.io/badge/Issues-Welcome-red?style=for-the-badge)](https://github.com/joeconstanti/ouroboros/issues)

</div>

| Step | Action |
|------|--------|
| **Branch** | Use a descriptive branch such as `fix/evaluator-timeout` |
| **Change** | Keep agent behavior focused and preserve unrelated work |
| **Validate** | Run the relevant tests, lint, build and CLI checks listed above |
| **PR** | Describe the resulting behavior and provide actual validation |

Useful contributions include engine compatibility fixes, reliable experiment
acceptance, focused skills and reproducible evaluation cases. See
[AGENTS.md](AGENTS.md) for repository conventions.

## Acknowledgments

<div align="center">

![Autoresearch](https://img.shields.io/badge/Inspired%20By-Autoresearch-purple?style=flat-square)
![Agent Skills](https://img.shields.io/badge/Built%20With-Agent%20Skills-blue?style=flat-square)

</div>

- [Ralphy](https://github.com/michaelshimeles/ralphy): inspiration for the original coding loop.
- [Karpathy autoresearch](https://github.com/karpathy/autoresearch): hypothesis, evaluation and keep/discard workflow.
- [Superpowers](https://github.com/obra/superpowers): research reference for systematic debugging and evidence before completion.
- [SkillsBench](https://arxiv.org/abs/2602.12670): paired evaluation of skill effectiveness.
- [Agent Skills](https://agentskills.io/specification): portable skill packaging and progressive disclosure.
- [jstack](https://github.com/joeconstanti/jstack): README structure and presentation reference.

## License

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](#license)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-green?style=for-the-badge)](https://github.com/joeconstanti/ouroboros)

</div>

The CLI package declares the MIT license.

---

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/joeconstanti/ouroboros?style=social)](https://github.com/joeconstanti/ouroboros/stargazers)

**Made by [Joe](https://madebyjoe.co)**

[GitHub](https://github.com/joeconstanti/ouroboros) • [Report Bug](https://github.com/joeconstanti/ouroboros/issues)

</div>
