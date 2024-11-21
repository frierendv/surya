import { Api, Baileys } from "@frierendv/frieren";
import { join } from "desm";
import { config as dotEnvConfig } from "dotenv";
import Pino from "pino";
import db from "./libs/database.js";
import FeatureLoader from "./libs/feature-loader.js";
import handler from "./libs/handler.js";
import { logger } from "./shared/logger.js";

dotEnvConfig();

const featureLoader = new FeatureLoader({
	dir: join(import.meta.url, "features"),
});
db.initialize();
featureLoader.initialize();

const api = new Api.Client({
	baseUrl: "https://api.itsrose.rest",
});

const client = new Baileys.WASocket({
	logger: Pino({ level: "silent" }),
});

// @ts-expect-error
client.store.bind(client);

client.on("message", (msg) =>
	// @ts-expect-error
	handler(client, msg, api, featureLoader.features)
);
client.on("connection.update", (update) => {
	const { connection, receivedPendingNotifications } = update;
	if (connection === "open") {
		logger.success("Connection opened");
	}
	if (receivedPendingNotifications) {
		logger.success("Ready to receive pending notifications");
	}
});
