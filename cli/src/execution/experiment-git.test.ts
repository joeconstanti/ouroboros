import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import simpleGit from "simple-git";
import { isDirectCandidate, restoreAttempt } from "./experiment-git.ts";
test("failed attempts restore tracked and untracked changes while preserving ignored logs", async () => {
	const dir = mkdtempSync(join(tmpdir(), "ouroboros-git-"));
	try {
		const git = simpleGit(dir);
		await git.init();
		await git.addConfig("user.name", "Test");
		await git.addConfig("user.email", "test@example.com");
		writeFileSync(join(dir, ".gitignore"), ".ouroboros/\n");
		writeFileSync(join(dir, "source"), "baseline");
		await git.add([".gitignore", "source"]);
		await git.commit("baseline");
		const branch = (await git.branch()).current;
		const base = (await git.revparse("HEAD")).trim();
		mkdirSync(join(dir, ".ouroboros"));
		writeFileSync(join(dir, ".ouroboros/log"), "evidence");
		writeFileSync(join(dir, "source"), "candidate");
		await git.add("source");
		await git.commit("exp: change");
		expect(await isDirectCandidate(git, branch, base)).toBe(true);
		writeFileSync(join(dir, "temporary"), "failed attempt");
		await restoreAttempt(git, branch, base);
		expect(await git.status().then((s) => s.isClean())).toBe(true);
		expect(existsSync(join(dir, "temporary"))).toBe(false);
		expect(existsSync(join(dir, ".ouroboros/log"))).toBe(true);
		await git.checkoutLocalBranch("other");
		await expect(restoreAttempt(git, branch, base)).rejects.toThrow("switched branches");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
