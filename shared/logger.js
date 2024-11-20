import chalk from "chalk";

export const logger = {
	info: (/** @type {unknown} */ message) => console.log(chalk.blue(message)),
	warn: (/** @type {unknown} */ message) =>
		console.log(chalk.yellow(message)),
	error: (/** @type {unknown} */ message) => console.log(chalk.red(message)),
	success: (/** @type {unknown} */ message) =>
		console.log(chalk.green(message)),
};
