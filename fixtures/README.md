# Fixtures for experiment / self-host testing

- **`sample-task/`** — Tiny mock project used to dry-run flows (no network).
- Use **`scripts/eval-ouroboros.sh`** from the repo root for Ouroboros-specific scoring (`bun run check` in `cli/`, `bash -n` on `ouroboros.sh`).

Copy **`examples/autoresearch/experiment.yaml`** to **`.ouroboros/experiment.yaml`** and set `evaluator.command` to `./scripts/eval.sh` or `./scripts/eval-ouroboros.sh` as needed.
