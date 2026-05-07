import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  try {
    if (!serviceKey) {
      return NextResponse.json({ error: "Servidor no configurado" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { cliente_nombre, cliente_telefono, cliente_direccion, cliente_barrio, nota, negocio_id, domicilio, items } = body;

    if (!cliente_nombre || !cliente_telefono || !cliente_direccion || !negocio_id || !items || items.length === 0) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    let subtotal = 0;
    for (const item of items) {
      subtotal += item.precio * item.cantidad;
    }
    const total = subtotal + (domicilio || 0);

    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos_cliente")
      .insert({
        cliente_nombre,
        cliente_telefono,
        cliente_direccion,
        cliente_barrio: cliente_barrio || "",
        nota: nota || "",
        negocio_id,
        subtotal,
        domicilio: domicilio || 0,
        total,
        estado: "recibido",
      })
      .select("id, codigo")
      .single();

    if (pedidoError) throw pedidoError;

    const detalles = items.map((item: any) => ({
      pedido_id: pedido.id,
      producto_id: item.productId,
      producto_nombre: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio,
      subtotal: item.precio * item.cantidad,
    }));

    const { error: detalleError } = await supabase
      .from("detalle_pedido_cliente")
      .insert(detalles);

    if (detalleError) throw detalleError;

    return NextResponse.json({ success: true, pedido: { id: pedido.id, codigo: pedido.codigo } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    const codigo = url.searchParams.get("codigo");
    const telefono = url.searchParams.get("telefono");

    if (codigo) {
      const { data, error } = await supabase
        .from("pedidos_cliente")
        .select("*, detalle_pedido_cliente(*), negocios(nombre, logo)")
        .eq("codigo", codigo)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json(data || null);
    }

    if (telefono) {
      const { data, error } = await supabase
        .from("pedidos_cliente")
        .select("*, negocios(nombre)")
        .eq("cliente_telefono", telefono)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    return NextResponse.json([]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
