import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MarkdownTaskSource } from "./markdown.ts";

test("reads and completes common checkbox list styles", async () => {
	const file = join(mkdtempSync(join(tmpdir(), "md-tasks-")), "PRD.md");
	writeFileSync(file, "- [ ] dash\n* [ ] star\n  + [ ] nested plus\n- [X] done\n- [x] done too\n");
	const source = new MarkdownTaskSource(file);
	const tasks = await source.getAllTasks();
	expect(tasks.map((t) => t.title)).toEqual(["dash", "star", "nested plus"]);
	expect(await source.countRemaining()).toBe(3);
	expect(await source.countCompleted()).toBe(2);
	await source.markComplete(tasks[2].id);
	expect(readFileSync(file, "utf-8")).toContain("  + [x] nested plus");
	expect(await source.countRemaining()).toBe(2);
});

test("ignores checkbox examples inside fenced code", async () => {
	const file = join(mkdtempSync(join(tmpdir(), "md-tasks-")), "PRD.md");
	writeFileSync(
		file,
		[
			"# Tasks",
			"```md",
			"- [ ] example",
			"- [x] also an example",
			"```",
			"- [ ] real work",
			"",
		].join("\n"),
	);
	const source = new MarkdownTaskSource(file);
	const tasks = await source.getAllTasks();
	expect(tasks.map((task) => task.title)).toEqual(["real work"]);
	expect(await source.countRemaining()).toBe(1);
	expect(await source.countCompleted()).toBe(0);
	await source.markComplete("3");
	expect(readFileSync(file, "utf-8")).toContain("- [ ] example");
	await source.markComplete(tasks[0].id);
	expect(readFileSync(file, "utf-8")).toContain("- [x] real work");
});
