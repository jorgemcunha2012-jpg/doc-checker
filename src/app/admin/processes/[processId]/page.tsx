import { notFound, redirect } from "next/navigation";
import { AdminProcessDetail } from "@/components/admin-process-detail";
import { getCurrentUser, isMasterAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { IncompleteProcessDetail } from "@/components/incomplete-process-detail";

export default async function AdminProcessPage({ params }: { params: Promise<{ processId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isMasterAdmin(user)) redirect("/admin");
  const { processId } = await params;
  const { data: process } = await createSupabaseAdminClient()
    .from("validation_processes")
    .select("id, result, processing_status, final_status, error, started_at, completed_at, profiles!validation_processes_user_id_fkey(name), process_documents(id, name, source, size_bytes, storage_path)")
    .eq("id", processId)
    .eq("organization_id", user.organizationId)
    .single();
  if (!process) notFound();
  const normalizedProcess = {
    ...process,
    profiles: Array.isArray(process.profiles) ? process.profiles[0] ?? null : process.profiles,
  };
  if (!process.result) {
    return <AppShell user={user}><IncompleteProcessDetail process={normalizedProcess} backHref="/admin" /></AppShell>;
  }
  const { data: reviews } = await createSupabaseAdminClient().from("human_reviews").select("*").eq("process_id", processId);
  return <AppShell user={user}><AdminProcessDetail process={normalizedProcess} reviews={reviews ?? []} currentUser={user} embedded /></AppShell>;
}
