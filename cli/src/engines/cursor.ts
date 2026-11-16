import { BaseAIEngine, checkForErrors, execCommand, resultFromOutput } from "./base.ts";
import type { AIResult } from "./types.ts";

/**
 * Cursor Agent AI Engine
 */
export class CursorEngine extends BaseAIEngine {
	name = "Cursor Agent";
	cliCommand = "agent";

	async execute(prompt: string, workDir: string): Promise<AIResult> {
		const { stdout, stderr, exitCode } = await execCommand(
			this.cliCommand,
			["--print", "--force", "--output-format", "stream-json", prompt],
			workDir,
		);

		const output = stdout + stderr;

		// Check for errors
		const error = checkForErrors(output);
		if (error) {
			return {
				success: false,
				response: "",
				inputTokens: 0,
				outputTokens: 0,
				error,
			};
		}

		// Parse Cursor output
		const { response, durationMs } = this.parseOutput(output);
		return resultFromOutput(exitCode, response, {
			cost: durationMs > 0 ? `duration:${durationMs}` : undefined,
		});
	}

	private parseOutput(output: string): { response: string; durationMs: number } {
		const lines = output.split("\n").filter(Boolean);
		let response = "";
		let durationMs = 0;

		for (const line of lines) {
			try {
				const parsed = JSON.parse(line);

				// Check result line
				if (parsed.type === "result") {
					if (typeof parsed.result === "string" && parsed.result.trim().length > 0) {
						response = parsed.result;
					}
					if (typeof parsed.duration_ms === "number") {
						durationMs = parsed.duration_ms;
					}
				}

				// Check assistant message as fallback
				if (parsed.type === "assistant" && !response) {
					const content = parsed.message?.content;
					if (Array.isArray(content) && content[0]?.text) {
						response = content[0].text;
					} else if (typeof content === "string") {
						response = content;
					}
				}
			} catch {
				// Ignore non-JSON lines
			}
		}

		return { response, durationMs };
	}
}
