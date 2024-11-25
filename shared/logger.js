import chalk from "chalk";

/**
 * @param {string} level
 * @param {string} icon
 * @param {import("chalk").ChalkInstance} color
 * @param {unknown} message
 */
const formatMessage = (level, icon, color, message) => {
	console.log(
		`${chalk.bold(color(`${icon} ${level}`))}: ${chalk.white(message)}`
	);
};

export const logger = {
	info: (/** @type {unknown} */ message) =>
		formatMessage("INFO", "ℹ️", chalk.blue, message),
	warn: (/** @type {unknown} */ message) =>
		formatMessage("WARN", "⚠️", chalk.yellow, message),
	error: (/** @type {unknown} */ message) =>
		formatMessage("ERROR", "❌", chalk.red, message),
	success: (/** @type {unknown} */ message) =>
		formatMessage("SUCCESS", "✅", chalk.green, message),
};

/**
 * @param {string} text
 * @param {number} maxLength
 * @param {string} replacer
 * @returns {string}
 */
function truncate(text, maxLength = 20, replacer = "...") {
	if (!text || text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength)}${replacer}`;
}

/**
 *
 * @param {import("surya").IHandlerExtras} ctx
 * @param {import("surya").GroupMetadataReturnType | null} groupMetadata
 */
export function printer(ctx, groupMetadata) {
	const _ts = Number(ctx.message?.messageTimestamp) || Date.now();
	const timestamp = new Date(_ts * 1000).toLocaleTimeString("id-ID", {
		timeZone: "Asia/Jakarta",
	});

	const head = `${chalk.bgBlue(
		chalk.whiteBright(chalk.bold(`[${timestamp || ctx.type}]`))
	)}`;
	const name = chalk
		.hex("#FF00FF")
		.bold(truncate(ctx.name?.split("\n")[0], 10, ""));
	const phone = chalk.hex("#e5dfc3").redBright(ctx.phone);
	const where = chalk.bold(
		ctx.isGroup
			? `Group: ${truncate(groupMetadata?.subject ?? chalk.redBright("Unknown"), 6)}`
			: "Private Chat"
	);
	const command = ctx.command
		? `(${chalk.hex("#FF00FF").bold(ctx.command)}) `
		: "";
	const text = `${chalk.redBright(":")} ${command}${ctx.text ? `${chalk.whiteBright(truncate(ctx.text, 70))}` : chalk.dim("(No Message Text)")}`;

	console.log(
		`${head} ${chalk.dim("|")} ${chalk
			.hex("#FF00FF")
			.italic(
				chalk.underline(name + " " + phone)
			)} ${chalk.dim("|")} (${where})${chalk.dim(text)}`
	);
}
