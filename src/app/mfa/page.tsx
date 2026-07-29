import { redirect } from "next/navigation";
import { MfaForm } from "@/components/mfa-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MfaPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal2") redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <MfaForm />
    </main>
  );
}
