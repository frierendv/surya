import {
	getContentType,
	isJidGroup,
	isLidUser,
	isPnUser,
	normalizeMessageContent,
	proto,
	WAProto,
} from "baileys";
import type { BinaryNode, WAMessageContent, WASocket } from "baileys";
import type { BusinessMessageType } from "./typing";

export const isInteractiveMessage = (
	message: proto.IMessage | undefined
): message is proto.Message => {
	return !!(
		message?.viewOnceMessage?.message?.interactiveMessage ||
		message?.viewOnceMessageV2?.message?.interactiveMessage ||
		message?.viewOnceMessageV2Extension?.message?.interactiveMessage ||
		message?.interactiveMessage
	);
};
export const isButtonsMessage = (
	message: proto.IMessage | undefined
): message is proto.Message => {
	return !!(
		message?.viewOnceMessage?.message?.buttonsMessage ||
		message?.viewOnceMessageV2?.message?.buttonsMessage ||
		message?.viewOnceMessageV2Extension?.message?.buttonsMessage ||
		message?.buttonsMessage
	);
};

export const isBizMessage = (message: proto.IMessage | undefined): boolean => {
	const contentType = getContentType(
		normalizeMessageContent(message)
	) as BusinessMessageType;
	const businessMessageTypes: BusinessMessageType[] = [
		"interactiveMessage",
		"buttonsMessage",
		"listMessage",
	];
	return businessMessageTypes.includes(contentType);
};

type RelayMessage = WASocket["relayMessage"];
export const patchRelayMessageBusiness = (relayMessage: RelayMessage) => {
	const boundRelayMessage: WASocket["relayMessage"] = (
		jid,
		msg,
		{ additionalNodes, ...options }
	) => {
		console.log("Patching relayMessage for business message");
		const isValidJid = isJidGroup(jid) || isPnUser(jid) || isLidUser(jid);
		if (isValidJid && isBizMessage(msg)) {
			const bizNode: BinaryNode = { tag: "biz", attrs: {} };
			additionalNodes = additionalNodes || [];

			if (isButtonsMessage(msg) || isInteractiveMessage(msg)) {
				bizNode.content = [
					{
						tag: "interactive",
						attrs: { type: "native_flow", v: "1" },
						content: [
							{
								tag: "native_flow",
								attrs: { v: "9", name: "mixed" },
							},
						],
					},
				];
			} else if (msg.listMessage) {
				bizNode.content = [
					{
						tag: "list",
						attrs: { type: "product_list", v: "2" },
					},
				];
			}

			additionalNodes.push(bizNode);
		}
		return relayMessage.call(this, jid, msg, {
			additionalNodes,
			...options,
		});
	};
	return boundRelayMessage;
};

