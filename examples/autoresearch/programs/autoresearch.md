# Autoresearch-style experiment protocol

You are running inside **Ouroboros experiment mode**. The harness (evaluator scripts, fixtures, and this protocol) is frozen. Your job is to improve a **primary metric** reported by the evaluator.

## Rules

1. **One hypothesis per attempt** — smallest change that might move the metric.
2. **One commit per attempt** — message must start with `exp: `.
3. **Do not modify** paths listed as forbidden in `.ouroboros/experiment.yaml` (evaluator, harness).
4. **Do not add dependencies** unless the project already uses that ecosystem and it is necessary.
5. **Do not run** the official evaluator script yourself to decide pass/fail; Ouroboros runs it after you commit.
6. After committing, append one line to `.ouroboros/experiments/last-hypothesis.txt` describing what you tried.

## After each attempt

The orchestrator runs the evaluator, compares the score to the best so far, and either **keeps** your commit or **resets** the branch to the last good commit.
