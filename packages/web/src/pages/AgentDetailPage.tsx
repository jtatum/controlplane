import { useParams, Link } from "react-router";
import { useAgent } from "../hooks/useAgents.js";
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

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: agent, isLoading, error } = useAgent(id!);

  if (isLoading) return <p>Loading agent...</p>;
  if (error) return <p>Error loading agent: {String(error)}</p>;
  if (!agent) return <p>Agent not found.</p>;

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
      </div>

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
            <Field label="Model">{agent.config.model.id}</Field>
            <Field label="Temperature">
              {agent.config.model.temperature}
            </Field>
            <Field label="Max Tokens">
              {agent.config.model.maxTokens}
            </Field>
            <Field label="Rate Limit">
              {agent.config.gateway.rateLimit} req/min
            </Field>
          </dl>
        </section>
      </div>
    </div>
  );
}
