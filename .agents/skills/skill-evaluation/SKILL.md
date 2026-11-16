---
name: skill-evaluation
description: Evaluate a proposed agent skill or prompt change with paired tasks, held-out checks, and measured cost before promoting it.
---

Define the target failure or capability before installing a skill. Inspect the upstream source, license, pinned revision, tool/dependency requirements, and instructions that could expand the user's scope. Prefer a small project-local skill over a broad instruction bundle. Record source attribution for copied material and retain its license.

Create representative task inputs plus held-out cases and deterministic acceptance checks outside the editable skill. Run the same model, harness, tools, base revision, and budgets with and without the skill. Alternate run order where practical and repeat stochastic cases. Include unrelated tasks to detect over-triggering. Do not modify acceptance checks during candidate optimization.

Capture per-run task success, elapsed time, tokens/cost when exposed, and failures. Report paired deltas, sample size, and uncertainty. Structural SKILL.md validation establishes format only; fake agents establish harness behavior only. Neither proves improved real-agent outcomes.

Promote only when the target capability improves without unacceptable regressions or cost. Keep the prior version recoverable and retain failed experiments as evidence. Use Ouroboros experiment mode for bounded iterations when a trustworthy evaluator exists.

Sources: [SkillsBench](https://arxiv.org/abs/2602.12670) for matched evaluation and [Agent Skills specification](https://agentskills.io/specification) for packaging.
