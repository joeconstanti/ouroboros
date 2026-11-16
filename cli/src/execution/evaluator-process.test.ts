import { expect, test } from "bun:test";
import { runEvaluatorCommand } from "./evaluator-process.ts";
test("evaluator preserves exit status and diagnostics", async () => {
	const result = await runEvaluatorCommand("echo diagnostic >&2; exit 7", process.cwd(), 2);
	expect(result.code).toBe(7);
	expect(result.combined).toContain("diagnostic");
});
test("timeout kills the shell and its pipe-holding descendants", async () => {
	const start = Date.now();
	const result = await runEvaluatorCommand("sleep 30 & wait", process.cwd(), 0.05);
	expect(result.code).toBe(124);
	expect(Date.now() - start).toBeLessThan(2000);
});
