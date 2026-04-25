import { useState } from "react";
import { useAuditLog } from "../hooks/useAuditLog.js";
import type { AuditLogFilters } from "../hooks/useAuditLog.js";

const inputStyle: React.CSSProperties = {
  padding: "0.4rem",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontSize: "0.85rem",
};

const ACTIONS = [
  "agent.create",
  "agent.update",
  "agent.terminate",
  "email.review.approved",
  "email.review.rejected",
];

export function AuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(0);

  const limit = 25;
  const activeFilters: AuditLogFilters = {
    ...filters,
    ...(actionFilter ? { action: actionFilter } : {}),
    limit,
    offset: page * limit,
  };

  const { data, isLoading, error } = useAuditLog(activeFilters);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Audit Log</h1>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <div>
          <label
            style={{ display: "block", fontSize: "0.75rem", marginBottom: 2 }}
          >
            Action
          </label>
          <select
            style={inputStyle}
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{ display: "block", fontSize: "0.75rem", marginBottom: 2 }}
          >
            Agent ID
          </label>
          <input
            style={inputStyle}
            placeholder="Filter by agent ID"
            value={filters.agentId ?? ""}
            onChange={(e) => {
              setFilters((f) => ({
                ...f,
                agentId: e.target.value || undefined,
              }));
              setPage(0);
            }}
          />
        </div>

        <div>
          <label
            style={{ display: "block", fontSize: "0.75rem", marginBottom: 2 }}
          >
            From
          </label>
          <input
            type="date"
            style={inputStyle}
            value={filters.from ?? ""}
            onChange={(e) => {
              setFilters((f) => ({
                ...f,
                from: e.target.value || undefined,
              }));
              setPage(0);
            }}
          />
        </div>

        <div>
          <label
            style={{ display: "block", fontSize: "0.75rem", marginBottom: 2 }}
          >
            To
          </label>
          <input
            type="date"
            style={inputStyle}
            value={filters.to ?? ""}
            onChange={(e) => {
              setFilters((f) => ({
                ...f,
                to: e.target.value || undefined,
              }));
              setPage(0);
            }}
          />
        </div>
      </div>

      {isLoading && <p>Loading audit log...</p>}
      {error && <p>Error loading audit log: {String(error)}</p>}

      {data && (
        <>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#fff",
              borderRadius: 8,
              overflow: "hidden",
              fontSize: "0.9rem",
            }}
          >
            <thead>
              <tr style={{ background: "#e9ecef", textAlign: "left" }}>
                <th style={{ padding: "0.6rem 0.75rem" }}>Time</th>
                <th style={{ padding: "0.6rem 0.75rem" }}>Action</th>
                <th style={{ padding: "0.6rem 0.75rem" }}>Actor</th>
                <th style={{ padding: "0.6rem 0.75rem" }}>Resource</th>
                <th style={{ padding: "0.6rem 0.75rem" }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.data.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: "1rem", textAlign: "center", color: "#888" }}
                  >
                    No audit entries found.
                  </td>
                </tr>
              ) : (
                data.data.map((entry) => (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: "1px solid #dee2e6" }}
                  >
                    <td
                      style={{
                        padding: "0.5rem 0.75rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <code style={{ fontSize: "0.8rem" }}>{entry.action}</code>
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      {entry.actorEmail ?? entry.actorId ?? "system"}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "#666" }}>
                        {entry.resourceType}
                      </span>{" "}
                      <code style={{ fontSize: "0.75rem" }}>
                        {entry.resourceId?.slice(0, 8) ?? "—"}
                      </code>
                    </td>
                    <td
                      style={{
                        padding: "0.5rem 0.75rem",
                        fontSize: "0.8rem",
                        color: "#555",
                        maxWidth: 300,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {JSON.stringify(entry.detail)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "0.75rem",
              fontSize: "0.85rem",
            }}
          >
            <span>
              {data.total} entries total — page {page + 1} of{" "}
              {Math.max(totalPages, 1)}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  padding: "0.3rem 0.75rem",
                  cursor: page === 0 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  padding: "0.3rem 0.75rem",
                  cursor: page + 1 >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
