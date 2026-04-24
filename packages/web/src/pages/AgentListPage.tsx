import { Link } from "react-router";
import { useAgents } from "../hooks/useAgents.js";
import { StatusBadge } from "../components/StatusBadge.js";

export function AgentListPage() {
  const { data: agents, isLoading, error } = useAgents();

  if (isLoading) return <p>Loading agents...</p>;
  if (error) return <p>Error loading agents: {String(error)}</p>;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Agents</h1>

      {!agents || agents.length === 0 ? (
        <p>No agents found.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#e9ecef",
                textAlign: "left",
              }}
            >
              <th style={{ padding: "0.75rem 1rem" }}>Name</th>
              <th style={{ padding: "0.75rem 1rem" }}>Agent Name</th>
              <th style={{ padding: "0.75rem 1rem" }}>Environment</th>
              <th style={{ padding: "0.75rem 1rem" }}>Status</th>
              <th style={{ padding: "0.75rem 1rem" }}>Version</th>
              <th style={{ padding: "0.75rem 1rem" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr
                key={agent.id}
                style={{ borderBottom: "1px solid #dee2e6" }}
              >
                <td style={{ padding: "0.75rem 1rem" }}>
                  <Link
                    to={`/agents/${agent.id}`}
                    style={{ color: "#0d6efd", textDecoration: "none" }}
                  >
                    {agent.name}
                  </Link>
                </td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    fontFamily: "monospace",
                    fontSize: "0.9rem",
                  }}
                >
                  {agent.agentName}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  {agent.environment}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <StatusBadge status={agent.status} />
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  {agent.version ?? "—"}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  {new Date(agent.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
