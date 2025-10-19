import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/*.ts"],
	splitting: false,
	clean: true,
	dts: true,
	target: "es2020",
	format: ["cjs", "esm"],
});
