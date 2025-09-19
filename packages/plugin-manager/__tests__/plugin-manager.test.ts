import path from "node:path";
import { PluginManager } from "../src";
import type { IPlugin } from "../src/types";

describe("PluginManager", () => {
	const rootDir = path.resolve(__dirname, "../__fixtures__/plugins");

	test("loadAll loads plugins and indexes commands", async () => {
		const pm = new PluginManager({
			rootDir,
			extensions: [".ts"],
			cacheBust: true,
			useChokidar: false,
		});
		const loaded: Array<{ fp: string; plugin: IPlugin }> = [];
		pm.on("loaded", (fp, p) => loaded.push({ fp, plugin: p }));

		await pm.loadAll();

		expect(loaded.length).toBeGreaterThanOrEqual(1);
		const byName = pm.get("fake-1");
		expect(byName?.name).toBe("fake-1");

		const byCmd = pm.findByCommand("FAKE1");
		expect(byCmd.find((p) => p.name === "fake-1")).toBeTruthy();
	});

	test("reloadFromFile replaces and reindexes", async () => {
		const pm = new PluginManager({
			rootDir,
			extensions: [".ts"],
			cacheBust: true,
			useChokidar: false,
		});
		await pm.loadAll();

		const pluginPath = path.join(rootDir, "fake-1.ts");
		await pm.reloadFromFile(pluginPath);
		const after = pm.get("fake-1");

		expect(after).toBeTruthy();
		const byCmd = pm.findByCommand("fake1");
		expect(byCmd.some((p) => p.name === "fake-1")).toBe(true);
	});

	test("removeByFile removes mappings and command index", async () => {
		const pm = new PluginManager({
			rootDir,
			extensions: [".ts"],
			cacheBust: true,
			useChokidar: false,
		});
		await pm.loadAll();
		const pluginPath = path.join(rootDir, "fake-1.ts");

		expect(pm.get("fake-1")).toBeTruthy();
		pm.removeByFile(pluginPath);
		expect(pm.get("fake-1")).toBeUndefined();
		expect(pm.findByCommand("fake1")).toHaveLength(0);
	});
});
