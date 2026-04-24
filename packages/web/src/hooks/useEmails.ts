import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EmailMessage } from "@controlplane/shared";
import { authFetch, fetchJson } from "./api.js";

interface EmailWithAgent extends EmailMessage {
  agentName: string;
}

interface EmailListResponse {
  messages: EmailWithAgent[];
  total: number;
  limit: number;
  offset: number;
}

export function useEmailsForReview(
  status: string,
  agentId: string,
) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (agentId) params.set("agentId", agentId);
  params.set("limit", "100");

  return useQuery<EmailListResponse>({
    queryKey: ["emails", "review", status, agentId],
    queryFn: () => fetchJson<EmailListResponse>(`/emails/review?${params}`),
  });
}

export function useReviewEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      status,
      note,
    }: {
      messageId: string;
      status: "approved" | "rejected";
      note?: string;
    }) => {
      const res = await authFetch(`/emails/${encodeURIComponent(messageId)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}
