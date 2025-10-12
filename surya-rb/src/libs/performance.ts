import prettyHrtime from "pretty-hrtime";

const defaultName = "surya-rb";

interface PerfResult {
	name: string;
	time: string;
	timeH: string;
}

const timers = new Map<string, [number, number]>();

export const performance = {
	start: (name = defaultName) => {
		if (timers.has(name)) {
			// logger.warn(
			// 	{ name },
			// 	`Performance for ${name} has already started, restarting...`
			// );
		}
		timers.set(name, process.hrtime());
	},
	stop: (name = defaultName): PerfResult => {
		const start = timers.get(name);
		if (!start) {
			// logger.warn(
			// 	{ name },
			// 	`No performance timer found for ${name}, did you forget to call start()?`
			// );
			return { name, time: "0ms", timeH: "0ms" };
		}
		timers.delete(name);

		const diff = process.hrtime(start);

		return {
			name,
			time: prettyHrtime(diff),
			timeH: prettyHrtime(diff, { verbose: true }),
		};
	},
};

export const measureExecution = async <T>(
	fn: () => Promise<T> | T,
	name = defaultName
): Promise<{ result: T; performance: PerfResult }> => {
	name = "fn_exec_" + (name || "anonymous");
	performance.start(name);
	const result = await fn();
	const perf = performance.stop(name);
	return { result, performance: perf };
};
