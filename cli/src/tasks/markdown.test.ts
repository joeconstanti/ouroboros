import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MarkdownTaskSource, scanMarkdownTasks } from "./markdown.ts";

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

test.each([
	[
		"shorter delimiters",
		["````md", "```", "- [ ] example", "- [x] example done", "````", "- [ ] real"],
	],
	[
		"mixed delimiters",
		["```md", "~~~", "- [ ] example", "- [x] example done", "```", "- [ ] real"],
	],
	[
		"closing fence with trailing text",
		["```md", "```not a close", "- [ ] example", "- [x] example done", "```", "- [ ] real"],
	],
	["longer closing fence", ["~~~md", "- [ ] example", "- [x] example done", "~~~~", "- [ ] real"]],
	["unclosed fence", ["- [ ] real", "````md", "```", "- [ ] example", "- [x] example done"]],
] as const)("fence matching: %s", async (_name, lines) => {
	const file = join(mkdtempSync(join(tmpdir(), "md-fences-")), "PRD.md");
	writeFileSync(file, lines.join("\r\n"));
	const source = new MarkdownTaskSource(file);
	const tasks = await source.getAllTasks();
	expect(tasks.map((task) => task.title)).toEqual(["real"]);
	expect(await source.countCompleted()).toBe(0);
	const exampleLine = lines.findIndex((line) => line === "- [ ] example") + 1;
	await source.markComplete(String(exampleLine));
	expect(readFileSync(file, "utf-8")).toContain("- [ ] example");
	await source.markComplete(tasks[0].id);
	expect(await source.countRemaining()).toBe(0);
	expect(await source.countCompleted()).toBe(1);
});

test("fence opening respects indentation and backtick info-string rules", () => {
	expect(
		scanMarkdownTasks("   ~~~`info`\n- [ ] example\n   ~~~  \n- [ ] real\n").open.map(
			(task) => task.title,
		),
	).toEqual(["real"]);
	expect(scanMarkdownTasks("```bad`info\n- [ ] real\n").open.map((task) => task.title)).toEqual([
		"real",
	]);
	expect(scanMarkdownTasks("    ```\n- [ ] real\n").open.map((task) => task.title)).toEqual([
		"real",
	]);
});
