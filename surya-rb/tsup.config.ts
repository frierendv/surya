import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	splitting: true,
	treeshake: true,
	clean: true,
	target: "es2020",
	format: ["esm"],
	external: ["pino"],
});
