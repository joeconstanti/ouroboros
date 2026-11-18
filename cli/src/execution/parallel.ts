import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { OUROBOROS_DIR, PROGRESS_FILE } from "../config/loader.ts";
import { logTaskProgress } from "../config/writer.ts";
import type { AIEngine, AIResult } from "../engines/types.ts";
import { cleanupAgentWorktree, createAgentWorktree, getWorktreeBase } from "../git/worktree.ts";
import type { Task, TaskSource } from "../tasks/types.ts";
import { YamlTaskSource } from "../tasks/yaml.ts";
import { logDebug, logError, logInfo, logSuccess } from "../ui/logger.ts";
import { notifyTaskComplete, notifyTaskFailed } from "../ui/notify.ts";
import { rejectBlankResult, tasksToRun } from "./pending.ts";
import { buildParallelPrompt } from "./prompt.ts";
import { isRetryableError, sleep, withRetry } from "./retry.ts";
import type { ExecutionOptions, ExecutionResult } from "./sequential.ts";

interface ParallelAgentResult {
	task: Task;
	worktreeDir: string;
	branchName: string;
	result: AIResult | null;
	error?: string;
}

/**
 * Run a single agent in a worktree
 */
async function runAgentInWorktree(
	engine: AIEngine,
	task: Task,
	agentNum: number,
	baseBranch: string,
	worktreeBase: string,
	originalDir: string,
	prdSource: string,
	prdFile: string,
	maxRetries: number,
	retryDelay: number,
): Promise<ParallelAgentResult> {
	let worktreeDir = "";
	let branchName = "";

	try {
		// Create worktree
		const worktree = await createAgentWorktree(
			task.title,
			agentNum,
			baseBranch,
			worktreeBase,
			originalDir,
		);
		worktreeDir = worktree.worktreeDir;
		branchName = worktree.branchName;

		logDebug(`Agent ${agentNum}: Created worktree at ${worktreeDir}`);

		// Copy PRD file to worktree
		if (prdSource === "markdown" || prdSource === "yaml") {
			const srcPath = join(originalDir, prdFile);
			const destPath = join(worktreeDir, prdFile);
			if (existsSync(srcPath)) {
				copyFileSync(srcPath, destPath);
			}
		}

		// Ensure .ouroboros/ exists in worktree
		const ouroborosDir = join(worktreeDir, OUROBOROS_DIR);
		if (!existsSync(ouroborosDir)) {
			mkdirSync(ouroborosDir, { recursive: true });
		}

		// Build prompt
		const prompt = buildParallelPrompt(task.title, PROGRESS_FILE);

		// Execute with retry
		const result = await withRetry(
			async () => {
				const res = await engine.execute(prompt, worktreeDir);
				if (!res.success && res.error && isRetryableError(res.error)) {
					throw new Error(res.error);
				}
				return res;
			},
			{ maxRetries, retryDelay },
		);

		return { task, worktreeDir, branchName, result };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		return { task, worktreeDir, branchName, result: null, error: errorMsg };
	}
}

/**
 * Run tasks in parallel using worktrees
 */
export async function runParallel(
	options: ExecutionOptions & { maxParallel: number; prdSource: string; prdFile: string },
): Promise<ExecutionResult> {
	const {
		engine,
		taskSource,
		workDir,
		dryRun,
		maxIterations,
		maxRetries,
		retryDelay,
		baseBranch,
		maxParallel,
		prdSource,
		prdFile,
	} = options;

	const result: ExecutionResult = {
		tasksCompleted: 0,
		tasksFailed: 0,
		totalInputTokens: 0,
		totalOutputTokens: 0,
	};

	// Get worktree base directory
	const worktreeBase = getWorktreeBase(workDir);
	logDebug(`Worktree base: ${worktreeBase}`);

	// Process tasks in batches
	let iteration = 0;
	const skipped = new Set<string>();

	while (true) {
		// Check iteration limit
		if (maxIterations > 0 && iteration >= maxIterations) {
			logInfo(`Reached max iterations (${maxIterations})`);
			break;
		}

		// Get tasks for this batch
		let tasks: Task[] = [];

		// For YAML sources, try to get tasks from the same parallel group
		if (taskSource instanceof YamlTaskSource) {
			const nextTask = tasksToRun(await taskSource.getAllTasks(), skipped)[0];
			if (nextTask) {
				const group = await taskSource.getParallelGroup(nextTask.title);
				tasks =
					group > 0 ? tasksToRun(await taskSource.getTasksInGroup(group), skipped) : [nextTask];
			}
		} else {
			// For other sources, get all remaining tasks
			tasks = tasksToRun(await taskSource.getAllTasks(), skipped);
		}

		if (tasks.length === 0) {
			if (result.tasksFailed > 0) {
				logInfo(`Stopped after ${result.tasksFailed} failed task(s)`);
			} else {
				logSuccess(dryRun ? "Dry run finished" : "All tasks completed!");
			}
			break;
		}

		// Limit to maxParallel
		const batch = tasks.slice(0, maxParallel);
		iteration++;

		logInfo(`Batch ${iteration}: ${batch.length} tasks in parallel`);

		if (dryRun) {
			for (const task of batch) skipped.add(task.id);
			logInfo("(dry run) Skipping batch");
			continue;
		}

		// Run agents in parallel
		const promises = batch.map((task, i) =>
			runAgentInWorktree(
				engine,
				task,
				i + 1,
				baseBranch,
				worktreeBase,
				workDir,
				prdSource,
				prdFile,
				maxRetries,
				retryDelay,
			),
		);

		const results = await Promise.all(promises);

		// Process results
		for (const agentResult of results) {
			const { task, worktreeDir, branchName, error } = agentResult;
			const aiResult = agentResult.result ? rejectBlankResult(agentResult.result) : null;

			if (error || !aiResult?.success) {
				skipped.add(task.id);
				const errMsg = error || aiResult?.error || "Unknown error";
				logError(`Task "${task.title}" failed: ${errMsg}`);
				logTaskProgress(task.title, "failed", workDir);
				result.tasksFailed++;
				notifyTaskFailed(task.title, errMsg);
			} else if (aiResult?.success) {
				logSuccess(`Task "${task.title}" completed`);
				result.totalInputTokens += aiResult.inputTokens;
				result.totalOutputTokens += aiResult.outputTokens;

				await taskSource.markComplete(task.id);
				logTaskProgress(task.title, "completed", workDir);
				result.tasksCompleted++;
				notifyTaskComplete(task.title);
			}

			// Cleanup worktree
			if (worktreeDir) {
				const cleanup = await cleanupAgentWorktree(worktreeDir, branchName, workDir);
				if (cleanup.leftInPlace) {
					logInfo(`Worktree left in place: ${worktreeDir}`);
				}
			}
		}
	}

	return result;
}
