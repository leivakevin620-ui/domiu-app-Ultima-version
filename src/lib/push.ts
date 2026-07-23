import { createClient } from "@supabase/supabase-js";
import { asCoordinate, isFreshLocation, rankRidersByDistance } from "@/lib/dispatch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:domiumagdalena@gmail.com";

interface PushSubscriptionRow {
  repartidor_id: string;
  subscription_json: string;
}

export async function enviarPushCercanos(domicilio: any) {
  try {
    if (!supabaseUrl || !serviceKey || !vapidPublicKey || !vapidPrivateKey) {
      return { sent: 0, error: "Variables Web Push incompletas" };
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("repartidor_id, subscription_json");
    if (subscriptionsError) throw subscriptionsError;
    if (!subscriptions?.length) return { sent: 0, selected: 0 };

    const riderIds = [...new Set(subscriptions.map((item) => item.repartidor_id).filter(Boolean))];
    const { data: riders, error: ridersError } = await supabase
      .from("repartidores")
      .select("id, estado, activo")
      .in("id", riderIds);
    if (ridersError) throw ridersError;

    const availableIds = new Set(
      (riders || [])
        .filter((rider: any) => rider.activo !== false && rider.estado === "Disponible")
        .map((rider: any) => rider.id),
    );

    const { data: locations, error: locationsError } = await supabase
      .from("ubicaciones_repartidores")
      .select("repartidor_id, latitud, longitud, estado, ultima_actualizacion")
      .in("repartidor_id", riderIds);
    if (locationsError) throw locationsError;

    const freshLocations = (locations || []).filter(
      (location: any) =>
        availableIds.has(location.repartidor_id) &&
        location.estado === "disponible" &&
        isFreshLocation(location.ultima_actualizacion, 15),
    );

    const origin = asCoordinate(domicilio.origen_lat, domicilio.origen_lng);
    const ranked = rankRidersByDistance(origin, freshLocations);
    const nearestIds = new Set(ranked.slice(0, 3).map((item) => item.repartidor_id));

    // Si ningún repartidor tiene GPS reciente, se usa un grupo pequeño de disponibles
    // para no dejar el pedido sin aviso, pero nunca se envía indiscriminadamente a todos.
    if (nearestIds.size === 0) {
      [...availableIds].slice(0, 3).forEach((id) => nearestIds.add(id));
    }

    const selectedSubscriptions = (subscriptions as PushSubscriptionRow[]).filter((item) =>
      nearestIds.has(item.repartidor_id),
    );
    if (!selectedSubscriptions.length) return { sent: 0, selected: 0 };

    const webpush = await import("web-push");
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    let sent = 0;
    await Promise.allSettled(
      selectedSubscriptions.map(async (row) => {
        try {
          const rankedRider = ranked.find((item) => item.repartidor_id === row.repartidor_id);
          const payload = JSON.stringify({
            title: "Nuevo domicilio cercano",
            body: `${domicilio.negocio_nombre || "Negocio"} → ${domicilio.direccion_destino || "Destino"} · $${Number(domicilio.valor_domicilio || 0).toLocaleString("es-CO")}`,
            domicilioId: domicilio.id,
            url: `/repartidor?oferta=${domicilio.id}`,
            pedido: {
              codigo: domicilio.pedido_codigo,
              negocio: domicilio.negocio_nombre,
              origen: domicilio.direccion_origen,
              cliente: domicilio.cliente_nombre,
              telefono: domicilio.cliente_telefono,
              destino: domicilio.direccion_destino,
              valor: domicilio.valor_domicilio,
              distanciaKm: Number.isFinite(rankedRider?.distanceKm)
                ? Number(rankedRider?.distanceKm.toFixed(2))
                : null,
            },
          });

          await webpush.sendNotification(JSON.parse(row.subscription_json), payload, {
            TTL: 90,
            urgency: "high",
          });
          sent += 1;
        } catch (error: any) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("repartidor_id", row.repartidor_id);
          } else {
            console.error("Push fallido para repartidor", row.repartidor_id, error?.message || error);
          }
        }
      }),
    );

    return {
      sent,
      selected: selectedSubscriptions.length,
      riderIds: [...nearestIds],
    };
  } catch (error) {
    console.error("Error enviando push cercano:", error);
    return { sent: 0, error };
  }
}

// Compatibilidad con llamadas antiguas: ahora prioriza cercanía en lugar de enviar a todos.
export async function enviarPushATodos(domicilio: any) {
  return enviarPushCercanos(domicilio);
}
