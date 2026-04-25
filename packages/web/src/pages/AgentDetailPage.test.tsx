// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentDetailPage } from "./AgentDetailPage.js";
import type { AgentDetail } from "@controlplane/shared";

vi.mock("../hooks/useAgents.js", () => ({
  useAgent: vi.fn(),
}));

import { useAgent } from "../hooks/useAgents.js";
const mockUseAgent = vi.mocked(useAgent);

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
  beforeEach(() => {
    vi.clearAllMocks();
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
});
