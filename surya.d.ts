import { Api, Baileys } from "@frierendv/frieren";
import { IParsedMessage } from "@frierendv/frieren/dist/baileys";

export type ClientSocket = NonNullable<Required<Baileys.WASocket>>;
export type Socket = NonNullable<ClientSocket["sock"]>;
export type Store = NonNullable<ClientSocket["store"]>;
export type GroupMetadataReturnType = Awaited<
	ReturnType<Required<Socket>["groupMetadata"]>
>;

export interface IClientSocket extends ClientSocket {
	sock: Socket;
	store: Store;
}

export interface IHandlerExtras {
	text: string;
	args: string[];
	prefix: string;
	command: string;
	isGroup: boolean;
	isAdmin: boolean;
	isOwner: boolean;
	isBotAdmin: boolean;
	groupMetadata: GroupMetadataReturnType;
	api: Api.Client;
	sock: Socket;
	store: Baileys.WASocket["store"];
	db: import("./database").Database;
	features: import("./feature-loader").default["features"];
}

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
	customPrefix?: string[];
	/**
	 * The function that will be executed when the command is called.
	 */
	execute: (
		msg: IParsedMessage,
		extras: IHandlerExtras
	) => Promise<void | any>;
};
