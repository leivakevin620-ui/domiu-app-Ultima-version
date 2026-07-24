import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const RIDER_ID = "5518ae6a-8d71-4a79-9fcd-857646aa9be0";

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const marker = `E2E-${Date.now()}`;
  let pedidoId: string | null = null;
  let domicilioId: string | null = null;
  let codigo: string | null = null;
  let previousRider: { estado: string; activo: boolean } | null = null;

  try {
    const { data: rider, error: riderReadError } = await supabase
      .from("repartidores")
      .select("estado,activo")
      .eq("id", RIDER_ID)
      .single();
    if (riderReadError) throw riderReadError;
    previousRider = rider;

    const payload = {
      cliente_nombre: marker,
      cliente_telefono: "0000000000",
      cliente_direccion: "Prueba técnica temporal",
      cliente_barrio: "Diagnóstico",
      nota: marker,
      negocio_id: "85abcf4d-d8ce-4b85-96a3-5d8c173a8f58",
      domicilio: 5000,
      metodo_pago: "efectivo",
      propina: 0,
      tarifa_servicio: 0,
      distancia_km: 1,
      items: [{
        productId: "e0df660f-9ac5-4caf-a532-653e1f8696f1",
        nombre: "Orden de 30 alitas",
        precio: 112000,
        cantidad: 1,
      }],
    };

    const createResponse = await fetch(new URL("/api/cliente/pedidos", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const createResult = await createResponse.json();
    if (!createResponse.ok) {
      throw new Error(`create_order ${createResponse.status}: ${createResult?.error || JSON.stringify(createResult)}`);
    }

    pedidoId = createResult?.pedido?.id || null;
    codigo = createResult?.pedido?.codigo || null;
    if (!pedidoId || !codigo) throw new Error("La API creó una respuesta incompleta");

    const { data: order, error: readError } = await supabase
      .from("pedidos_cliente")
      .select("id,codigo,estado,total,detalle_pedido_cliente(id),domicilios_disponibles(id,estado)")
      .eq("id", pedidoId)
      .single();
    if (readError) throw readError;

    const detailsCount = Array.isArray(order.detalle_pedido_cliente) ? order.detalle_pedido_cliente.length : 0;
    const offers = Array.isArray(order.domicilios_disponibles) ? order.domicilios_disponibles : [];
    if (detailsCount !== 1 || offers.length !== 1) {
      throw new Error(`Integridad incompleta: detalles=${detailsCount}, ofertas=${offers.length}`);
    }
    domicilioId = offers[0].id;

    const { error: riderReadyError } = await supabase
      .from("repartidores")
      .update({ estado: "Disponible", activo: true })
      .eq("id", RIDER_ID);
    if (riderReadyError) throw riderReadyError;

    const acceptResponse = await fetch(new URL("/api/domicilios/aceptar", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domicilio_id: domicilioId, repartidor_id: RIDER_ID }),
      cache: "no-store",
    });
    const acceptResult = await acceptResponse.json();
    if (!acceptResponse.ok) {
      throw new Error(`accept_delivery ${acceptResponse.status}: ${acceptResult?.error || JSON.stringify(acceptResult)}`);
    }

    const stateResponse = await fetch(new URL("/api/admin/marketplace", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pedidoId, action: "cambiar_estado", estado: "entregado" }),
      cache: "no-store",
    });
    const stateResult = await stateResponse.json();
    if (!stateResponse.ok) {
      throw new Error(`marketplace_state ${stateResponse.status}: ${stateResult?.error || JSON.stringify(stateResult)}`);
    }

    const { data: finalOrder, error: finalReadError } = await supabase
      .from("pedidos_cliente")
      .select("estado,repartidor_id,pago_repartidor,comision_empresa,ganancia_empresa,actualizado_en")
      .eq("id", pedidoId)
      .single();
    if (finalReadError) throw finalReadError;
    if (finalOrder.estado !== "entregado" || finalOrder.repartidor_id !== RIDER_ID) {
      throw new Error("El pedido no conservó la asignación o el estado final");
    }

    return NextResponse.json({
      ok: true,
      stages: {
        createOrder: true,
        details: detailsCount,
        deliveryOffer: offers.length,
        acceptDelivery: true,
        marketplaceState: finalOrder.estado,
        financialSplit: {
          courier: finalOrder.pago_repartidor,
          company: finalOrder.comision_empresa,
        },
      },
      codigo,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      stage: "verification",
      error: error instanceof Error ? error.message : String(error),
      pedidoId,
      domicilioId,
      codigo,
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  } finally {
    if (pedidoId) {
      await supabase.from("domicilios_disponibles").delete().eq("pedido_cliente_id", pedidoId);
      await supabase.from("detalle_pedido_cliente").delete().eq("pedido_id", pedidoId);
      await supabase.from("pedidos_cliente").delete().eq("id", pedidoId);
    } else {
      await supabase.from("pedidos_cliente").delete().eq("nota", marker);
    }
    if (previousRider) {
      await supabase
        .from("repartidores")
        .update({ estado: previousRider.estado, activo: previousRider.activo })
        .eq("id", RIDER_ID);
    }
  }
}
