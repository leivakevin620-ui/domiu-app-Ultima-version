import { createClient } from "@supabase/supabase-js";
import { asCoordinate, isFreshLocation, rankRidersByDistance } from "@/lib/dispatch";

const FALLBACK_VAPID_PUBLIC_KEY =
  "BFh0n5qxJo1oA0MADsQEOODyEkNan-QvFB5UgfhzGu0GyjkR30Mb1lTGShcAPJCafjZHwEt4nirMCzeGr_pACMQ";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const vapidPublicKey =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  FALLBACK_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:domiumagdalena@gmail.com";

interface PushSubscriptionRow {
  repartidor_id: string;
  subscription_json: string;
}

export function getPushPublicConfig() {
  return {
    enabled: Boolean(supabaseUrl && serviceKey && vapidPublicKey && vapidPrivateKey),
    publicKey: vapidPublicKey,
    subject: vapidSubject,
    missing: [
      !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !serviceKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
      !vapidPrivateKey ? "VAPID_PRIVATE_KEY" : null,
    ].filter(Boolean),
  };
}

export async function sendPushToSubscription(
  subscriptionJson: string,
  payload: Record<string, unknown>,
) {
  const config = getPushPublicConfig();
  if (!config.enabled) {
    throw new Error(`Web Push no está configurado: ${config.missing.join(", ")}`);
  }

  const webpush = await import("web-push");
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  return webpush.sendNotification(JSON.parse(subscriptionJson), JSON.stringify(payload), {
    TTL: 120,
    urgency: "high",
  });
}

export async function enviarPushCercanos(domicilio: any) {
  try {
    const config = getPushPublicConfig();
    if (!config.enabled) {
      return { sent: 0, selected: 0, error: `Variables Web Push incompletas: ${config.missing.join(", ")}` };
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("repartidor_id, subscription_json");
    if (subscriptionsError) throw subscriptionsError;
    if (!subscriptions?.length) return { sent: 0, selected: 0, reason: "no_subscriptions" };

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

    // Si ningún repartidor tiene GPS reciente, se avisa a un grupo pequeño de disponibles
    // para no dejar el pedido sin atención. La API de ofertas mantiene la prioridad geográfica.
    if (nearestIds.size === 0) {
      [...availableIds].slice(0, 3).forEach((id) => nearestIds.add(id));
    }

    const selectedSubscriptions = (subscriptions as PushSubscriptionRow[]).filter((item) =>
      nearestIds.has(item.repartidor_id),
    );
    if (!selectedSubscriptions.length) {
      return { sent: 0, selected: 0, reason: "no_eligible_subscriptions", available: availableIds.size };
    }

    let sent = 0;
    const errors: Array<{ riderId: string; statusCode?: number; message: string }> = [];

    await Promise.allSettled(
      selectedSubscriptions.map(async (row) => {
        try {
          const rankedRider = ranked.find((item) => item.repartidor_id === row.repartidor_id);
          await sendPushToSubscription(row.subscription_json, {
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
          sent += 1;
        } catch (error: any) {
          const statusCode = Number(error?.statusCode) || undefined;
          errors.push({
            riderId: row.repartidor_id,
            statusCode,
            message: error?.message || "Error enviando push",
          });

          if (statusCode === 404 || statusCode === 410) {
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

    const result = {
      sent,
      selected: selectedSubscriptions.length,
      riderIds: [...nearestIds],
      errors,
    };
    console.info("Resultado Web Push cercano", result);
    return result;
  } catch (error) {
    console.error("Error enviando push cercano:", error);
    return { sent: 0, selected: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

// Compatibilidad con llamadas antiguas: ahora prioriza cercanía en lugar de enviar a todos.
export async function enviarPushATodos(domicilio: any) {
  return enviarPushCercanos(domicilio);
}
