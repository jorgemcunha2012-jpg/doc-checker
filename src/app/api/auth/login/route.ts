import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { audit } from "@/services/process/process-repository";

export async function POST(request: Request) {
  const isFormSubmission = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded") ?? false;
  try {
    const credentials = isFormSubmission
      ? Object.fromEntries(await request.formData())
      : await request.json();
    const { email, password } = credentials;
    const normalizedEmail = normalizeLogin(email);
    if (await loginRateLimited(normalizedEmail)) {
      return loginFailure(request, isFormSubmission, "Muitas tentativas de acesso. Aguarde 15 minutos antes de tentar novamente.", 429);
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error || !data.user) {
      await auditFailedLogin(normalizedEmail, request);
      return loginFailure(request, isFormSubmission, "Email ou senha inválidos.", 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, active, must_change_password, mfa_required")
      .eq("id", data.user.id)
      .single();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      return loginFailure(request, isFormSubmission, "Usuário autenticado, mas sem perfil operacional cadastrado.", 403);
    }
    if (!profile.active) {
      await supabase.auth.signOut();
      return loginFailure(request, isFormSubmission, "Usuário desativado.", 403);
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
    const mustChangePassword = profile.must_change_password;
    const requiresMfa = profile.mfa_required && assurance?.currentLevel !== "aal2";
    if (isFormSubmission) {
      const destination = mustChangePassword ? "/change-password" : requiresMfa ? "/mfa" : "/";
      return NextResponse.redirect(new URL(destination, request.url), 303);
    }
    return NextResponse.json({ mustChangePassword, requiresMfa });
  } catch (error) {
    console.error("[ConferIA] Falha inesperada no login", error);
    return loginFailure(request, isFormSubmission, "Não foi possível concluir o login. Confira as variáveis do Supabase em produção.", 500);
  }
}

function loginFailure(request: Request, isFormSubmission: boolean, error: string, status: number) {
  if (isFormSubmission) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url, 303);
  }
  return NextResponse.json({ error }, { status });
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
