import { expect, test } from "bun:test";
import { slugify } from "./branch.ts";

test("branch slugs stay git-safe", () => {
	expect(slugify("Add login")).toBe("add-login");
	expect(slugify(` ${"a".repeat(49)} extra`)).toBe("a".repeat(49));
	expect(slugify("a".repeat(60))).toBe("a".repeat(50));
});

test("punctuation-only titles get distinct stable slugs", () => {
	const first = slugify("!!!");
	const second = slugify("???");
	expect(first).toMatch(/^task-[0-9a-f]{8}$/);
	expect(second).toMatch(/^task-[0-9a-f]{8}$/);
	expect(first).not.toBe(second);
	expect(slugify("!!!")).toBe(first);
});
