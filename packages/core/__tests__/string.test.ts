import { capitalize } from "../src/string";

describe("capitalize", () => {
	test("returns empty string as-is", () => {
		expect(capitalize("")).toBe("");
	});
	test("returns non-string as-is", () => {
		// @ts-expect-error testing non-string input
		expect(capitalize(null)).toBe(null);
		// @ts-expect-error testing non-string input
		expect(capitalize(undefined)).toBe(undefined);
		// @ts-expect-error testing non-string input
		expect(capitalize(123)).toBe(123);
	});
	test("returns single char uppercased", () => {
		expect(capitalize("a")).toBe("A");
		expect(capitalize("Z")).toBe("Z");
	});

	test("capitalizes first character only", () => {
		expect(capitalize("hello")).toBe("Hello");
		expect(capitalize("éclair")).toBe("Éclair");
	});

	test("lowerRest option lowercases the tail", () => {
		expect(capitalize("hELLo", { lowerRest: true })).toBe("Hello");
	});
});
