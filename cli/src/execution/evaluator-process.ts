import { spawn } from "node:child_process";

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
/** Kill the evaluator process group on timeout; retain a bounded diagnostic tail. */
export function runEvaluatorCommand(
	command: string,
	cwd: string,
	timeoutSec: number,
): Promise<{ code: number; combined: string }> {
	return new Promise((resolve) => {
		const child = spawn("bash", ["-c", command], {
			cwd,
			env: process.env,
			detached: process.platform !== "win32",
		});
		let combined = "";
		let timedOut = false;
		const onData = (data: Buffer): void => {
			combined = (combined + data.toString()).slice(-MAX_OUTPUT_BYTES);
		};
		child.stdout?.on("data", onData);
		child.stderr?.on("data", onData);
		const timer = setTimeout(() => {
			timedOut = true;
			if (process.platform !== "win32" && child.pid) {
				try {
					process.kill(-child.pid, "SIGKILL");
				} catch {
					child.kill("SIGKILL");
				}
			} else {
				child.kill("SIGKILL");
			}
		}, timeoutSec * 1000);
		child.on("close", (code) => {
			clearTimeout(timer);
			resolve({ code: timedOut ? 124 : (code ?? 1), combined });
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			resolve({ code: 1, combined: `${combined}\n${error.message}` });
		});
	});
}
