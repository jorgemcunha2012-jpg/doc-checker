import { createClient } from "@supabase/supabase-js";

const [email, name = "Administrador ConferIA"] = process.argv.slice(2);
if (!email || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Uso: npm run create-admin -- admin@empresa.com \"Nome\" (com variáveis Supabase carregadas)");
  process.exit(1);
}
const organizationId = process.env.CONFERIA_ORGANIZATION_ID ?? "00000000-0000-0000-0000-000000000001";
const password = `Cf!${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}9a`;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
const { error: profileError } = await supabase.from("profiles").insert({ id: data.user.id, organization_id: organizationId, name, email, role: "ADMIN", active: true, must_change_password: true });
if (profileError) throw profileError;
console.log(`Admin criado: ${email}\nSenha temporária: ${password}\nA senha será exigida no primeiro acesso.`);
