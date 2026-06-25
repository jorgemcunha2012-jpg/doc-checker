export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export const DEFAULT_ORGANIZATION_ID =
  process.env.CONFERIA_ORGANIZATION_ID ?? "00000000-0000-0000-0000-000000000001";
