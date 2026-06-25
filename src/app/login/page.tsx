import { Building2 } from "lucide-react";
import { LoginForm } from "@/components/login-form";
export default function LoginPage() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5"><section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white"><Building2 className="h-5 w-5" /></div><h1 className="mt-5 text-2xl font-bold text-slate-950">Acessar ConferIA</h1><p className="mt-2 text-sm leading-6 text-slate-500">Entre para processar documentos ou acompanhar a operação.</p><LoginForm /></section></main>;
}
