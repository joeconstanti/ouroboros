import { expect, test } from "bun:test";
import type { AIEngine } from "../engines/types.ts";
import type { Task, TaskSource } from "../tasks/types.ts";
import { rejectBlankResult, tasksToRun } from "./pending.ts";
import { runSequential } from "./sequential.ts";

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
		workDir: process.cwd(),
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
