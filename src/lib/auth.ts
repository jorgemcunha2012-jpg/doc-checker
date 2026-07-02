import { defaultUser } from "@/domain/tenant";
import type { User } from "@/domain/validation";
import { isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

export type AuthenticatedUser = User & {
  active: boolean;
  mustChangePassword: boolean;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  if (isPublicAccessEnabled()) {
    return {
      id: process.env.CONFERIA_PUBLIC_USER_ID ?? defaultUser.id,
      organizationId: process.env.CONFERIA_ORGANIZATION_ID ?? defaultUser.organizationId,
      name: "Acesso público",
      email: "publico@conferia.local",
      role: "ANALISTA",
      active: true,
      mustChangePassword: false,
    };
  }

  if (!isSupabaseConfigured()) {
    return { ...defaultUser, active: true, mustChangePassword: false };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, name, email, role, active, must_change_password")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) return null;
  return {
    id: profile.id,
    organizationId: profile.organization_id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    active: profile.active,
    mustChangePassword: profile.must_change_password,
  };
}

export function isPublicAccessEnabled() {
  return process.env.CONFERIA_AUTH_DISABLED === "true";
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Não autenticado.", 401);
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

export function isMasterAdmin(user: Pick<AuthenticatedUser, "email" | "role">) {
  if (user.role !== "ADMIN") return false;
  const emails = (process.env.CONFERIA_MASTER_ADMIN_EMAILS ?? "jorge@conferia.local")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return emails.includes(user.email.toLowerCase());
}

export class AuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
