import { NextResponse } from "next/server";
import { AuthError, requireMasterAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { audit } from "@/services/process/process-repository";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const admin = await requireMasterAdmin();
    const { userId } = await context.params;
    const { action } = await request.json();
    const supabase = createSupabaseAdminClient();

    if (action === "RESET_PASSWORD") {
      const password = `Cf!${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}9a`;
      const { error } = await supabase.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      await supabase.from("profiles").update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("id", userId).eq("organization_id", admin.organizationId);
      await audit(admin, "PASSWORD_RESET", "profile", userId);
      return NextResponse.json({ temporaryPassword: password });
    }

    if (action === "ACTIVATE" || action === "DEACTIVATE") {
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
