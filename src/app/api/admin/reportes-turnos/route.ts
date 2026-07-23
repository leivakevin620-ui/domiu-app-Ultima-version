import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdmin() {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown) {
  const time = new Date(String(value || "")).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isDelivered(value: unknown) {
  return ["entregado", "delivered"].includes(String(value || "").toLowerCase());
}

function isCancelled(value: unknown) {
  return ["cancelado", "cancelled"].includes(String(value || "").toLowerCase());
}

function companyPart(order: any) {
  const saved = number(order.empresa_recibe || order.comision_empresa || order.ganancia_empresa);
  if (saved > 0) return saved;
  const rate = number(order.precio || order.domicilio);
  const courier = number(order.pago_repartidor);
  if (rate > 0 && courier > 0 && rate >= courier) return rate - courier;
  return rate > 0 ? Math.round(rate * 0.2) : 0;
}

function courierPart(order: any) {
  const saved = number(order.pago_repartidor);
  if (saved > 0) return saved;
  const rate = number(order.precio || order.domicilio);
  return Math.max(0, rate - companyPart(order));
}

function noStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

export async function GET() {
  try {
    const supabase = getAdmin();
    const [turnsResult, manualResult, marketplaceResult, dispatchResult] = await Promise.all([
      supabase.from("turnos").select("*").order("created_at", { ascending: true }).limit(100),
      supabase.from("pedidos").select("*").order("created_at", { ascending: true }).limit(5000),
      supabase.from("pedidos_cliente").select("*").order("created_at", { ascending: true }).limit(5000),
      supabase.from("domicilios_disponibles").select("*").order("created_at", { ascending: true }).limit(5000),
    ]);

    if (turnsResult.error) throw turnsResult.error;
    if (manualResult.error) throw manualResult.error;
    if (marketplaceResult.error) throw marketplaceResult.error;
    if (dispatchResult.error) throw dispatchResult.error;

    const turns = turnsResult.data || [];
    const manual = manualResult.data || [];
    const marketplace = marketplaceResult.data || [];
    const dispatches = dispatchResult.data || [];
    const now = Date.now();

    const reports = turns.map((turn: any, index: number) => {
      const startedAt = turn.opened_at || turn.created_at;
      const start = dateValue(startedAt);
      const nextTurn = turns[index + 1];
      const endedAt = turn.closed_at || nextTurn?.opened_at || nextTurn?.created_at || null;
      const end = endedAt ? dateValue(endedAt) : now + 1;
      const belongs = (row: any) => {
        const created = dateValue(row.created_at);
        return created >= start && created < end;
      };

      const manualRows = manual.filter(belongs);
      const marketRows = marketplace.filter(belongs);
      const dispatchRows = dispatches.filter(belongs);
      const deliveredManual = manualRows.filter((row: any) => isDelivered(row.estado));
      const deliveredMarket = marketRows.filter((row: any) => isDelivered(row.estado));

      const details = [
        ...manualRows.map((row: any) => ({
          source: "Manual",
          id: row.id,
          codigo: row.codigo,
          cliente: row.cliente,
          estado: row.estado,
          total: number(row.precio),
          domicilio: number(row.precio),
          empresa: companyPart(row),
          repartidor: courierPart(row),
          created_at: row.created_at,
        })),
        ...marketRows.map((row: any) => ({
          source: "Marketplace",
          id: row.id,
          codigo: row.codigo,
          cliente: row.cliente_nombre,
          estado: row.estado,
          total: number(row.total),
          domicilio: number(row.domicilio),
          empresa: companyPart(row),
          repartidor: courierPart(row),
          created_at: row.created_at,
        })),
        ...dispatchRows.map((row: any) => ({
          source: "InDriver",
          id: row.id,
          codigo: row.pedido_codigo,
          cliente: row.cliente_nombre,
          estado: row.estado,
          total: number(row.valor_domicilio),
          domicilio: number(row.valor_domicilio),
          empresa: 0,
          repartidor: 0,
          created_at: row.created_at,
        })),
      ].sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at));

      return {
        id: turn.id,
        active: Boolean(turn.activo),
        opened_at: startedAt,
        closed_at: turn.closed_at || null,
        manual_count: manualRows.length,
        marketplace_count: marketRows.length,
        indriver_count: dispatchRows.length,
        total_records: manualRows.length + marketRows.length + dispatchRows.length,
        delivered: deliveredManual.length + deliveredMarket.length,
        cancelled:
          manualRows.filter((row: any) => isCancelled(row.estado)).length +
          marketRows.filter((row: any) => isCancelled(row.estado)).length,
        total_sold:
          deliveredManual.reduce((sum: number, row: any) => sum + number(row.precio), 0) +
          deliveredMarket.reduce((sum: number, row: any) => sum + number(row.total), 0),
        delivery_fees:
          deliveredManual.reduce((sum: number, row: any) => sum + number(row.precio), 0) +
          deliveredMarket.reduce((sum: number, row: any) => sum + number(row.domicilio), 0),
        company_earnings:
          deliveredManual.reduce((sum: number, row: any) => sum + companyPart(row), 0) +
          deliveredMarket.reduce((sum: number, row: any) => sum + companyPart(row), 0),
        courier_earnings:
          deliveredManual.reduce((sum: number, row: any) => sum + courierPart(row), 0) +
          deliveredMarket.reduce((sum: number, row: any) => sum + courierPart(row), 0),
        details,
      };
    });

    const assignedIds = new Set(reports.flatMap((report: any) => report.details.map((row: any) => `${row.source}:${row.id}`)));
    const legacyDetails = [
      ...manual.map((row: any) => ({ source: "Manual", row })),
      ...marketplace.map((row: any) => ({ source: "Marketplace", row })),
      ...dispatches.map((row: any) => ({ source: "InDriver", row })),
    ].filter(({ source, row }) => !assignedIds.has(`${source}:${row.id}`));

    if (legacyDetails.length) {
      reports.unshift({
        id: "legacy",
        active: false,
        opened_at: null,
        closed_at: turns[0]?.opened_at || turns[0]?.created_at || null,
        manual_count: legacyDetails.filter((item) => item.source === "Manual").length,
        marketplace_count: legacyDetails.filter((item) => item.source === "Marketplace").length,
        indriver_count: legacyDetails.filter((item) => item.source === "InDriver").length,
        total_records: legacyDetails.length,
        delivered: legacyDetails.filter(({ row }) => isDelivered(row.estado)).length,
        cancelled: legacyDetails.filter(({ row }) => isCancelled(row.estado)).length,
        total_sold: 0,
        delivery_fees: 0,
        company_earnings: 0,
        courier_earnings: 0,
        details: legacyDetails.map(({ source, row }) => ({
          source,
          id: row.id,
          codigo: row.codigo || row.pedido_codigo,
          cliente: row.cliente || row.cliente_nombre,
          estado: row.estado,
          total: number(row.total || row.precio || row.valor_domicilio),
          domicilio: number(row.domicilio || row.precio || row.valor_domicilio),
          empresa: source === "InDriver" ? 0 : companyPart(row),
          repartidor: source === "InDriver" ? 0 : courierPart(row),
          created_at: row.created_at,
        })),
      });
    }

    return noStore(reports.sort((a: any, b: any) => dateValue(b.opened_at || b.closed_at) - dateValue(a.opened_at || a.closed_at)));
  } catch (error: any) {
    return noStore({ error: error.message }, 500);
  }
}
