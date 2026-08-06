#!/usr/bin/env node
/**
 * Unit tests for LLM config resolution (no network required).
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const CONFIG_KEYS = [
  "LLM_PROVIDER",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "MDB_GROVE_API_KEY",
  "GROVE_BASE_URL",
];

describe("getLlmConfig", () => {
  let saved = {};
  let getLlmConfig;

  beforeEach(async () => {
    saved = {};
    for (const key of CONFIG_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    ({ getLlmConfig } = await import(`../../backend/src/config/env.js?ts=${Date.now()}`));
  });

  afterEach(() => {
    for (const key of CONFIG_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it("resolves direct openai", () => {
    process.env.LLM_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    const cfg = getLlmConfig();
    assert.equal(cfg.protocol, "openai");
    assert.equal(cfg.gateway, "direct");
    assert.equal(cfg.baseUrl, "https://api.openai.com/v1");
    assert.equal(cfg.headers.Authorization, "Bearer sk-test");
  });

  it("resolves direct anthropic", () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "ant-test";
    const cfg = getLlmConfig();
    assert.equal(cfg.protocol, "anthropic");
    assert.equal(cfg.gateway, "direct");
    assert.equal(cfg.headers["x-api-key"], "ant-test");
  });

  it("resolves grove-openai", () => {
    process.env.LLM_PROVIDER = "grove-openai";
    process.env.MDB_GROVE_API_KEY = "grove-test";
    process.env.GROVE_BASE_URL = "https://grove.example.com/grove-foundry-prod";
    const cfg = getLlmConfig();
    assert.equal(cfg.protocol, "openai");
    assert.equal(cfg.gateway, "grove");
    assert.equal(cfg.baseUrl, "https://grove.example.com/grove-foundry-prod/openai/v1");
    assert.equal(cfg.headers["api-key"], "grove-test");
    assert.equal(cfg.model, "gpt-4o");
  });

  it("resolves grove-anthropic", () => {
    process.env.LLM_PROVIDER = "grove-anthropic";
    process.env.MDB_GROVE_API_KEY = "grove-test";
    const cfg = getLlmConfig();
    assert.equal(cfg.protocol, "anthropic");
    assert.equal(cfg.gateway, "grove");
    assert.ok(cfg.baseUrl.endsWith("/anthropic/v1"));
    assert.equal(cfg.headers["anthropic-version"], "2023-06-01");
  });

  it("throws for unknown provider", () => {
    process.env.LLM_PROVIDER = "unknown";
    process.env.OPENAI_API_KEY = "sk-test";
    assert.throws(() => getLlmConfig(), /Unknown LLM_PROVIDER/);
  });

  it("throws when grove key missing", () => {
    process.env.LLM_PROVIDER = "grove-openai";
    assert.throws(() => getLlmConfig(), /MDB_GROVE_API_KEY/);
  });
});
