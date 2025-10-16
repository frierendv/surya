export interface UserSchema {
	age: number;
	money: number;
	limit: number;
	plugins: {
		[key: string]: {
			executions: number;
			lastExecution: number;
		};
	};
	[key: string]: any;
}

export interface GroupSchema {
	[key: string]: any;
}

export interface SettingsSchema {
	[key: string]: any;
}

export interface DatabaseSchema {
	users: UserSchema;
	groups: GroupSchema;
	settings: SettingsSchema;
}
