import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, search, replacement, label) {
  if (typeof search === "string") {
    if (!source.includes(search)) throw new Error(`No se encontró el bloque requerido: ${label}`);
    return source.replace(search, replacement);
  }
  if (!search.test(source)) throw new Error(`No se encontró el patrón requerido: ${label}`);
  return source.replace(search, replacement);
}

function patchAdminApp() {
  const path = "src/components/AdminApp.tsx";
  let source = readFileSync(path, "utf8");

  if (!source.includes("reportesOperativos")) {
    source = replaceRequired(
      source,
      '  const [pubId, setPubId] = useState<string | null>(null);',
      '  const [pubId, setPubId] = useState<string | null>(null);\n  const [reportesOperativos, setReportesOperativos] = useState<any[]>([]);',
      "estado de reportes operativos",
    );
  }

  const loadPedidosClientePattern = /  const loadPedidosCliente = useCallback\(async \(\) => \{[\s\S]*?  \}, \[\]\);/;
  source = replaceRequired(
    source,
    loadPedidosClientePattern,
    `  const loadPedidosCliente = useCallback(async () => {
    try {
      const { data: activeTurns, error: turnError } = await sb
        .from("turnos")
        .select("opened_at, created_at")
        .eq("activo", true)
        .order("opened_at", { ascending: false })
        .limit(1);
      if (turnError) throw turnError;

      const activeTurn = activeTurns?.[0] || null;
      const startedAt = activeTurn?.opened_at || activeTurn?.created_at || null;
      if (!startedAt) {
        setPcPedidos([]);
        return;
      }

      const { data, error } = await sb
        .from("pedidos_cliente")
        .select("id, codigo, cliente_nombre, cliente_direccion, domicilio, estado, estado_negocio, negocio_id, created_at")
        .gte("created_at", startedAt)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setPcPedidos(data || []);
    } catch (e: any) {
      console.error("loadPedidosCliente:", e);
      setPcPedidos([]);
    }
  }, []);`,
    "carga de InDriver por turno",
  );

  if (!source.includes("const loadReportesOperativos")) {
    const loadDomiPattern = /(  const loadDomiDisponibles = useCallback\(async \(\) => \{[\s\S]*?  \}, \[\]\);)/;
    source = replaceRequired(
      source,
      loadDomiPattern,
      `$1

  const loadReportesOperativos = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/reportes-turnos", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los reportes");
      setReportesOperativos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("loadReportesOperativos:", error);
      setReportesOperativos([]);
    }
  }, []);`,
      "carga del archivo histórico",
    );
  }

  source = source.replace(
    `      const pedidosQuery = turnoAct
        ? sb.from("pedidos").select("*").eq("turno_id", turnoAct.id).order("created_at", { ascending: false })
        : sb.from("pedidos").select("*").order("created_at", { ascending: false });`,
    `      const pedidosQuery = turnoAct
        ? sb.from("pedidos").select("*").eq("turno_id", turnoAct.id).order("created_at", { ascending: false })
        : sb.from("pedidos").select("*").limit(0);`,
  );

  source = source.replace(
    '  useEffect(() => { load(); loadPedidosCliente(); loadDomiDisponibles(); }, [load, loadPedidosCliente, loadDomiDisponibles]);',
    '  useEffect(() => { load(); loadPedidosCliente(); loadDomiDisponibles(); loadReportesOperativos(); }, [load, loadPedidosCliente, loadDomiDisponibles, loadReportesOperativos]);',
  );
  source = source.replace(
    '    const interval = setInterval(() => { load(); loadPedidosCliente(); loadDomiDisponibles(); }, 30000);',
    '    const interval = setInterval(() => { load(); loadPedidosCliente(); loadDomiDisponibles(); }, 30000);',
  );

  source = source.replace(
    '.on("postgres_changes", { event: "*", schema: "public", table: "repartidores" }, () => load())\n      .subscribe();',
    '.on("postgres_changes", { event: "*", schema: "public", table: "repartidores" }, () => load())\n      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos_cliente" }, () => { loadPedidosCliente(); loadReportesOperativos(); })\n      .on("postgres_changes", { event: "*", schema: "public", table: "domicilios_disponibles" }, () => { loadDomiDisponibles(); loadReportesOperativos(); })\n      .on("postgres_changes", { event: "*", schema: "public", table: "turnos" }, () => { load(); loadPedidosCliente(); loadDomiDisponibles(); loadReportesOperativos(); })\n      .subscribe();',
  );

  const openTurnPattern = /  const abrirTurno = async \(\) => \{[\s\S]*?  \};\n  const cerrarTurno/;
  source = replaceRequired(
    source,
    openTurnPattern,
    `  const abrirTurno = async () => {
    const { data: existingTurns, error: existingError } = await sb
      .from("turnos")
      .select("id")
      .eq("activo", true)
      .limit(1);
    if (existingError) return fail(existingError.message);
    if (existingTurns?.length) return fail("Ya existe un turno activo");

    const openedAt = new Date().toISOString();
    const { data: nuevoTurno, error } = await sb
      .from("turnos")
      .insert({
        user_id: user?.id,
        activo: true,
        opened_at: openedAt,
      })
      .select()
      .single();
    if (error) return fail(error.message);

    setPedidos([]);
    setPcPedidos([]);
    setDomDisponibles([]);
    setTurnoActivo(nuevoTurno);
    await Promise.all([load(), loadPedidosCliente(), loadDomiDisponibles(), loadReportesOperativos()]);
    ok("Nuevo turno abierto. Marketplace e InDriver iniciaron vacíos; el turno anterior quedó en Reportes.");
  };
  const cerrarTurno`,
    "apertura no destructiva del turno",
  );

  const closeTurnPattern = /  const cerrarTurno = async \(\) => \{[\s\S]*?  \};\n\n  \/\* ======================== PEDIDOS/;
  source = replaceRequired(
    source,
    closeTurnPattern,
    `  const cerrarTurno = async () => {
    if (!turnoActivo) return fail("No hay turno activo");

    const manualDelivered = pedidos.filter((p: any) => String(p.estado).toLowerCase() === "entregado");
    const manualCancelled = pedidos.filter((p: any) => String(p.estado).toLowerCase() === "cancelado");
    const marketplaceDelivered = pcPedidos.filter((p: any) => String(p.estado).toLowerCase() === "entregado");
    const marketplaceCancelled = pcPedidos.filter((p: any) => String(p.estado).toLowerCase() === "cancelado");

    const totalTurno = pedidos.length + pcPedidos.length + domDisponibles.length;
    const recaudado =
      manualDelivered.reduce((sum: number, pedido: any) => sum + Number(pedido.precio || 0), 0) +
      marketplaceDelivered.reduce((sum: number, pedido: any) => sum + Number(pedido.total || 0), 0);
    const empresa =
      manualDelivered.reduce((sum: number, pedido: any) => sum + parteEmpresaPedido(pedido), 0) +
      marketplaceDelivered.reduce((sum: number, pedido: any) => sum + parteEmpresaPedido(pedido), 0);

    const { error: turnoError } = await sb.from("turnos").update({
      activo: false,
      closed_at: new Date().toISOString(),
      total_turno: totalTurno,
      entregados: manualDelivered.length + marketplaceDelivered.length,
      cancelados: manualCancelled.length + marketplaceCancelled.length,
      recaudado_total: recaudado,
      empresa_recibe_total: empresa,
      liquidado_total: manualDelivered.filter((p: any) => p.liquidado).length,
    }).eq("id", turnoActivo.id);
    if (turnoError) return fail(turnoError.message);

    await sb.from("repartidores").update({ estado: "No disponible" }).in("estado", ["Ocupado", "Disponible"]);

    setTurnoActivo(null);
    setPedidos([]);
    setPcPedidos([]);
    setDomDisponibles([]);
    await Promise.all([load(), loadPedidosCliente(), loadDomiDisponibles(), loadReportesOperativos()]);
    ok("Turno cerrado y archivado en Reportes");
  };

  /* ======================== PEDIDOS`,
    "cierre y archivo del turno",
  );

  if (!source.includes("Historial operativo por turnos")) {
    source = replaceRequired(
      source,
      `          {tab === "reportes" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`,
      `          {tab === "reportes" && (
            <div className="space-y-6">
              <div className="bg-[#1E293B]/70 backdrop-blur-sm rounded-2xl border border-white/[0.06] p-6">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="font-bold text-white text-lg flex items-center gap-2"><History size={20} className="text-[#10B981]" /> Historial operativo por turnos</h3>
                    <p className="text-xs text-slate-500 mt-1">Pedidos manuales, Marketplace y domicilios publicados permanecen archivados aquí.</p>
                  </div>
                  <button onClick={loadReportesOperativos} className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2"><RefreshCw size={14} /> Actualizar</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-800 text-slate-500">
                      <th className="text-left py-3 px-3">Turno</th>
                      <th className="text-center py-3 px-3">Manual</th>
                      <th className="text-center py-3 px-3">Marketplace</th>
                      <th className="text-center py-3 px-3">InDriver</th>
                      <th className="text-center py-3 px-3">Entregados</th>
                      <th className="text-right py-3 px-3">Vendido</th>
                      <th className="text-right py-3 px-3">Empresa</th>
                      <th className="text-center py-3 px-3">Exportar</th>
                    </tr></thead>
                    <tbody>
                      {reportesOperativos.map((reporte: any) => (
                        <tr key={reporte.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="py-3 px-3">
                            <p className="text-xs font-semibold text-white">{reporte.id === "legacy" ? "Histórico anterior" : reporte.opened_at ? new Date(reporte.opened_at).toLocaleString("es-CO") : "Sin fecha"}</p>
                            <p className={`text-[10px] ${reporte.active ? "text-green-400" : "text-slate-500"}`}>{reporte.active ? "Turno activo" : reporte.closed_at ? `Cerrado: ${new Date(reporte.closed_at).toLocaleString("es-CO")}` : "Archivado"}</p>
                          </td>
                          <td className="py-3 px-3 text-center text-white font-bold">{reporte.manual_count || 0}</td>
                          <td className="py-3 px-3 text-center text-yellow-400 font-bold">{reporte.marketplace_count || 0}</td>
                          <td className="py-3 px-3 text-center text-cyan-400 font-bold">{reporte.indriver_count || 0}</td>
                          <td className="py-3 px-3 text-center text-green-400 font-bold">{reporte.delivered || 0}</td>
                          <td className="py-3 px-3 text-right text-[#10B981] font-bold">{fmt(reporte.total_sold || 0)}</td>
                          <td className="py-3 px-3 text-right text-blue-400 font-bold">{fmt(reporte.company_earnings || 0)}</td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => exportarExcel((reporte.details || []).map((item: any) => ({ ...item, fecha: item.created_at ? new Date(item.created_at).toLocaleString("es-CO") : "" })), `Turno_${reporte.id}`, [
                                { header: "Origen", key: "source" }, { header: "Código", key: "codigo" }, { header: "Cliente", key: "cliente" }, { header: "Estado", key: "estado" }, { header: "Total", key: "total" }, { header: "Domicilio", key: "domicilio" }, { header: "Empresa", key: "empresa" }, { header: "Repartidor", key: "repartidor" }, { header: "Fecha", key: "fecha" },
                              ])} className="p-2 rounded-lg bg-green-500/10 text-green-400"><FileSpreadsheet size={14} /></button>
                              <button onClick={() => exportarPDF((reporte.details || []).map((item: any) => ({ ...item, total: fmt(item.total), domicilio: fmt(item.domicilio), empresa: fmt(item.empresa), repartidor: fmt(item.repartidor), fecha: item.created_at ? new Date(item.created_at).toLocaleString("es-CO") : "" })), `Reporte turno ${reporte.id}`, [
                                { header: "Origen", key: "source" }, { header: "Código", key: "codigo" }, { header: "Cliente", key: "cliente" }, { header: "Estado", key: "estado" }, { header: "Total", key: "total" }, { header: "Domicilio", key: "domicilio" }, { header: "Empresa", key: "empresa" }, { header: "Repartidor", key: "repartidor" }, { header: "Fecha", key: "fecha" },
                              ])} className="p-2 rounded-lg bg-red-500/10 text-red-400"><FileDown size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {reportesOperativos.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-500">No hay turnos archivados</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`,
      "tabla histórica de reportes",
    );
  }

  writeFileSync(path, source, "utf8");
}

