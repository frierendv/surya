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
}

export interface IPlugin extends IPluginManifest {
	/**
	 * The function that will be called before executing the main function.
	 * It can be used for pre-processing or validation.
	 * @param ctx - The context of the incoming message.
	 * @param extra - Additional context for the message.
	 * @returns A boolean indicating whether to proceed with the main function.
	 */
	before?: (
		ctx: IMessageContext,
		extra: IExtraMessageContext
	) => Promise<boolean> | boolean;
	/**
	 * The main function that gets executed when the plugin is triggered.
	 * @param ctx - The context of the incoming message.
	 * @param extra - Additional context for the message.
	 */
	execute: (
		ctx: IMessageContext,
		extra: IExtraMessageContext
	) => Promise<void>;
	/**
	 * The function that will be called after executing the main function.
	 * It can be used for post-processing or cleanup.
	 * @param ctx - The context of the incoming message.
	 * @param extra - Additional context for the message.
	 */
	after?: (
		ctx: IMessageContext,
		extra: IExtraMessageContext
	) => Promise<void> | void;
}
