import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
config({ path: join(rootDir, ".env") });

const DEFAULT_GROVE_BASE_URL =
  "https://grove-gateway-prod.azure-api.net/grove-foundry-prod";

export const env = {
  mongodbUri: process.env.MONGODB_URI,
  mongodbDb: process.env.MONGODB_DB || "virtual_engineer",
  mcpPort: Number(process.env.MCP_PORT || 3100),
  mcpHost: process.env.MCP_HOST || "0.0.0.0",
  mcpApiKey: process.env.MCP_API_KEY || "",
  mcpAuthDisabled: process.env.MCP_AUTH_DISABLED === "true",
  mcpBaseUrl: process.env.MCP_BASE_URL || `http://localhost:${process.env.MCP_PORT || 3100}`,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  knowledgeVectorIndex: process.env.KNOWLEDGE_VECTOR_INDEX || "knowledge_auto_embed_index",
  knowledgeSearchIndex: process.env.KNOWLEDGE_SEARCH_INDEX || "knowledge_search",
  ticketsVectorIndex: process.env.TICKETS_VECTOR_INDEX || "service_tickets_auto_embed_index",
  ticketsSearchIndex: process.env.TICKETS_SEARCH_INDEX || "service_tickets_search",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  mdbGroveApiKey: process.env.MDB_GROVE_API_KEY || "",
  groveBaseUrl: process.env.GROVE_BASE_URL || DEFAULT_GROVE_BASE_URL,
  groveOpenAiModel: process.env.GROVE_OPENAI_MODEL || "gpt-4o",
  groveAnthropicModel: process.env.GROVE_ANTHROPIC_MODEL || "claude-sonnet-4-6",
  llmProvider:
    process.env.LLM_PROVIDER ||
    (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai"),
  agentMaxSteps: Number(process.env.AGENT_MAX_STEPS || 12),
  chatPort: Number(process.env.CHAT_PORT || process.env.MCP_PORT || 3100),
};

function groveHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "api-key": apiKey,
  };
}

export function getLlmConfig() {
  const provider = process.env.LLM_PROVIDER || env.llmProvider;
  const openaiApiKey = process.env.OPENAI_API_KEY || env.openaiApiKey;
  const openaiModel = process.env.OPENAI_MODEL || env.openaiModel;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || env.anthropicApiKey;
  const anthropicModel = process.env.ANTHROPIC_MODEL || env.anthropicModel;
  const mdbGroveApiKey = process.env.MDB_GROVE_API_KEY || env.mdbGroveApiKey;
  const groveBaseUrl = (process.env.GROVE_BASE_URL || env.groveBaseUrl).replace(/\/$/, "");
  const groveOpenAiModel = process.env.GROVE_OPENAI_MODEL || env.groveOpenAiModel;
  const groveAnthropicModel = process.env.GROVE_ANTHROPIC_MODEL || env.groveAnthropicModel;

  if (provider === "grove-openai") {
    if (!mdbGroveApiKey) {
      throw new Error("MDB_GROVE_API_KEY is required when LLM_PROVIDER=grove-openai");
    }
    const baseUrl = `${groveBaseUrl}/openai/v1`;
    return {
      provider: "grove-openai",
      protocol: "openai",
      gateway: "grove",
      apiKey: mdbGroveApiKey,
      model: groveOpenAiModel,
      baseUrl,
      headers: {
        ...groveHeaders(mdbGroveApiKey),
        "Content-Type": "application/json",
      },
    };
  }

  if (provider === "grove-anthropic") {
    if (!mdbGroveApiKey) {
      throw new Error("MDB_GROVE_API_KEY is required when LLM_PROVIDER=grove-anthropic");
    }
    const baseUrl = `${groveBaseUrl}/anthropic/v1`;
    return {
      provider: "grove-anthropic",
      protocol: "anthropic",
      gateway: "grove",
      apiKey: mdbGroveApiKey,
      model: groveAnthropicModel,
      baseUrl,
      headers: {
        ...groveHeaders(mdbGroveApiKey),
        "x-api-key": mdbGroveApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    };
  }

  if (provider === "anthropic") {
    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
    }
    return {
      provider: "anthropic",
      protocol: "anthropic",
      gateway: "direct",
      apiKey: anthropicApiKey,
      model: anthropicModel,
      baseUrl: "https://api.anthropic.com/v1",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    };
  }

  if (provider !== "openai") {
    throw new Error(
      `Unknown LLM_PROVIDER="${provider}". Use openai, anthropic, grove-openai, or grove-anthropic.`
    );
  }

  if (!openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is required when LLM_PROVIDER=openai (or set LLM_PROVIDER=grove-openai / anthropic / grove-anthropic)"
    );
  }

  return {
    provider: "openai",
    protocol: "openai",
    gateway: "direct",
    apiKey: openaiApiKey,
    model: openaiModel,
    baseUrl: "https://api.openai.com/v1",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
  };
}
