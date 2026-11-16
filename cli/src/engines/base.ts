import { spawn } from "node:child_process";
import type { AIEngine, AIResult } from "./types.ts";

export interface EngineUsage {
	inputTokens?: number;
	outputTokens?: number;
	cost?: string;
}

/**
 * Check if a command is available in PATH.
 * Bun.which works on Windows, where `which` is not a command.
 */
export async function commandExists(command: string): Promise<boolean> {
	return Bun.which(command) !== null;
}

/**
 * Execute a command and return stdout
 */
export async function execCommand(
	command: string,
	args: string[],
	workDir: string,
	env?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const proc = Bun.spawn([command, ...args], {
		cwd: workDir,
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, ...env },
	});
	// Close stdin so a CLI cannot block waiting for interactive input.
	proc.stdin.end();

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	return { stdout, stderr, exitCode };
}

/**
 * Parse token counts from stream-json output (Claude/Qwen format)
 */
export function parseStreamJsonResult(output: string): {
	response: string;
	inputTokens: number;
	outputTokens: number;
} {
	const lines = output.split("\n").filter(Boolean);
	let response = "";
	let inputTokens = 0;
	let outputTokens = 0;

	for (const line of lines) {
		try {
			const parsed = JSON.parse(line);
			if (parsed.type === "result" && parsed.is_error !== true) {
				response = typeof parsed.result === "string" ? parsed.result : "";
				const usage = parsed.usage ?? {};
				inputTokens =
					(usage.input_tokens || 0) +
					(usage.cache_creation_input_tokens || 0) +
					(usage.cache_read_input_tokens || 0);
				outputTokens = usage.output_tokens || 0;
			}
		} catch {
			// Ignore non-JSON lines
		}
	}

	return { response, inputTokens, outputTokens };
}

/**
 * Check for errors in stream-json output
 */
export function checkForErrors(output: string): string | null {
	const lines = output.split("\n").filter(Boolean);

	for (const line of lines) {
		try {
			const parsed = JSON.parse(line);
			if (parsed.type === "error" || parsed.is_error === true) {
				const message = parsed.error?.message || parsed.message || parsed.result;
				return typeof message === "string" && message.trim().length > 0 ? message : "Unknown error";
			}
		} catch {
			// Ignore non-JSON lines
		}
	}

	return null;
}

/**
 * A non-zero exit is a failed engine call. Blank stdout stays blank so callers
 * can decide whether a silent success is acceptable.
 */
export function resultFromOutput(
	exitCode: number,
	response: string,
	extra: EngineUsage = {},
): AIResult {
	const text = response.trim();
	const inputTokens = extra.inputTokens ?? 0;
	const outputTokens = extra.outputTokens ?? 0;
	if (exitCode !== 0) {
		return {
			success: false,
			response: text,
			inputTokens,
			outputTokens,
			cost: extra.cost,
			error: text || `Engine exited with code ${exitCode}`,
		};
	}
	return {
		success: true,
		response: text,
		inputTokens,
		outputTokens,
		cost: extra.cost,
	};
}

/**
 * Base implementation for AI engines
 */
export abstract class BaseAIEngine implements AIEngine {
	abstract name: string;
	abstract cliCommand: string;

	async isAvailable(): Promise<boolean> {
		return commandExists(this.cliCommand);
	}

	abstract execute(prompt: string, workDir: string): Promise<AIResult>;
}
