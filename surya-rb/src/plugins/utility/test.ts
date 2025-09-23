import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "test-command",
	command: ["test"],
	category: ["utility"],
	description: "Test command",
	execute: async (ctx, { sock }) => {
		await sock.sendMessage(ctx.from, { text: "Test command executed" });
	},
} satisfies IPlugin;
