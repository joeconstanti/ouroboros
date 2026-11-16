import { expect, test } from "bun:test";
import { ExperimentConfigSchema } from "../config/types.ts";
import { metricImproved, parseEvalOutput } from "./evaluation.ts";

test("metrics reject missing, partial and nonfinite values", () => {
	for (const value of ["", "NaN", "Infinity", "1ms", "1e999"]) {
		expect(parseEvalOutput(`OUROBOROS_EVAL_STATUS=ok\nOUROBOROS_EVAL_PRIMARY=${value}`)).toBeNull();
	}
	expect(parseEvalOutput("OUROBOROS_EVAL_PRIMARY=1")).toBeNull();
	expect(parseEvalOutput("OUROBOROS_EVAL_STATUS=ok\nOUROBOROS_EVAL_PRIMARY=1.2e-3")?.primary).toBe(
		"1.2e-3",
	);
});
test("improvement respects direction and minimum threshold", () => {
	expect(metricImproved("min", 0.1, 1, 0.8)).toBe(true);
	expect(metricImproved("min", 0.1, 1, 0.95)).toBe(false);
	expect(metricImproved("max", 0, 1, 2)).toBe(true);
	expect(metricImproved("max", 0, 1, 1)).toBe(false);
});
test("configuration rejects empty evaluators and negative thresholds", () => {
	expect(
		ExperimentConfigSchema.safeParse({ evaluator: { command: " " }, primary_metric: {} }).success,
	).toBe(false);
	expect(
		ExperimentConfigSchema.safeParse({
			evaluator: { command: "true" },
			primary_metric: { improvement_threshold: -1 },
		}).success,
	).toBe(false);
});
