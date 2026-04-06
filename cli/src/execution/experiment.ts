import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import simpleGit from "simple-git";
import { loadExperimentConfig } from "../config/experiment-loader.ts";
import type { RuntimeOptions } from "../config/types.ts";
import { createEngine, isEngineAvailable } from "../engines/index.ts";
import type { AIEngineName, AIResult } from "../engines/types.ts";
import { getDefaultBaseBranch } from "../git/branch.ts";
import { logError, logInfo, logSuccess, logWarn, setVerbose } from "../ui/logger.ts";
import { buildExperimentPrompt } from "./prompt.ts";
import { isRetryableError, withRetry } from "./retry.ts";

const OUROBOROS_DIR = ".ouroboros";

type ParsedEval = {
	status: string;
	primary: string;
	durationMs: string;
};

function parseEvalOutput(text: string): ParsedEval | null {
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
	if (primary === "") return null;
	return { status, primary, durationMs };
}

function metricImproved(
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

function runEvaluatorCommand(
	command: string,
	cwd: string,
	timeoutSec: number,
): Promise<{ code: number; combined: string }> {
	return new Promise((resolve) => {
		const child = spawn("bash", ["-c", command], {
			cwd,
			env: process.env,
		});
		let combined = "";
		const onData = (d: Buffer): void => {
			combined += d.toString();
		};
		child.stdout?.on("data", onData);
		child.stderr?.on("data", onData);
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
		}, timeoutSec * 1000);
		child.on("close", (code) => {
			clearTimeout(timer);
			resolve({ code: code ?? 1, combined });
		});
		child.on("error", () => {
			clearTimeout(timer);
			resolve({ code: 1, combined });
		});
	});
}

function experimentTimestamp(): string {
	return new Date().toISOString().slice(0, 19);
}

function appendTsv(workDir: string, resultsPath: string, row: string): void {
	const dir = join(workDir, OUROBOROS_DIR, "experiments");
	mkdirSync(dir, { recursive: true });
	const full = join(workDir, resultsPath);
	if (!existsSync(full)) {
		writeFileSync(
			full,
			"timestamp\tattempt\tdecision\tbaseline\tprimary\tbest_before\tstatus_eval\n",
			"utf-8",
		);
	}
	appendFileSync(full, `${row}\n`, "utf-8");
}

/**
 * Autoresearch-style experiment loop (TypeScript parity with ouroboros.sh --experiment).
 */
