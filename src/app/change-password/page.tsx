import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getCurrentUser } from "@/lib/auth";
export default async function ChangePasswordPage() {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5"><section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7"><h1 className="text-2xl font-bold text-slate-950">Crie sua nova senha</h1><p className="mt-2 text-sm leading-6 text-slate-500">A senha temporária deve ser substituída antes de continuar.</p><ChangePasswordForm /></section></main>;
}
