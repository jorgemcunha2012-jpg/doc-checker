import { NextResponse } from "next/server";
import { AuthError, requireMasterAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const admin = await requireMasterAdmin();
    const { data, error } = await createSupabaseAdminClient()
      .from("audit_events")
      .select("id, event_type, entity_type, entity_id, metadata, created_at, profiles!audit_events_actor_id_fkey(name)")
      .eq("organization_id", admin.organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ events: data });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
