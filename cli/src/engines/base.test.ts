import { expect, test } from "bun:test";
import { checkForErrors, parseStreamJsonResult, resultFromOutput } from "./base.ts";

test("stream-json error results fail and cached tokens count as input", () => {
	const output = [
		JSON.stringify({ type: "assistant", message: { content: "partial" } }),
		JSON.stringify({
			type: "result",
			is_error: true,
			result: "overloaded",
			usage: { input_tokens: 2, output_tokens: 3 },
		}),
	].join("\n");

	expect(checkForErrors(output)).toBe("overloaded");

	const success = [
		JSON.stringify({
			type: "result",
			is_error: false,
			result: "done",
			usage: {
				input_tokens: 10,
				cache_creation_input_tokens: 4,
				cache_read_input_tokens: 6,
				output_tokens: 2,
			},
		}),
	].join("\n");
	expect(parseStreamJsonResult(success)).toEqual({
		response: "done",
		inputTokens: 20,
		outputTokens: 2,
	});
	expect(parseStreamJsonResult("")).toEqual({
		response: "",
		inputTokens: 0,
		outputTokens: 0,
	});
});

test("non-zero exits fail and blank success stays blank", () => {
	expect(resultFromOutput(0, "  ")).toMatchObject({
		success: true,
		response: "",
	});
	expect(resultFromOutput(0, "shipped", { inputTokens: 3, outputTokens: 4 })).toEqual({
		success: true,
		response: "shipped",
		inputTokens: 3,
		outputTokens: 4,
		cost: undefined,
	});
	expect(resultFromOutput(2, "")).toMatchObject({
		success: false,
		error: "Engine exited with code 2",
	});
});
