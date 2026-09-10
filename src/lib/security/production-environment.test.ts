import assert from "node:assert/strict";
import test from "node:test";
import { productionConfigurationProblems } from "./production-environment";

const validProduction = {
  VERCEL_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  CRON_SECRET: "cron",
  ANTHROPIC_API_KEY: "anthropic",
  CONFERIA_FIELD_ENCRYPTION_KEY: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=",
};

test("requires security-critical configuration in production", () => {
  assert.deepEqual(productionConfigurationProblems(validProduction), []);
  assert.deepEqual(
    productionConfigurationProblems({ ...validProduction, SUPABASE_SERVICE_ROLE_KEY: "", CONFERIA_AUTH_DISABLED: "true" }),
    ["SUPABASE_SERVICE_ROLE_KEY", "CONFERIA_AUTH_DISABLED must not be true"],
  );
});

test("allows local development to start without production credentials", () => {
  assert.deepEqual(productionConfigurationProblems({}), []);
});

test("requires Azure credentials when Azure is selected in production", () => {
  const problems = productionConfigurationProblems({
    ...validProduction,
    TEXT_EXTRACTION_PROVIDER: "AZURE_OPENAI",
    VISION_EXTRACTION_PROVIDER: "AZURE_OPENAI",
    AZURE_OPENAI_API_KEY: "",
    AZURE_OPENAI_ENDPOINT: "",
    AZURE_OPENAI_DEPLOYMENT: "",
  });

  assert.deepEqual(problems, [
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_DEPLOYMENT",
  ]);
});

test("recusa provedores externos não aprovados em produção", () => {
  assert.deepEqual(
    productionConfigurationProblems({
      ...validProduction,
      TEXT_EXTRACTION_PROVIDER: "DEEPSEEK",
      VISION_EXTRACTION_PROVIDER: "KIMI",
    }),
    [
      "TEXT_EXTRACTION_PROVIDER must be HAIKU or AZURE_OPENAI",
      "VISION_EXTRACTION_PROVIDER must be HAIKU or AZURE_OPENAI",
    ],
  );
});
