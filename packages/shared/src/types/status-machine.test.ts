import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  allowedTransitions,
  InvalidStatusTransitionError,
} from "./status-machine.js";
import type { AgentStatus } from "./enums.js";

describe("canTransition", () => {
  const valid: [AgentStatus, AgentStatus][] = [
    ["requested", "provisioning"],
    ["requested", "error"],
    ["provisioning", "running"],
    ["provisioning", "stopping"],
    ["provisioning", "error"],
    ["running", "updating"],
    ["running", "stopping"],
    ["running", "error"],
    ["updating", "running"],
    ["updating", "stopping"],
    ["updating", "error"],
    ["stopping", "stopped"],
    ["stopping", "error"],
    ["stopped", "terminated"],
    ["error", "provisioning"],
    ["error", "stopping"],
    ["error", "terminated"],
  ];

  it.each(valid)("%s → %s is valid", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  const invalid: [AgentStatus, AgentStatus][] = [
    ["requested", "running"],
    ["requested", "terminated"],
    ["provisioning", "terminated"],
    ["running", "provisioning"],
    ["running", "terminated"],
    ["updating", "terminated"],
    ["stopping", "running"],
    ["stopped", "running"],
    ["terminated", "running"],
    ["terminated", "provisioning"],
    ["terminated", "error"],
  ];

  it.each(invalid)("%s → %s is invalid", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe("assertTransition", () => {
  it("does not throw for valid transitions", () => {
    expect(() => assertTransition("running", "stopping")).not.toThrow();
  });

  it("throws InvalidStatusTransitionError for invalid transitions", () => {
    expect(() => assertTransition("terminated", "running")).toThrow(
      InvalidStatusTransitionError,
    );
  });

  it("includes from and to in error", () => {
    try {
      assertTransition("stopped", "running");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidStatusTransitionError);
      const e = err as InvalidStatusTransitionError;
      expect(e.from).toBe("stopped");
      expect(e.to).toBe("running");
      expect(e.message).toContain("stopped");
      expect(e.message).toContain("running");
    }
  });
});

describe("allowedTransitions", () => {
  it("returns allowed targets for running", () => {
    expect(allowedTransitions("running")).toEqual(["updating", "stopping", "error"]);
  });

  it("returns empty array for terminated", () => {
    expect(allowedTransitions("terminated")).toEqual([]);
  });
});
