import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { audit } from "@/services/process/process-repository";

export async function POST() {
  const user = await requireUser({ allowPasswordChange: true, allowMfaSetup: true });
  const supabase = await createSupabaseServerClient();
  await audit(user, "LOGOUT", "profile", user.id);
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
