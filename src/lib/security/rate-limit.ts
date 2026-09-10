import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export { requestRateLimitKey } from "./rate-limit-key";

export async function consumeRateLimit(key: string, maxRequests: number, windowMs: number) {
  const keyHash = createHash("sha256").update(key).digest("hex");
  const { data, error } = await createSupabaseAdminClient().rpc("consume_rate_limit", {
    p_key_hash: keyHash, p_max_requests: maxRequests, p_window_seconds: Math.ceil(windowMs / 1000),
  });
  if (error || !data?.[0]) throw new Error("Rate limit distribuído indisponível.");
  return { allowed: data[0].allowed, retryAfterSeconds: data[0].retry_after_seconds };
}
