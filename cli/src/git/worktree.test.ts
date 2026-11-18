import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import simpleGit from "simple-git";
import { cleanupAgentWorktree, cleanupAllWorktrees, createAgentWorktree } from "./worktree.ts";

test("repeated parallel attempts preserve existing worktrees, directories and branches", async () => {
	const root = mkdtempSync(join(tmpdir(), "ouroboros-worktree-"));
	const dir = join(root, "repo");
	const base = join(root, ".ouroboros-worktrees");
	mkdirSync(dir);
	const git = simpleGit(dir);
	try {
		await git.raw(["init", "-b", "main"]);
		await git.addConfig("user.name", "Test");
		await git.addConfig("user.email", "test@example.com");
		writeFileSync(join(dir, "file"), "base\n");
		await git.add("file");
		await git.commit("baseline");
		await git.branch(["ouroboros/agent-1-task"]);
		const oldHead = await git.revparse(["ouroboros/agent-1-task"]);
		mkdirSync(join(base, "agent-1"), { recursive: true });
		writeFileSync(join(base, "agent-1", "notes"), "keep legacy directory");

		const first = await createAgentWorktree("task", 1, "main", base, dir);
		writeFileSync(join(first.worktreeDir, "file"), "unfinished\n");
		const second = await createAgentWorktree("task", 1, "main", base, dir);
		expect(second.worktreeDir).not.toBe(first.worktreeDir);
		expect(second.branchName).not.toBe(first.branchName);
		expect(await git.revparse(["ouroboros/agent-1-task"])).toBe(oldHead);
		expect(readFileSync(join(base, "agent-1", "notes"), "utf-8")).toBe("keep legacy directory");
		expect(readFileSync(join(first.worktreeDir, "file"), "utf-8")).toBe("unfinished\n");
		expect(await cleanupAgentWorktree(first.worktreeDir, first.branchName, dir)).toEqual({
			leftInPlace: true,
		});
		expect(await cleanupAgentWorktree(second.worktreeDir, second.branchName, dir)).toEqual({
			leftInPlace: false,
		});
		expect(existsSync(second.worktreeDir)).toBe(false);
		expect((await git.branchLocal()).all).toContain(second.branchName);
		expect((await git.status()).current).toBe("main");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("automatic cleanup preserves ignored and untracked files", async () => {
	const root = mkdtempSync(join(tmpdir(), "ouroboros-cleanup-"));
	const dir = join(root, "repo");
	const base = join(root, ".ouroboros-worktrees");
	mkdirSync(dir);
	const git = simpleGit(dir);
	try {
		await git.raw(["init", "-b", "main"]);
		await git.addConfig("user.name", "Test");
		await git.addConfig("user.email", "test@example.com");
		writeFileSync(join(dir, ".gitignore"), "*.log\n");
		await git.add(".gitignore");
		await git.commit("baseline");
		const ignored = await createAgentWorktree("ignored", 2, "main", base, dir);
		const log = join(ignored.worktreeDir, "attempt.log");
		writeFileSync(log, "attempt evidence");
		expect(await cleanupAgentWorktree(ignored.worktreeDir, ignored.branchName, dir)).toEqual({
			leftInPlace: true,
		});
		const untracked = await createAgentWorktree("untracked", 3, "main", base, dir);
		const notes = join(untracked.worktreeDir, "notes");
		writeFileSync(notes, "unfinished notes");
		const clean = await createAgentWorktree("clean", 4, "main", base, dir);
		await cleanupAllWorktrees(dir);
		expect(readFileSync(log, "utf-8")).toBe("attempt evidence");
		expect(readFileSync(notes, "utf-8")).toBe("unfinished notes");
		expect(existsSync(clean.worktreeDir)).toBe(false);
		expect((await git.branchLocal()).all).toContain(clean.branchName);
		expect((await git.status()).current).toBe("main");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
