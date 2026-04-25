import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgentSummary, AgentDetail } from "@controlplane/shared";
import { authFetch, fetchJson } from "./api.js";

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

export function useTerminateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agentId: string) => {
      const res = await authFetch(`/agents/${encodeURIComponent(agentId)}/terminate`, {
        method: "POST",
      });
      return res.json() as Promise<AgentDetail>;
    },
    onSuccess: (_data, agentId) => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
