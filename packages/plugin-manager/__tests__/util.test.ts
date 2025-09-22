import path from "node:path";
import { pathToFileURL } from "node:url";
import type { IPlugin } from "../src/types";
import { isPlugin, normalizePluginManifest, toFileUrl } from "../src/util";

describe("util", () => {
	test("normalizePluginManifest normalizes arrays and strings", () => {
		const p1: IPlugin = {
			name: "p1",
			command: ["HELLO", "World"],
			description: "x",
			category: ["teST", "othER"],
			execute: () => {},
		};
		normalizePluginManifest(p1);
		expect(p1.command).toEqual(["hello", "world"]);
		expect(p1.category).toEqual(["TeST", "OthER"]);

		const p2: IPlugin = {
			name: "p2",
			command: "MiXeD",
			description: "x",
			category: "somE",
			execute: () => {},
		};
		normalizePluginManifest(p2);
		expect(p2.command).toBe("mixed");
		expect(p2.category).toBe("SomE");
	});

	test("toFileUrl respects cacheBust flag", () => {
		const fp = path.resolve("/tmp/test-file.js");
		const base = pathToFileURL(fp).href;

		expect(toFileUrl(fp, false)).toBe(base);
		expect(toFileUrl(fp, undefined)).toBe(base);
		expect(toFileUrl(fp)).toBe(base);

		const noBust = toFileUrl(fp, false);
		expect(noBust).toBe(base);

		const withBust = toFileUrl(fp, true);
		expect(withBust.startsWith(base)).toBe(true);
		expect(withBust).toMatch(/\?t=\d+$/);
	});

	test("isPlugin handles array command and invalid cases", () => {
		const good: any = {
			name: "ok",
			command: ["A", "b"],
			execute: () => {},
			description: "",
			category: "x",
		} satisfies Partial<IPlugin>;
		expect(isPlugin(good)).toBe(true);

		expect(!!isPlugin(null)).toBe(false);
		expect(!!isPlugin({})).toBe(false);
		expect(!!isPlugin({ name: "x", command: "y" })).toBe(false);
		expect(isPlugin({ name: "x", command: ["y"], execute: 123 })).toBe(
			false as any
		);
	});
});
