---
name: evidence-debugging
description: Investigate repeatable agent, evaluator, or CLI failures and verify the smallest root-cause fix with observable evidence.
---

Reproduce the concrete failure with the same command, repository state, engine, and configuration. Read the exit status and relevant log tail before changing code. Trace the failing boundary: CLI parsing, prompt construction, agent process, Git candidate, evaluator process, metric parsing, or keep/discard decision.

State a falsifiable cause and change the smallest relevant surface. For state-loss, acceptance, or process-lifecycle bugs, use a temporary Git repository or deterministic fake CLI to reproduce behavior without invoking a paid model. Include failure cases: malformed output, nonzero exits, missing commits, branch changes, and timeout descendants when relevant.

Run the regression and repository checks for the changed surface. Verify the final diff and actual exit statuses before reporting success. Separate local test/build evidence from hosted checks and real engine behavior. If the cause remains uncertain, preserve the diagnostic evidence and narrow the claim.

Research inspiration: [Superpowers systematic debugging](https://github.com/obra/superpowers/tree/main/skills/systematic-debugging) and [verification](https://github.com/obra/superpowers/tree/main/skills/verification-before-completion). These are original project-specific instructions; no upstream bundle or automatic delegation is installed.
