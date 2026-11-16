---
name: autoresearch
description: Run or improve Ouroboros metric-driven experiments with frozen evaluators, bounded attempts, and reproducible keep/discard evidence.
---

Use this for experiment setup, evaluator design, or metric optimization. Read the current experiment configuration and protocol first. Pick one editable surface, one measurable hypothesis, a primary metric/direction, and a minimum useful improvement. Freeze evaluator scripts, fixtures, and quality gates in forbidden_paths; prefer an explicit allowlist over **.

Establish a valid baseline before changing code. Use `bun cli/src/index.ts --experiment --dry-run` from this repository to inspect the protocol, then run the CLI from the target repository root with its entrypoint or installed binary. Real runs require a clean worktree and exactly one direct child commit per attempt. Use existing authorization for runs; setup alone does not authorize deployments or unrelated changes.

The harness evaluates after the agent commits. Keep only successful, finite, quality-passing improvements. Make evaluator commands read-only. Do not weaken checks to improve the metric. Failed/no-op attempts must leave the next attempt at the best commit. Respect configured attempt/evaluator limits; the current wall budget is checked between agent attempts, so it is not a hard agent execution timeout.

Inspect `.ouroboros/experiments/runs/<run-id>/manifest.json`, `results.tsv`, and evaluator logs. Report the baseline, retained score and commit, number of attempts, and quality evidence. A deterministic harness test proves orchestration, not a real model quality or speed gain. For noisy measurements, repeat matched baseline/candidate runs before claiming a gain.

Source: [Karpathy autoresearch](https://github.com/karpathy/autoresearch/blob/master/program.md). This is an original Ouroboros workflow, not a vendored upstream skill.
