import db from "@/libs/database";
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

	await using user = await db.users.get(localCtx.sender);
	// TODO: handle default user values
	user.limit = user.limit ?? 50;
	user.money = user.money ?? 0;
	user.age = user.age ?? 0;
	user.plugins = user.plugins ?? {};

	// pre handler
	const runPre = "pre" in plugin ? plugin.pre : plugin.before;
	if (typeof runPre === "function") {
		try {
			const { result, ...perfBefore } = await measureExecution(
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
			// if result !== true return
			if (result !== true) {
				logger.warn(
					{ result },
					"PreHook not return `true`. Skipping next execution."
				);
				return;
			}
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

		// TODO: Plugin limiting handling. Wait for merge of PR https://github.com/frierendv/surya/pull/34
		if (plugin.rateLimit) {
			if (user.limit < (plugin.rateLimit.uses ?? 1)) {
				return localCtx.reply(
					"You have reached your limit. Please wait or contact the bot owner to increase your limit."
				);
			}
			user.limit -= plugin.rateLimit.uses ?? 1;
		}

		const execPerf = await measureExecution(
			() => execute(localCtx, localExtra),
			"pluginExecute"
		);
		user.plugins[plugin.name] = {
			executions: (user.plugins[plugin.name]?.executions ?? 0) + 1,
			lastExecution: Date.now(),
		};
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
		}
	}
};
