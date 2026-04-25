import { useState } from "react";
import { useEmailsForReview, useReviewEmail } from "../hooks/useEmails.js";

type DirectionFilter = "" | "inbound" | "outbound";
type StatusFilter = "pending" | "approved" | "rejected";

const reviewStatusClasses: Record<string, string> = {
  pending: "bg-yellow-500",
  approved: "bg-green-600",
  rejected: "bg-red-600",
};

function ReviewBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold text-white uppercase tracking-wide ${reviewStatusClasses[status] ?? "bg-gray-500"}`}
    >
      {status}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold text-white uppercase tracking-wide ${
        direction === "inbound" ? "bg-blue-600" : "bg-purple-600"
      }`}
    >
      {direction}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function EmailReviewPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("");
  const [agentFilter, setAgentFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useEmailsForReview(
    statusFilter,
    agentFilter,
  );
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

  const selectClasses =
    "px-3 py-1.5 rounded border border-gray-300 text-sm bg-white focus:outline-2 focus:outline-blue-500 focus:border-blue-500";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Email Review</h1>

      <div className="flex gap-4 mb-4 items-center flex-wrap">
        <label className="text-sm">
          Status:{" "}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={selectClasses}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>

        <label className="text-sm">
          Direction:{" "}
          <select
            value={directionFilter}
            onChange={(e) =>
              setDirectionFilter(e.target.value as DirectionFilter)
            }
            className={selectClasses}
          >
            <option value="">All</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </label>

        <label className="text-sm">
          Agent:{" "}
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className={selectClasses}
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
          <span className="text-gray-500 text-sm">
            {filtered.length} of {data.total} emails
          </span>
        )}
      </div>

      {isLoading && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Sender</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && isLoading === false && (
        <>
          {error && (
            <p className="text-red-600">
              Error loading emails: {String(error)}
            </p>
          )}

          {!error && filtered.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-500 text-lg">No emails found.</p>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Direction</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Sender</th>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Received</th>
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
            </div>
          )}
        </>
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
        className={`border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
          expanded ? "bg-gray-50" : ""
        }`}
      >
        <td className="px-4 py-3">
          <DirectionBadge direction={msg.direction} />
        </td>
        <td className="px-4 py-3">{msg.agentName}</td>
        <td className="px-4 py-3 text-sm">{msg.sender}</td>
        <td className="px-4 py-3 text-sm">{msg.recipients.join(", ")}</td>
        <td className="px-4 py-3">{msg.subject}</td>
        <td className="px-4 py-3">
          <ReviewBadge status={msg.reviewStatus} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-gray-500">
          {new Date(msg.createdAt).toLocaleString()}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-100">
          <td colSpan={7} className="p-4 bg-gray-50">
            <div className="bg-white border border-gray-200 rounded p-4 whitespace-pre-wrap font-mono text-sm max-h-96 overflow-auto">
              {msg.bodyText ?? "(no text body)"}
            </div>

            {isPending && (
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReview(msg.id, "approved");
                  }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors cursor-pointer ${
                    reviewing
                      ? "bg-green-400 cursor-not-allowed opacity-60"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
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
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors cursor-pointer ${
                    reviewing
                      ? "bg-red-400 cursor-not-allowed opacity-60"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
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
