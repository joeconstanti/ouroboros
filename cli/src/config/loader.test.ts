import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPrompt } from "../execution/prompt.ts";
import { getConfigPath, loadConfig } from "./loader.ts";

test("missing config stays optional and valid rules and boundaries reach prompts", () => {
	const dir = mkdtempSync(join(tmpdir(), "ouroboros-config-"));
	try {
		expect(loadConfig(dir)).toBeNull();
		mkdirSync(join(dir, ".ouroboros"));
		writeFileSync(
			getConfigPath(dir),
			"rules: [keep tests]\nboundaries:\n  never_touch: [secrets/**]\n",
		);
		const prompt = buildPrompt({ task: "work", workDir: dir });
		expect(prompt).toContain("keep tests");
		expect(prompt).toContain("secrets/**");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("malformed or invalid config stops prompt construction instead of dropping safeguards", () => {
	const dir = mkdtempSync(join(tmpdir(), "ouroboros-config-"));
	try {
		mkdirSync(join(dir, ".ouroboros"));
		for (const content of [
			"rules: [",
			"rules: wrong",
			"boundaries:\n  never_touch: false\n",
			"null",
		]) {
			writeFileSync(getConfigPath(dir), content);
			expect(() => loadConfig(dir)).toThrow(getConfigPath(dir));
			expect(() => buildPrompt({ task: "work", workDir: dir })).toThrow("Invalid project config");
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
