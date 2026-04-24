import type { AgentStatus } from "@controlplane/shared";

const statusColors: Record<AgentStatus, string> = {
  requested: "#6c757d",
  provisioning: "#0d6efd",
  running: "#198754",
  updating: "#0dcaf0",
  stopping: "#ffc107",
  stopped: "#6c757d",
  terminated: "#dc3545",
  error: "#dc3545",
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.2rem 0.6rem",
        borderRadius: 12,
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "#fff",
        background: statusColors[status] ?? "#6c757d",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {status}
    </span>
  );
}
