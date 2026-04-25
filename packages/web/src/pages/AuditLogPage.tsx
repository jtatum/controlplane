import { useState } from "react";
import { useAuditLog } from "../hooks/useAuditLog.js";
import type { AuditLogFilters } from "../hooks/useAuditLog.js";

const ACTIONS = [
  "agent.create",
  "agent.update",
  "agent.terminate",
  "email.review.approved",
  "email.review.rejected",
];

const inputClasses =
  "px-3 py-1.5 rounded border border-gray-300 text-sm bg-white focus:outline-2 focus:outline-blue-500 focus:border-blue-500";

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Log</h1>

      <div className="flex gap-3 mb-4 flex-wrap items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Action</label>
          <select
            className={inputClasses}
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
          <label className="block text-xs text-gray-500 mb-0.5">
            Agent ID
          </label>
          <input
            className={inputClasses}
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
          <label className="block text-xs text-gray-500 mb-0.5">From</label>
          <input
            type="date"
            className={inputClasses}
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
          <label className="block text-xs text-gray-500 mb-0.5">To</label>
          <input
            type="date"
            className={inputClasses}
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

      {isLoading && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Action</th>
                <th className="px-3 py-2.5">Actor</th>
                <th className="px-3 py-2.5">Resource</th>
                <th className="px-3 py-2.5">Detail</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <p className="text-red-600">
          Error loading audit log: {String(error)}
        </p>
      )}

      {data && (
        <>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5">Action</th>
                  <th className="px-3 py-2.5">Actor</th>
                  <th className="px-3 py-2.5">Resource</th>
                  <th className="px-3 py-2.5">Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-4 text-center text-gray-400"
                    >
                      No audit entries found.
                    </td>
                  </tr>
                ) : (
                  data.data.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                          {entry.action}
                        </code>
                      </td>
                      <td className="px-3 py-2">
                        {entry.actorEmail ?? entry.actorId ?? "system"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-gray-500">
                          {entry.resourceType}
                        </span>{" "}
                        <code className="text-xs">
                          {entry.resourceId?.slice(0, 8) ?? "—"}
                        </code>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                        {JSON.stringify(entry.detail)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-3 text-sm text-gray-600">
            <span>
              {data.total} entries total — page {page + 1} of{" "}
              {Math.max(totalPages, 1)}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                  page === 0
                    ? "border-gray-200 text-gray-400 cursor-not-allowed"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
                }`}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                  page + 1 >= totalPages
                    ? "border-gray-200 text-gray-400 cursor-not-allowed"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
                }`}
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
