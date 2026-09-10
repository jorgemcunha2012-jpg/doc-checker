import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProductionDeployment, productionConfigurationProblems } from "@/lib/security/production-environment";
import { contentSecurityPolicy } from "@/lib/security/content-security-policy";

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const secureResponse = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    return response;
  };
  if (isProductionDeployment() && productionConfigurationProblems().length) {
    return secureResponse(NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 }));
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return secureResponse(NextResponse.json({ error: "Origem da requisição não autorizada." }, { status: 403 }));
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return secureResponse(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
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
    return secureResponse(NextResponse.redirect(url));
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
      return secureResponse(NextResponse.redirect(url));
    }
    if (profile.must_change_password && path !== "/change-password") {
      const url = request.nextUrl.clone();
      url.pathname = "/change-password";
      return secureResponse(NextResponse.redirect(url));
    }
    if (profile.mfa_required && !profile.must_change_password && path !== "/mfa") {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.currentLevel !== "aal2") {
        const url = request.nextUrl.clone();
        url.pathname = "/mfa";
        return secureResponse(NextResponse.redirect(url));
      }
    }
  }
  return secureResponse(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
