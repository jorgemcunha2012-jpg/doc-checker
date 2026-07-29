import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { audit } from "@/services/process/process-repository";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = normalizeLogin(email);
    if (await loginRateLimited(normalizedEmail)) {
      return NextResponse.json({
        error: "Muitas tentativas de acesso. Aguarde 15 minutos antes de tentar novamente.",
      }, { status: 429 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error || !data.user) {
      await auditFailedLogin(normalizedEmail, request);
      return NextResponse.json({ error: "Email ou senha inválidos." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, active, must_change_password, mfa_required")
      .eq("id", data.user.id)
      .single();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "Usuário autenticado, mas sem perfil operacional cadastrado." }, { status: 403 });
    }
    if (!profile.active) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "Usuário desativado." }, { status: 403 });
    }
    try {
      await createSupabaseAdminClient().from("profiles").update({
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", data.user.id);
      await audit({
        id: data.user.id,
        organizationId: profile.organization_id,
      }, "LOGIN", "profile", data.user.id, requestMetadata(request));
    } catch (error) {
      console.error("[ConferIA] Falha ao registrar auditoria de login", error);
    }
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return NextResponse.json({
      mustChangePassword: profile.must_change_password,
      requiresMfa: profile.mfa_required && assurance?.currentLevel !== "aal2",
    });
  } catch (error) {
    console.error("[ConferIA] Falha inesperada no login", error);
    return NextResponse.json({ error: "Não foi possível concluir o login. Confira as variáveis do Supabase em produção." }, { status: 500 });
  }
}

async function loginRateLimited(email: string) {
  if (!email) return false;
  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!profile) return false;
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "LOGIN_FAILED")
    .eq("entity_id", profile.id)
    .gte("created_at", cutoff);
  return (count ?? 0) >= 8;
}

async function auditFailedLogin(email: string, request: Request) {
  if (!email) return;
  try {
    const supabase = createSupabaseAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("email", email)
      .maybeSingle();
    if (!profile) return;
    await audit(
      { id: profile.id, organizationId: profile.organization_id },
      "LOGIN_FAILED",
      "profile",
      profile.id,
      requestMetadata(request),
    );
  } catch (error) {
    console.error("[ConferIA] Falha ao registrar tentativa de login", error);
  }
}

function requestMetadata(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwardedFor ?? request.headers.get("x-real-ip") ?? "unknown",
    userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? "unknown",
  };
}

function normalizeLogin(value: unknown) {
  const login = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!login) return "";
  return login.includes("@") ? login : `${login}@conferia.local`;
}
