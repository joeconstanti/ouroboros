import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import simpleGit from "simple-git";
import type { AIEngine } from "../engines/types.ts";
import type { Task, TaskSource } from "../tasks/types.ts";
import { rejectBlankResult, tasksToRun } from "./pending.ts";
import { type ExecutionOptions, runSequential } from "./sequential.ts";

test("pending tasks skip ones this run already gave up on", () => {
	const tasks: Task[] = [
		{ id: "1", title: "one", completed: false },
		{ id: "2", title: "two", completed: true },
		{ id: "3", title: "three", completed: false },
	];
	expect(tasksToRun(tasks, new Set(["1"])).map((task) => task.id)).toEqual(["3"]);
});

test("a silent success is a failure", () => {
	expect(
		rejectBlankResult({ success: true, response: "  ", inputTokens: 1, outputTokens: 2 }),
	).toMatchObject({
		success: false,
		error: "Empty response",
		inputTokens: 1,
	});
});

function sourceFor(titles: string[]): TaskSource {
	const tasks: Task[] = titles.map((title, index) => ({
		id: String(index + 1),
		title,
		completed: false,
	}));
	return {
		type: "markdown",
		async getAllTasks() {
			return tasks.filter((task) => !task.completed);
		},
		async getNextTask() {
			return (await this.getAllTasks())[0] ?? null;
		},
		async markComplete(id: string) {
			const task = tasks.find((item) => item.id === id);
			if (task) task.completed = true;
		},
		async countRemaining() {
			return (await this.getAllTasks()).length;
		},
		async countCompleted() {
			return tasks.filter((task) => task.completed).length;
		},
	};
}

function engine(execute: AIEngine["execute"]): AIEngine {
	return {
		name: "Fake",
		cliCommand: "true",
		async isAvailable() {
			return true;
		},
		execute,
	};
}

test("a failed task does not block the rest of the list", async () => {
	const workDir = mkdtempSync(join(tmpdir(), "ouroboros-pending-"));
	try {
		const result = await runSequential({
			engine: engine(async (prompt) => {
				if (prompt.includes("one")) {
					return {
						success: false,
						response: "",
						inputTokens: 0,
						outputTokens: 0,
						error: "compile failed",
					};
				}
				return { success: true, response: "done", inputTokens: 2, outputTokens: 3 };
			}),
			taskSource: sourceFor(["one", "two"]),
			workDir,
			skipTests: true,
			skipLint: true,
			dryRun: false,
			maxIterations: 0,
			maxRetries: 1,
			retryDelay: 0,
			branchPerTask: false,
			baseBranch: "",
			createPr: false,
			draftPr: false,
			autoCommit: false,
		});

		expect(result).toMatchObject({
			tasksCompleted: 1,
			tasksFailed: 1,
			totalInputTokens: 2,
			totalOutputTokens: 3,
		});
	} finally {
		rmSync(workDir, { recursive: true, force: true });
	}
});

test("dry run visits each task once", async () => {
	let calls = 0;
	const result = await runSequential({
		engine: engine(async () => {
			calls++;
			return { success: true, response: "done", inputTokens: 0, outputTokens: 0 };
		}),
		taskSource: sourceFor(["one", "two"]),
		workDir: process.cwd(),
		skipTests: true,
		skipLint: true,
		dryRun: true,
		maxIterations: 0,
		maxRetries: 1,
		retryDelay: 0,
		branchPerTask: false,
		baseBranch: "",
		createPr: false,
		draftPr: false,
		autoCommit: false,
	});
	expect(result.tasksCompleted).toBe(0);
	expect(calls).toBe(0);
});

test("branch setup failure leaves the task open without running the engine", async () => {
	const workDir = mkdtempSync(join(tmpdir(), "ouroboros-task-branch-"));
	const git = simpleGit(workDir);
	try {
		await git.raw(["init", "-b", "main"]);
		await git.raw([
			"-c",
			"user.name=Test",
			"-c",
			"user.email=test@example.com",
			"commit",
			"--allow-empty",
			"-m",
			"baseline",
		]);
		const taskSource = sourceFor(["one"]);
		let calls = 0;
		const options: ExecutionOptions = {
			engine: engine(async () => {
				calls++;
				return { success: true, response: "done", inputTokens: 0, outputTokens: 0 };
			}),
			taskSource,
			workDir,
			skipTests: true,
			skipLint: true,
			dryRun: false,
			maxIterations: 1,
			maxRetries: 1,
			retryDelay: 0,
			branchPerTask: true,
			baseBranch: "missing-base",
			createPr: false,
			draftPr: false,
			autoCommit: false,
		};

		await expect(runSequential(options)).rejects.toThrow('Failed to create task branch for "one"');
		await expect(runSequential({ ...options, baseBranch: "" })).rejects.toThrow(
			"Task branch requires a base branch",
		);
		await runSequential({ ...options, dryRun: true, baseBranch: "main" });
		expect(calls).toBe(0);
		expect(await taskSource.countRemaining()).toBe(1);
		expect((await git.branchLocal()).all).toEqual(["main"]);
		expect((await git.status()).isClean()).toBe(true);
	} finally {
		rmSync(workDir, { recursive: true, force: true });
	}
});
