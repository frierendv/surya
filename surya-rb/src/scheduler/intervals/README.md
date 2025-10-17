# scheduler/intervals

Interval-based jobs registered at startup. Export jobs from `index.ts` within this folder.

## Creating new interval jobs

To add a new interval job, create a new file in this folder and define a job handler. The handler should conform to the `JobHandler` type from `@surya/job-scheduler`.

Example:

```ts
import { interval } from "@/libs/scheduler";
import type { JobHandler, JobRecord } from "@surya/job-scheduler";

type MyJobData = {
  // custom data shape for this job
  foo: string;
};

const handlerKey = "my-interval-job";
const myHandler: JobHandler<MyJobData> = async (data: JobRecord) => {
  const { foo } = data;
  // job logic here
  console.log(`Running my job with foo=${foo}`);
};


export const myIntervalJob = {
 handlerKey,
 handler: myHandler,
}
```

Then, export the job from `index.ts`:

To schedule the job, use it in plugin code or elsewhere:

```ts
import { interval } from "@/libs/scheduler";
import type { Plugin } from "@surya/plugin-manager";

const doJob: Plugin = {
  name: "do-my-job",
  command: ["dojob"],
  category: ["utility"],
  description: "Trigger my interval job",
  async execute(ctx, { sock }) {
    const delayMs = 20 * 1000; // 20 seconds
    const jobData = { foo: "bar" }; // custom data for the job
    const options = { maxRuns: 5, maxRetries: 2 }; // optional job options

    interval.add("any-unique-id", delayMs, "my-interval-job", jobData, options);

    await sock.sendMessage(ctx.from, { text: "Scheduling job..." });
  },
};
```

> [!TIP]
>
> - Use `interval.add` to schedule a job with a unique ID, delay, handler key, and optional data and options.
> - Jobs are persistent and will survive restarts.
