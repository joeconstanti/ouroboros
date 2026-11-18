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
	_branchName: string,
	originalDir: string,
): Promise<{ leftInPlace: boolean }> {
	return removeCleanWorktree(worktreeDir, originalDir);
}

async function removeCleanWorktree(
	worktreeDir: string,
	originalDir: string,
): Promise<{ leftInPlace: boolean }> {
	if (!existsSync(worktreeDir)) return { leftInPlace: false };

	try {
		const status = await simpleGit(worktreeDir).raw([
			"status",
			"--porcelain",
			"--untracked-files=all",
			"--ignored=matching",
		]);
		if (status.length > 0) return { leftInPlace: true };
		await simpleGit(originalDir).raw(["worktree", "remove", worktreeDir]);
		return { leftInPlace: false };
	} catch {
		// Preserve the directory when its status or removal cannot be confirmed.
		return { leftInPlace: true };
	}
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
		await removeCleanWorktree(worktree, workDir);
	}

	// Prune any stale worktrees
	await git.raw(["worktree", "prune"]);
}
