// @ts-check
import { Api, Baileys } from "@frierendv/frieren";
import { IContextMessage } from "@frierendv/frieren/dist/baileys";

export type ClientSocket = NonNullable<Required<Baileys.WASocket>>;
export type Socket = NonNullable<ClientSocket["sock"]>;
export type Store = NonNullable<ClientSocket["store"]>;
export type GroupMetadataReturnType = Awaited<
	ReturnType<Required<Socket>["groupMetadata"]>
>;

type MappedRequired<T> = {
	[K in keyof T]: NonNullable<T[K]>;
};
export interface IClientSocket extends ClientSocket {
	sock: MappedRequired<Socket>;
	store: Store;
}

export interface IHandlerExtrasBase extends Required<IContextMessage> {
	isGroup: boolean;
	isAdmin: boolean;
	isOwner: boolean;
	isBotAdmin: boolean;
	groupMetadata: GroupMetadataReturnType | null;
	api: Api.Client;
	sock: Socket;
	store: Baileys.WASocket["store"];
	db: import("./libs/database").Database;
	features: import("./libs/feature-loader").default["featuresMap"];
	feature: Feature;
}
export type IHandlerExtras<T = IHandlerExtrasBase> = T extends "isGroup"
	? {
			[K in Exclude<keyof T, "isGroup">]: T[K];
		} & {
			groupMetadata: GroupMetadataReturnType;
		}
	: IHandlerExtrasBase;

type ConstructorToType<T> = T extends typeof Array
	? any[]
	: T extends typeof String
		? string | null
		: T extends typeof Boolean
			? boolean
			: T extends typeof Function
				? (...args: any[]) => any
				: never | null;
type FeatureSchema<K = typeof import("./schema").Feature> = {
	[Key in keyof K]: ConstructorToType<K[Key]>;
};

export type Feature = Omit<FeatureSchema, "execute"> & {
	/**
	 * Custom prefixes for the command.
	 */
	ignorePrefix?: boolean;
	/**
	 * The function that will be executed when the command is called.
	 */
	execute: (
		ctx: IContextMessage,
		extras: IHandlerExtras
	) => Promise<void | any>;
	/**
	 * The function that will be executed before the command is called.
	 */
	before?: (
		ctx: IContextMessage,
		extras: IHandlerExtras
	) => Promise<void | any>;
	/**
	 * The function that will be executed after the command is called.
	 */
	after?: (
		ctx: IContextMessage,
		extras: IHandlerExtras
	) => Promise<void | any>;
} & Partial<Record<string, any | Promise<any>>>;

export interface IConfig {
	prefix: string | string[];
	owners: string | string[];
	bot_name: string;
	bot_number: string;

	database?: {
		mongo_url: string;
	};
}

export type InferSchema<T> = {
	[K in keyof T]: T[K] extends StringConstructor
		? string
		: T[K] extends NumberConstructor
			? number
			: T[K] extends BooleanConstructor
				? boolean
				: T[K] extends DateConstructor
					? Date
					: T[K] extends ArrayConstructor
						? any[]
						: T[K] extends new (...args: any[]) => infer U
							? U
							: never;
};
