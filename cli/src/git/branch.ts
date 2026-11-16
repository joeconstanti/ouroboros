import { createHash } from "node:crypto";
import simpleGit, { type SimpleGit } from "simple-git";

/**
 * Slugify text for branch names.
 * Truncation cannot leave a trailing hyphen, and titles with no usable
 * characters get a stable hash so they do not all share one branch.
 */
export function slugify(text: string): string {
	const slug = text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 50)
		.replace(/-+$/g, "");
	if (slug.length > 0) return slug;
	const hash = createHash("sha256").update(text).digest("hex").slice(0, 8);
	return `task-${hash}`;
}

const AUTOSTASH_MESSAGE = "ouroboros-autostash";

/**
 * Pick a branch name that does not already exist locally.
 */
export async function uniqueTaskBranchName(git: SimpleGit, task: string): Promise<string> {
	const base = `ouroboros/${slugify(task)}`;
	const existing = new Set((await git.branchLocal()).all);
	if (!existing.has(base)) return base;
	for (let suffix = 2; suffix < 1000; suffix++) {
		const name = `${base}-${suffix}`;
		if (!existing.has(name)) return name;
	}
	throw new Error(`No free branch name for ${base}`);
}

async function restoreAutostash(git: SimpleGit): Promise<void> {
	const list = await git.stash(["list"]);
	const top = list.split("\n").find((line) => line.trim().length > 0) ?? "";
	if (top.includes(AUTOSTASH_MESSAGE)) {
		await git.stash(["pop"]);
	}
}

/**
 * Create a task branch from the base branch.
 * Uncommitted work is stashed and left there until returnToBaseBranch.
 * An existing task branch is never reused.
 */
export async function createTaskBranch(
	task: string,
	baseBranch: string,
	workDir = process.cwd(),
): Promise<string> {
	const git: SimpleGit = simpleGit(workDir);
	const branchName = await uniqueTaskBranchName(git, task);
	const dirty = (await git.status()).files.length > 0;
	if (dirty) {
		await git.stash(["push", "--include-untracked", "-m", AUTOSTASH_MESSAGE]);
	}

	try {
		await git.checkout(baseBranch);
		await git.pull("origin", baseBranch).catch(() => {
			// Ignore pull errors when the repo has no upstream.
		});
		await git.checkoutLocalBranch(branchName);
	} catch (error) {
		if (dirty) {
			await git.checkout(baseBranch).catch(() => {});
			await restoreAutostash(git).catch(() => {});
		}
		throw error;
	}

	return branchName;
}

/**
 * Return to the base branch and restore work stashed for the task branch.
 */
export async function returnToBaseBranch(
	baseBranch: string,
	workDir = process.cwd(),
): Promise<void> {
	const git: SimpleGit = simpleGit(workDir);
	try {
		await git.checkout(baseBranch);
	} catch {
		return;
	}
	await restoreAutostash(git).catch(() => {});
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(workDir = process.cwd()): Promise<string> {
	const git: SimpleGit = simpleGit(workDir);
	const status = await git.status();
	return status.current || "";
}

/**
 * Get the default base branch (main or master)
 */
export async function getDefaultBaseBranch(workDir = process.cwd()): Promise<string> {
	const git: SimpleGit = simpleGit(workDir);

	// Try main first, then master
	const branches = await git.branchLocal();
	if (branches.all.includes("main")) return "main";
	if (branches.all.includes("master")) return "master";

	// Fall back to current branch
	return branches.current;
}

/**
 * Check if there are uncommitted changes
 */
export async function hasUncommittedChanges(workDir = process.cwd()): Promise<boolean> {
	const git: SimpleGit = simpleGit(workDir);
	const status = await git.status();
	return status.files.length > 0;
}
