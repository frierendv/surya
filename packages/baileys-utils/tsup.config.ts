import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	splitting: false,
	clean: true,
	dts: true,
	target: "es2020",
	format: ["esm"],
	external: ["long", "undici", "file-type", "baileys", "ws", "pino"],
});
