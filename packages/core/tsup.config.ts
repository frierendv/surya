import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src"],
	splitting: false,
	clean: true,
	dts: true,
	target: "es2020",
	format: ["cjs", "esm"],
});
