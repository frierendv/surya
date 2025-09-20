import { IExtraMessageContext, IMessageContext } from "@surya/baileys-utils";

export type LimitOptions = {
	limit: number;
	windowMs: number;
};

export interface IPluginManifest {
	/** The name of the plugin. */
	name: string;
	/**
	 * The command(s) to trigger the plugin.
	 */
	command: string | string[];
	/** The version of the plugin. */
	version?: string;
	/**
	 * The category or categories the plugin belongs to.
	 * All category names will be **capitalized**.
	 */
	category: string | string[];
	/** A brief description of the plugin. */
	description: string;
	/**
	 * Make the plugin can be execute by owner only.
	 * @default false
	 */
	ownerOnly?: boolean;
	/**
	 * Only group admin can use this plugin.
	 * @default false
	 */
	adminOnly?: boolean;
	/**
	 * Make the plugin can be triggered in private chat.
	 * @default false
	 */
	privateChatOnly?: boolean;
	/**
	 * Make the plugin can be triggered in group chat.
	 */
	groupChatOnly?: boolean;
	/**
	 * Mark this plugin hidden, it won't be listed in the help command.
	 */
	hidden?: boolean;
	/**
	 * If set, the plugin will be rate limited according to the specified options.
	 */
	rateLimit?: LimitOptions;
	/**
	 * Should ignore prefix when matching command.
	 * This is useful for plugins that want to respond to messages without a specific prefix.
	 * @default false
	 */
	ignorePrefix?: boolean;
	/** Whether the plugin is disabled. */
	disabled?: boolean;
}

export interface IPlugin extends IPluginManifest {
	/**
	 * The function that will be called before executing the main function.
	 * It can be used for pre-processing or validation.
	 *
	 * **If fails (throws an error), the main function will not be executed.**
	 * @param ctx - The context of the incoming message.
	 * @param extra - Additional context for the message.
	 */
	before?: (
		ctx: IMessageContext,
		extra: IExtraMessageContext
	) => Promise<unknown> | unknown;
	/**
	 * The **main** function that gets executed when the plugin is triggered.
	 *
	 * **If fails (throws an error), the after function will not be executed.**
	 * @param ctx - The context of the incoming message.
	 * @param extra - Additional context for the message.
	 */
	execute: (
		ctx: IMessageContext,
		extra: IExtraMessageContext
	) => Promise<unknown> | unknown;
	/**
	 * The function that will be called after executing the main function.
	 * It can be used for post-processing or cleanup.
	 * @param ctx - The context of the incoming message.
	 * @param extra - Additional context for the message.
	 */
	after?: (
		ctx: IMessageContext,
		extra: IExtraMessageContext
	) => Promise<unknown> | unknown;
}
