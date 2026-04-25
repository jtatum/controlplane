import { hostname } from "node:os";

export const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? "controlplane";
export const TEMPORAL_ADDRESS =
  process.env.TEMPORAL_ADDRESS ?? "localhost:7233";

export const MAX_CONCURRENT_WORKFLOW_TASKS = parseInt(
  process.env.MAX_CONCURRENT_WORKFLOW_TASKS ?? "100",
  10,
);
export const MAX_CONCURRENT_ACTIVITY_TASKS = parseInt(
  process.env.MAX_CONCURRENT_ACTIVITY_TASKS ?? "200",
  10,
);

export function buildWorkerIdentity(): string {
  return `${hostname()}-${process.pid}`;
}
