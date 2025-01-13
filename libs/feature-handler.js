import { logger, printer } from "../shared/logger.js";
import wrap from "../shared/wrap.js";
import db from "./database.js";
import { handleFeatureError } from "./feature-handler/error.js";
import { executor } from "./feature-handler/executor.js";

/**
 * @typedef {import("./feature-loader.js").default} FC
 * @param {import("surya").IHandlerExtras} ctx
 * @param {import("@frierendv/frieren").Api.Client} api
 * @param {Pick<FC, "featuresTrie" | "featuresMap">} param3
 */
export default async function featureHandler(
	ctx,
	api,
	{ featuresTrie, featuresMap }
) {
	let _execute_time = Date.now();
	const {
		command,
		text,
		args,
		groupMetadata,
		isOwner,
		isAdmin,
		isBotAdmin,
		sock,
		store,
		sender,
		isGroup,
		prefix,
	} = ctx;
	const user = db.users.get(sender);

	const extras = {
		command,
		text,
		args,
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
		features: featuresMap,
	};

	const feature = featuresTrie.findOne((command || args[0]).toLowerCase());
	if (!feature) {
		return;
	}

	if (feature.ignorePrefix) {
		Object.assign(extras, {
			command: args[0],
			text: ctx.text.replace(args[0], "").trim(),
			args: ctx.text.split(" "),
		});
	}

	// TODO: Fix the execution of 'before' function.
	if (feature.before && typeof feature.before === "function") {
		await wrap(
			// @ts-ignore
			() => feature.before(ctx, extras),
			(error) => handleFeatureError(feature, command, error, ctx.reply),
			() => {}
		);
	}

	// @ts-ignore
	await executor(ctx, extras, feature, user);

	if (feature.after && typeof feature.after === "function") {
		await wrap(
			// @ts-ignore
			() => feature.after(ctx, extras),
			(error) => handleFeatureError(feature, command, error, ctx.reply),
			() => {}
		);
	}
	logger.info(
		`[FEATURE HANDLER] ${extras.command} executed in ${
			Date.now() - _execute_time
		}ms`
	);
	wrap(() => printer(ctx, groupMetadata), logger.error);
}
