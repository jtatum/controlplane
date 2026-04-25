import { Link } from "react-router";
import { useAgents } from "../hooks/useAgents.js";
import { StatusBadge } from "../components/StatusBadge.js";

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function AgentListPage() {
  const { data: agents, isLoading, error } = useAgents();

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
        </div>
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Agent Name</th>
                <th className="px-4 py-3">Environment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) return <p className="text-red-600">Error loading agents: {String(error)}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
        <Link
          to="/agents/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-600 transition-colors"
        >
          + New Agent
        </Link>
      </div>

      {!agents || agents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">No agents found.</p>
          <Link
            to="/agents/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create your first agent
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Agent Name</th>
                <th className="px-4 py-3">Environment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr
                  key={agent.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/agents/${agent.id}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      {agent.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-600">
                    {agent.agentName}
                  </td>
                  <td className="px-4 py-3">{agent.environment}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="px-4 py-3">{agent.version ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(agent.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
