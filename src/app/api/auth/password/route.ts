import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { audit } from "@/services/process/process-repository";

export async function POST(request: Request) {
  try {
    const user = await requireUser({ allowPasswordChange: true, allowMfaSetup: true });
    const { password } = await request.json();
    if (!validPassword(password)) {
      return NextResponse.json({
        error: "Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.",
      }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await createSupabaseAdminClient().from("profiles").update({
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    await audit(user, "PASSWORD_CHANGED", "profile", user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

function validPassword(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 12
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}
