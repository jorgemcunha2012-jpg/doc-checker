import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Altere para false somente quando os créditos do provedor forem regularizados.
const CONFERIA_PAUSED = true;
const PAUSE_MESSAGE = "Créditos insuficientes. O ConferIA está temporariamente pausado.";

function pausedResponse(request: NextRequest) {
  const headers = {
    "Cache-Control": "no-store, max-age=0",
    "Retry-After": "3600",
  };

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: PAUSE_MESSAGE }, { status: 503, headers });
  }

  return new NextResponse(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ConferIA temporariamente pausado</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif"><main style="width:min(520px,calc(100% - 48px));padding:40px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;box-shadow:0 16px 40px rgba(15,23,42,.08)"><p style="margin:0 0 12px;color:#0f766e;font-weight:700">ConferIA</p><h1 style="margin:0 0 16px;font-size:28px">Ferramenta temporariamente pausada</h1><p style="margin:0;color:#475569;font-size:16px;line-height:1.6">${PAUSE_MESSAGE}</p></main></body></html>`,
    { status: 503, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function middleware(request: NextRequest) {
  if (CONFERIA_PAUSED) {
    return pausedResponse(request);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Origem da requisição não autorizada." }, { status: 403 });
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const publicPath = path === "/login" || path.startsWith("/api/auth/");

  if (!user && !publicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && !publicPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("active, must_change_password, mfa_required")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.active) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    if (profile.must_change_password && path !== "/change-password") {
      const url = request.nextUrl.clone();
      url.pathname = "/change-password";
      return NextResponse.redirect(url);
    }
    if (profile.mfa_required && !profile.must_change_password && path !== "/mfa") {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.currentLevel !== "aal2") {
        const url = request.nextUrl.clone();
        url.pathname = "/mfa";
        return NextResponse.redirect(url);
      }
    }
  }
  return response;
}

export const config = {
  matcher: ["/:path*"],
};
