// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentListPage } from "./AgentListPage.js";
import type { AgentSummary } from "@controlplane/shared";

vi.mock("../hooks/useAgents.js", () => ({
  useAgents: vi.fn(),
}));

import { useAgents } from "../hooks/useAgents.js";
const mockUseAgents = vi.mocked(useAgents);

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AgentListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const agent1: AgentSummary = {
  id: "a1",
  name: "My Agent",
  agentName: "my-agent",
  environment: "dev",
  status: "running",
  version: "1.2.0",
  bedrockRegion: "us-east-1",
  createdAt: "2026-03-15T12:00:00Z",
};

const agent2: AgentSummary = {
  id: "a2",
  name: "Prod Bot",
  agentName: "prod-bot",
  environment: "prod",
  status: "stopped",
  version: null,
  bedrockRegion: "us-east-1",
  createdAt: "2026-04-01T08:00:00Z",
};

describe("AgentListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state with skeleton", () => {
    mockUseAgents.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useAgents>);

    renderPage();

    expect(screen.getByText("Agents")).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
  });

  it("renders error state", () => {
    mockUseAgents.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Server error"),
    } as ReturnType<typeof useAgents>);

    renderPage();

    expect(screen.getByText(/Error loading agents/)).toBeTruthy();
  });

  it("renders empty state when no agents", () => {
    mockUseAgents.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>);

    renderPage();

    expect(screen.getByText("No agents found.")).toBeTruthy();
  });

  it("renders empty state when data is undefined", () => {
    mockUseAgents.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>);

    renderPage();

    expect(screen.getByText("No agents found.")).toBeTruthy();
  });

  it("renders agents in a table", () => {
    mockUseAgents.mockReturnValue({
      data: [agent1, agent2],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>);

    renderPage();

    expect(screen.getByText("My Agent")).toBeTruthy();
    expect(screen.getByText("my-agent")).toBeTruthy();
    expect(screen.getByText("Prod Bot")).toBeTruthy();
    expect(screen.getByText("prod-bot")).toBeTruthy();
  });

  it("renders table headers", () => {
    mockUseAgents.mockReturnValue({
      data: [agent1],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>);

    renderPage();

    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Agent Name")).toBeTruthy();
    expect(screen.getByText("Environment")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Version")).toBeTruthy();
    expect(screen.getByText("Created")).toBeTruthy();
  });

  it("renders status badges", () => {
    mockUseAgents.mockReturnValue({
      data: [agent1, agent2],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>);

    renderPage();

    expect(screen.getByText("running")).toBeTruthy();
    expect(screen.getByText("stopped")).toBeTruthy();
  });

  it("renders version or dash for null version", () => {
    mockUseAgents.mockReturnValue({
      data: [agent1, agent2],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>);

    renderPage();

    expect(screen.getByText("1.2.0")).toBeTruthy();
    const cells = screen.getAllByRole("cell");
    const versionCells = cells.filter((c) => c.textContent === "—");
    expect(versionCells.length).toBeGreaterThanOrEqual(1);
  });

  it("renders agent names as links to detail page", () => {
    mockUseAgents.mockReturnValue({
      data: [agent1],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>);

    renderPage();

    const link = screen.getByText("My Agent").closest("a");
    expect(link).toBeTruthy();
    expect(link!.getAttribute("href")).toBe("/agents/a1");
  });
});
