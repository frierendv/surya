import type {
	AnyMediaMessageContent,
	WASocket as BaileysWASocket,
	MiscMessageGenerationOptions,
	WAMessage,
} from "baileys";

export type MediaKey = "image" | "video" | "audio" | "sticker" | "document";

/**internal */
export type AsType = MediaKey;
export type SendFileOptions = Partial<
	AnyMediaMessageContent & Pick<MiscMessageGenerationOptions, "quoted">
> & { as?: AsType };

export type SendFile = (
	jid: string,
	content: any,
	options?: SendFileOptions,
	quoted?: WAMessage
) => Promise<WAMessage | undefined>;

export interface WASocket extends BaileysWASocket {
	/**
	 * Sends a file to the given JID. The content can be a URL, local file path, data URL, or Buffer.
	 *
	 * It automatically detects the file type
	 * and sends it as the appropriate media type (image, video, audio, document).
	 */
	sendFile: SendFile;
}
