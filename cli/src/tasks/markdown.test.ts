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
