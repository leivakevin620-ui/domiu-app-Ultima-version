self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));

async function openRiderUrl(url) {
  const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if ("focus" in client) {
      await client.focus();
      if ("navigate" in client) await client.navigate(url);
      return;
    }
  }
  if (clients.openWindow) await clients.openWindow(url);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const domicilioId = data.domicilioId;
  let url = data.url || "/repartidor";

  if (event.action === "aceptar" && domicilioId) {
    url = `/repartidor?aceptar=${encodeURIComponent(domicilioId)}`;
  } else if (event.action === "rechazar" && domicilioId) {
    url = `/repartidor?rechazar=${encodeURIComponent(domicilioId)}`;
  } else if (domicilioId) {
    url = `/repartidor?oferta=${encodeURIComponent(domicilioId)}`;
  }

  event.waitUntil(openRiderUrl(url));
});

self.addEventListener("push", (event) => {
  let data = { title: "DomiU", body: "Nuevo domicilio disponible", domicilioId: null, pedido: null };
  try {
    data = { ...data, ...(event.data?.json() || {}) };
  } catch {}

  const pedido = data.pedido || {};
  const details = [
    pedido.codigo ? `#${pedido.codigo}` : null,
    pedido.negocio || null,
    pedido.destino || null,
    pedido.valor ? `$${Number(pedido.valor).toLocaleString("es-CO")}` : null,
  ].filter(Boolean);

  event.waitUntil(
    self.registration.showNotification(data.title || "Nuevo domicilio cercano", {
      body: details.length ? details.join(" · ") : data.body,
      icon: "/icon.png",
      badge: "/icon.png",
      tag: `domi-oferta-${data.domicilioId || "nueva"}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [300, 120, 300, 120, 500, 150, 500],
      timestamp: Date.now(),
      data: {
        domicilioId: data.domicilioId,
        url: data.url || "/repartidor",
        pedido,
      },
      actions: [
        { action: "aceptar", title: "Aceptar domicilio" },
        { action: "rechazar", title: "Rechazar" },
      ],
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLOSE_DOMICILIO_NOTIFICATIONS") {
    event.waitUntil(
      self.registration.getNotifications().then((notifications) => {
        notifications.forEach((notification) => {
          if (notification.tag?.startsWith("domi-oferta-")) notification.close();
        });
      }),
    );
  }
});
