/** Match repo-relative globs or a directory and its descendants. */
function matches(path: string, pattern: string): boolean {
	const normalized = pattern.replace(/^\.\//, "").replace(/\/$/, "");
	return (
		path === normalized || path.startsWith(`${normalized}/`) || new Bun.Glob(normalized).match(path)
	);
}
export function boundaryViolations(
	paths: string[],
	allowed: string[],
	forbidden: string[],
): string[] {
	return paths.filter(
		(path) =>
			forbidden.some((pattern) => matches(path, pattern)) ||
			!allowed.some((pattern) => matches(path, pattern)),
	);
}
