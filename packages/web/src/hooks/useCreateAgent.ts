import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgentDetail, CreateAgentInput } from "@controlplane/shared";
import { authFetch } from "./api.js";

export function useCreateAgent() {
  const qc = useQueryClient();

  return useMutation<AgentDetail, Error, CreateAgentInput>({
    mutationFn: async (input) => {
      const res = await authFetch("/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return res.json() as Promise<AgentDetail>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
