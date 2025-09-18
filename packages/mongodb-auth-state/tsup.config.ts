import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	splitting: true,
	treeshake: true,
	clean: true,
	dts: true,
	target: "es2020",
	format: ["cjs", "esm"],

	external: ["baileys"],
});
