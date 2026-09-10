import assert from "node:assert/strict";
import test from "node:test";
import { contentSecurityPolicy } from "./content-security-policy";

test("restringe fontes e permite somente Supabase configurado", () => {
  const policy = contentSecurityPolicy("nonce-test", {
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  });
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /'nonce-nonce-test'/);
  assert.match(policy, /https:\/\/example\.supabase\.co wss:\/\/example\.supabase\.co/);
  assert.equal(policy.includes("unsafe-inline"), false);
});
