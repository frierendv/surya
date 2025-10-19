import { closeDatabase, initDatabase } from "@/libs/database";
import { logger } from "@/libs/logger";
import { connectToDatabase } from "@/libs/mongodb";
import pm from "@/libs/plugin-manager";
import { scheduler } from "@/libs/scheduler";
import { createSocket } from "@/socket";

const start = async () => {
	try {
		await connectToDatabase();
		logger.success("Connected to MongoDB");
		await initDatabase();
		logger.success("Database initialized");
	} catch (err) {
		logger.error({ err }, "Failed to initialize persistence layer");
		process.exit(1);
	}

	try {
		await pm.load();
		await pm.watch();
	} catch (err) {
		logger.error({ err }, "Plugin manager failed to initialize");
		process.exit(1);
	}

	const baileys = createSocket();

	try {
		await baileys.launch();
	} catch (err) {
		logger.error({ err }, "Failed to launch Baileys socket");
		process.exit(1);
	}

	const shutdown = async (signal: string) => {
		logger.fatal({ signal }, "Shutting down...");
		try {
			await baileys.stop();
			await closeDatabase();
			await pm.stop();
			scheduler.close();
			logger.info("Shutdown complete");
		} catch (err) {
			logger.error({ err }, "Error during shutdown");
		} finally {
			process.exit(0);
		}
	};

	scheduler.start();

	process.once("SIGINT", () => void shutdown("SIGINT"));
	process.once("SIGTERM", () => void shutdown("SIGTERM"));

	process.on("unhandledRejection", (reason) => {
		logger.fatal({ reason }, "Unhandled promise rejection");
		console.error(reason);
	});
	process.on("uncaughtException", (err) => {
		logger.fatal({ err }, "Uncaught exception");
		console.error(err);
	});
};

start().catch((err) => {
	logger.fatal({ err }, "Fatal error");
	process.exit(1);
});
