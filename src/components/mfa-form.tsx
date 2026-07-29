"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Enrollment = {
  factorId: string;
  qrCode?: string;
  secret?: string;
  existing: boolean;
};

export function MfaForm() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    void prepare();
  }, []);

  async function prepare() {
    const supabase = createSupabaseBrowserClient();
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      setError("Não foi possível consultar o segundo fator.");
      setLoading(false);
      return;
    }
    const verified = factors.totp[0];
    if (verified) {
      setEnrollment({ factorId: verified.id, existing: true });
      setLoading(false);
      return;
    }
    await Promise.all(
      factors.all
        .filter((factor) => factor.status === "unverified")
        .map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })),
    );
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "ConferIA",
    });
    if (enrollError || !data) {
      setError("Não foi possível preparar o autenticador.");
      setLoading(false);
      return;
    }
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      existing: false,
    });
    setLoading(false);
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!enrollment || code.replace(/\D/g, "").length !== 6) {
      setError("Informe o código de 6 dígitos.");
      return;
    }
    setVerifying(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: code.replace(/\D/g, ""),
    });
    if (verifyError) {
      setError("Código inválido ou expirado.");
      setVerifying(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0f8f88] text-white">
        <KeyRound className="h-5 w-5" />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-slate-950">Verificação em duas etapas</h1>
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparando acesso seguro...
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {enrollment?.existing
              ? "Digite o código atual do seu aplicativo autenticador."
              : "Escaneie o QR Code no seu aplicativo autenticador e confirme o código gerado."}
          </p>
          {!enrollment?.existing && enrollment?.qrCode ? (
            <div className="mt-5 flex justify-center rounded-md border border-slate-200 bg-white p-4">
              {/* O QR Code é fornecido pela sessão autenticada do Supabase. */}
              <Image
                src={enrollment.qrCode}
                alt="QR Code para configurar autenticação em duas etapas"
                width={192}
                height={192}
                unoptimized
              />
            </div>
          ) : null}
          {!enrollment?.existing && enrollment?.secret ? (
            <p className="mt-3 break-all rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              Chave manual: <strong>{enrollment.secret}</strong>
            </p>
          ) : null}
          <form className="mt-5 space-y-4" onSubmit={verify}>
            <label className="block text-sm font-bold text-slate-700">
              Código de 6 dígitos
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-slate-300 px-3 text-center text-lg tracking-[0.3em] outline-none focus:border-[#0f8f88]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
            <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#0f8f88] px-4 text-sm font-bold text-white disabled:bg-slate-300" disabled={verifying || !enrollment}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirmar e entrar
            </button>
          </form>
        </>
      )}
    </section>
  );
}
