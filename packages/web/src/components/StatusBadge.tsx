import type { AgentStatus } from "@controlplane/shared";

const statusClasses: Record<AgentStatus, string> = {
  requested: "bg-gray-500",
  provisioning: "bg-blue-500",
  running: "bg-green-600",
  updating: "bg-cyan-500",
  stopping: "bg-yellow-500",
  stopped: "bg-gray-500",
  terminated: "bg-red-600",
  error: "bg-red-600",
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold text-white uppercase tracking-wide ${statusClasses[status] ?? "bg-gray-500"}`}
    >
      {status}
    </span>
  );
}
