import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import { getConfigPath } from "./loader.ts";
import { OuroborosConfigSchema } from "./types.ts";
import { initConfig } from "./writer.ts";

test("initialization round-trips special characters without changing YAML structure", () => {
	const dir = mkdtempSync(join(tmpdir(), "ouroboros-writer-"));
	try {
		for (const name of [
			'quoted "project"',
			String.raw`C:\new\tools`,
			"line one\nline two\twith tabs",
			"control\u0000\u0007\r\b",
			"Unicode 🐍 café",
		]) {
			writeFileSync(
				join(dir, "package.json"),
				JSON.stringify({ name, scripts: { test: "test", lint: "lint", build: "build" } }),
			);
			initConfig(dir);
			const content = readFileSync(getConfigPath(dir), "utf-8");
			const parsed = OuroborosConfigSchema.parse(YAML.parse(content));
			expect(parsed.project.name).toBe(name);
			expect(parsed.commands).toEqual({
				test: "npm test",
				lint: "npm run lint",
				build: "npm run build",
			});
			expect(parsed.rules).toEqual([]);
			expect(parsed.boundaries.never_touch).toEqual([]);
			expect(content).toContain("# Boundaries");
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
