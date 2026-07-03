import { notFound, redirect } from "next/navigation";
import { AdminProcessDetail } from "@/components/admin-process-detail";
import { getCurrentUser, isMasterAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AdminProcessPage({ params }: { params: Promise<{ processId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isMasterAdmin(user)) redirect("/admin");
  const { processId } = await params;
  const { data: process } = await createSupabaseAdminClient()
    .from("validation_processes")
    .select("id, result, final_status, started_at, completed_at, profiles!validation_processes_user_id_fkey(name), process_documents(id, name, source, size_bytes, storage_path)")
    .eq("id", processId)
    .eq("organization_id", user.organizationId)
    .single();
  if (!process?.result) notFound();
  const { data: reviews } = await createSupabaseAdminClient().from("human_reviews").select("*").eq("process_id", processId);
  return <AppShell user={user}><AdminProcessDetail process={{
    ...process,
    profiles: Array.isArray(process.profiles) ? process.profiles[0] ?? null : process.profiles,
  }} reviews={reviews ?? []} currentUser={user} embedded /></AppShell>;
}
