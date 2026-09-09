import { notFound, redirect } from "next/navigation";
import { AdminProcessDetail } from "@/components/admin-process-detail";
import { getCurrentUser, isMasterAdmin } from "@/lib/auth";
import { getAccessibleProcessScope } from "@/lib/process-access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { IncompleteProcessDetail } from "@/components/incomplete-process-detail";

export default async function AdminProcessPage({ params }: { params: Promise<{ processId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");
  const { processId } = await params;
  const processScope = await getAccessibleProcessScope(user, processId);
  if (!processScope) notFound();
  const { data: process } = await createSupabaseAdminClient()
    .from("validation_processes")
    .select("id, result, processing_status, final_status, error, started_at, completed_at, profiles!validation_processes_user_id_fkey(name), process_documents(id, name, source, size_bytes, storage_path, purged_at)")
    .eq("id", processScope.id)
    .eq("organization_id", processScope.organizationId)
    .eq("user_id", processScope.userId)
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
  const showTechnicalExtractionDetails = isMasterAdmin(user);
  const visibleProcess = showTechnicalExtractionDetails
    ? normalizedProcess
    : { ...normalizedProcess, result: { ...normalizedProcess.result, extractionQualityBySource: undefined } };
  return <AppShell user={user}><AdminProcessDetail process={visibleProcess} reviews={reviews ?? []} currentUser={user} embedded showTechnicalExtractionDetails={showTechnicalExtractionDetails} /></AppShell>;
}
