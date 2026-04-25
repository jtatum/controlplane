import { auditLog } from "@controlplane/shared";
import { db } from "./db.js";

export interface AuditEntry {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  agentId?: string | null;
  detail?: Record<string, unknown>;
  ipAddress?: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    actorType: "user",
    agentId: entry.agentId ?? null,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    detail: entry.detail ?? {},
    ipAddress: entry.ipAddress ?? null,
  });
}
