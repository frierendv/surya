import { Api, Baileys } from "@frierendv/frieren";
import { join } from "desm";
import { config as dotEnvConfig } from "dotenv";
import db from "./libs/database.js";
import FeatureLoader from "./libs/feature-loader.js";
import handler from "./libs/handler.js";

dotEnvConfig();

const featureLoader = new FeatureLoader({
	dir: join(import.meta.url, "features"),
});
db.initialize();
featureLoader.initialize();

const api = new Api.Client({
	baseUrl: "https://api.itsrose.rest",
});

const client = new Baileys.WASocket();

// @ts-expect-error
client.store.bind(client);

client.on("message", (msg) =>
	// @ts-expect-error
	handler(client, api, msg, featureLoader.features)
);
