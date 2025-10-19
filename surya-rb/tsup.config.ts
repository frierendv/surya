import { fixImportsPlugin } from "esbuild-fix-imports-plugin";
import { defineConfig } from "tsup";
import { getConfigs } from "./extract";

export default defineConfig({
	entry: ["src", "!src/**/*.md"],
	splitting: false,
	bundle: false,
	clean: true,
	target: "es2020",
	format: ["esm"],
	external: [
		"fluent-ffmpeg",
		"pino",
		"mongoose",
		"baileys",
		"pino-std-serializers",
	],
	noExternal: ["@surya/baileys-utils"],
	esbuildPlugins: [fixImportsPlugin()],
	...getConfigs({ packageUrl: "./", packagesUrl: "../packages" }),
});
