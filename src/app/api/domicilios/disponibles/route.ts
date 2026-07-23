import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdmin() {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getActiveTurnStart(supabase: ReturnType<typeof getAdmin>) {
  const { data, error } = await supabase
    .from("turnos")
    .select("opened_at, created_at")
    .eq("activo", true)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.opened_at || data?.created_at || null;
}

export async function GET(req: Request) {
  try {
    const supabase = getAdmin();
    const { searchParams } = new URL(req.url);
    const repartidorId = searchParams.get("repartidor_id");
    const onlyMine = searchParams.get("mis_aceptados") === "true";
    const scope = searchParams.get("scope") || "current";

    const activeTurnStart = scope === "history" ? null : await getActiveTurnStart(supabase);
    if (scope !== "history" && !activeTurnStart) return NextResponse.json([]);

    let query = supabase
      .from("domicilios_disponibles")
      .select("*")
      .order("created_at", { ascending: false });

    if (activeTurnStart) query = query.gte("created_at", activeTurnStart);

    if (onlyMine && repartidorId) {
      query = query
        .eq("repartidor_id", repartidorId)
        .neq("estado", "cancelado");
    } else {
      query = query.eq("estado", "disponible");
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
