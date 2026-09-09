import { LoginForm } from "@/components/login-form";
import { AuthShell } from "@/components/auth-shell";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell eyebrow="Acesso da organização" title="Entrar no ConferIA" description="Use o email ou usuário fornecido pela sua organização.">
      <LoginForm error={error} />
    </AuthShell>
  );
}