function patchAvailableDeliveriesRoute() {
  const path = "src/app/api/domicilios/disponibles/route.ts";
  const source = `import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdmin() {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
  return createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function noStore(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } });
}

export async function GET(req: Request) {
  try {
    const supabase = getAdmin();
    const { searchParams } = new URL(req.url);
    const repartidorId = searchParams.get("repartidor_id");
    const onlyMine = searchParams.get("mis_aceptados") === "true";
    const scope = searchParams.get("scope") || "current";

    const { data: activeTurns, error: turnError } = await supabase
      .from("turnos")
      .select("opened_at, created_at")
      .eq("activo", true)
      .order("opened_at", { ascending: false })
      .limit(1);
    if (turnError) throw turnError;

    const activeTurn = activeTurns?.[0] || null;
    const startedAt = activeTurn?.opened_at || activeTurn?.created_at || null;
    if (scope !== "history" && !startedAt) return noStore([]);

    let query = supabase.from("domicilios_disponibles").select("*").order("created_at", { ascending: false });
    if (scope !== "history") query = query.gte("created_at", startedAt);

    if (onlyMine && repartidorId) query = query.eq("repartidor_id", repartidorId).neq("estado", "cancelado");
    else query = query.eq("estado", "disponible");

    const { data, error } = await query;
    if (error) throw error;
    return noStore(data || []);
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
}
`;
  writeFileSync(path, source, "utf8");
}

patchAdminApp();
patchAvailableDeliveriesRoute();
console.log("Archivo histórico por turnos aplicado a Marketplace, InDriver y Reportes.");
