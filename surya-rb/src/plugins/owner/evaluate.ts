import vm from "node:vm";
import { inspect } from "util";
import db from "@/libs/database";
import type { IPlugin } from "@surya/plugin-manager";

const VM_TIMEOUT_MS = 5000;

export default {
	name: "evaluate-js",
	command: ["->"],
	ignorePrefix: true,
	category: ["owner"],
	ownerOnly: true,
	description: "Evaluate JavaScript code using vm.",
	execute: async (ctx, extra) => {
		if (!ctx.text) {
			await ctx.reply("Please provide a command to execute.");
			return;
		}

		const sandbox = {
			console,
			db,
			ctx,
			Buffer,
			URL,
			setTimeout,
			setInterval,
			clearTimeout,
			clearInterval,
			...extra,
		};

		try {
			const context = vm.createContext(sandbox, { name: "eval-sandbox" });

			const asExpr = `(async () => (${ctx.text}))()`;
			const asBlock = `(async () => { ${ctx.text} })()`;

			let script: vm.Script;
			try {
				script = new vm.Script(asExpr, { filename: "owner-eval.js" });
			} catch {
				script = new vm.Script(asBlock, { filename: "owner-eval.js" });
			}

			// Run sync part with timeout
			const promise = script.runInContext(context, {
				timeout: VM_TIMEOUT_MS,
			}) as Promise<unknown>;

			// Await async resolution with a separate timeout
			const result = await Promise.race([
				promise,
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error("Execution timed out")),
						VM_TIMEOUT_MS
					)
				),
			]);

			const output =
				typeof result === "string"
					? result
					: inspect(result, {
							depth: 2,
							maxArrayLength: 100,
							maxStringLength: 10000,
						});

			await ctx.reply(String(output).trim());
		} catch (error) {
			await ctx.reply(
				String(
					error instanceof Error ? error.message : String(error)
				).trim()
			);
		}
	},
} satisfies IPlugin;
