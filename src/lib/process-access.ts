import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { canAccessProcess } from "@/lib/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type AccessibleProcessScope = {
  id: string;
  organizationId: string;
  userId: string;
};

/**
 * Resolves a process only after applying the single access rule shared by API
 * routes and server pages. Returning null intentionally avoids exposing
 * whether a process exists outside the caller's permitted scope.
 */
export async function getAccessibleProcessScope(
  user: AuthenticatedUser,
  processId: string,
): Promise<AccessibleProcessScope | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("validation_processes")
    .select("id, organization_id, user_id")
    .eq("id", processId)
    .maybeSingle();

  if (error || !data) return null;
  if (!canAccessProcess(user, { userId: data.user_id, organizationId: data.organization_id })) return null;

  return {
    id: data.id,
    organizationId: data.organization_id,
    userId: data.user_id,
  };
}
