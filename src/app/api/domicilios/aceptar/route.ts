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

export async function POST(req: Request) {
  try {
    const supabase = getAdmin();
    const { domicilio_id, repartidor_id } = await req.json();

    if (!domicilio_id || !repartidor_id) {
      return NextResponse.json(
        { error: "domicilio_id y repartidor_id requeridos" },
        { status: 400 },
      );
    }

    const { data: turnosActivos, error: turnoError } = await supabase
      .from("turnos")
      .select("id")
      .eq("activo", true)
      .limit(1);
    if (turnoError) throw turnoError;
    if (!turnosActivos?.length) {
      return NextResponse.json({ error: "El turno ya está cerrado" }, { status: 409 });
    }

    const { data: rider, error: riderError } = await supabase
      .from("repartidores")
      .select("id, estado, activo")
      .eq("id", repartidor_id)
      .single();
    if (riderError || !rider) {
      return NextResponse.json({ error: "Repartidor no encontrado" }, { status: 404 });
    }
    if (rider.activo === false || rider.estado !== "Disponible") {
      return NextResponse.json(
        { error: "Debes estar disponible para aceptar el domicilio" },
        { status: 409 },
      );
    }

    const { data: currentDelivery, error: currentDeliveryError } = await supabase
      .from("domicilios_disponibles")
      .select("id")
      .eq("repartidor_id", repartidor_id)
      .eq("estado", "aceptado")
      .limit(1);
    if (currentDeliveryError) throw currentDeliveryError;
    if (currentDelivery?.length) {
      return NextResponse.json(
        { error: "Ya tienes un domicilio activo. Debes terminarlo antes de aceptar otro." },
        { status: 409 },
      );
    }

    // Compare-and-set: solo la primera solicitud que encuentre estado disponible gana.
    const { data: updated, error: updateError } = await supabase
      .from("domicilios_disponibles")
      .update({
        estado: "aceptado",
        repartidor_id,
        aceptado_at: new Date().toISOString(),
      })
      .eq("id", domicilio_id)
      .eq("estado", "disponible")
      .is("repartidor_id", null)
      .select();
    if (updateError) throw updateError;

    if (!updated?.length) {
      return NextResponse.json(
        { error: "Este domicilio ya fue aceptado por otro repartidor" },
        { status: 409 },
      );
    }

    const domicilio = updated[0];
    const { error: orderError } = await supabase
      .from("pedidos_cliente")
      .update({ repartidor_id, estado: "asignado" })
      .eq("id", domicilio.pedido_cliente_id);
    if (orderError) {
      // Rollback compensatorio: si no se puede enlazar el pedido, se libera la oferta.
      await supabase
        .from("domicilios_disponibles")
        .update({ estado: "disponible", repartidor_id: null, aceptado_at: null })
        .eq("id", domicilio_id)
        .eq("repartidor_id", repartidor_id);
      throw orderError;
    }

    await supabase
      .from("repartidores")
      .update({ estado: "Ocupado" })
      .eq("id", repartidor_id);

    return NextResponse.json({ success: true, data: domicilio });
  } catch (error: any) {
    console.error("Error aceptando domicilio:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
