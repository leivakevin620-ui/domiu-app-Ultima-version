import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { calcularTarifas, geocodificar, haversineKm } from "@/lib/tarifas";

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
    const { pedido_cliente_id, negocio_id } = await req.json();

    if (!pedido_cliente_id || !negocio_id) {
      return NextResponse.json({ error: "pedido_cliente_id y negocio_id requeridos" }, { status: 400 });
    }

    const { data: turnosActivos, error: turnoError } = await supabase
      .from("turnos")
      .select("id")
      .eq("activo", true)
      .limit(1);
    if (turnoError) throw turnoError;
    if (!turnosActivos?.length) {
      return NextResponse.json({ error: "No hay un turno operativo activo" }, { status: 409 });
    }

    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos_cliente")
      .select("codigo, cliente_nombre, cliente_telefono, cliente_direccion, domicilio, nota, negocios(nombre, direccion, latitud, longitud)")
      .eq("id", pedido_cliente_id)
      .single();
    if (pedidoError || !pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const negocio = Array.isArray(pedido.negocios) ? pedido.negocios[0] : pedido.negocios;
    if (!negocio) {
      return NextResponse.json({ error: "El pedido no tiene un negocio válido" }, { status: 409 });
    }

    const { data: existing } = await supabase
      .from("domicilios_disponibles")
      .select("id, estado")
      .eq("pedido_cliente_id", pedido_cliente_id)
      .neq("estado", "cancelado")
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "Este pedido ya tiene un domicilio publicado", data: existing },
        { status: 400 },
      );
    }

    let originCoords =
      Number.isFinite(Number(negocio.latitud)) && Number.isFinite(Number(negocio.longitud))
        ? { lat: Number(negocio.latitud), lng: Number(negocio.longitud) }
        : null;
    let destinationCoords = null as { lat: number; lng: number } | null;

    const geocodingTasks: Promise<void>[] = [];
    if (!originCoords && negocio.direccion) {
      geocodingTasks.push(
        geocodificar(negocio.direccion).then((coords) => {
          if (coords) originCoords = coords;
        }),
      );
    }
    if (pedido.cliente_direccion) {
      geocodingTasks.push(
        geocodificar(pedido.cliente_direccion).then((coords) => {
          if (coords) destinationCoords = coords;
        }),
      );
    }
    await Promise.all(geocodingTasks);

    const km = originCoords && destinationCoords ? haversineKm(originCoords, destinationCoords) : null;
    const tarifa = km !== null && km > 0 ? calcularTarifas(km) : null;
    const valorDomicilio = tarifa ? tarifa.precio : Number(pedido.domicilio || 5000);
    const pagoRepartidor = tarifa
      ? tarifa.pagoRepartidor
      : Math.round(Number(pedido.domicilio || 5000) * 0.75);
    const empresaRecibe = valorDomicilio - pagoRepartidor;

    const domicilio = {
      pedido_cliente_id,
      negocio_id,
      direccion_origen: negocio.direccion || negocio.nombre || "Dirección del negocio no registrada",
      direccion_destino: pedido.cliente_direccion,
      valor_domicilio: valorDomicilio,
      distancia_km: km,
      cliente_nombre: pedido.cliente_nombre,
      cliente_telefono: pedido.cliente_telefono,
      negocio_nombre: negocio.nombre || "Negocio",
      pedido_codigo: pedido.codigo,
      nota: pedido.nota || "",
      origen_lat: originCoords?.lat ?? null,
      origen_lng: originCoords?.lng ?? null,
      estado: "disponible",
    };

    const { data: inserted, error: insertError } = await supabase
      .from("domicilios_disponibles")
      .insert(domicilio)
      .select()
      .single();
    if (insertError) throw insertError;

    const { error: pedidoUpdateError } = await supabase
      .from("pedidos_cliente")
      .update({
        estado: "esperando_domiciliario",
        pago_repartidor: pagoRepartidor,
        comision_empresa: empresaRecibe,
        ganancia_empresa: empresaRecibe,
      })
      .eq("id", pedido_cliente_id);
    if (pedidoUpdateError) throw pedidoUpdateError;

    let pushResult: unknown = null;
    try {
      const { enviarPushCercanos } = await import("@/lib/push");
      pushResult = await enviarPushCercanos(inserted);
    } catch (error) {
      console.error("Error enviando push cercano:", error);
    }

    return NextResponse.json({ success: true, data: inserted, push: pushResult });
  } catch (error: any) {
    console.error("Error publicando domicilio:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
