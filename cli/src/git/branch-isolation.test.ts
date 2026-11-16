import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";
import { createTaskBranch, returnToBaseBranch } from "./branch.ts";

async function repo(): Promise<{ dir: string; git: SimpleGit }> {
	const dir = mkdtempSync(join(tmpdir(), "ouroboros-branch-"));
	const git = simpleGit(dir);
	await git.raw(["init", "-b", "main"]);
	await git.addConfig("user.name", "Test");
	await git.addConfig("user.email", "test@example.com");
	writeFileSync(join(dir, "file"), "base\n");
	await git.add("file");
	await git.commit("baseline");
	return { dir, git };
}

test("task branches leave existing branches and uncommitted work alone", async () => {
	const { dir, git } = await repo();
	try {
		await git.checkoutLocalBranch("ouroboros/add-login");
		await git.checkout("main");
		writeFileSync(join(dir, "file"), "dirty\n");
		writeFileSync(join(dir, "notes"), "untracked\n");

		const branch = await createTaskBranch("Add login", "main", dir);

		expect(branch).toBe("ouroboros/add-login-2");
		expect((await git.status()).current).toBe(branch);
		expect(readFileSync(join(dir, "file"), "utf-8")).toBe("base\n");
		expect(existsSync(join(dir, "notes"))).toBe(false);

		await returnToBaseBranch("main", dir);

		expect((await git.status()).current).toBe("main");
		expect(readFileSync(join(dir, "file"), "utf-8")).toBe("dirty\n");
		expect(readFileSync(join(dir, "notes"), "utf-8")).toBe("untracked\n");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
