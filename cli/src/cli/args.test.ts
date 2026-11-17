import { expect, test } from "bun:test";
import { DEFAULT_OPTIONS } from "../config/types.ts";
import { createProgram, parseArgs } from "./args.ts";

test("numeric defaults and explicit zero budgets are preserved", () => {
	const defaults = parseArgs(["bun", "ouroboros"]).options;
	for (const key of ["maxIterations", "maxRetries", "retryDelay", "maxParallel"] as const) {
		expect(defaults[key]).toBe(DEFAULT_OPTIONS[key]);
	}
	const { options } = parseArgs([
		"bun",
		"ouroboros",
		"--max-iterations",
		"0",
		"--max-retries",
		"0",
		"--retry-delay",
		"0",
		"--max-parallel",
		"1",
	]);
	expect(options.maxIterations).toBe(0);
	expect(options.maxRetries).toBe(0);
	expect(options.retryDelay).toBe(0);
	expect(options.maxParallel).toBe(1);
});

test("numeric options reject malformed, fractional, negative and unsafe integers", () => {
	for (const flag of ["--max-iterations", "--max-retries", "--retry-delay", "--max-parallel"]) {
		for (const value of ["bad", "2x", "1.5", "-1", "Infinity", "9007199254740992", "1e3", ""]) {
			const program = createProgram()
				.exitOverride()
				.configureOutput({ writeErr: () => {} });
			expect(() => program.parse(["bun", "ouroboros", flag, value])).toThrow();
		}
	}
	const program = createProgram()
		.exitOverride()
		.configureOutput({ writeErr: () => {} });
	expect(() => program.parse(["bun", "ouroboros", "--max-parallel", "0"])).toThrow();
});
