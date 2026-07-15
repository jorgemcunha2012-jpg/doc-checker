import { NextResponse } from "next/server";
import { AuthError, isMasterAdmin, requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { audit } from "@/services/process/process-repository";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const admin = await requireAdmin();
    const { userId } = await context.params;
    const { action } = await request.json();
    const supabase = createSupabaseAdminClient();
    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("id, email, role")
      .eq("id", userId)
      .eq("organization_id", admin.organizationId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

    if (action === "RESET_PASSWORD") {
      if (isMasterAdmin({ email: target.email, role: target.role }) && !isMasterAdmin(admin)) {
        return NextResponse.json({ error: "Somente o administrador master pode redefinir a senha do master." }, { status: 403 });
      }
      const password = `Cf!${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}9a`;
      const { error } = await supabase.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: true, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .eq("organization_id", admin.organizationId);
      if (profileError) throw profileError;
      await audit(admin, "PASSWORD_RESET", "profile", userId);
      return NextResponse.json({ temporaryPassword: password });
    }

    if (action === "ACTIVATE" || action === "DEACTIVATE") {
      if (!isMasterAdmin(admin)) {
        return NextResponse.json({ error: "Somente o administrador master pode ativar ou desativar usuários." }, { status: 403 });
      }
      const active = action === "ACTIVATE";
      const { error } = await supabase.from("profiles").update({ active, updated_at: new Date().toISOString() }).eq("id", userId).eq("organization_id", admin.organizationId);
      if (error) throw error;
      await audit(admin, active ? "USER_ACTIVATED" : "USER_DEACTIVATED", "profile", userId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
