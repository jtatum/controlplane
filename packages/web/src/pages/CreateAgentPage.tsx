import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { CreateAgentSchema } from "@controlplane/shared";
import { useVersions } from "../hooks/useVersions.js";
import { useCreateAgent } from "../hooks/useCreateAgent.js";

const inputClasses =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-2 focus:outline-blue-500 focus:border-blue-500";

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
      <div className="mb-4">
        <Link
          to="/"
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          &larr; All agents
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Agent</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-sm max-w-xl"
      >
        <div className="mb-4">
          <label
            className="block mb-1 font-semibold text-sm text-gray-700"
            htmlFor="name"
          >
            Display Name
          </label>
          <input
            id="name"
            className={inputClasses}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Agent"
          />
          {errors["name"] && (
            <div className="text-red-600 text-xs mt-1">{errors["name"]}</div>
          )}
        </div>

        <div className="mb-4">
          <label
            className="block mb-1 font-semibold text-sm text-gray-700"
            htmlFor="agentName"
          >
            Agent Name
          </label>
          <input
            id="agentName"
            className={inputClasses}
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="my-agent-01"
          />
          <div className="text-xs text-gray-500 mt-0.5">
            3-40 chars, lowercase alphanumeric and hyphens only
          </div>
          {errors["agentName"] && (
            <div className="text-red-600 text-xs mt-1">
              {errors["agentName"]}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label
            className="block mb-1 font-semibold text-sm text-gray-700"
            htmlFor="environment"
          >
            Environment
          </label>
          <select
            id="environment"
            className={inputClasses}
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as "dev" | "prod")}
          >
            <option value="dev">Dev</option>
            <option value="prod">Prod</option>
          </select>
          {errors["environment"] && (
            <div className="text-red-600 text-xs mt-1">
              {errors["environment"]}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label
            className="block mb-1 font-semibold text-sm text-gray-700"
            htmlFor="version"
          >
            Version
          </label>
          {versionsLoading ? (
            <div className="text-gray-500 text-sm">Loading versions...</div>
          ) : (
            <select
              id="version"
              className={`${inputClasses} bg-gray-50`}
              disabled
            >
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
          <div className="text-xs text-gray-500 mt-0.5">
            Version is automatically selected by the platform
          </div>
        </div>

        <h3 className="mt-6 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800 mb-4">
          Configuration
        </h3>

        <div className="mb-4">
          <label
            className="block mb-1 font-semibold text-sm text-gray-700"
            htmlFor="modelId"
          >
            Model ID
          </label>
          <input
            id="modelId"
            className={inputClasses}
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
          />
          {errors["config.model.id"] && (
            <div className="text-red-600 text-xs mt-1">
              {errors["config.model.id"]}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label
              className="block mb-1 font-semibold text-sm text-gray-700"
              htmlFor="temperature"
            >
              Temperature
            </label>
            <input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="1"
              className={inputClasses}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
            {errors["config.model.temperature"] && (
              <div className="text-red-600 text-xs mt-1">
                {errors["config.model.temperature"]}
              </div>
            )}
          </div>

          <div>
            <label
              className="block mb-1 font-semibold text-sm text-gray-700"
              htmlFor="maxTokens"
            >
              Max Tokens
            </label>
            <input
              id="maxTokens"
              type="number"
              min="1"
              className={inputClasses}
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
            />
            {errors["config.model.maxTokens"] && (
              <div className="text-red-600 text-xs mt-1">
                {errors["config.model.maxTokens"]}
              </div>
            )}
          </div>

          <div>
            <label
              className="block mb-1 font-semibold text-sm text-gray-700"
              htmlFor="rateLimit"
            >
              Rate Limit (req/min)
            </label>
            <input
              id="rateLimit"
              type="number"
              min="1"
              className={inputClasses}
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
            />
            {errors["config.gateway.rateLimit"] && (
              <div className="text-red-600 text-xs mt-1">
                {errors["config.gateway.rateLimit"]}
              </div>
            )}
          </div>
        </div>

        {createAgent.error && (
          <div className="text-red-600 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
            {createAgent.error.message}
          </div>
        )}

        <button
          type="submit"
          disabled={createAgent.isPending}
          className={`px-6 py-2.5 rounded-lg text-white font-medium text-sm transition-colors cursor-pointer ${
            createAgent.isPending
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
          }`}
        >
          {createAgent.isPending ? "Creating..." : "Create Agent"}
        </button>
      </form>
    </div>
  );
}
