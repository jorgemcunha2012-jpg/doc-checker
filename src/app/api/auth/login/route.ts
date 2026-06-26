import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { audit } from "@/services/process/process-repository";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const normalizedEmail = normalizeLogin(email);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error || !data.user) return NextResponse.json({ error: "Email ou senha inválidos." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("organization_id, active, must_change_password").eq("id", data.user.id).single();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Usuário desativado." }, { status: 403 });
  }
  try {
    await audit({
      id: data.user.id,
      organizationId: profile.organization_id,
    }, "LOGIN", "profile", data.user.id);
  } catch (error) {
    console.error("[ConferIA] Falha ao registrar auditoria de login", error);
  }
  return NextResponse.json({ mustChangePassword: profile.must_change_password });
}

function normalizeLogin(value: unknown) {
  const login = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!login) return "";
  return login.includes("@") ? login : `${login}@conferia.local`;
}
