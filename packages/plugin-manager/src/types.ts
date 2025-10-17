import type {
	IExtraMessageContext,
	IMessageContext,
} from "@surya/baileys-utils";

/**
 * Rate limiting options for a plugin.
 */
export type PluginLimit = {
	/**
	 * The number of limit reductions.
	 * Each time the plugin is used, for each use, the limit will be reduced by this amount.
	 * @default 1
	 */
	uses: number;
};

/**
 * The base properties that every plugin must have.
 */
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

/**
 * Extended properties for plugins, providing additional metadata and configuration options.
 */
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

/** The function that gets executed when the plugin is triggered. */
export type PluginFn<T = unknown> = (
	/** The message context created by `createMessageContext`. */
	ctx: IMessageContext,
	/** Additional context for the message. */
	extra: IExtraMessageContext
) => Promise<T> | T;

/**
 * Plugin manifest as defined in the plugin module.
 * Combines base and extra manifest properties.
 */
export interface PluginManifest
	extends BasePluginManifest,
		ExtraPluginManifest {}

/**
 * The complete plugin type, combining manifest, pre-processing, main execution, and post-processing.
 */
export interface Plugin extends PluginManifest {
	/**
	 * Pre-execution hooks for a plugin.
	 * @deprecated Use `pre` instead
	 */
	before?: PluginFn<boolean>;
	/**
	 * Pre-execution hooks for a plugin.
	 *
	 * The function that will be called before executing the main function.
	 * It can be used for pre-processing or validation.
	 *
	 * If this throws, the main function will not be executed.
	 * @returns A boolean indicating whether to proceed with the main execution.
	 */
	pre?: PluginFn<boolean>;
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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IPlugin extends Plugin {}
/** Backward compatibility alias for PluginManifest */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IPluginManifest extends PluginManifest {}
