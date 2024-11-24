import { Baileys } from "@frierendv/frieren";
import config from "../config.js";

const client = new Baileys.WASocket({
	prefix: config.prefix,
});

export default client;
