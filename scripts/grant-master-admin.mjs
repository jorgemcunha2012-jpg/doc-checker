import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [email] = process.argv.slice(2);
if (!email || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Uso: node --env-file=.env.local scripts/grant-master-admin.mjs admin@empresa.com");
  process.exit(1);
}

const normalizedEmail = email.trim().toLowerCase();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id, organization_id, role, active")
  .eq("email", normalizedEmail)
  .single();
if (profileError || !profile) throw new Error("Administrador do comprador não encontrado.");
if (profile.role !== "ADMIN" || !profile.active) throw new Error("O perfil precisa ser um administrador ativo.");

const { error: updateError } = await supabase
  .from("profiles")
  .update({ is_master_admin: true, updated_at: new Date().toISOString() })
  .eq("id", profile.id);
if (updateError) throw updateError;

const targetHash = createHash("sha256").update(normalizedEmail).digest("hex");
const { error: auditError } = await supabase.from("audit_events").insert({
  organization_id: profile.organization_id,
  actor_id: null,
  event_type: "MASTER_ACCESS_GRANTED",
  entity_type: "profile",
  entity_id: profile.id,
  metadata: { targetEmailHash: targetHash, grantedBy: "OPERATIONS_PROCEDURE" },
});
if (auditError) throw auditError;

console.log("Acesso master concedido e registrado em auditoria.");
