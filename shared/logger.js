import chalk from "chalk";

export const logger = {
	info: (/** @type {unknown} */ message) => console.log(chalk.blue(message)),
	warn: (/** @type {unknown} */ message) =>
		console.log(chalk.yellow(message)),
	error: (/** @type {unknown} */ message) => console.log(chalk.red(message)),
	success: (/** @type {unknown} */ message) =>
		console.log(chalk.green(message)),
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
 * @param {import("@frierendv/frieren").Baileys.IParsedMessage} msg
 * @param {import("surya").GroupMetadataReturnType | null} groupMetadata
 */
export function printer(msg, groupMetadata) {
	const timestamp = msg?.message?.messageTimestamp
		? new Date(msg.message.messageTimestamp * 1000).toLocaleTimeString(
				"id-ID",
				{
					timeZone: "Asia/Jakarta",
				}
			)
		: null;

	const head = `${chalk.bgBlue(
		chalk.whiteBright(chalk.bold(`[${timestamp || msg.type}]`))
	)}`;
	const name = chalk
		.hex("#FF00FF")
		.bold(truncate(msg.name?.split("\n")[0], 10, ""));
	const phone = chalk.hex("#e5dfc3").redBright(msg.phone);
	const where = chalk.bold(
		msg.isGroup
			? `Group: ${truncate(groupMetadata?.subject ?? chalk.redBright("Unknown"), 6)}`
			: "Private Chat"
	);
	const text = `${msg.text ? `${chalk.redBright(":")} ${chalk.whiteBright(truncate(msg.text, 70))}` : chalk.dim("(No Message Text)")}`;

	console.log(
		`${head} ${chalk.dim("|")} ${chalk
			.hex("#FF00FF")
			.italic(
				chalk.underline(name + " " + phone)
			)} ${chalk.dim("|")} (${where})${chalk.dim(text)}`
	);
}
