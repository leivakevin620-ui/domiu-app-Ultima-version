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
    const id = url.searchParams.get("id");

    if (id) {
      const { data, error } = await supabase.from("negocios").select("*").eq("id", id).single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    const { data, error } = await supabase.from("negocios").select("*").order("created_at", { ascending: false });
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
      const { error: delProd } = await supabase.from("productos").delete().eq("negocio_id", id);
      if (delProd) throw delProd;
      const { error } = await supabase.from("negocios").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Negocio eliminado" });
    }

    if (action === "toggle") {
      const { error } = await supabase.from("negocios").update({ activo: data.activo }).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Estado actualizado" });
    }

    if (id) {
      const { error } = await supabase.from("negocios").update(data).eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Negocio actualizado" });
    }

    const { data: nuevo, error } = await supabase.from("negocios").insert(data).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, data: nuevo, message: "Negocio creado" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
