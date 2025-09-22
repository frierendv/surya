import os from "os";
import { performance } from "perf_hooks";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "ping-server",
	command: ["ping", "p", "server"],
	category: ["utility"],
	description: "Ping the bot to check if it's alive.",
	execute: async (ctx, { command }) => {
		if (command !== "server") {
			await ctx.reply("Pong!");
			return;
		}
		const old = performance.now();
		const ram = (os.totalmem() / Math.pow(1024, 3)).toFixed(2);
		const used_ram = (
			(os.totalmem() - os.freemem()) /
			Math.pow(1024, 3)
		).toFixed(2);
		const cpus = os.cpus();

		await ctx.reply(
			"```Server Information```\n" +
				`> *CPU*: ${cpus.length} Cores\n` +
				`> *Uptime*: ${Math.floor(os.uptime() / 86400)} days\n` +
				`> *RAM*: ${ram} GB\n` +
				`> *Used RAM*: ${used_ram} GB\n` +
				`> *Platform*: ${os.platform()} ${os.arch()}\n` +
				`> *Speed*: ${(performance.now() - old).toFixed(5)} ms`
		);
	},
} satisfies IPlugin;
