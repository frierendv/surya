import { logger } from "@libs/logger";
import type { WASocket } from "@surya/baileys-utils";
import { readEnv } from "@surya/core/read-env";
import QRCode from "qrcode";

let pairingRequested = false;
const envBotNumber = readEnv("SR_BOT_NUMBER");

export const requestPairing = async (qr: string, socket?: WASocket | null) => {
	if (!socket || socket.authState.creds.registered) {
		return;
	}

	if (envBotNumber && !pairingRequested) {
		try {
			const phoneNumber = envBotNumber.replace(/\D+/g, "");
			const code = await socket.requestPairingCode(phoneNumber);
			logger.info("Pairing code generated");
			console.log(`Pairing code: ${code}.`);
			pairingRequested = true;
			return;
		} catch (err) {
			logger.error({ err }, "Failed to request pairing code");
			// fallthrough to QR
		}
	}

	try {
		const qrStr = await QRCode.toString(qr, {
			type: "terminal",
			small: true,
		});
		console.log(qrStr);
	} catch (err) {
		logger.error({ err }, "Failed to generate QR code");
	}
};
