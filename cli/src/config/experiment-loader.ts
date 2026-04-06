import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import YAML from "yaml";
import { type ExperimentConfig, ExperimentConfigSchema } from "./types.ts";

/**
 * Load experiment config from .ouroboros/experiment.yaml (or custom path).
 */
export function loadExperimentConfig(
	experimentPath: string,
	workDir = process.cwd(),
): ExperimentConfig | null {
	const full = isAbsolute(experimentPath) ? experimentPath : join(workDir, experimentPath);
	if (!existsSync(full)) {
		return null;
	}

	try {
		const content = readFileSync(full, "utf-8");
		const parsed = YAML.parse(content);
		return ExperimentConfigSchema.parse(parsed);
	} catch {
		return null;
	}
}
