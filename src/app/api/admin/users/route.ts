import { NextResponse } from "next/server";
import { AuthError, isMasterAdmin, requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { audit } from "@/services/process/process-repository";

export async function GET() {
  try {
    const admin = await requireAdmin();
    const { data, error } = await createSupabaseAdminClient()
      .from("profiles")
      .select("id, name, email, role, active, must_change_password, created_at")
      .eq("organization_id", admin.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ users: (data ?? []).map((profile) => ({
      ...profile,
      is_master_admin: isMasterAdmin({ email: profile.email, role: profile.role }),
    })) });
  } catch (error) {
    return authResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { name, email } = await request.json();
    if (!name?.trim() || !email?.trim()) return NextResponse.json({ error: "Nome e email são obrigatórios." }, { status: 400 });
    const password = temporaryPassword();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name: name.trim() },
    });
    if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Falha ao criar usuário." }, { status: 400 });
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      organization_id: admin.organizationId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: "ANALISTA",
      active: true,
      must_change_password: true,
    });
    if (profileError) {
      await supabase.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    await audit(admin, "USER_CREATED", "profile", data.user.id, { email });
    return NextResponse.json({ userId: data.user.id, temporaryPassword: password }, { status: 201 });
  } catch (error) {
    return authResponse(error);
  }
}

function temporaryPassword() {
  return `Cf!${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}9a`;
}

function authResponse(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: "Erro interno." }, { status: 500 });
}