export const patchGenerateWAMessageContent = (
	m: WAMessageContent,
	message: any
) => {
	if ("buttons" in message && message.buttons) {
		const buttonMessage: any = {
			buttons: message.buttons.map((btn: any) => ({
				...btn,
				type: proto.Message.ButtonsMessage.Button.Type.RESPONSE,
			})),
		};
		if ("text" in message) {
			buttonMessage.contentText = message.text;
			buttonMessage.headerType =
				proto.Message.ButtonsMessage.HeaderType.EMPTY;
		} else {
			if ("caption" in message) {
				buttonMessage.contentText = message.caption;
			}

			const bType = Object.keys(m)[0]!
				.replace("Message", "")
				.toUpperCase() as keyof typeof proto.Message.ButtonsMessage.HeaderType;
			buttonMessage.headerType =
				proto.Message.ButtonsMessage.HeaderType[bType] ||
				proto.Message.ButtonsMessage.HeaderType.EMPTY;
			Object.assign(buttonMessage, { ...m });
		}

		if ("title" in message && !!message.title) {
			buttonMessage.title = message.title;
			buttonMessage.headerType =
				proto.Message.ButtonsMessage.HeaderType.TEXT;
		}
		if ("footer" in message && !!message.footer) {
			buttonMessage.footerText = message.footer;
		}
		if ("contextInfo" in message && !!message.contextInfo) {
			buttonMessage.contextInfo = message.contextInfo;
		}
		if ("mentions" in message && message.mentions?.length) {
			buttonMessage.contextInfo = buttonMessage.contextInfo || {};
			buttonMessage.contextInfo.mentionedJid = message.mentions;
		}
		m = { buttonsMessage: buttonMessage };
	} else if ("templateButtons" in message && message.templateButtons) {
		const templateMessage: Record<string, any> = {
			hydratedButtons: message.templateButtons,
		};
		if ("text" in message) {
			templateMessage.hydratedContentText = message.text;
		} else {
			if ("caption" in message) {
				templateMessage.hydratedContentText = message.caption;
			}
			Object.assign(templateMessage, { ...m });
		}
		if ("footer" in message && message.footer) {
			templateMessage.hydratedFooterText = message.footer;
		}
		m = {
			templateMessage: {
				fourRowTemplate: templateMessage,
				hydratedFourRowTemplate: templateMessage,
			},
		};
	}
	if ("sections" in message && message.sections) {
		const listMessage = {
			sections: message.sections,
			buttonText: message.buttonText,
			title: message.title,
			footerText: message.footer,
			description: message.text,
			listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
		};
		m = { listMessage: listMessage };
	}
	if ("interactiveButtons" in message && !!message.interactiveButtons) {
		const interactiveMessage: Record<string, any> = {
			nativeFlowMessage:
				WAProto.Message.InteractiveMessage.NativeFlowMessage.create({
					buttons: message.interactiveButtons,
				}),
		};
		if ("text" in message) {
			interactiveMessage.body = {
				text: message.text,
			};
		} else if ("caption" in message) {
			interactiveMessage.body = {
				text: message.caption,
			};
			interactiveMessage.header = {
				title: message.title,
				subtitle: message.subtitle,
				hasMediaAttachment: message?.media ?? false,
			};
			Object.assign(interactiveMessage.header, { ...m });
		}
		if ("footer" in message && !!message.footer) {
			interactiveMessage.footer = {
				text: message.footer,
			};
		}
		if ("title" in message && !!message.title) {
			interactiveMessage.header = {
				title: message.title,
				subtitle: message.subtitle,
				hasMediaAttachment: message?.media ?? false,
			};
			Object.assign(interactiveMessage.header, { ...m });
		}
		if ("contextInfo" in message && !!message.contextInfo) {
			interactiveMessage.contextInfo = message.contextInfo;
		}
		if ("mentions" in message && !!message.mentions) {
			interactiveMessage.contextInfo = { mentionedJid: message.mentions };
		}

		m = { interactiveMessage };
	}
	if ("shop" in message && !!message.shop) {
		const interactiveMessage: Record<string, any> = {
			shopStorefrontMessage:
				proto.Message.InteractiveMessage.ShopMessage.create({
					surface: message.shop,
					id: message.id,
				}),
		};
		if ("text" in message) {
			interactiveMessage.body = {
				text: message.text,
			};
		} else if ("caption" in message) {
			interactiveMessage.body = {
				text: message.caption,
			};
			interactiveMessage.header = {
				title: message.title,
				subtitle: message.subtitle,
				hasMediaAttachment: message?.media ?? false,
			};
			Object.assign(interactiveMessage.header, { ...m });
		}
		if ("footer" in message && !!message.footer) {
			interactiveMessage.footer = {
				text: message.footer,
			};
		}
		if ("title" in message && !!message.title) {
			interactiveMessage.header = {
				title: message.title,
				subtitle: message.subtitle,
				hasMediaAttachment: message?.media ?? false,
			};
			Object.assign(interactiveMessage.header, { ...m });
		}
		if ("contextInfo" in message && !!message.contextInfo) {
			interactiveMessage.contextInfo = message.contextInfo;
		}
		if ("mentions" in message && !!message.mentions) {
			interactiveMessage.contextInfo = { mentionedJid: message.mentions };
		}
		m = { interactiveMessage };
	}
	return m;
};
