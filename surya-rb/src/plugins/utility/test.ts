import type { IPlugin } from "@surya/plugin-manager";

const testPlugin: IPlugin = {
	name: "test-command", // plugin name for logging
	command: ["test"], // command triggers (e.g. /test)
	category: ["utility"], // plugin category
	description: "Test command", // short description
	before: async (_ctx, _extra) => {
		// precondition checks
		// do something before main handler
	},
	execute: async (ctx, { sock }) => {
		await sock.sendMessage(ctx.from, { text: "Test command executed" });
	},
	after: async (_ctx, _extra) => {
		// cleanup or logging after main handler
	},
};

export default testPlugin;
