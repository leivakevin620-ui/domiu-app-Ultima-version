import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/app/repartidor/page.tsx';
let source = readFileSync(path, 'utf8');

function replaceRequired(search, replacement, label) {
  if (typeof search === 'string') {
    if (!source.includes(search)) throw new Error(`No se encontró el bloque requerido: ${label}`);
    source = source.replace(search, replacement);
    return;
  }
  if (!search.test(source)) throw new Error(`No se encontró el patrón requerido: ${label}`);
  source = source.replace(search, replacement);
}

if (!source.includes('type PushStatus')) {
  replaceRequired(
    'type PerfilSubtab = "info" | "liquidacion" | "gps";',
    'type PerfilSubtab = "info" | "liquidacion" | "gps";\ntype PushStatus = "checking" | "ready" | "inactive" | "blocked" | "unsupported" | "error";',
    'tipo del estado Web Push',
  );
}

if (!source.includes('const [pushStatus')) {
  replaceRequired(
    '  const [domiNotif, setDomiNotif] = useState<any>(null);',
    `  const [domiNotif, setDomiNotif] = useState<any>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus>("checking");
  const [pushMessage, setPushMessage] = useState("Comprobando notificaciones...");
  const [activatingPush, setActivatingPush] = useState(false);`,
    'estado de notificaciones',
  );
}

const pushBlock = /  \/\/ Registrar Service Worker y mantener una única suscripción push por repartidor\.[\s\S]*?  \}, \[riderData\?\.id\]\);/;
replaceRequired(
  pushBlock,
  `  const registrarPush = useCallback(async (
    requestPermission: boolean,
    resetSubscription: boolean,
    sendTest: boolean,
  ) => {
    if (!riderData?.id) return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushStatus("unsupported");
      setPushMessage("Este dispositivo no admite notificaciones Web Push.");
      return false;
    }

    setActivatingPush(true);
    setPushStatus("checking");
    setPushMessage("Configurando notificaciones...");

    try {
      const configResponse = await fetch("/api/push/config", { cache: "no-store" });
      const config = await configResponse.json();
      if (!configResponse.ok || !config.enabled || !config.publicKey) {
        const missing = Array.isArray(config.missing) ? config.missing.join(", ") : "configuración del servidor";
        throw new Error("Web Push incompleto: " + missing);
      }

      let permission = Notification.permission;
      if (requestPermission && permission !== "granted") {
        permission = await Notification.requestPermission();
      }
      if (permission === "denied") {
        setPushStatus("blocked");
        setPushMessage("Las notificaciones están bloqueadas. Actívalas en los permisos del navegador.");
        return false;
      }
      if (permission !== "granted") {
        setPushStatus("inactive");
        setPushMessage("Pulsa Activar para recibir nuevos domicilios aunque la app esté en segundo plano.");
        return false;
      }

      const registration = await navigator.serviceWorker.register("/sw.js?v=20260723-4", {
        updateViaCache: "none",
      });
      await registration.update().catch(() => {});
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (resetSubscription && subscription) {
        await subscription.unsubscribe().catch(() => false);
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        });
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          repartidor_id: riderData.id,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo registrar este dispositivo");

      setPushStatus("ready");
      setPushMessage("Notificaciones activas en este dispositivo.");

      if (sendTest) {
        const testResponse = await fetch("/api/push/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repartidor_id: riderData.id }),
        });
        const testResult = await testResponse.json().catch(() => ({}));
        if (!testResponse.ok) throw new Error(testResult.error || "La prueba no pudo entregarse");
        setPushMessage("Notificaciones activas. Se envió una prueba a este teléfono.");
        ok("Notificación de prueba enviada");
      }

      return true;
    } catch (error: any) {
      console.error("Error registrando Web Push:", error);
      setPushStatus("error");
      setPushMessage(error?.message || "No se pudieron activar las notificaciones.");
      return false;
    } finally {
      setActivatingPush(false);
    }
  }, [riderData?.id]);

  useEffect(() => {
    if (!riderData?.id || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      void registrarPush(false, false, false);
    } else if (Notification.permission === "denied") {
      setPushStatus("blocked");
      setPushMessage("Las notificaciones están bloqueadas en este navegador.");
    } else {
      setPushStatus("inactive");
      setPushMessage("Activa las notificaciones para recibir las ofertas de domicilio.");
    }
  }, [riderData?.id, registrarPush]);

  async function activarNotificaciones() {
    await registrarPush(true, true, true);
  }

  async function probarNotificacion() {
    if (!riderData?.id) return;
    setActivatingPush(true);
    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repartidor_id: riderData.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo enviar la prueba");
      ok("Notificación de prueba enviada");
      setPushStatus("ready");
      setPushMessage("Notificaciones activas. Revisa la notificación de prueba.");
    } catch (error: any) {
      setPushStatus("error");
      setPushMessage(error?.message || "La prueba de notificación falló.");
      fail(error?.message || "La prueba de notificación falló");
    } finally {
      setActivatingPush(false);
    }
  }`,
  'registro Web Push con gesto del usuario',
);

replaceRequired(
  '.select("id, codigo, cliente_nombre, cliente_telefono, cliente_direccion, total, domicilio, estado, created_at, nota")',
  '.select("id, codigo, cliente_nombre, cliente_telefono, cliente_direccion, total, domicilio, estado, created_at, nota, metodo_pago, pago_repartidor, comision_empresa, ganancia_empresa")',
  'campos financieros de pedidos marketplace',
);

