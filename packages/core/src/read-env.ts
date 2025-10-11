type DefaultValue = string | (() => string);

export interface ReadEnvOptions {
	/** If true, throw if the environment variable is not set */
	required?: boolean;
	/** Default value or function to generate default value if the environment variable is not set */
	defaultValue?: DefaultValue;
	/** Custom error message if the environment variable is required but not set */
	error?: string;
}

export function readEnv(
	key: string,
	options: ReadEnvOptions & { required: true }
): string;
export function readEnv(
	key: string,
	options: ReadEnvOptions & { defaultValue: DefaultValue }
): string;
export function readEnv(
	key: string,
	options?: ReadEnvOptions
): string | undefined;
export function readEnv(key: string, options: ReadEnvOptions = {}) {
	const v = process.env[key];
	if (v !== undefined) {
		return v;
	}

	if (options.required) {
		throw new Error(
			options.error ?? `Environment variable ${key} is required`
		);
	}

	const def = options.defaultValue;
	return typeof def === "function" ? def() : def;
}
