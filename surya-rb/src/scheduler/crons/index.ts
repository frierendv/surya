import { resetUserLimitJob } from "./user";

export const cronJobs = [resetUserLimitJob] as const;
