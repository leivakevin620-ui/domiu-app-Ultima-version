import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const marker = `E2E-${Date.now()}`;
  let pedidoId: string | null = null;
  let codigo: string | null = null;

  try {
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

    const response = await fetch(new URL("/api/cliente/pedidos", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) {
      return NextResponse.json({ ok: false, stage: "create_order", status: response.status, result }, { status: 500 });
    }

    pedidoId = result?.pedido?.id || null;
    codigo = result?.pedido?.codigo || null;
    if (!pedidoId || !codigo) throw new Error("La API creó una respuesta incompleta");

    const { data: order, error: readError } = await supabase
      .from("pedidos_cliente")
      .select("id,codigo,estado,total,detalle_pedido_cliente(id),domicilios_disponibles(id,estado)")
      .eq("id", pedidoId)
      .single();
    if (readError) throw readError;

    const detailsCount = Array.isArray(order.detalle_pedido_cliente) ? order.detalle_pedido_cliente.length : 0;
    const offersCount = Array.isArray(order.domicilios_disponibles) ? order.domicilios_disponibles.length : 0;
    if (detailsCount !== 1 || offersCount !== 1) {
      throw new Error(`Integridad incompleta: detalles=${detailsCount}, ofertas=${offersCount}`);
    }

    return NextResponse.json({
      ok: true,
      stages: {
        api: true,
        order: true,
        details: detailsCount,
        deliveryOffer: offersCount,
      },
      codigo,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      stage: "verification",
      error: error instanceof Error ? error.message : String(error),
      pedidoId,
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
  }
}
