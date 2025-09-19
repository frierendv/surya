import type {
	IExtraMessageContext,
	IMessageContext,
} from "@surya/baileys-utils";
import { PluginManager } from "@surya/plugin-manager";
import type { IPlugin } from "@surya/plugin-manager";

const isDev = process.env.NODE_ENV === "development";

const pluginManager = new PluginManager({
	rootDir: isDev ? "src/plugins" : "dist/plugins",
	extensions: [isDev ? ".ts" : ".js"],
	recursive: true,
	useChokidar: true,
	ignore: (file) => file.endsWith(".d.ts"),
})
	.on("loaded", (fp, plugin) => console.log("Loaded plugin:", plugin.name))
	.on("updated", (fp, plugin) => console.log("Updated:", plugin.name))
	.on("removed", (fp, prev) => console.log("Removed:", prev?.name ?? fp))
	.on("error", (err, fp) => console.error("Plugin error:", fp, err));

pluginManager.handle = async (plugin, ctx, extra) => {
	// pre handler
	if (plugin.before) {
		try {
			const shouldContinue = await plugin.before(ctx, extra);
			if (!shouldContinue) {
				return;
			}
		} catch (err) {
			console.error(
				`Error in before hook of plugin ${plugin.name}:`,
				err
			);
			return;
		}
	}
	// main handler
	try {
		await plugin.execute(ctx, extra);
	} catch (err) {
		console.error(`Error executing plugin ${plugin.name}:`, err);
	}
	// post handler
	if (plugin.after) {
		try {
			await plugin.after(ctx, extra);
		} catch (err) {
			console.error(`Error in after hook of plugin ${plugin.name}:`, err);
			return;
		}
	}
};

declare module "@surya/plugin-manager" {
	interface PluginManager {
		handle: (
			plugin: IPlugin,
			ctx: IMessageContext,
			extra: IExtraMessageContext
		) => Promise<void>;
	}
}
export default pluginManager;
