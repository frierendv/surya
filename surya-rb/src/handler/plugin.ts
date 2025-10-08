import { logger } from "@libs/logger";
import type {
	IExtraMessageContext,
	IMessageContext,
} from "@surya/baileys-utils";
import type { IPlugin } from "@surya/plugin-manager";
import { jidNormalizedUser } from "baileys";

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

	// hack lid to pn for quoted message
	if (localCtx.quoted) {
		const participant = localCtx.quoted.participant;
		const { getPNForLID } = localExtra.sock.signalRepository.lidMapping;
		if (participant && participant.endsWith("@lid")) {
			const pn = await getPNForLID(participant);
			if (pn) {
				localCtx.quoted.participant = jidNormalizedUser(pn);
			}
		}
	}

	// pre handler
	if (plugin.before) {
		try {
			await plugin.before(localCtx, localExtra);
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
		await plugin.execute(localCtx, localExtra);
	} catch (err) {
		logger.error({ err, plugin: plugin.name }, "Error executing plugin");
		return;
	}
	// post handler
	if (plugin.after) {
		try {
			await plugin.after(localCtx, localExtra);
		} catch (err) {
			logger.error(
				{ err, plugin: plugin.name },
				"Error executing after hook"
			);
			return;
		}
	}
};
