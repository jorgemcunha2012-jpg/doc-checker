import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { password } = await request.json();
    if (typeof password !== "string" || password.length < 10) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 10 caracteres." }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await createSupabaseAdminClient().from("profiles").update({
      must_change_password: false,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
