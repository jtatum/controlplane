// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentDetailPage } from "./AgentDetailPage.js";
import type { AgentDetail } from "@controlplane/shared";

vi.mock("../hooks/useAgents.js", () => ({
  useAgent: vi.fn(),
  useTerminateAgent: vi.fn(),
}));

import { useAgent, useTerminateAgent } from "../hooks/useAgents.js";
const mockUseAgent = vi.mocked(useAgent);
const mockUseTerminateAgent = vi.mocked(useTerminateAgent);

function renderPage(id = "agent-1") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/agents/${id}`]}>
        <Routes>
          <Route path="/agents/:id" element={<AgentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const baseAgent: AgentDetail = {
  id: "agent-1",
  name: "Test Agent",
  agentName: "test-agent",
  environment: "dev",
  status: "running",
  version: "1.0.0",
  bedrockRegion: "us-east-1",
  createdAt: "2026-01-01T00:00:00Z",
  ownerId: "user-1",
  ec2InstanceId: "i-abc123",
  privateIp: "10.0.0.1",
  availabilityZone: "us-east-1a",
  instanceType: "c7g.large",
  provisionedAt: "2026-01-01T01:00:00Z",
  updatedAt: "2026-01-01T02:00:00Z",
  config: {
    model: { id: "anthropic.claude-sonnet-4-20250514-v1:0", temperature: 0.7, maxTokens: 4096 },
    gateway: { rateLimit: 60 },
    features: {},
  },
};

describe("AgentDetailPage", () => {
  let mutateFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mutateFn = vi.fn();
    mockUseTerminateAgent.mockReturnValue({
      mutate: mutateFn,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTerminateAgent>);
  });

  it("renders full config correctly", () => {
    mockUseAgent.mockReturnValue({
      data: baseAgent,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgent>);

    renderPage();

    expect(screen.getByText("anthropic.claude-sonnet-4-20250514-v1:0")).toBeTruthy();
    expect(screen.getByText("0.7")).toBeTruthy();
    expect(screen.getByText("4096")).toBeTruthy();
    expect(screen.getByText("60 req/min")).toBeTruthy();
  });

  it("renders safely with empty config object", () => {
    mockUseAgent.mockReturnValue({
      data: { ...baseAgent, config: {} as AgentDetail["config"] },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgent>);

    renderPage();

    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it("renders safely with missing model and gateway", () => {
    mockUseAgent.mockReturnValue({
      data: {
        ...baseAgent,
        config: { features: {} } as unknown as AgentDetail["config"],
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgent>);

    renderPage();

    expect(screen.queryByText(/req\/min/)).toBeNull();
  });

  it("renders safely with partial model (missing temperature)", () => {
    mockUseAgent.mockReturnValue({
      data: {
        ...baseAgent,
        config: {
          model: { id: "custom-model" } as AgentDetail["config"]["model"],
          gateway: { rateLimit: 100 },
          features: {},
        },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgent>);

    renderPage();

    expect(screen.getByText("custom-model")).toBeTruthy();
    expect(screen.getByText("100 req/min")).toBeTruthy();
  });

  it("renders loading state", () => {
    mockUseAgent.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useAgent>);

    renderPage();

    expect(screen.getByText("Loading agent...")).toBeTruthy();
  });

  it("renders not found state", () => {
    mockUseAgent.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgent>);

    renderPage();

    expect(screen.getByText("Agent not found.")).toBeTruthy();
  });

  describe("terminate button", () => {
    it("shows enabled terminate button for running agent", () => {
      mockUseAgent.mockReturnValue({
        data: baseAgent,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useAgent>);

      renderPage();

      const btn = screen.getByText("Terminate");
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });

    it("shows disabled terminate button for terminated agent", () => {
      mockUseAgent.mockReturnValue({
        data: { ...baseAgent, status: "terminated" },
        isLoading: false,
        error: null,
      } as ReturnType<typeof useAgent>);

      renderPage();

      const btn = screen.getByText("Terminate");
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it("shows disabled terminate button for stopping agent", () => {
      mockUseAgent.mockReturnValue({
        data: { ...baseAgent, status: "stopping" },
        isLoading: false,
        error: null,
      } as ReturnType<typeof useAgent>);

      renderPage();

      const btn = screen.getByText("Terminate");
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it("shows disabled terminate button for stopped agent", () => {
      mockUseAgent.mockReturnValue({
        data: { ...baseAgent, status: "stopped" },
        isLoading: false,
        error: null,
      } as ReturnType<typeof useAgent>);

      renderPage();

      const btn = screen.getByText("Terminate");
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it("shows confirmation dialog when terminate is clicked", () => {
      mockUseAgent.mockReturnValue({
        data: baseAgent,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useAgent>);

      renderPage();

      fireEvent.click(screen.getByText("Terminate"));

      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(screen.getByText(/This action cannot be undone/)).toBeTruthy();
      expect(screen.getByText("Confirm")).toBeTruthy();
      expect(screen.getByText("Cancel")).toBeTruthy();
    });

    it("calls mutate when confirm is clicked", () => {
      mockUseAgent.mockReturnValue({
        data: baseAgent,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useAgent>);

      renderPage();

      fireEvent.click(screen.getByText("Terminate"));
      fireEvent.click(screen.getByText("Confirm"));

      expect(mutateFn).toHaveBeenCalledWith("agent-1");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("hides confirmation dialog when cancel is clicked", () => {
      mockUseAgent.mockReturnValue({
        data: baseAgent,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useAgent>);

      renderPage();

      fireEvent.click(screen.getByText("Terminate"));
      expect(screen.getByRole("dialog")).toBeTruthy();

      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mutateFn).not.toHaveBeenCalled();
    });

    it("shows 'Terminating...' text while mutation is pending", () => {
      mockUseTerminateAgent.mockReturnValue({
        mutate: mutateFn,
        isPending: true,
        isSuccess: false,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useTerminateAgent>);

      mockUseAgent.mockReturnValue({
        data: baseAgent,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useAgent>);

      renderPage();

      expect(screen.getByText("Terminating...")).toBeTruthy();
      expect((screen.getByText("Terminating...") as HTMLButtonElement).disabled).toBe(true);
    });

    it("shows success message after termination", () => {
      mockUseTerminateAgent.mockReturnValue({
        mutate: mutateFn,
        isPending: false,
        isSuccess: true,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useTerminateAgent>);

      mockUseAgent.mockReturnValue({
        data: baseAgent,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useAgent>);

      renderPage();

      expect(screen.getByText(/termination initiated/)).toBeTruthy();
    });

    it("shows error message when termination fails", () => {
      mockUseTerminateAgent.mockReturnValue({
        mutate: mutateFn,
        isPending: false,
        isSuccess: false,
        isError: true,
        error: new Error("Agent is already terminated"),
      } as unknown as ReturnType<typeof useTerminateAgent>);

      mockUseAgent.mockReturnValue({
        data: baseAgent,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useAgent>);

      renderPage();

      expect(screen.getByText(/Termination failed/)).toBeTruthy();
    });
  });
});
