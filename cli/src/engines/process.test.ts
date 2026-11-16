import { expect, test } from "bun:test";
import { commandExists, execCommand } from "./base.ts";

test("command lookup does not depend on the which binary", async () => {
	expect(await commandExists("bun")).toBe(true);
	expect(await commandExists("ouroboros-not-a-real-command")).toBe(false);
});

test("engine commands do not wait for stdin", async () => {
	const started = Date.now();
	const result = await execCommand(
		"bun",
		["-e", "let n=0; for await (const chunk of process.stdin) n+=chunk.length; console.log(n)"],
		process.cwd(),
	);
	expect(result.exitCode).toBe(0);
	expect(result.stdout.trim()).toBe("0");
	expect(Date.now() - started).toBeLessThan(5_000);
});
