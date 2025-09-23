import { PluginManager } from "@surya/plugin-manager";
import { logger } from "./logger";

const isDev = process.env.NODE_ENV === "development";

const pluginManager = new PluginManager({
	rootDir: isDev ? "src/plugins" : "dist/plugins",
	extensions: [isDev ? ".ts" : ".js"],
	recursive: true,
	useChokidar: true,
	ignore: (file) => file.endsWith(".d.ts"),
})
	.on("loaded", (fp, plugin) =>
		logger.success({ plugin: plugin.name }, "Loaded plugin")
	)
	.on("updated", (fp, plugin) =>
		logger.info({ plugin: plugin.name }, "Updated plugin")
	)
	.on("removed", (fp, prev) =>
		logger.warn({ plugin: prev?.name ?? fp }, "Removed plugin")
	)
	.on("error", (err, fp) => logger.error({ err, file: fp }, "Plugin error"));

export default pluginManager;
