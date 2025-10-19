import type { GroupMetadata } from "baileys";

type Dict<T = unknown> = Record<string, T>;

export type TPluginInfo = {
	executions: number;
	lastExecution: number;
};

export type TUser = Dict & {
	limit: number;
	plugins: Dict<TPluginInfo>;
};

export type TGroup = Dict & {
	/**
	 * Baileys Group Metadata
	 */
	metadata: GroupMetadata;
} & Dict;

export type TDatabase<User = TUser, Group = TGroup, Setting = Dict> = {
	/**  map of userId -> user data */
	users: User;
	/** map of groupId -> group data (includes metadata) */
	groups: Group;
	/** application settings */
	settings: Setting;
};
