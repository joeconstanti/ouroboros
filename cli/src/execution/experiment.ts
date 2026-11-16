import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import simpleGit from "simple-git";
import { loadExperimentConfig } from "../config/experiment-loader.ts";
import { loadBoundaries } from "../config/loader.ts";
import type { RuntimeOptions } from "../config/types.ts";
import { createEngine, isEngineAvailable } from "../engines/index.ts";
import type { AIEngineName, AIResult } from "../engines/types.ts";
import { logError, logInfo, logSuccess, logWarn, setVerbose } from "../ui/logger.ts";
import { boundaryViolations } from "./boundaries.ts";
import { runEvaluatorCommand } from "./evaluator-process.ts";
import { isDirectCandidate, restoreAttempt } from "./experiment-git.ts";
import { buildExperimentPrompt } from "./prompt.ts";
import { isRetryableError, withRetry } from "./retry.ts";

import { metricImproved, successfulEvaluation } from "./evaluation.ts";

const OUROBOROS_DIR = ".ouroboros";

function experimentTimestamp(): string {
	return new Date().toISOString().slice(0, 19);
}

function appendTsv(
	workDir: string,
	resultsPath: string,
	row: string,
	commit: string,
	hypothesis: string,
): void {
	const dir = join(workDir, OUROBOROS_DIR, "experiments");
	mkdirSync(dir, { recursive: true });
	const full = join(workDir, resultsPath);
	if (!existsSync(full)) {
		writeFileSync(
			full,
			"timestamp\tattempt\tdecision\tbaseline\tprimary\tbest_before\tstatus_eval\tcommit\thypothesis\n",
			"utf-8",
		);
	}
	appendFileSync(
		full,
		`${row}\t${commit}\t${hypothesis.replace(/[\t\r\n]+/g, " ").trim()}\n`,
		"utf-8",
	);
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

	if (options.dryRun) {
		console.log(
			buildExperimentPrompt({
				attempt: 1,
				baselinePrimary: "(not evaluated)",
				bestPrimary: "(not evaluated)",
				programFile: exp.program_file,
				allowedPaths: exp.allowed_paths,
				forbiddenPaths: exp.forbidden_paths,
				workDir,
				autoCommit: options.autoCommit,
			}),
		);
		return;
	}
	if (!options.autoCommit) throw new Error("Experiment mode requires commits; remove --no-commit.");
	const git = simpleGit(workDir);
	if ((await git.revparse("--show-toplevel")).trim() !== workDir)
		throw new Error("Run experiments from the repository root.");
	if (!(await git.status()).isClean()) {
		throw new Error(
			"Experiment mode requires a clean working tree. Commit or stash existing changes first.",
		);
	}
	try {
		await git.raw(["check-ignore", "--quiet", ".ouroboros/experiments/"]);
	} catch {
		throw new Error(
			"Ignore .ouroboros/experiments/ in Git before running experiments so cleanup preserves run evidence.",
		);
	}
	const engine = createEngine(options.aiEngine as AIEngineName);
	if (!(await isEngineAvailable(options.aiEngine as AIEngineName))) {
		throw new Error(`${engine.name} CLI not found.`);
	}
	const frozenBoundaries = loadBoundaries(workDir);
	const frozenFiles = [options.experimentFile, exp.program_file, ".ouroboros/config.yaml"].map(
		(path) => resolve(workDir, path),
	);
	const frozenContents = frozenFiles.map((path) =>
		existsSync(path) ? readFileSync(path, "utf-8") : null,
	);
	const assertFrozen = (): void => {
		if (
			frozenFiles.some(
				(path, i) => (existsSync(path) ? readFileSync(path, "utf-8") : null) !== frozenContents[i],
			)
		)
			throw new Error(
				"Experiment configuration or protocol changed; stopping. Restore the frozen harness before resuming.",
			);
	};
	const baseBranch = options.baseBranch || exp.base_branch || (await git.branch()).current;
	if (!baseBranch) throw new Error("Detached HEAD: specify --base-branch.");
	await git.checkout(baseBranch);

	const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
	const expBranch = `ouroboros/experiment-${runId}`;
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

	const runDir = join(OUROBOROS_DIR, "experiments", "runs", runId);
	mkdirSync(join(workDir, runDir), { recursive: true });
	const hypothesisFile = join(workDir, OUROBOROS_DIR, "experiments", "last-hypothesis.txt");
	writeFileSync(hypothesisFile, "", "utf-8");
	writeFileSync(
		join(workDir, runDir, "manifest.json"),
		JSON.stringify(
			{
				runId,
				branch: expBranch,
				startingCommit: (await git.revparse("HEAD")).trim(),
				engine: options.aiEngine,
				config: exp,
				runtime: Bun.version,
			},
			null,
			2,
		),
	);
	const baselineLog = join(workDir, runDir, "baseline.log");

	const baselineCommit = (await git.revparse("HEAD")).trim();
	const { code: baselineCode, combined: baselineOut } = await runEvaluatorCommand(
		evalCmd,
		workDir,
		evalTimeout,
	);
	writeFileSync(baselineLog, baselineOut, "utf-8");
	assertFrozen();
	if (
		!(await git.status()).isClean() ||
		(await git.revparse("HEAD")).trim() !== baselineCommit ||
		(await git.branch()).current !== expBranch
	) {
		await restoreAttempt(git, expBranch, baselineCommit);
		throw new Error(`Baseline evaluator modified Git state; see ${baselineLog}`);
	}
	const parsedBase = successfulEvaluation(baselineCode, baselineOut);
	if (!parsedBase) {
		throw new Error(`Baseline evaluator failed or emitted invalid output; see ${baselineLog}`);
	}
	const baselineScore = parsedBase.primary;
	logInfo(`Baseline primary=${baselineScore}`);

	let bestScore = Number.parseFloat(baselineScore);
	if (Number.isNaN(bestScore)) bestScore = 0;

	let bestCommit = (await git.revparse("HEAD")).trim();

	const wallStart = Date.now();
	const resultsTsv = join(runDir, "results.tsv");
	let attemptedCommit = bestCommit;
	const record = (row: string): void =>
		appendTsv(
			workDir,
			resultsTsv,
			row,
			attemptedCommit,
			existsSync(hypothesisFile) ? readFileSync(hypothesisFile, "utf-8") : "",
		);
	record(
		`${experimentTimestamp()}\t0\tbaseline\t${baselineScore}\t${baselineScore}\t${baselineScore}\tok`,
	);

	for (let att = 1; att <= maxAttempts; att++) {
		if ((Date.now() - wallStart) / 1000 > budgetSec) {
			logWarn(`Wall clock budget (${budgetSec}s) reached.`);
			break;
		}

		logInfo(`Experiment attempt ${att} / ${maxAttempts}`);
		writeFileSync(hypothesisFile, "", "utf-8");
		attemptedCommit = bestCommit;

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

		let aiResult: AIResult | null = null;
		try {
			aiResult = await withRetry(
				async () => {
					await restoreAttempt(git, expBranch, bestCommit);
					const res = await engine.execute(prompt, workDir);
					if (!res.success && res.error && isRetryableError(res.error)) {
						throw new Error(res.error);
					}
					return res;
				},
				{ maxRetries: options.maxRetries, retryDelay: options.retryDelay },
			);
		} catch {
			attemptedCommit = (await git.revparse("HEAD")).trim();
			await restoreAttempt(git, expBranch, bestCommit);
			record(`${experimentTimestamp()}\t${att}\taifail\t${baselineScore}\t\t${bestScore}\t`);
			continue;
		}

		assertFrozen();
		attemptedCommit = (await git.revparse("HEAD")).trim();
		if (!aiResult?.success) {
			await restoreAttempt(git, expBranch, bestCommit);
			record(`${experimentTimestamp()}\t${att}\taifail\t${baselineScore}\t\t${bestScore}\t`);
			continue;
		}

		const ncommits = (await git.raw(["rev-list", "--count", `${bestCommit}..HEAD`])).trim();
		const nc = Number.parseInt(ncommits, 10) || 0;
		if (nc === 0) {
			await restoreAttempt(git, expBranch, bestCommit);
			logWarn("No new commit; skipping.");
			record(`${experimentTimestamp()}\t${att}\tnocommit\t${baselineScore}\t\t${bestScore}\t`);
			continue;
		}
		if (nc > 1 || !(await isDirectCandidate(git, expBranch, bestCommit))) {
			logWarn("Multiple commits; resetting to best.");
			await restoreAttempt(git, expBranch, bestCommit);
			record(`${experimentTimestamp()}\t${att}\tmulticommit\t${baselineScore}\t\t${bestScore}\t`);
			continue;
		}

		const changedPaths = (
			await git.raw(["diff", "--name-only", "-z", "--no-renames", bestCommit, "HEAD"])
		)
			.split("\0")
			.filter(Boolean);
		const violations = boundaryViolations(changedPaths, exp.allowed_paths, [
			...exp.forbidden_paths,
			...frozenBoundaries,
			options.experimentFile,
			exp.program_file,
		]);
		if (violations.length > 0 || !(await git.status()).isClean()) {
			logWarn(`Candidate violates boundaries or has uncommitted changes: ${violations.join(", ")}`);
			await restoreAttempt(git, expBranch, bestCommit);
			record(`${experimentTimestamp()}\t${att}\tboundary\t${baselineScore}\t\t${bestScore}\t`);
			continue;
		}

		const attemptLog = join(workDir, runDir, `attempt-${att}.log`);
		const candidateCommit = (await git.revparse("HEAD")).trim();
		const { code: attemptCode, combined: attemptOut } = await runEvaluatorCommand(
			evalCmd,
			workDir,
			evalTimeout,
		);
		writeFileSync(attemptLog, attemptOut, "utf-8");
		assertFrozen();
		const parsed = successfulEvaluation(attemptCode, attemptOut);
		if (
			!parsed ||
			!(await git.status()).isClean() ||
			(await git.revparse("HEAD")).trim() !== candidateCommit ||
			(await git.branch()).current !== expBranch
		) {
			logWarn("Could not parse evaluator output; reverting.");
			await restoreAttempt(git, expBranch, bestCommit);
			record(`${experimentTimestamp()}\t${att}\tunparsed\t${baselineScore}\t\t${bestScore}\t`);
			continue;
		}

		const newNum = Number.parseFloat(parsed.primary);
		if (Number.isNaN(newNum)) {
			await restoreAttempt(git, expBranch, bestCommit);
			continue;
		}

		if (metricImproved(direction, threshold, bestScore, newNum)) {
			logSuccess(`KEEP primary=${parsed.primary} (was ${bestScore})`);
			const bestBefore = bestScore;
			bestScore = newNum;
			bestCommit = (await git.revparse("HEAD")).trim();
			record(
				`${experimentTimestamp()}\t${att}\tkeep\t${baselineScore}\t${parsed.primary}\t${bestBefore}\t${parsed.status}`,
			);
		} else {
			logWarn(`DISCARD primary=${parsed.primary} (best=${bestScore})`);
			await restoreAttempt(git, expBranch, bestCommit);
			record(
				`${experimentTimestamp()}\t${att}\tdiscard\t${baselineScore}\t${parsed.primary}\t${bestScore}\t${parsed.status}`,
			);
		}
	}

	logInfo(`Experiment finished. Best primary: ${bestScore}. Results: ${resultsTsv}`);
}
