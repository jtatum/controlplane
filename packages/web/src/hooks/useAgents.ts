import { useQuery } from "@tanstack/react-query";
import type { AgentSummary, AgentDetail } from "@controlplane/shared";
import { fetchJson } from "./api.js";

interface AgentListResponse {
  data: AgentSummary[];
  total: number;
  limit: number;
  offset: number;
}

export function useAgents() {
  return useQuery<AgentSummary[]>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetchJson<AgentListResponse>("/agents");
      return res.data;
    },
  });
}

export function useAgent(id: string) {
  return useQuery<AgentDetail>({
    queryKey: ["agents", id],
    queryFn: () => fetchJson<AgentDetail>(`/agents/${encodeURIComponent(id)}`),
    enabled: !!id,
  });
}
