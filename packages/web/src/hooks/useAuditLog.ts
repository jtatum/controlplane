import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "./api.js";

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorType: string;
  actorEmail: string | null;
  agentId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  detail: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditLogResponse {
  data: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogFilters {
  agentId?: string;
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export function useAuditLog(filters: AuditLogFilters = {}) {
  const params = new URLSearchParams();
  if (filters.agentId) params.set("agentId", filters.agentId);
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.action) params.set("action", filters.action);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));

  const qs = params.toString();
  const path = `/audit-log${qs ? `?${qs}` : ""}`;

  return useQuery<AuditLogResponse>({
    queryKey: ["audit-log", filters],
    queryFn: () => fetchJson<AuditLogResponse>(path),
  });
}
