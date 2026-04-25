import { describe, it, expect } from "vitest";
import { hostname } from "node:os";
import {
  buildWorkerIdentity,
  MAX_CONCURRENT_WORKFLOW_TASKS,
  MAX_CONCURRENT_ACTIVITY_TASKS,
  TASK_QUEUE,
} from "./config.js";

describe("buildWorkerIdentity", () => {
  it("includes hostname and pid", () => {
    const identity = buildWorkerIdentity();
    expect(identity).toBe(`${hostname()}-${process.pid}`);
  });

  it("produces a non-empty string", () => {
    const identity = buildWorkerIdentity();
    expect(identity.length).toBeGreaterThan(0);
  });
});

describe("worker configuration", () => {
  it("defaults maxConcurrentWorkflowTaskExecutions to 100", () => {
    expect(MAX_CONCURRENT_WORKFLOW_TASKS).toBe(100);
  });

  it("defaults maxConcurrentActivityTaskExecutions to 200", () => {
    expect(MAX_CONCURRENT_ACTIVITY_TASKS).toBe(200);
  });

  it("defaults task queue to controlplane", () => {
    expect(TASK_QUEUE).toBe("controlplane");
  });
});
