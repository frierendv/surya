import { Api, Baileys } from "@frierendv/frieren";
import { join } from "desm";
import { config as dotEnvConfig } from "dotenv";
import config from "./config.js";
import db from "./libs/database.js";
import featureHandler from "./libs/feature-handler.js";
import FeatureLoader from "./libs/feature-loader.js";
import { middleware } from "./libs/middleware.js";
import { logger } from "./shared/logger.js";

dotEnvConfig();

const client = new Baileys.WASocket({
	prefix: config.prefix,
});

const featureLoader = new FeatureLoader({
	dir: join(import.meta.url, "features"),
});
db.initialize();
featureLoader.initialize();

const api = new Api.Client({
	baseUrl: process.env.ITSROSE_API_URL,
});

client.use(middleware);

client.on("message", (ctx) =>
	featureHandler(
		// @ts-expect-error
		ctx,
		api,
		{
			// This is the Trie
			featuresTrie: featureLoader.featuresTrie,
			// This is the Map
			featuresMap: featureLoader.featuresMap,
		}
	)
);

client.on("connection.update", (update) => {
	const { connection, receivedPendingNotifications } = update;
	if (connection === "open") {
		logger.success("Connection opened");
	}
	if (receivedPendingNotifications) {
		logger.success("Receive pending notifications");
	}
});

client.launch();
