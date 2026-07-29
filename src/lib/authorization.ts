import type { UserRole } from "@/domain/validation";

export type AuthorizationUser = {
  id: string;
  organizationId: string;
  role: UserRole;
  isMasterAdmin: boolean;
};

export function isMasterAdmin(user: Pick<AuthorizationUser, "role" | "isMasterAdmin">) {
  return user.role === "ADMIN" && user.isMasterAdmin;
}

export function isOrganizationAdmin(user: Pick<AuthorizationUser, "role">) {
  return user.role === "ADMIN";
}

export function canAccessProcess(
  user: AuthorizationUser,
  process: { userId: string; organizationId: string },
) {
  if (isMasterAdmin(user)) return true;
  if (process.organizationId !== user.organizationId) return false;
  return isOrganizationAdmin(user) || process.userId === user.id;
}
