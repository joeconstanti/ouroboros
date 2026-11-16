import { logDebug, logWarn } from "../ui/logger.ts";

interface RetryOptions {
	maxRetries: number;
	retryDelay: number; // in seconds
	onRetry?: (attempt: number, error: string) => void;
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delay before the next attempt. `attempt` is the 1-based attempt that just failed.
 * The delay grows exponentially and adds up to 20% jitter, capped at 60s.
 */
export function retryDelayMs(
	attempt: number,
	baseSeconds: number,
	random: () => number = Math.random,
): number {
	const base = Math.max(0, baseSeconds) * 1000;
	const exponential = base * 2 ** Math.max(0, attempt - 1);
	const capped = Math.min(exponential, 60_000);
	const roll = Math.min(1, Math.max(0, random()));
	return Math.round(capped + capped * 0.2 * roll);
}

/**
 * Execute a function with retry logic.
 * Permanent failures throw immediately. Rate limits, timeouts and network
 * errors wait with exponential backoff.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
	const { maxRetries, retryDelay, onRetry } = options;
	const attempts = Math.max(1, maxRetries);
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			const errorMsg = lastError.message;
			if (!isRetryableError(errorMsg) || attempt >= attempts) {
				throw lastError;
			}

			logWarn(`Attempt ${attempt}/${attempts} failed: ${errorMsg}`);
			onRetry?.(attempt, errorMsg);

			const delay = retryDelayMs(attempt, retryDelay);
			logDebug(`Waiting ${delay}ms before retry...`);
			await sleep(delay);
		}
	}

	throw lastError || new Error("All retry attempts failed");
}

/**
 * Check if an error is retryable (e.g., rate limit, network error)
 */
export function isRetryableError(error: string): boolean {
	const retryablePatterns = [
		/rate limit/i,
		/too many requests/i,
		/429/,
		/timeout/i,
		/network/i,
		/connection/i,
		/ECONNRESET/,
		/ETIMEDOUT/,
		/ENOTFOUND/,
		/overloaded/i,
		/empty response/i,
	];

	return retryablePatterns.some((pattern) => pattern.test(error));
}
