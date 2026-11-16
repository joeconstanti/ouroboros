import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("dry run needs neither git nor an agent and creates no artifacts", () => {
	const dir = mkdtempSync(join(tmpdir(), "ouroboros-dry-"));
	try {
		writeFileSync(
			join(dir, "experiment.yaml"),
			"evaluator:\n  command: touch SHOULD_NOT_EXIST\nprimary_metric: {}\n",
		);
		const result = Bun.spawnSync(
			[
				process.execPath,
				resolve(import.meta.dir, "../index.ts"),
				"--experiment",
				"--experiment-file",
				"experiment.yaml",
				"--dry-run",
			],
			{ cwd: dir },
		);
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("not evaluated");
		expect(existsSync(join(dir, "SHOULD_NOT_EXIST"))).toBe(false);
		expect(existsSync(join(dir, ".ouroboros"))).toBe(false);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
