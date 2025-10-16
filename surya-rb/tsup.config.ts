import { fixImportsPlugin } from "esbuild-fix-imports-plugin";
import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src", "!src/**/*.md"],
	splitting: false,
	bundle: false,
	clean: true,
	target: "es2020",
	format: ["esm"],
	external: ["fluent-ffmpeg", "pino"],
	esbuildPlugins: [fixImportsPlugin()],
});
