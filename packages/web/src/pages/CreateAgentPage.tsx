import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { CreateAgentSchema } from "@controlplane/shared";
import { useVersions } from "../hooks/useVersions.js";
import { useCreateAgent } from "../hooks/useCreateAgent.js";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontSize: "0.95rem",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "0.25rem",
  fontWeight: 600,
  fontSize: "0.85rem",
};

const fieldStyle: React.CSSProperties = { marginBottom: "1rem" };

export function CreateAgentPage() {
  const navigate = useNavigate();
  const { data: versions, isLoading: versionsLoading } = useVersions();
  const createAgent = useCreateAgent();

  const [name, setName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [environment, setEnvironment] = useState<"dev" | "prod">("dev");
  const [modelId, setModelId] = useState(
    "anthropic.claude-sonnet-4-20250514-v1:0",
  );
  const [temperature, setTemperature] = useState("0.7");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [rateLimit, setRateLimit] = useState("60");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const defaultVersion = versions?.find((v) => v.isDefault);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = CreateAgentSchema.safeParse({
      name,
      agentName,
      environment,
      config: {
        model: {
          id: modelId,
          temperature: parseFloat(temperature),
          maxTokens: parseInt(maxTokens, 10),
        },
        gateway: {
          rateLimit: parseInt(rateLimit, 10),
        },
      },
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    createAgent.mutate(result.data, {
      onSuccess: (agent) => {
        navigate(`/agents/${agent.id}`);
      },
    });
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/" style={{ color: "#0d6efd", textDecoration: "none" }}>
          &larr; All agents
        </Link>
      </div>

      <h1 style={{ marginTop: 0 }}>Create Agent</h1>

      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          padding: "1.5rem",
          borderRadius: 8,
          maxWidth: 600,
        }}
      >
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="name">
            Display Name
          </label>
          <input
            id="name"
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Agent"
          />
          {errors["name"] && (
            <div style={{ color: "red", fontSize: "0.8rem", marginTop: 4 }}>
              {errors["name"]}
            </div>
          )}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="agentName">
            Agent Name
          </label>
          <input
            id="agentName"
            style={inputStyle}
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="my-agent-01"
          />
          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: 2 }}>
            3-40 chars, lowercase alphanumeric and hyphens only
          </div>
          {errors["agentName"] && (
            <div style={{ color: "red", fontSize: "0.8rem", marginTop: 4 }}>
              {errors["agentName"]}
            </div>
          )}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="environment">
            Environment
          </label>
          <select
            id="environment"
            style={inputStyle}
            value={environment}
            onChange={(e) =>
              setEnvironment(e.target.value as "dev" | "prod")
            }
          >
            <option value="dev">Dev</option>
            <option value="prod">Prod</option>
          </select>
          {errors["environment"] && (
            <div style={{ color: "red", fontSize: "0.8rem", marginTop: 4 }}>
              {errors["environment"]}
            </div>
          )}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="version">
            Version
          </label>
          {versionsLoading ? (
            <div style={{ color: "#666", fontSize: "0.9rem" }}>
              Loading versions...
            </div>
          ) : (
            <select id="version" style={inputStyle} disabled>
              {defaultVersion ? (
                <option value={defaultVersion.id}>
                  {defaultVersion.version} (default)
                </option>
              ) : (
                <option value="">Latest available</option>
              )}
              {versions
                ?.filter((v) => !v.isDefault)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version}
                  </option>
                ))}
            </select>
          )}
          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: 2 }}>
            Version is automatically selected by the platform
          </div>
        </div>

        <h3
          style={{
            marginTop: "1.5rem",
            borderBottom: "1px solid #dee2e6",
            paddingBottom: "0.5rem",
          }}
        >
          Configuration
        </h3>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="modelId">
            Model ID
          </label>
          <input
            id="modelId"
            style={inputStyle}
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
          />
          {errors["config.model.id"] && (
            <div style={{ color: "red", fontSize: "0.8rem", marginTop: 4 }}>
              {errors["config.model.id"]}
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <label style={labelStyle} htmlFor="temperature">
              Temperature
            </label>
            <input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="1"
              style={inputStyle}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
            {errors["config.model.temperature"] && (
              <div style={{ color: "red", fontSize: "0.8rem", marginTop: 4 }}>
                {errors["config.model.temperature"]}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle} htmlFor="maxTokens">
              Max Tokens
            </label>
            <input
              id="maxTokens"
              type="number"
              min="1"
              style={inputStyle}
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
            />
            {errors["config.model.maxTokens"] && (
              <div style={{ color: "red", fontSize: "0.8rem", marginTop: 4 }}>
                {errors["config.model.maxTokens"]}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle} htmlFor="rateLimit">
              Rate Limit (req/min)
            </label>
            <input
              id="rateLimit"
              type="number"
              min="1"
              style={inputStyle}
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
            />
            {errors["config.gateway.rateLimit"] && (
              <div style={{ color: "red", fontSize: "0.8rem", marginTop: 4 }}>
                {errors["config.gateway.rateLimit"]}
              </div>
            )}
          </div>
        </div>

        {createAgent.error && (
          <div
            style={{
              color: "red",
              marginBottom: "1rem",
              padding: "0.5rem",
              background: "#ffeaea",
              borderRadius: 4,
            }}
          >
            {createAgent.error.message}
          </div>
        )}

        <button
          type="submit"
          disabled={createAgent.isPending}
          style={{
            padding: "0.6rem 1.5rem",
            background: createAgent.isPending ? "#999" : "#0d6efd",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: createAgent.isPending ? "not-allowed" : "pointer",
            fontSize: "1rem",
          }}
        >
          {createAgent.isPending ? "Creating..." : "Create Agent"}
        </button>
      </form>
    </div>
  );
}
