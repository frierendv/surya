import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		plugins: "src/plugins",
	},
	splitting: true,
	treeshake: true,
	clean: true,
	target: "es2020",
	format: ["esm"],
	external: ["fluent-ffmpeg", "pino"],
});
