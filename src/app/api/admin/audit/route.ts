import { NextResponse } from "next/server";
import { AuthError, isMasterAdmin, requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const admin = await requireAdmin();
    let query = createSupabaseAdminClient()
      .from("audit_events")
      .select("id, actor_id, event_type, entity_type, entity_id, metadata, created_at, profiles!audit_events_actor_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!isMasterAdmin(admin)) query = query.eq("organization_id", admin.organizationId);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ events: data });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
