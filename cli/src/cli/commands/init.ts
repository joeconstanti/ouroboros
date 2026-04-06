import pc from "picocolors";
import { isInitialized } from "../../config/loader.ts";
import { initConfig } from "../../config/writer.ts";
import { logSuccess, logWarn } from "../../ui/logger.ts";

/**
 * Handle --init command
 */
export async function runInit(workDir = process.cwd()): Promise<void> {
	// Check if already initialized
	if (isInitialized(workDir)) {
		logWarn(".ouroboros/ already exists");

		// In a real CLI, we'd prompt the user
		// For now, just warn and return
		console.log("To overwrite, delete .ouroboros/ and run again");
		return;
	}

	// Initialize config
	const { detected } = initConfig(workDir);

	// Show what we detected
	console.log("");
	console.log(pc.bold("Detected:"));
	console.log(`  Project:   ${pc.cyan(detected.name)}`);
	if (detected.language) console.log(`  Language:  ${pc.cyan(detected.language)}`);
	if (detected.framework) console.log(`  Framework: ${pc.cyan(detected.framework)}`);
	if (detected.testCmd) console.log(`  Test:      ${pc.cyan(detected.testCmd)}`);
	if (detected.lintCmd) console.log(`  Lint:      ${pc.cyan(detected.lintCmd)}`);
	if (detected.buildCmd) console.log(`  Build:     ${pc.cyan(detected.buildCmd)}`);
	console.log("");

	logSuccess("Created .ouroboros/");
	console.log("");
	console.log(`  ${pc.cyan(".ouroboros/config.yaml")}   - Your rules and preferences`);
	console.log(`  ${pc.cyan(".ouroboros/progress.txt")} - Progress log (auto-updated)`);
	console.log("");
	console.log(pc.bold("Next steps:"));
	console.log(`  1. Add rules:  ${pc.cyan('ouroboros --add-rule "your rule here"')}`);
	console.log(`  2. Or edit:    ${pc.cyan(".ouroboros/config.yaml")}`);
	console.log(
		`  3. Run:        ${pc.cyan('ouroboros "your task"')} or ${pc.cyan("ouroboros")} (with PRD.md)`,
	);
}
