/* eslint-disable turbo/no-undeclared-env-vars */
import { readEnv } from "../src/read-env";

describe("readEnv", () => {
	const OLD_ENV = process.env;

	beforeEach(() => {
		// Reset modules and clone env so tests are isolated
		jest.resetModules();
		process.env = { ...OLD_ENV };
	});

	afterAll(() => {
		process.env = OLD_ENV;
	});

	test("returns the value when env var is set", () => {
		process.env["ENV_READ_ENV_SET"] = "foo";
		expect(readEnv("ENV_READ_ENV_SET")).toBe("foo");
	});

	test("returns undefined when env var is not set and not required", () => {
		delete process.env["ENV_READ_ENV_NOT_SET"];
		expect(readEnv("ENV_READ_ENV_NOT_SET")).toBeUndefined();
	});

	test("throws when required and env var is not set (default message)", () => {
		delete process.env["ENV_READ_ENV_REQUIRED"];
		expect(() =>
			readEnv("ENV_READ_ENV_REQUIRED", { required: true })
		).toThrow("Environment variable ENV_READ_ENV_REQUIRED is required");
	});

	test("throws with custom error when required and not set", () => {
		delete process.env["ENV_READ_ENV_CUSTOM_ERR"];
		const msg = "Custom error: var is missing";
		expect(() =>
			readEnv("ENV_READ_ENV_CUSTOM_ERR", { required: true, error: msg })
		).toThrow(msg);
	});

	test("returns default string when env var is not set", () => {
		delete process.env["ENV_READ_ENV_DEFAULT_STR"];
		expect(
			readEnv("ENV_READ_ENV_DEFAULT_STR", { defaultValue: "default" })
		).toBe("default");
	});

	test("calls default function lazily only when needed", () => {
		delete process.env["ENV_READ_ENV_DEFAULT_FN"];
		const gen = jest.fn(() => "computed");
		expect(readEnv("ENV_READ_ENV_DEFAULT_FN", { defaultValue: gen })).toBe(
			"computed"
		);
		expect(gen).toHaveBeenCalledTimes(1);
	});

	test("does not call default function when env var is set", () => {
		process.env["ENV_READ_ENV_DEFAULT_FN_SET"] = "present";
		const gen = jest.fn(() => "should-not-be-called");
		expect(
			readEnv("ENV_READ_ENV_DEFAULT_FN_SET", { defaultValue: gen })
		).toBe("present");
		expect(gen).not.toHaveBeenCalled();
	});

	test("treats empty string as set value (no default, no error)", () => {
		process.env["ENV_READ_ENV_EMPTY"] = "";
		expect(
			readEnv("ENV_READ_ENV_EMPTY", { defaultValue: "fallback" })
		).toBe("");
	});

	test("does not throw when required and value is empty string (still set)", () => {
		process.env["ENV_READ_ENV_REQUIRED_EMPTY"] = "";
		expect(readEnv("ENV_READ_ENV_REQUIRED_EMPTY", { required: true })).toBe(
			""
		);
	});
});
