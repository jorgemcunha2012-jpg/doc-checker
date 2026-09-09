import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { MfaForm } from "@/components/mfa-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MfaPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal2") redirect("/");

  return (
    <AuthShell eyebrow="Proteção da conta" title="Verificação em duas etapas" description="Confirme o código do seu aplicativo autenticador para continuar.">
      <MfaForm />
    </AuthShell>
  );
}
