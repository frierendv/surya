import { logger } from "@libs/logger";
import { measureExecution } from "@libs/performance";
import type {
	IExtraMessageContext,
	IMessageContext,
} from "@surya/baileys-utils";
import type { IPlugin } from "@surya/plugin-manager";

export const pluginHandler = async (
	plugin: IPlugin,
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
	if (plugin.before) {
		try {
			const perfBefore = await measureExecution(
				() => plugin.before!(localCtx, localExtra),
				"pluginBeforeHook"
			);
			logger.debug(
				{
					msg: localCtx,
					plugin: plugin.name,
					...perfBefore.performance,
				},
				"Executed before hook"
			);
		} catch (err) {
			logger.error(
				{ err, plugin: plugin.name },
				"Error executing before hook"
			);
			return;
		}
	}
	// main handler
	try {
		const execPerf = await measureExecution(
			() => plugin.execute(localCtx, localExtra),
			"pluginExecute"
		);
		logger.debug(
			{
				msg: localCtx,
				plugin: plugin.name,
				...execPerf.performance,
			},
			"Executed plugin"
		);
	} catch (err) {
		logger.error({ err, plugin: plugin.name }, "Error executing plugin");
		return;
	}
	// post handler
	if (plugin.after) {
		try {
			const perfAfter = await measureExecution(
				() => plugin.after!(localCtx, localExtra),
				"pluginAfterHook"
			);
			logger.debug(
				{
					msg: localCtx,
					plugin: plugin.name,
					...perfAfter.performance,
				},
				"Executed after hook"
			);
		} catch (err) {
			logger.error(
				{ err, plugin: plugin.name },
				"Error executing after hook"
			);
			return;
		}
	}
};
