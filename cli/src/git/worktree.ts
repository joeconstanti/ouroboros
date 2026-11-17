import { existsSync, mkdirSync, mkdtempSync, rmdirSync } from "node:fs";
import { basename, join } from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";
import { slugify } from "./branch.ts";

/**
 * Create a worktree for parallel agent execution
 */
export async function createAgentWorktree(
	taskName: string,
	agentNum: number,
	baseBranch: string,
	worktreeBase: string,
	originalDir: string,
): Promise<{ worktreeDir: string; branchName: string }> {
	// Reserve a fresh directory for every attempt, including repeated batches.
	// Existing worktrees and branches may contain unfinished work.
	mkdirSync(worktreeBase, { recursive: true });
	const worktreeDir = mkdtempSync(join(worktreeBase, `agent-${agentNum}-`));
	const branchName = `ouroboros/${basename(worktreeDir)}-${slugify(taskName)}`;
	const git: SimpleGit = simpleGit(originalDir);

	try {
		await git.raw(["worktree", "add", "-b", branchName, worktreeDir, baseBranch]);
	} catch (error) {
		// Only remove our empty reservation. Never recursively remove user data.
		try {
			rmdirSync(worktreeDir);
		} catch {
			// Git may have populated it before failing; preserve it for inspection.
		}
		throw error;
	}

	return { worktreeDir, branchName };
}

/**
 * Cleanup a worktree after agent completes
 */
export async function cleanupAgentWorktree(
	worktreeDir: string,
	branchName: string,
	originalDir: string,
): Promise<{ leftInPlace: boolean }> {
	// Check for uncommitted changes
	if (existsSync(worktreeDir)) {
		const worktreeGit = simpleGit(worktreeDir);
		const status = await worktreeGit.status();

		if (status.files.length > 0) {
			// Leave worktree in place due to uncommitted changes
			return { leftInPlace: true };
		}
	}

	// Remove the worktree
	const git: SimpleGit = simpleGit(originalDir);
	try {
		await git.raw(["worktree", "remove", "-f", worktreeDir]);
	} catch {
		// Ignore removal errors
	}

	// Don't delete branch - it may have commits we want to keep/PR
	return { leftInPlace: false };
}

/**
 * Get worktree base directory (creates if needed)
 */
export function getWorktreeBase(workDir: string): string {
	const worktreeBase = join(workDir, ".ouroboros-worktrees");
	if (!existsSync(worktreeBase)) {
		mkdirSync(worktreeBase, { recursive: true });
	}
	return worktreeBase;
}

/**
 * List all ouroboros worktrees
 */
export async function listWorktrees(workDir: string): Promise<string[]> {
	const git: SimpleGit = simpleGit(workDir);
	const output = await git.raw(["worktree", "list", "--porcelain"]);

	const worktrees: string[] = [];
	const lines = output.split("\n");

	for (const line of lines) {
		if (line.startsWith("worktree ") && line.includes(".ouroboros-worktrees")) {
			worktrees.push(line.replace("worktree ", ""));
		}
	}

	return worktrees;
}

/**
 * Clean up all ouroboros worktrees
 */
export async function cleanupAllWorktrees(workDir: string): Promise<void> {
	const git: SimpleGit = simpleGit(workDir);
	const worktrees = await listWorktrees(workDir);

	for (const worktree of worktrees) {
		try {
			await git.raw(["worktree", "remove", "-f", worktree]);
		} catch {
			// Ignore errors
		}
	}

	// Prune any stale worktrees
	await git.raw(["worktree", "prune"]);
}
