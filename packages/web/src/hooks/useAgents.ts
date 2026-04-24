import { useQuery } from "@tanstack/react-query";
import type { AgentSummary, AgentDetail } from "@controlplane/shared";
import { fetchJson } from "./api.js";

export function useAgents() {
  return useQuery<AgentSummary[]>({
    queryKey: ["agents"],
    queryFn: () => fetchJson<AgentSummary[]>("/agents"),
  });
}

export function useAgent(id: string) {
  return useQuery<AgentDetail>({
    queryKey: ["agents", id],
    queryFn: () => fetchJson<AgentDetail>(`/agents/${encodeURIComponent(id)}`),
    enabled: !!id,
  });
}
