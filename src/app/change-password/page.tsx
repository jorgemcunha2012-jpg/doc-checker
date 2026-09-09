import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/change-password-form";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <AuthShell eyebrow="Primeiro acesso" title="Defina sua senha" description="Substitua a senha temporária antes de entrar na plataforma.">
      <ChangePasswordForm />
    </AuthShell>
  );
}
