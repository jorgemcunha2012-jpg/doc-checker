import type { User } from "@/domain/validation";
import { isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";
export { canAccessProcess, isMasterAdmin, isOrganizationAdmin } from "./authorization";
import { isMasterAdmin } from "./authorization";

export type AuthenticatedUser = User & {
  active: boolean;
  mustChangePassword: boolean;
  isMasterAdmin: boolean;
  mfaRequired: boolean;
  mfaVerified: boolean;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, name, email, role, active, must_change_password, is_master_admin, mfa_required")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) return null;
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    id: profile.id,
    organizationId: profile.organization_id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    active: profile.active,
    mustChangePassword: profile.must_change_password,
    isMasterAdmin: profile.is_master_admin,
    mfaRequired: profile.mfa_required,
    mfaVerified: assurance?.currentLevel === "aal2",
  };
}

export async function requireUser(options: { allowPasswordChange?: boolean; allowMfaSetup?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Não autenticado.", 401);
  if (user.mustChangePassword && !options.allowPasswordChange) {
    throw new AuthError("Troca de senha obrigatória.", 403);
  }
  if (user.mfaRequired && !user.mfaVerified && !options.allowMfaSetup) {
    throw new AuthError("Autenticação em dois fatores obrigatória.", 403);
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AuthError("Acesso restrito ao administrador.", 403);
  return user;
}

export async function requireMasterAdmin() {
  const user = await requireAdmin();
  if (!isMasterAdmin(user)) throw new AuthError("Acesso restrito ao administrador master.", 403);
  return user;
}

export class AuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
