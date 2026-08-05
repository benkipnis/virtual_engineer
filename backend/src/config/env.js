import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
config({ path: join(rootDir, ".env") });

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
  ticketsVectorIndex: process.env.TICKETS_VECTOR_INDEX || "service_tickets_auto_embed_index",
  ticketsSearchIndex: process.env.TICKETS_SEARCH_INDEX || "service_tickets_search",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  llmProvider: process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai"),
  agentMaxSteps: Number(process.env.AGENT_MAX_STEPS || 12),
  chatPort: Number(process.env.CHAT_PORT || process.env.MCP_PORT || 3100),
};

export function getLlmConfig() {
  if (env.llmProvider === "anthropic") {
    if (!env.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
    }
    return { provider: "anthropic", apiKey: env.anthropicApiKey, model: env.anthropicModel };
  }
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required (set LLM_PROVIDER=anthropic to use Anthropic instead)");
  }
  return { provider: "openai", apiKey: env.openaiApiKey, model: env.openaiModel };
}
