import type { AIResult } from "../engines/types.ts";
import type { Task } from "../tasks/types.ts";

/**
 * Tasks still eligible for this run. Failed and dry-run tasks stay in the
 * source so a later run can retry them, but this process moves on.
 */
export function tasksToRun(tasks: Task[], skippedIds: ReadonlySet<string>): Task[] {
	return tasks.filter((task) => !task.completed && !skippedIds.has(task.id));
}

/**
 * A zero exit with no reply did not finish the task.
 */
export function rejectBlankResult(result: AIResult): AIResult {
	if (result.success && result.response.trim().length === 0) {
		return { ...result, success: false, error: "Empty response" };
	}
	return result;
}