export async function runExperimentLoop(options: RuntimeOptions): Promise<void> {
	const workDir = process.cwd();
	setVerbose(options.verbose);

	const exp = loadExperimentConfig(options.experimentFile, workDir);
	if (!exp) {
		logError(`Experiment config not found or invalid: ${options.experimentFile}`);
		logInfo("Copy examples/autoresearch/experiment.yaml to .ouroboros/experiment.yaml");
		process.exit(1);
	}

	const engine = createEngine(options.aiEngine as AIEngineName);
	const available = await isEngineAvailable(options.aiEngine as AIEngineName);
	if (!available) {
		logError(`${engine.name} CLI not found.`);
		process.exit(1);
	}

	let baseBranch = options.baseBranch;
	if (!baseBranch) {
		baseBranch = exp.base_branch ?? (await getDefaultBaseBranch(workDir));
	}

	const git = simpleGit(workDir);
	await git.checkout(baseBranch).catch(() => {
		logError(`Cannot checkout ${baseBranch}`);
		process.exit(1);
	});

	const expBranch = `ouroboros/experiment-${Date.now()}`;
	await git.checkoutLocalBranch(expBranch).catch(async () => {
		await git.checkout(expBranch);
	});
	logSuccess(`Created branch ${expBranch}`);

	const evalCmd = exp.evaluator.command;
	const evalTimeout = exp.eval_timeout_sec;
	const direction = exp.primary_metric.direction;
	const threshold = exp.primary_metric.improvement_threshold;
	const maxAttempts = exp.max_attempts;
	const budgetSec = exp.wall_clock_budget_sec;
	const programFile = exp.program_file;

	mkdirSync(join(workDir, OUROBOROS_DIR, "experiments", "runs"), { recursive: true });
	writeFileSync(join(workDir, OUROBOROS_DIR, "experiments", "last-hypothesis.txt"), "", "utf-8");

	const baselineLog = join(workDir, OUROBOROS_DIR, "experiments", "runs", "baseline.log");
	const { combined: baselineOut } = await runEvaluatorCommand(evalCmd, workDir, evalTimeout);
	writeFileSync(baselineLog, baselineOut, "utf-8");
	const parsedBase = parseEvalOutput(baselineOut);
	const baselineScore = parsedBase?.primary ?? "0";
	if (!parsedBase) {
		logWarn(`Baseline did not emit OUROBOROS_EVAL_PRIMARY (see ${baselineLog}). Using 0.`);
	}
	logInfo(`Baseline primary=${baselineScore}`);

	let bestScore = Number.parseFloat(baselineScore);
	if (Number.isNaN(bestScore)) bestScore = 0;

	let bestCommit = (await git.revparse("HEAD")).trim();

	const wallStart = Date.now();
	const resultsTsv = join(OUROBOROS_DIR, "experiments", "results.tsv");

	for (let att = 1; att <= maxAttempts; att++) {
		if ((Date.now() - wallStart) / 1000 > budgetSec) {
			logWarn(`Wall clock budget (${budgetSec}s) reached.`);
			break;
		}

		logInfo(`Experiment attempt ${att} / ${maxAttempts}`);

		const prompt = buildExperimentPrompt({
			attempt: att,
			baselinePrimary: baselineScore,
			bestPrimary: String(bestScore),
			programFile,
			allowedPaths: exp.allowed_paths,
			forbiddenPaths: exp.forbidden_paths,
			workDir,
			autoCommit: options.autoCommit,
		});

		if (options.dryRun) {
			logInfo("(dry run) Prompt:");
			console.log(prompt);
			break;
		}

		let aiResult: AIResult | null = null;
		try {
			aiResult = await withRetry(
				async () => {
					const res = await engine.execute(prompt, workDir);
					if (!res.success && res.error && isRetryableError(res.error)) {
						throw new Error(res.error);
					}
					return res;
				},
				{ maxRetries: options.maxRetries, retryDelay: options.retryDelay },
			);
		} catch {
			appendTsv(
				workDir,
				resultsTsv,
				`${experimentTimestamp()}\t${att}\taifail\t${baselineScore}\t\t${bestScore}\t`,
			);
			continue;
		}

		if (!aiResult?.success) {
			appendTsv(
				workDir,
				resultsTsv,
				`${experimentTimestamp()}\t${att}\taifail\t${baselineScore}\t\t${bestScore}\t`,
			);
			continue;
		}

		const ncommits = (await git.raw(["rev-list", "--count", `${bestCommit}..HEAD`])).trim();
		const nc = Number.parseInt(ncommits, 10) || 0;
		if (nc === 0) {
			logWarn("No new commit; skipping.");
			appendTsv(
				workDir,
				resultsTsv,
				`${experimentTimestamp()}\t${att}\tnocommit\t${baselineScore}\t\t${bestScore}\t`,
			);
			continue;
		}
		if (nc > 1) {
			logWarn("Multiple commits; resetting to best.");
			await git.raw(["reset", "--hard", bestCommit]);
			appendTsv(
				workDir,
				resultsTsv,
				`${experimentTimestamp()}\t${att}\tmulticommit\t${baselineScore}\t\t${bestScore}\t`,
			);
			continue;
		}

		const attemptLog = join(workDir, OUROBOROS_DIR, "experiments", "runs", `attempt-${att}.log`);
		const { combined: attemptOut } = await runEvaluatorCommand(evalCmd, workDir, evalTimeout);
		writeFileSync(attemptLog, attemptOut, "utf-8");
		const parsed = parseEvalOutput(attemptOut);
		if (!parsed) {
			logWarn("Could not parse evaluator output; reverting.");
			await git.raw(["reset", "--hard", bestCommit]);
			appendTsv(
				workDir,
				resultsTsv,
				`${experimentTimestamp()}\t${att}\tunparsed\t${baselineScore}\t\t${bestScore}\t`,
			);
			continue;
		}

		const newNum = Number.parseFloat(parsed.primary);
		if (Number.isNaN(newNum)) {
			await git.raw(["reset", "--hard", bestCommit]);
			continue;
		}

		if (metricImproved(direction, threshold, bestScore, newNum)) {
			logSuccess(`KEEP primary=${parsed.primary} (was ${bestScore})`);
			bestScore = newNum;
			bestCommit = (await git.revparse("HEAD")).trim();
			appendTsv(
				workDir,
				resultsTsv,
				`${experimentTimestamp()}\t${att}\tkeep\t${baselineScore}\t${parsed.primary}\t${bestScore}\t${parsed.status}`,
			);
		} else {
			logWarn(`DISCARD primary=${parsed.primary} (best=${bestScore})`);
			await git.raw(["reset", "--hard", bestCommit]);
			appendTsv(
				workDir,
				resultsTsv,
				`${experimentTimestamp()}\t${att}\tdiscard\t${baselineScore}\t${parsed.primary}\t${bestScore}\t${parsed.status}`,
			);
		}
	}

	logInfo(`Experiment finished. Best primary: ${bestScore}. Results: ${resultsTsv}`);
}
