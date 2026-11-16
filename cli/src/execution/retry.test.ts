import { expect, test } from "bun:test";
import { isRetryableError, retryDelayMs, withRetry } from "./retry.ts";

test("retry delay grows exponentially, jitters, and caps at 60s", () => {
	expect(retryDelayMs(1, 5, () => 0)).toBe(5_000);
	expect(retryDelayMs(2, 5, () => 0)).toBe(10_000);
	expect(retryDelayMs(3, 5, () => 0)).toBe(20_000);
	expect(retryDelayMs(1, 5, () => 1)).toBe(6_000);
	expect(retryDelayMs(10, 30, () => 0)).toBe(60_000);
	expect(retryDelayMs(1, 0, () => 1)).toBe(0);
});

test("permanent errors are not retried", async () => {
	let calls = 0;
	await expect(
		withRetry(
			async () => {
				calls++;
				throw new Error("compile failed");
			},
			{ maxRetries: 4, retryDelay: 0 },
		),
	).rejects.toThrow("compile failed");
	expect(calls).toBe(1);
});

test("rate limits are retried until success", async () => {
	let calls = 0;
	const value = await withRetry(
		async () => {
			calls++;
			if (calls < 3) throw new Error("429 rate limit");
			return "ok";
		},
		{ maxRetries: 4, retryDelay: 0 },
	);
	expect(value).toBe("ok");
	expect(calls).toBe(3);
});

test("empty agent responses are retryable", () => {
	expect(isRetryableError("Empty response")).toBe(true);
	expect(isRetryableError("compile failed")).toBe(false);
});
