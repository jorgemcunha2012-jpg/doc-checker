import assert from "node:assert/strict";
import test from "node:test";
import { canAccessProcess, isMasterAdmin, isOrganizationAdmin, type AuthorizationUser } from "./authorization";

const analyst: AuthorizationUser = {
  id: "analyst-1",
  organizationId: "victa",
  role: "ANALISTA",
  isMasterAdmin: false,
};

const admin: AuthorizationUser = {
  ...analyst,
  id: "admin-1",
  role: "ADMIN",
};

const master: AuthorizationUser = {
  ...admin,
  id: "master-1",
  isMasterAdmin: true,
};

test("analista acessa somente os próprios processos da organização", () => {
  assert.equal(canAccessProcess(analyst, { userId: analyst.id, organizationId: "victa" }), true);
  assert.equal(canAccessProcess(analyst, { userId: "other", organizationId: "victa" }), false);
  assert.equal(canAccessProcess(analyst, { userId: analyst.id, organizationId: "other-org" }), false);
});

test("admin acessa a equipe da própria organização, mas não outra empresa", () => {
  assert.equal(isOrganizationAdmin(admin), true);
  assert.equal(canAccessProcess(admin, { userId: "other", organizationId: "victa" }), true);
  assert.equal(canAccessProcess(admin, { userId: "other", organizationId: "other-org" }), false);
});

test("master possui acesso global sem depender de email configurado", () => {
  assert.equal(isMasterAdmin(master), true);
  assert.equal(canAccessProcess(master, { userId: "other", organizationId: "other-org" }), true);
});
