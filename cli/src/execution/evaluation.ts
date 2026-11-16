export type ParsedEval = {
	status: string;
	primary: string;
	durationMs: string;
};

export function parseEvalOutput(text: string): ParsedEval | null {
	let status = "";
	let primary = "";
	let durationMs = "";
	for (const line of text.split("\n")) {
		if (line.startsWith("OUROBOROS_EVAL_STATUS=")) {
			status = line.slice("OUROBOROS_EVAL_STATUS=".length).trim();
		} else if (line.startsWith("OUROBOROS_EVAL_PRIMARY=")) {
			primary = line.slice("OUROBOROS_EVAL_PRIMARY=".length).trim();
		} else if (line.startsWith("OUROBOROS_EVAL_DURATION_MS=")) {
			durationMs = line.slice("OUROBOROS_EVAL_DURATION_MS=".length).trim();
		}
	}
	if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(primary)) return null;
	if (!Number.isFinite(Number(primary))) return null;
	if (status !== "ok" && status !== "fail") return null;
	return { status, primary, durationMs };
}

export function metricImproved(
	direction: "min" | "max",
	threshold: number,
	best: number,
	next: number,
): boolean {
	if (direction === "min") {
		return next < best - threshold;
	}
	return next > best + threshold;
}

/** Scores are usable only when the process and its quality gate both succeed. */
export function successfulEvaluation(code: number, output: string): ParsedEval | null {
	const parsed = parseEvalOutput(output);
	return code === 0 && parsed?.status === "ok" ? parsed : null;
}
