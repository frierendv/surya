export type AnyObject = Record<string, any>;

export type TPluginInfo = {
	executions: number;
	lastExecution: number;
};

export type TUser<Extra extends AnyObject = AnyObject> = Extra & {
	age: number;
	money: number;
	limit: number;
	plugins: Record<string, TPluginInfo>;
};

export type TDatabase = {
	users: TUser;
	groups: AnyObject;
	settings: AnyObject;
};
