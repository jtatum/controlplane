import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities.js";
import {
  TASK_QUEUE,
  TEMPORAL_ADDRESS,
  MAX_CONCURRENT_WORKFLOW_TASKS,
  MAX_CONCURRENT_ACTIVITY_TASKS,
  buildWorkerIdentity,
} from "./config.js";
import { logger } from "./logger.js";
import { startHealthServer } from "./health.js";

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
      import.meta.url.endsWith(".ts") ? "./workflows.ts" : "./workflows.js",
      import.meta.url,
    ).pathname,
    activities,
    identity,
    maxConcurrentWorkflowTaskExecutions: MAX_CONCURRENT_WORKFLOW_TASKS,
    maxConcurrentActivityTaskExecutions: MAX_CONCURRENT_ACTIVITY_TASKS,
  });

  startHealthServer();

  logger.info(
    {
      identity,
      taskQueue: TASK_QUEUE,
      maxWorkflows: MAX_CONCURRENT_WORKFLOW_TASKS,
      maxActivities: MAX_CONCURRENT_ACTIVITY_TASKS,
    },
    "temporal worker started",
  );
  await worker.run();
}

run().catch((err) => {
  logger.fatal({ err }, "worker failed");
  process.exit(1);
});
