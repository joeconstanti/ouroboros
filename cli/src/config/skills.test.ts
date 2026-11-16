import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { buildExperimentPrompt, buildPrompt } from "../execution/prompt.ts";
import { loadSkillCatalog } from "./skills.ts";
test("project skills are discoverable without loading their full instructions", () => {
	const workDir = resolve(import.meta.dir, "../../..");
	const catalog = loadSkillCatalog(workDir);
	for (const name of ["autoresearch", "evidence-debugging", "skill-evaluation"])
		expect(catalog).toContain(`- ${name}:`);
	expect(catalog).not.toContain("Establish a valid baseline");
	expect(buildPrompt({ task: "fix evaluator", workDir })).toContain(catalog);
	expect(
		buildExperimentPrompt({
			attempt: 1,
			baselinePrimary: "1",
			bestPrimary: "1",
			programFile: "missing",
			allowedPaths: ["**"],
			forbiddenPaths: [],
			workDir,
		}),
	).toContain(catalog);
});
