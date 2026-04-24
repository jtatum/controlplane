import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities.js";

const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? "controlplane";
const TEMPORAL_ADDRESS =
  process.env.TEMPORAL_ADDRESS ?? "localhost:7233";

async function run() {
  const connection = await NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  });

  const worker = await Worker.create({
    connection,
    namespace: "default",
    taskQueue: TASK_QUEUE,
    workflowsPath: new URL("./workflows.js", import.meta.url).pathname,
    activities,
  });

  console.log(`Temporal worker started on task queue: ${TASK_QUEUE}`);
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
