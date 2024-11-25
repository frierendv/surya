import wrap from "../../shared/wrap.js";
import { handleFeatureError } from "./error.js";
import queue from "./queue.js";

/**
 * @param {import("@frierendv/frieren").Baileys.IContextMessage} ctx
 * @param {Required<import("surya").IHandlerExtras>} extras
 * @param {import("surya").Feature} feature
 * @param {Record<string, any>} user
 */
export const executor = async (ctx, extras, feature, user) => {
	const { command, isOwner, isGroup, isAdmin } = extras;
	if (queue.exist(ctx.sender, command)) {
		ctx.reply("You are still using this command");
		return;
	}

	if (feature.owner && !isOwner) {
		ctx.reply("Only the owner can use this command.");
		return;
	}

	const isAdminCommand = feature.admin && isGroup && !isAdmin;
	if (isAdminCommand) {
		ctx.reply("Only the admin can use this command.");
		return;
	}

	if (feature.group && !isGroup) {
		ctx.reply("This command only available in group");
		return;
	}
	if (feature.private && isGroup) {
		ctx.reply("This command only available in private chat");
		return;
	}

	const shouldApplyLimit = feature.limit && !isOwner && !user.premium;
	if (shouldApplyLimit && user.limit < 0) {
		ctx.reply("You have reached the limit of using this command");
		return;
	}

	queue.add(ctx.sender, command);
	await wrap(
		() => feature.execute(ctx, extras),
		(error) => handleFeatureError(feature, command, error, ctx.reply),
		() => {
			if (feature.limit) {
				user.limit--;
			}
		}
	);
	queue.remove(ctx.sender, command);

	if (feature.after && typeof feature.after === "function") {
		await wrap(
			// @ts-ignore
			() => feature.after(ctx, extras),
			(error) => handleFeatureError(feature, command, error, ctx.reply),
			() => {}
		);
	}
};
