import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

/** Discover only metadata; the agent reads a matching skill body on demand. */
export function loadSkillCatalog(workDir: string): string {
	const root = join(workDir, ".agents", "skills");
	if (!existsSync(root)) return "";
	const entries: string[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) =>
		a.name.localeCompare(b.name),
	)) {
		if (!entry.isDirectory()) continue;
		const path = join(root, entry.name, "SKILL.md");
		if (!existsSync(path)) continue;
		const match = readFileSync(path, "utf-8").match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
		if (!match) throw new Error(`Missing skill frontmatter: ${path}`);
		const data = YAML.parse(match[1]);
		if (
			data?.name !== entry.name ||
			typeof data.description !== "string" ||
			!data.description.trim()
		)
			throw new Error(`Invalid skill metadata: ${path}`);
		entries.push(
			`- ${data.name}: ${data.description.replace(/\s+/g, " ")} (read .agents/skills/${entry.name}/SKILL.md when relevant)`,
		);
	}
	return entries.length
		? `## Available project skills\nRead only skills relevant to this task.\n${entries.join("\n")}`
		: "";
}
