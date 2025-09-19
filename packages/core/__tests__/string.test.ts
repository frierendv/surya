import { capitalize } from "../src/string";

describe("capitalize", () => {
	test("returns empty string as-is", () => {
		expect(capitalize("")).toBe("");
	});

	test("capitalizes first character only", () => {
		expect(capitalize("hello")).toBe("Hello");
		expect(capitalize("éclair")).toBe("Éclair");
	});

	test("lowerRest option lowercases the tail", () => {
		expect(capitalize("hELLo", { lowerRest: true })).toBe("Hello");
	});
});
