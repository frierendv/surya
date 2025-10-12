export interface UserSchema {
	name: string;
	age: number;
	money?: number;
	[key: string]: any;
}

export interface GroupSchema {
	name: string;
}

export interface SettingsSchema {
	[key: string]: any;
}

export interface DatabaseSchema {
	users: UserSchema;
	groups: GroupSchema;
	settings: SettingsSchema;
}
