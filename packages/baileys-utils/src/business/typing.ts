import type { proto } from "baileys";

export type Buttonable = {
	/** add buttons to the message  */
	buttons?: proto.Message.ButtonsMessage.IButton[];
};
export type Templatable = {
	/** add buttons to the message (conflicts with normal buttons)*/
	templateButtons?: proto.IHydratedTemplateButton[];
	footer?: string;
};
export type Interactiveable = {
	/** add buttons to the message  */
	interactiveButtons?: proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton[];
	title?: string;
	subtitle?: string;
	media?: boolean;
};
export type Shopable = {
	shop?: proto.Message.InteractiveMessage.ShopMessage.Surface;
	id?: string;
	title?: string;
	subtitle?: string;
	media?: boolean;
};
export type Listable = {
	/** Sections of the List */
	sections?: proto.Message.ListMessage.ISection[];
	/** Title of a List Message only */
	title?: string;
	/** Text of the button on the list (required) */
	buttonText?: string;
	/** ListType of a List Message only */
	listType?: proto.Message.ListMessage.ListType;
};
export type Cardsable = {
	cards?: string[];
	subtitle?: string;
};

export type BusinessMessage =
	| proto.Message.InteractiveMessage
	| proto.Message.ButtonsMessage
	| proto.Message.ListMessage;
export type BusinessMessageType =
	| "interactiveMessage"
	| "buttonsMessage"
	| "listMessage";
