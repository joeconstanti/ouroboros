import { expect, test } from "bun:test";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import simpleGit from "simple-git";

test.each(["cli", "bash"])(
	"%s keeps improvements, discards regressions and records evidence",
	async (entrypoint) => {
		const dir = mkdtempSync(join(tmpdir(), "ouroboros-loop-"));
		const bin = mkdtempSync(join(tmpdir(), "ouroboros-agent-"));
		try {
			const git = simpleGit(dir);
			await git.init();
			await git.addConfig("user.name", "Test");
			await git.addConfig("user.email", "test@example.com");
			writeFileSync(join(dir, ".gitignore"), ".ouroboros/\n");
			writeFileSync(join(dir, "score"), "10\n");
			await git.add([".gitignore", "score"]);
			await git.commit("baseline");
			mkdirSync(join(dir, ".ouroboros"));
			writeFileSync(
				join(dir, ".ouroboros/experiment.yaml"),
				`evaluator:\n  command: 'echo OUROBOROS_EVAL_STATUS=ok; echo OUROBOROS_EVAL_PRIMARY=$(cat score)'\nprimary_metric: {}\nmax_attempts: 2\nallowed_paths: [score]\n`,
			);
			writeFileSync(
				join(bin, "codex"),
				`#!/bin/bash\nif [[ -f .ouroboros/tried ]]; then echo 9 > score; else echo 8 > score; touch .ouroboros/tried; fi\ngit add score && git commit -qm 'exp: test'\necho hypothesis > .ouroboros/experiments/last-hypothesis.txt\n`,
			);
			chmodSync(join(bin, "codex"), 0o755);
			const child = Bun.spawn(
				[
					...(entrypoint === "cli"
						? [process.execPath, resolve(import.meta.dir, "../index.ts")]
						: ["bash", resolve(import.meta.dir, "../../../ouroboros.sh")]),
					"--experiment",
					"--codex",
				],
				{
					cwd: dir,
					env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
					stdout: "pipe",
					stderr: "pipe",
				},
			);
			const [out, err, code] = await Promise.all([
				new Response(child.stdout).text(),
				new Response(child.stderr).text(),
				child.exited,
			]);
			expect({ code, error: code ? out + err : "" }).toEqual({ code: 0, error: "" });
			expect(readFileSync(join(dir, "score"), "utf8").trim()).toBe("8");
			const runs = join(dir, ".ouroboros/experiments/runs");
			const run = join(runs, readdirSync(runs)[0]);
			const rows = readFileSync(join(run, "results.tsv"), "utf8")
				.trim()
				.split("\n")
				.map((row) => row.split("\t"));
			expect(rows.map((row) => row[2])).toEqual(["decision", "baseline", "keep", "discard"]);
			expect(rows[2][5]).toBe("10");
			expect(rows[2][7]).toMatch(/^[0-9a-f]{40}$/);
			expect(rows[3][8]).toBe("hypothesis");
			expect(JSON.parse(readFileSync(join(run, "manifest.json"), "utf8")).engine).toBe("codex");
		} finally {
			rmSync(dir, { recursive: true, force: true });
			rmSync(bin, { recursive: true, force: true });
		}
	},
);
