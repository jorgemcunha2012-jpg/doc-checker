import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

async function withoutSupabase<T>(callback: () => Promise<T>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    return await callback();
  } finally {
    if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    if (key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
  }
}

test("bloqueia mutação sem Origin ou com Origin externo", async () => {
  await withoutSupabase(async () => {
    const missing = await middleware(new NextRequest("https://conferia.test/api/processes", { method: "POST" }));
    const foreign = await middleware(new NextRequest("https://conferia.test/api/processes", { method: "POST", headers: { origin: "https://evil.test" } }));
    assert.equal(missing.status, 403);
    assert.equal(foreign.status, 403);
  });
});

test("permite origem própria e emite os cabeçalhos de segurança", async () => {
  await withoutSupabase(async () => {
    const response = await middleware(new NextRequest("https://conferia.test/api/processes", { method: "POST", headers: { origin: "https://conferia.test" } }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
  });
});
