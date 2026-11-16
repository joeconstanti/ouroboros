import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("dry run needs neither git nor an agent and creates no artifacts", () => {
	const dir = mkdtempSync(join(tmpdir(), "ouroboros-dry-"));
	try {
		writeFileSync(
			join(dir, "experiment.yaml"),
			"evaluator:\n  command: touch SHOULD_NOT_EXIST\nprimary_metric: {}\n",
		);
		const result = Bun.spawnSync(
			[
				process.execPath,
				resolve(import.meta.dir, "../index.ts"),
				"--experiment",
				"--experiment-file",
				"experiment.yaml",
				"--dry-run",
			],
			{ cwd: dir },
		);
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("not evaluated");
		expect(existsSync(join(dir, "SHOULD_NOT_EXIST"))).toBe(false);
		expect(existsSync(join(dir, ".ouroboros"))).toBe(false);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("mutating baselines are rejected and tracked source is restored", async () => {
	const dir = mkdtempSync(join(tmpdir(), "ouroboros-baseline-"));
	try {
		const { default: simpleGit } = await import("simple-git");
		const git = simpleGit(dir);
		await git.init();
		await git.addConfig("user.name", "Test");
		await git.addConfig("user.email", "test@example.com");
		writeFileSync(join(dir, ".gitignore"), ".ouroboros/\n");
		writeFileSync(join(dir, "source"), "original");
		await git.add([".gitignore", "source"]);
		await git.commit("baseline");
		const { mkdirSync, readFileSync, chmodSync } = await import("node:fs");
		mkdirSync(join(dir, ".ouroboros"));
		writeFileSync(
			join(dir, ".ouroboros/experiment.yaml"),
			`evaluator:\n  command: 'echo changed > source; echo OUROBOROS_EVAL_STATUS=ok; echo OUROBOROS_EVAL_PRIMARY=1'\nprimary_metric: {}\n`,
		);
		const fakeBin = join(dir, ".ouroboros/bin");
		mkdirSync(fakeBin);
		writeFileSync(join(fakeBin, "codex"), "#!/bin/sh\nexit 99\n");
		chmodSync(join(fakeBin, "codex"), 0o755);
		const result = Bun.spawnSync(
			[process.execPath, resolve(import.meta.dir, "../index.ts"), "--experiment", "--codex"],
			{ cwd: dir, env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` } },
		);
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString() + result.stdout.toString()).toContain(
			"Baseline evaluator modified Git state",
		);
		expect(readFileSync(join(dir, "source"), "utf8")).toBe("original");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
