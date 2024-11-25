import { logger, printer } from "../shared/logger.js";
import wrap from "../shared/wrap.js";
import db from "./database.js";
import { handleFeatureError } from "./feature-handler/error.js";
import { executor } from "./feature-handler/executor.js";

/**
 * @typedef {import("./feature-loader.js").default} FC
 * @param {import("surya").IHandlerExtras} ctx
 * @param {import("@frierendv/frieren").Api.Client} api
 * @param {{features: FC["features"], _features: FC["_features"]}} features
 */
export default async function featureHandler(
	ctx,
	api,
	{ features, _features }
) {
	let _execute_time = Date.now();
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

	let _command = command;
	let _text = ctx.text;
	let _args = ctx.args;

	const feature = features.findOne(_command || args[0]);
	if (!feature) {
		return;
	}
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
		features: _features,
	};
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
	logger.info(
		`[FEATURE HANDLER] ${_command} executed in ${
			Date.now() - _execute_time
		}ms`
	);
	wrap(() => printer(ctx, groupMetadata), logger.error);
}
