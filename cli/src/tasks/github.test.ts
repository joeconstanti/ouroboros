import { expect, test } from "bun:test";
import { onlyIssues } from "./github.ts";

test("pull requests from the issues API are not tasks", () => {
	const items = [{ number: 1 }, { number: 2, pull_request: { url: "x" } }, { number: 3 }];
	expect(onlyIssues(items).map((i) => i.number)).toEqual([1, 3]);
});
