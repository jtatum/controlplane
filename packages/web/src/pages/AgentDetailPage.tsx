import { useState } from "react";
import { useParams, Link } from "react-router";
import { useAgent, useTerminateAgent } from "../hooks/useAgents.js";
import { StatusBadge } from "../components/StatusBadge.js";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <dt className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">
        {label}
      </dt>
      <dd className="text-[0.95rem]">{children}</dd>
    </div>
  );
}

function SkeletonField() {
  return (
    <div className="mb-3">
      <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-1.5" />
      <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}

const TERMINAL_STATUSES = new Set(["terminated", "stopping", "stopped"]);

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: agent, isLoading, error } = useAgent(id!);
  const terminateMutation = useTerminateAgent();
  const [showConfirm, setShowConfirm] = useState(false);

  if (isLoading) {
    return (
      <div>
        <div className="mb-4">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-lg shadow-sm">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
              {Array.from({ length: 4 }).map((_, j) => (
                <SkeletonField key={j} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error)
    return <p className="text-red-600">Error loading agent: {String(error)}</p>;
  if (!agent) return <p className="text-gray-500">Agent not found.</p>;

  const canTerminate =
    !TERMINAL_STATUSES.has(agent.status) && !terminateMutation.isPending;

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/"
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          &larr; All agents
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
        <StatusBadge status={agent.status} />
        <button
          type="button"
          disabled={!canTerminate}
          onClick={() => setShowConfirm(true)}
          className={`ml-auto px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors cursor-pointer ${
            canTerminate
              ? "bg-red-600 hover:bg-red-700 focus:outline-2 focus:outline-offset-2 focus:outline-red-600"
              : "bg-gray-400 opacity-60 cursor-not-allowed"
          }`}
        >
          {terminateMutation.isPending ? "Terminating..." : "Terminate"}
        </button>
      </div>

      {showConfirm && (
        <div
          role="dialog"
          aria-label="Confirm termination"
          className="bg-amber-50 border border-amber-400 rounded-lg px-6 py-4 mb-4 flex items-center gap-4"
        >
          <span>
            Terminate <strong>{agent.name}</strong>? This action cannot be
            undone.
          </span>
          <button
            type="button"
            onClick={() => {
              terminateMutation.mutate(agent.id);
              setShowConfirm(false);
            }}
            className="px-4 py-1.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors cursor-pointer"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            className="px-4 py-1.5 rounded-lg border border-gray-300 bg-white text-sm hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {terminateMutation.isSuccess && (
        <div className="bg-green-50 border border-green-600 rounded-lg px-4 py-3 mb-4 text-green-800">
          Agent termination initiated. Status will update shortly.
        </div>
      )}

      {terminateMutation.isError && (
        <div className="bg-red-50 border border-red-600 rounded-lg px-4 py-3 mb-4 text-red-800">
          Termination failed: {String(terminateMutation.error)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-lg shadow-sm">
        <section>
          <h3 className="mt-0 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 mb-4">
            General
          </h3>
          <dl>
            <Field label="Agent Name">
              <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
                {agent.agentName}
              </code>
            </Field>
            <Field label="Environment">{agent.environment}</Field>
            <Field label="Version">{agent.version ?? "—"}</Field>
            <Field label="Region">{agent.bedrockRegion}</Field>
            <Field label="Created">
              {new Date(agent.createdAt).toLocaleString()}
            </Field>
            {agent.provisionedAt && (
              <Field label="Provisioned">
                {new Date(agent.provisionedAt).toLocaleString()}
              </Field>
            )}
          </dl>
        </section>

        <section>
          <h3 className="mt-0 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 mb-4">
            Infrastructure
          </h3>
          <dl>
            <Field label="Instance Type">{agent.instanceType}</Field>
            <Field label="EC2 Instance">{agent.ec2InstanceId ?? "—"}</Field>
            <Field label="Private IP">{agent.privateIp ?? "—"}</Field>
            <Field label="Availability Zone">
              {agent.availabilityZone ?? "—"}
            </Field>
          </dl>
        </section>

        <section className="md:col-span-2">
          <h3 className="mt-0 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 mb-4">
            Configuration
          </h3>
          <dl>
            <Field label="Model">{agent.config?.model?.id ?? "—"}</Field>
            <Field label="Temperature">
              {agent.config?.model?.temperature ?? "—"}
            </Field>
            <Field label="Max Tokens">
              {agent.config?.model?.maxTokens ?? "—"}
            </Field>
            <Field label="Rate Limit">
              {agent.config?.gateway?.rateLimit != null
                ? `${agent.config.gateway.rateLimit} req/min`
                : "—"}
            </Field>
          </dl>
        </section>
      </div>
    </div>
  );
}
