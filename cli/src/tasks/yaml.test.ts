import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { YamlTaskSource } from "./yaml.ts";

function taskFile(yaml: string): string {
	const file = join(mkdtempSync(join(tmpdir(), "yaml-tasks-")), "tasks.yaml");
	writeFileSync(file, yaml);
	return file;
}

test("reads incomplete tasks and preserves extra fields on completion", async () => {
	const file = taskFile(`tasks:
  - title: first
    completed: false
    note: keep me
  - title: second
    completed: true
    parallel_group: 2
`);
	const source = new YamlTaskSource(file);
	const tasks = await source.getAllTasks();
	expect(tasks.map((task) => task.title)).toEqual(["first"]);
	expect(await source.countRemaining()).toBe(1);
	expect(await source.countCompleted()).toBe(1);
	await source.markComplete("first");
	const written = readFileSync(file, "utf-8");
	expect(written).toContain("note: keep me");
	expect(written).toContain("completed: true");
	expect(await source.countRemaining()).toBe(0);
});

test("rejects missing titles, bad groups and duplicate titles", async () => {
	const source = new YamlTaskSource(
		taskFile(`tasks:
  - completed: false
`),
	);
	await expect(source.getAllTasks()).rejects.toThrow("tasks.0.title: Required");

	const duplicates = new YamlTaskSource(
		taskFile(`tasks:
  - title: same
  - title: " same "
`),
	);
	await expect(duplicates.getAllTasks()).rejects.toThrow("Duplicate task title: same");

	const group = new YamlTaskSource(
		taskFile(`tasks:
  - title: grouped
    parallel_group: -1
`),
	);
	await expect(group.getAllTasks()).rejects.toThrow("parallel_group");
});
