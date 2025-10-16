import db from "@/libs/database";

const handler = async () => {
	const usersKey = await db.users.keys();
	for (const key of usersKey) {
		const user = await db.users.get(key);
		if (user) {
			const userLimit = user.limit || 100;
			// if user limit is less than default, reset to default
			if (user.limit === undefined || user.limit < 100) {
				user.limit = userLimit;
			}
			await user.save();
		}
	}
};

export const resetUserLimitJob = {
	handler,
	handlerKey: "reset-user-limit" as const,
	cronExpr: "0 0 * * *" as const,
	cronOptions: {
		maxRetries: 5,
		backoffMs: 1000,
	},
} as const;
