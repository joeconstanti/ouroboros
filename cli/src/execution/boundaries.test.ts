import { expect, test } from "bun:test";
import { boundaryViolations } from "./boundaries.ts";
test("forbidden globs and directories override the allowlist", () => {
	expect(
		boundaryViolations(
			["src/a.ts", "fixtures/a.json", "scripts/eval.sh", "README.md"],
			["src/**", "scripts/**"],
			["fixtures", "scripts/eval.sh"],
		),
	).toEqual(["fixtures/a.json", "scripts/eval.sh", "README.md"]);
	expect(boundaryViolations(["cli/a.ts", "cli/nested/a.ts"], ["./cli/"], [])).toEqual([]);
});
