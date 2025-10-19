import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		logger: "src/logger.ts",
		readdir: "src/readdir.ts",
		string: "src/string.ts",
		debounce: "src/debounce.ts",
		semaphore: "src/semaphore.ts",
		"read-env": "src/read-env.ts",
		events: "src/events.ts",
	},
	splitting: false,
	clean: true,
	dts: true,
	target: "es2020",
	format: ["cjs", "esm"],
});
