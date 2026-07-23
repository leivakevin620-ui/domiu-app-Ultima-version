import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getAdmin() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase no está configurado para registrar notificaciones");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const supabase = getAdmin();
    const { subscription, repartidor_id } = await req.json();

    if (!repartidor_id || typeof repartidor_id !== "string") {
      return NextResponse.json({ error: "repartidor_id requerido" }, { status: 400 });
    }

    const endpoint = subscription?.endpoint;
    const authKey = subscription?.keys?.auth;
    const p256dhKey = subscription?.keys?.p256dh;
    if (!endpoint || !authKey || !p256dhKey) {
      return NextResponse.json(
        { error: "La suscripción enviada por el navegador está incompleta" },
        { status: 422 },
      );
    }

    const { data: rider, error: riderError } = await supabase
      .from("repartidores")
      .select("id")
      .eq("id", repartidor_id)
      .maybeSingle();
    if (riderError) throw riderError;
    if (!rider) {
      return NextResponse.json({ error: "Repartidor no encontrado" }, { status: 404 });
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        repartidor_id,
        endpoint,
        auth_key: authKey,
        p256dh_key: p256dhKey,
        subscription_json: JSON.stringify(subscription),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "repartidor_id" },
    );

    if (error) throw error;
    console.info("Suscripción push registrada", { repartidor_id, endpointHost: new URL(endpoint).host });
    return NextResponse.json({ success: true, repartidor_id });
  } catch (error: any) {
    console.error("Error registrando suscripción push:", error);
    return NextResponse.json({ error: error?.message || "Error registrando notificaciones" }, { status: 500 });
  }
}
