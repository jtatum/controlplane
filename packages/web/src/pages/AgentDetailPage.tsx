import { useState } from "react";
import { useParams, Link } from "react-router";
import { useAgent, useTerminateAgent } from "../hooks/useAgents.js";
import { StatusBadge } from "../components/StatusBadge.js";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <dt
        style={{
          fontSize: "0.8rem",
          color: "#666",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.15rem",
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: "0.95rem" }}>{children}</dd>
    </div>
  );
}

const TERMINAL_STATUSES = new Set(["terminated", "stopping", "stopped"]);

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: agent, isLoading, error } = useAgent(id!);
  const terminateMutation = useTerminateAgent();
  const [showConfirm, setShowConfirm] = useState(false);

  if (isLoading) return <p>Loading agent...</p>;
  if (error) return <p>Error loading agent: {String(error)}</p>;
  if (!agent) return <p>Agent not found.</p>;

  const canTerminate = !TERMINAL_STATUSES.has(agent.status) && !terminateMutation.isPending;

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/" style={{ color: "#0d6efd", textDecoration: "none" }}>
          &larr; All agents
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ margin: 0 }}>{agent.name}</h1>
        <StatusBadge status={agent.status} />
        <button
          type="button"
          disabled={!canTerminate}
          onClick={() => setShowConfirm(true)}
          style={{
            marginLeft: "auto",
            padding: "0.5rem 1.2rem",
            borderRadius: 4,
            border: "none",
            background: canTerminate ? "#dc3545" : "#6c757d",
            color: "#fff",
            cursor: canTerminate ? "pointer" : "not-allowed",
            fontWeight: 600,
            opacity: canTerminate ? 1 : 0.6,
          }}
        >
          {terminateMutation.isPending ? "Terminating..." : "Terminate"}
        </button>
      </div>

      {showConfirm && (
        <div
          role="dialog"
          aria-label="Confirm termination"
          style={{
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 8,
            padding: "1rem 1.5rem",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <span>
            Terminate <strong>{agent.name}</strong>? This action cannot be undone.
          </span>
          <button
            type="button"
            onClick={() => {
              terminateMutation.mutate(agent.id);
              setShowConfirm(false);
            }}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: 4,
              border: "none",
              background: "#dc3545",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: 4,
              border: "1px solid #ced4da",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {terminateMutation.isSuccess && (
        <div style={{ background: "#d1e7dd", border: "1px solid #198754", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          Agent termination initiated. Status will update shortly.
        </div>
      )}

      {terminateMutation.isError && (
        <div style={{ background: "#f8d7da", border: "1px solid #dc3545", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          Termination failed: {String(terminateMutation.error)}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2rem",
          background: "#fff",
          padding: "1.5rem",
          borderRadius: 8,
        }}
      >
        <section>
          <h3 style={{ marginTop: 0, borderBottom: "1px solid #dee2e6", paddingBottom: "0.5rem" }}>
            General
          </h3>
          <dl>
            <Field label="Agent Name">
              <code>{agent.agentName}</code>
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
          <h3 style={{ marginTop: 0, borderBottom: "1px solid #dee2e6", paddingBottom: "0.5rem" }}>
            Infrastructure
          </h3>
          <dl>
            <Field label="Instance Type">{agent.instanceType}</Field>
            <Field label="EC2 Instance">
              {agent.ec2InstanceId ?? "—"}
            </Field>
            <Field label="Private IP">{agent.privateIp ?? "—"}</Field>
            <Field label="Availability Zone">
              {agent.availabilityZone ?? "—"}
            </Field>
          </dl>
        </section>

        <section style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ marginTop: 0, borderBottom: "1px solid #dee2e6", paddingBottom: "0.5rem" }}>
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
