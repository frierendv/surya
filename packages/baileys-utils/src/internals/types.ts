import type {
	AnyMediaMessageContent,
	AnyMessageContent,
	WASocket as BaileysWASocket,
	MiscMessageGenerationOptions,
} from "baileys";

export interface WASocket extends BaileysWASocket {
	/**
	 * Sends a file to the given JID. The content can be a URL, local file path, data URL, or Buffer.
	 *
	 * It automatically detects the file type
	 * and sends it as the appropriate media type (image, video, audio, document).
	 */
	sendFile: (
		jid: string,
		content: any,
		options?: Partial<AnyMessageContent> | null,
		miscOptions?: MiscMessageGenerationOptions
	) => Promise<AnyMediaMessageContent>;
}
