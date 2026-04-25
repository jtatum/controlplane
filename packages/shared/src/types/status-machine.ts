import type { AgentStatus } from "./enums.js";

const VALID_TRANSITIONS: Record<AgentStatus, readonly AgentStatus[]> = {
  requested: ["provisioning", "error"],
  provisioning: ["running", "stopping", "error"],
  running: ["updating", "stopping", "error"],
  updating: ["running", "stopping", "error"],
  stopping: ["stopped", "error"],
  stopped: ["terminated"],
  terminated: [],
  error: ["provisioning", "stopping", "terminated"],
};

export function canTransition(from: AgentStatus, to: AgentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: AgentStatus, to: AgentStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

export class InvalidStatusTransitionError extends Error {
  public readonly from: AgentStatus;
  public readonly to: AgentStatus;

  constructor(from: AgentStatus, to: AgentStatus) {
    super(`Invalid status transition: ${from} → ${to}`);
    this.name = "InvalidStatusTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function allowedTransitions(from: AgentStatus): readonly AgentStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}
