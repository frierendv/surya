import { logger, printer } from "../shared/logger.js";
import wrap from "../shared/wrap.js";
import db from "./database.js";
import { handleFeatureError } from "./feature-handler/error.js";
import queue from "./queue.js";

/**
 * @param {import("surya").IHandlerExtras} ctx
 * @param {import("@frierendv/frieren").Api.Client} api
 * @param {import("./feature-loader.js").default["features"]} features
 */
export default async function featureHandler(ctx, api, features) {
	const {
		groupMetadata,
		isOwner,
		isAdmin,
		isBotAdmin,
		sock,
		store,
		sender,
		isGroup,
		args,
		prefix,
		command,
	} = ctx;
	const user = db.users.get(sender);

	for (const feature of Object.values(features)) {
		let _command = command;
		let _text = ctx.text;
		let _args = ctx.args;
		if (feature.ignorePrefix) {
			_command = args[0];
			_text = ctx.text.replace(_command, "").trim();
			_args = ctx.text.split(" ");
		}

		const extras = {
			command: _command,
			text: _text,
			args: _args,
			prefix,
			isGroup,
			isAdmin,
			isOwner,
			isBotAdmin,
			groupMetadata,
			api,
			sock,
			store,
			db,
			features,
			feature,
		};
		if (feature.before && typeof feature.before === "function") {
			await wrap(
				// @ts-ignore
				() => feature.before(ctx, extras),
				(error) =>
					handleFeatureError(feature, command, error, ctx.reply),
				() => {}
			);
		}

		const shouldExecute = [...feature.command].includes(_command);

		if (!shouldExecute || !_command) {
			continue;
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
		// @ts-ignore
		await executor(ctx, extras, feature, user);
	}

	wrap(() => printer(ctx, groupMetadata), logger.error);
}

/**
 * @param {import("@frierendv/frieren").Baileys.IContextMessage} ctx
 * @param {Required<import("surya").IHandlerExtras>} extras
 * @param {import("surya").Feature} feature
 * @param {Record<string, any>} user
 */
async function executor(ctx, extras, feature, user) {
	const { command } = extras;
	if (queue.exist(ctx.sender, command)) {
		ctx.reply("You are still using this command");
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
}