const totalsBlock = /  const activos = pedidos\.filter\(\(p\) => !\["Entregado", "Cancelado"\]\.includes\(p\.estado\)\);[\s\S]*?  const todosLiquidados = entregados\.length > 0 && entregados\.every\(\(p\) => p\.liquidado\);/;
replaceRequired(
  totalsBlock,
  `  const activos = pedidos.filter((p) => !["Entregado", "Cancelado"].includes(p.estado));
  const entregados = pedidos.filter((p) => p.estado === "Entregado");
  const pcEntregados = pcPedidos.filter((p: any) => String(p.estado || "").toLowerCase() === "entregado");
  const totalEntregados = entregados.length + pcEntregados.length;
  const totalGenerado =
    entregados.reduce((sum, pedido) => sum + Number(pedido.precio || 0), 0) +
    pcEntregados.reduce((sum, pedido) => sum + Number(pedido.domicilio || 0), 0);
  const totalEmpresa =
    entregados.reduce((sum, pedido) => sum + Number(pedido.empresa_recibe || 0), 0) +
    pcEntregados.reduce(
      (sum, pedido) => sum + Number(pedido.comision_empresa || pedido.ganancia_empresa || 0),
      0,
    );
  const totalRepartidor =
    entregados.reduce((sum, pedido) => sum + Number(pedido.pago_repartidor || 0), 0) +
    pcEntregados.reduce(
      (sum, pedido) => sum + Number(pedido.pago_repartidor || pedido.domicilio || 0),
      0,
    );
  const ultimo = pedidos[0] || pcPedidos[0] || null;
  const todosLiquidados = entregados.length > 0 && entregados.every((p) => p.liquidado);`,
  'totales financieros del repartidor',
);

source = source.replaceAll('{entregados.length}', '{totalEntregados}');
source = source.replaceAll('`${entregados.length}`', '`${totalEntregados}`');

replaceRequired(
  `          <div>
            <p style={{ margin: 0, fontSize: 11, color: colors.gray500 }}>Entregados</p>
            <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 800, color: colors.white }}>{totalEntregados}</p>
          </div>
        </div>`,
  `          <div>
            <p style={{ margin: 0, fontSize: 11, color: colors.gray500 }}>Entregados</p>
            <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 800, color: colors.white }}>{totalEntregados}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: colors.gray500 }}>Debes a DomiU</p>
            <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 900, color: totalEmpresa > 0 ? colors.amber : colors.green }}>{fmt(totalEmpresa)}</p>
          </div>
        </div>`,
  'deuda en el encabezado',
);

replaceRequired(
  '      {/* DASHBOARD STATS GRID */}',
  `      {/* ESTADO DE NOTIFICACIONES */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{
          ...card,
          marginBottom: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderColor: pushStatus === "ready" ? "rgba(16,185,129,0.35)" : pushStatus === "blocked" || pushStatus === "error" ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.30)",
        }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            flexShrink: 0,
            background: pushStatus === "ready" ? colors.green : pushStatus === "blocked" || pushStatus === "error" ? colors.red : colors.amber,
            boxShadow: pushStatus === "ready" ? "0 0 12px rgba(16,185,129,0.7)" : "none",
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 900, color: colors.white }}>
              {pushStatus === "ready" ? "Notificaciones activas" : "Notificaciones de pedidos"}
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 11, lineHeight: 1.45, color: colors.gray500 }}>{pushMessage}</p>
          </div>
          <button
            type="button"
            disabled={activatingPush}
            onClick={() => pushStatus === "ready" ? void probarNotificacion() : void activarNotificaciones()}
            style={{
              padding: "9px 12px",
              borderRadius: 11,
              border: "none",
              background: pushStatus === "ready" ? "rgba(16,185,129,0.14)" : "linear-gradient(135deg, " + colors.primary + ", " + colors.primaryDark + ")",
              color: pushStatus === "ready" ? colors.green : "#fff",
              fontSize: 11,
              fontWeight: 900,
              whiteSpace: "nowrap",
              opacity: activatingPush ? 0.6 : 1,
            }}
          >
            {activatingPush ? "Procesando..." : pushStatus === "ready" ? "Probar" : "Activar"}
          </button>
        </div>
      </div>

      {/* DASHBOARD STATS GRID */}`,
  'tarjeta de estado de notificaciones',
);

replaceRequired(
  `        <div style={card}>
          <p style={{ margin: "0 0 6px", fontSize: 11, color: colors.gray500, fontWeight: 600 }}>Pedidos hoy</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: colors.white }}>{totalEntregados}</p>
        </div>`,
  `        <div style={card}>
          <p style={{ margin: "0 0 6px", fontSize: 11, color: colors.gray500, fontWeight: 600 }}>Pedidos hoy</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: colors.white }}>{totalEntregados}</p>
        </div>
        <div style={{ ...card, gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: "rgba(245,158,11,0.28)", background: "linear-gradient(135deg, rgba(245,158,11,0.10), rgba(30,41,59,1))" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: colors.gray500, fontWeight: 700 }}>SALDO PENDIENTE CON LA EMPRESA</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: colors.gray400 }}>Comisiones de los domicilios entregados durante el turno.</p>
          </div>
          <p style={{ margin: 0, fontSize: 25, fontWeight: 950, color: totalEmpresa > 0 ? colors.amber : colors.green }}>{fmt(totalEmpresa)}</p>
        </div>`,
  'tarjeta de deuda en Inicio',
);

writeFileSync(path, source, 'utf8');
console.log('Activación Web Push y saldo del repartidor aplicados.');
