import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { audit } from "@/services/process/process-repository";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return NextResponse.json({ error: "Email ou senha inválidos." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("organization_id, active, must_change_password").eq("id", data.user.id).single();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Usuário desativado." }, { status: 403 });
  }
  await audit({
    id: data.user.id,
    organizationId: profile.organization_id,
  }, "LOGIN", "profile", data.user.id);
  return NextResponse.json({ mustChangePassword: profile.must_change_password });
}
