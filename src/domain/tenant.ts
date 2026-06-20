import type { Organization, User } from "./validation";

export const defaultOrganization: Organization = {
  id: "org_conferia_demo",
  name: "ConferIA Operações",
};

export const defaultUser: User = {
  id: "usr_conferia_analista",
  organizationId: defaultOrganization.id,
  name: "Analista ConferIA",
  email: "analista@conferia.local",
  role: "ANALISTA",
};
