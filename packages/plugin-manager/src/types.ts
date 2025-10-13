import type {
	IExtraMessageContext,
	IMessageContext,
} from "@surya/baileys-utils";

// TODO
export type PluginLimit = {
	limit: number;
	windowMs: number;
};

export type BasePluginManifest = {
	/** The name of the plugin. */
	name: string;
	/**
	 * The command(s) to trigger the plugin.
	 */
	command: string | string[];
	/**
	 * The category or categories the plugin belongs to.
	 * All category names will be **capitalized**.
	 */
	category: string | string[];
};
export type ExtraPluginManifest = {
	/** A brief description of the plugin. */
	description?: string;
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
	rateLimit?: PluginLimit;
	/**
	 * Should ignore prefix when matching command.
	 * This is useful for plugins that want to respond to messages without a specific prefix.
	 * @default false
	 */
	ignorePrefix?: boolean;
	/** Whether the plugin is disabled. */
	disabled?: boolean;
};

export type PluginManifest = BasePluginManifest & ExtraPluginManifest;

/** The function that gets executed when the plugin is triggered. */
export type PluginFn<T = unknown> = (
	/** The message context created by `createMessageContext`. */
	ctx: IMessageContext,
	/** Additional context for the message. */
	extra: IExtraMessageContext
) => Promise<T> | T;

/**
 * The complete plugin type, combining manifest, pre-processing, main execution, and post-processing.
 * This is an interface to support module augmentation by consumers.
 *
 * Augmentable via declaration merging.
 */
export interface Plugin extends PluginManifest {
	/**
	 * Pre-execution hooks for a plugin.
	 * @deprecated Use `pre` instead
	 */
	before?: PluginFn;
	/**
	 * Pre-execution hooks for a plugin.
	 *
	 * The function that will be called before executing the main function.
	 * It can be used for pre-processing or validation.
	 *
	 * If this throws, the main function will not be executed.
	 * @returns A boolean indicating whether to proceed with the main execution.
	 */
	pre?: PluginFn;
	/**
	 * The main function that gets executed when the plugin is triggered.
	 * If this throws, the post/after function will not be executed.
	 */
	execute?: PluginFn;
	/**
	 * Post-execution hooks for a plugin.
	 * @deprecated Use `post` instead
	 */
	after?: PluginFn;
	/**
	 * Post-execution hooks for a plugin.
	 *
	 * The function that will be called after executing the main function.
	 * It can be used for post-processing or cleanup.
	 */
	post?: PluginFn;
}

/** Backward compatibility alias for Plugin */
export type IPlugin = Plugin;
/** Backward compatibility alias for PluginManifest */
export type IPluginManifest = PluginManifest;
