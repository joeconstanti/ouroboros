import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
test("generic evaluator fails closed without configured checks", () => {
	const dir = mkdtempSync(join(tmpdir(), "ouroboros-eval-"));
	try {
		const result = Bun.spawnSync(["bash", resolve(import.meta.dir, "../../../scripts/eval.sh")], {
			cwd: dir,
		});
		expect(result.exitCode).toBe(1);
		expect(result.stdout.toString()).toContain("OUROBOROS_EVAL_STATUS=fail");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
