import { useState } from "react";
import { useEmailsForReview, useReviewEmail } from "../hooks/useEmails.js";

type DirectionFilter = "" | "inbound" | "outbound";
type StatusFilter = "pending" | "approved" | "rejected";

const cellStyle = { padding: "0.75rem 1rem" } as const;

const reviewStatusColors: Record<string, string> = {
  pending: "#ffc107",
  approved: "#198754",
  rejected: "#dc3545",
};

function ReviewBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.2rem 0.6rem",
        borderRadius: 12,
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "#fff",
        background: reviewStatusColors[status] ?? "#6c757d",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {status}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isInbound = direction === "inbound";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.2rem 0.6rem",
        borderRadius: 12,
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "#fff",
        background: isInbound ? "#0d6efd" : "#6f42c1",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {direction}
    </span>
  );
}

export function EmailReviewPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("");
  const [agentFilter, setAgentFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useEmailsForReview(statusFilter, agentFilter);
  const reviewMutation = useReviewEmail();

  const messages = data?.messages ?? [];

  const filtered = directionFilter
    ? messages.filter((m) => m.direction === directionFilter)
    : messages;

  const agents = Array.from(
    new Map(messages.map((m) => [m.agentId, m.agentName])),
  );

  function handleReview(messageId: string, status: "approved" | "rejected") {
    reviewMutation.mutate({ messageId, status });
    if (expandedId === messageId) setExpandedId(null);
  }

  const selectStyle = {
    padding: "0.4rem 0.6rem",
    borderRadius: 4,
    border: "1px solid #ced4da",
    fontSize: "0.9rem",
    background: "#fff",
  } as const;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Email Review</h1>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label>
          Status:{" "}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={selectStyle}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>

        <label>
          Direction:{" "}
          <select
            value={directionFilter}
            onChange={(e) =>
              setDirectionFilter(e.target.value as DirectionFilter)
            }
            style={selectStyle}
          >
            <option value="">All</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </label>

        <label>
          Agent:{" "}
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">All agents</option>
            {agents.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>

        {data && (
          <span style={{ color: "#6c757d", fontSize: "0.85rem" }}>
            {filtered.length} of {data.total} emails
          </span>
        )}
      </div>

      {isLoading && <p>Loading emails...</p>}
      {error && <p>Error loading emails: {String(error)}</p>}

      {!isLoading && !error && filtered.length === 0 && (
        <p>No emails found.</p>
      )}

      {filtered.length > 0 && (
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
            <tr style={{ background: "#e9ecef", textAlign: "left" }}>
              <th style={cellStyle}>Direction</th>
              <th style={cellStyle}>Agent</th>
              <th style={cellStyle}>Sender</th>
              <th style={cellStyle}>Recipient</th>
              <th style={cellStyle}>Subject</th>
              <th style={cellStyle}>Status</th>
              <th style={cellStyle}>Received</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((msg) => (
              <EmailRow
                key={msg.id}
                msg={msg}
                expanded={expandedId === msg.id}
                onToggle={() =>
                  setExpandedId(expandedId === msg.id ? null : msg.id)
                }
                onReview={handleReview}
                reviewing={
                  reviewMutation.isPending &&
                  reviewMutation.variables?.messageId === msg.id
                }
                isPending={statusFilter === "pending"}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EmailRow({
  msg,
  expanded,
  onToggle,
  onReview,
  reviewing,
  isPending,
}: {
  msg: {
    id: string;
    direction: string;
    agentName: string;
    sender: string;
    recipients: string[];
    subject: string;
    reviewStatus: string;
    createdAt: string;
    bodyText: string | null;
    bodyHtml: string | null;
  };
  expanded: boolean;
  onToggle: () => void;
  onReview: (id: string, status: "approved" | "rejected") => void;
  reviewing: boolean;
  isPending: boolean;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: expanded ? "none" : "1px solid #dee2e6",
          cursor: "pointer",
          background: expanded ? "#f8f9fa" : undefined,
        }}
      >
        <td style={cellStyle}>
          <DirectionBadge direction={msg.direction} />
        </td>
        <td style={cellStyle}>{msg.agentName}</td>
        <td style={{ ...cellStyle, fontSize: "0.9rem" }}>{msg.sender}</td>
        <td style={{ ...cellStyle, fontSize: "0.9rem" }}>
          {msg.recipients.join(", ")}
        </td>
        <td style={cellStyle}>{msg.subject}</td>
        <td style={cellStyle}>
          <ReviewBadge status={msg.reviewStatus} />
        </td>
        <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
          {new Date(msg.createdAt).toLocaleString()}
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: "1px solid #dee2e6" }}>
          <td colSpan={7} style={{ padding: "1rem 1.5rem", background: "#f8f9fa" }}>
            <div
              style={{
                background: "#fff",
                border: "1px solid #dee2e6",
                borderRadius: 4,
                padding: "1rem",
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                maxHeight: 400,
                overflow: "auto",
              }}
            >
              {msg.bodyText ?? "(no text body)"}
            </div>

            {isPending && (
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "0.75rem",
                }}
              >
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReview(msg.id, "approved");
                  }}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: 4,
                    border: "none",
                    background: "#198754",
                    color: "#fff",
                    cursor: reviewing ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    opacity: reviewing ? 0.6 : 1,
                  }}
                >
                  {reviewing ? "..." : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReview(msg.id, "rejected");
                  }}
                  style={{
                    padding: "0.4rem 1rem",
                    borderRadius: 4,
                    border: "none",
                    background: "#dc3545",
                    color: "#fff",
                    cursor: reviewing ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    opacity: reviewing ? 0.6 : 1,
                  }}
                >
                  {reviewing ? "..." : "Reject"}
                </button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
