import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities.js";
import {
  TASK_QUEUE,
  TEMPORAL_ADDRESS,
  MAX_CONCURRENT_WORKFLOW_TASKS,
  MAX_CONCURRENT_ACTIVITY_TASKS,
  buildWorkerIdentity,
} from "./config.js";

async function run() {
  const connection = await NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  });

  const identity = buildWorkerIdentity();

  const worker = await Worker.create({
    connection,
    namespace: "default",
    taskQueue: TASK_QUEUE,
    workflowsPath: new URL(
      import.meta.url.endsWith(".ts")
        ? "./workflows.ts"
        : "./workflows.js",
      import.meta.url,
    ).pathname,
    activities,
    identity,
    maxConcurrentWorkflowTaskExecutions: MAX_CONCURRENT_WORKFLOW_TASKS,
    maxConcurrentActivityTaskExecutions: MAX_CONCURRENT_ACTIVITY_TASKS,
  });

  console.log(
    `Temporal worker started: identity=${identity} queue=${TASK_QUEUE} workflows=${MAX_CONCURRENT_WORKFLOW_TASKS} activities=${MAX_CONCURRENT_ACTIVITY_TASKS}`,
  );
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
