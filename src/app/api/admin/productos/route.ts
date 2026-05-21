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
    const negocioId = url.searchParams.get("negocio_id");

    let query = supabase.from("productos").select("*").order("created_at", { ascending: false });
    if (negocioId) query = query.eq("negocio_id", negocioId);

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
    const { id, action, ...data } = body;

    if (action === "delete") {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Producto eliminado" });
    }

    if (action === "toggle") {
      const { error } = await supabase.from("productos").update({ disponible: data.disponible }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Estado actualizado" });
    }

    if (id) {
      const { error } = await supabase.from("productos").update(data).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Producto actualizado" });
    }

    const { data: nuevo, error } = await supabase.from("productos").insert(data).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, data: nuevo, message: "Producto creado" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
