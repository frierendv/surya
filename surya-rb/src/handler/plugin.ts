import { logger } from "@libs/logger";
import { measureExecution } from "@libs/performance";
import type {
	IExtraMessageContext,
	IMessageContext,
} from "@surya/baileys-utils";
import type { Plugin } from "@surya/plugin-manager";

export const pluginHandler = async (
	plugin: Plugin,
	ctx: IMessageContext,
	extra: IExtraMessageContext
) => {
	/** ignore disabled plugin */
	if (plugin.disabled) {
		return;
	}
	const localCtx = { ...ctx };
	const localExtra = { ...extra };

	// pre handler
	const runPre = "pre" in plugin ? plugin.pre : plugin.before;
	if (typeof runPre === "function") {
		try {
			const perfBefore = await measureExecution(
				() => runPre(localCtx, localExtra),
				"pluginPreHook"
			);
			logger.debug(
				{
					msg: localCtx,
					plugin: plugin.name,
					...perfBefore.performance,
				},
				"Executed pre hook"
			);
		} catch (err) {
			logger.error(
				{ err, plugin: plugin.name },
				"Error executing pre hook"
			);
			return;
		}
	}
	// main handler
	try {
		const execute = "execute" in plugin ? plugin.execute : undefined;
		if (!execute) {
			logger.error(
				{ plugin: plugin.name },
				"Plugin has no execute/main handler"
			);
			return;
		}
		const execPerf = await measureExecution(
			() => execute(localCtx, localExtra),
			"execute" in plugin ? "pluginExecute" : "pluginMain"
		);
		logger.debug(
			{
				msg: localCtx,
				plugin: plugin.name,
				...execPerf.performance,
			},
			"execute" in plugin ? "Executed plugin" : "Executed plugin (main)"
		);
	} catch (err) {
		logger.error({ err, plugin: plugin.name }, "Error executing plugin");
		return;
	}
	// post handler
	const runPost = "post" in plugin ? plugin.post : plugin.after;
	if (typeof runPost === "function") {
		try {
			const perfAfter = await measureExecution(
				() => runPost(localCtx, localExtra),
				"pluginPostHook"
			);
			logger.debug(
				{
					msg: localCtx,
					plugin: plugin.name,
					...perfAfter.performance,
				},
				"Executed post hook"
			);
		} catch (err) {
			logger.error(
				{ err, plugin: plugin.name },
				"Error executing post hook"
			);
			return;
		}
	}
};
