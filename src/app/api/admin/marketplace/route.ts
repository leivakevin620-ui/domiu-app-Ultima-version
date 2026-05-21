import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: Request) {
  try {
    const supabase = getAdminClient();
    const url = new URL(req.url);
    const estado = url.searchParams.get("estado");

    let query = supabase
      .from("pedidos_cliente")
      .select("*, negocios!inner(nombre), repartidores!left(nombre, vehiculo, telefono)")
      .order("created_at", { ascending: false });

    if (estado) query = query.eq("estado", estado);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getAdminClient();
    const body = await req.json();
    const { id, action, estado, repartidor_id } = body;

    if (action === "cambiar_estado") {
      const update: any = { estado, actualizado_en: new Date().toISOString() };
      if (estado === "en_preparacion") update.estado_negocio = "en_preparacion";
      if (estado === "listo_para_recoger") update.estado_negocio = "listo_para_recoger";
      if (["asignado", "en_camino", "entregado"].includes(estado)) update.estado_negocio = "listo_para_recoger";
      if (estado === "entregado") {
        const { data: pedido } = await supabase.from("pedidos_cliente").select("domicilio").eq("id", id).single();
        const costoEnvio = pedido?.domicilio || 0;
        const comision = Math.round(costoEnvio * 0.2);
        update.comision_empresa = comision;
        update.pago_repartidor = costoEnvio - comision;
        update.ganancia_empresa = comision;
      }
      const { error } = await supabase.from("pedidos_cliente").update(update).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "asignar_repartidor") {
      const { error } = await supabase.from("pedidos_cliente").update({
        repartidor_id, estado: "asignado", estado_negocio: "listo_para_recoger", actualizado_en: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Accion no valida" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
