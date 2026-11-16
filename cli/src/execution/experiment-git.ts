import type { SimpleGit } from "simple-git";

/** Only restore a branch owned by this run; ignored logs/configuration survive. */
export async function restoreAttempt(
	git: SimpleGit,
	branch: string,
	commit: string,
): Promise<void> {
	if ((await git.branch()).current !== branch)
		throw new Error("Agent switched branches; stopping without resetting another branch.");
	await git.raw(["reset", "--hard", commit]);
	await git.raw(["clean", "-fd"]);
}
export async function isDirectCandidate(
	git: SimpleGit,
	branch: string,
	parent: string,
): Promise<boolean> {
	if ((await git.branch()).current !== branch)
		throw new Error("Agent switched branches; stopping experiment.");
	return (await git.raw(["rev-parse", "HEAD^"])).trim() === parent;
}
