import { readFileSync, writeFileSync } from "node:fs";
import type { Task, TaskSource } from "./types.ts";

const OPEN_TASK = /^\s*[-*+] \[ \] (.+)$/;
const OPEN_MARK = /^(\s*[-*+] )\[ \] /;
const COMPLETED_TASK = /^\s*[-*+] \[x\] /i;
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export interface MarkdownTaskLine {
	line: number;
	title: string;
}

/**
 * Checkbox items inside fenced code samples are examples, not tasks.
 */
export function scanMarkdownTasks(content: string): {
	open: MarkdownTaskLine[];
	completed: number;
} {
	const lines = content.split("\n");
	let fence: { marker: string; length: number } | null = null;
	const open: MarkdownTaskLine[] = [];
	let completed = 0;

	for (let index = 0; index < lines.length; index++) {
		const line = (lines[index] ?? "").replace(/\r$/, "");
		const delimiter = line.match(FENCE);
		if (fence) {
			if (
				delimiter &&
				delimiter[1][0] === fence.marker &&
				delimiter[1].length >= fence.length &&
				!delimiter[2].trim()
			) {
				fence = null;
			}
			continue;
		}
		if (delimiter && (delimiter[1][0] === "~" || !delimiter[2].includes("`"))) {
			fence = { marker: delimiter[1][0], length: delimiter[1].length };
			continue;
		}

		const match = line.match(OPEN_TASK);
		if (match?.[1]) {
			open.push({ line: index + 1, title: match[1].trim() });
			continue;
		}
		if (COMPLETED_TASK.test(line)) completed++;
	}

	return { open, completed };
}

/**
 * Markdown task source - reads tasks from markdown files with checkbox format
 * Format: "- [ ] Task description" (incomplete) or "- [x] Task description" (complete)
 */
export class MarkdownTaskSource implements TaskSource {
	type = "markdown" as const;
	private filePath: string;

	constructor(filePath: string) {
		this.filePath = filePath;
	}

	async getAllTasks(): Promise<Task[]> {
		const content = readFileSync(this.filePath, "utf-8");
		return scanMarkdownTasks(content).open.map((task) => ({
			id: String(task.line),
			title: task.title,
			completed: false,
		}));
	}

	async getNextTask(): Promise<Task | null> {
		const tasks = await this.getAllTasks();
		return tasks[0] || null;
	}

	async markComplete(id: string): Promise<void> {
		const content = readFileSync(this.filePath, "utf-8");
		const lineNumber = Number.parseInt(id, 10);
		if (!scanMarkdownTasks(content).open.some((task) => task.line === lineNumber)) return;

		const lines = content.split("\n");
		const index = lineNumber - 1;
		const line = lines[index];
		if (line === undefined) return;
		lines[index] = line.replace(OPEN_MARK, "$1[x] ");
		writeFileSync(this.filePath, lines.join("\n"), "utf-8");
	}

	async countRemaining(): Promise<number> {
		const content = readFileSync(this.filePath, "utf-8");
		return scanMarkdownTasks(content).open.length;
	}

	async countCompleted(): Promise<number> {
		const content = readFileSync(this.filePath, "utf-8");
		return scanMarkdownTasks(content).completed;
	}
}
