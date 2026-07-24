import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function money(value: unknown) {
  return "$" + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function safeFileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_");
}

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Servidor no configurado" }, { status: 500 });
    }

    const url = new URL(request.url);
    const repId = url.searchParams.get("repId") || "";
    const turnoId = url.searchParams.get("turnoId") || "";
    if (!/^[0-9a-f-]{36}$/i.test(repId)) {
      return NextResponse.json({ error: "Repartidor inválido" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: rep, error: repError } = await supabase
      .from("repartidores")
      .select("id, nombre, telefono, vehiculo, placa")
      .eq("id", repId)
      .single();
    if (repError || !rep) {
      return NextResponse.json({ error: "Repartidor no encontrado" }, { status: 404 });
    }

    let query = supabase
      .from("pedidos")
      .select("codigo, cliente, direccion, precio, empresa_recibe, pago_repartidor, metodo_pago, created_at")
      .eq("repartidor_id", repId)
      .eq("estado", "Entregado")
      .order("created_at", { ascending: true });
    if (/^[0-9a-f-]{36}$/i.test(turnoId)) query = query.eq("turno_id", turnoId);

    const { data: pedidos, error: ordersError } = await query;
    if (ordersError) throw ordersError;
    const entregados = pedidos || [];

    const totalGenerado = entregados.reduce((sum, p) => sum + (Number(p.precio) || 0), 0);
    const totalEmpresa = entregados.reduce((sum, p) => sum + (Number(p.empresa_recibe) || 0), 0);
    const totalRepartidor = entregados.reduce((sum, p) => sum + (Number(p.pago_repartidor) || 0), 0);
    const totalEfectivo = entregados
      .filter((p) => String(p.metodo_pago || "").toLowerCase() === "efectivo")
      .reduce((sum, p) => sum + (Number(p.precio) || 0), 0);
    const totalTransferencia = totalGenerado - totalEfectivo;

    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 43, "F");
    doc.setTextColor(250, 204, 21);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(23);
    doc.text("DomiU", 14, 17);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text("MAGDALENA", 14, 25);
    doc.setFontSize(14);
    doc.text("Desprendible de liquidación", 196, 17, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(8);
    doc.text(new Date().toLocaleString("es-CO"), 196, 25, { align: "right" });

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(rep.nombre || "Repartidor", 14, 54);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Teléfono: ${rep.telefono || "N/A"}`, 14, 61);
    doc.text(`Vehículo: ${rep.vehiculo || "N/A"}  |  Placa: ${rep.placa || "N/A"}`, 14, 67);

    let y = 79;
    const summary = [
      ["Domicilios realizados", String(entregados.length)],
      ["Total generado", money(totalGenerado)],
      ["Efectivo recaudado", money(totalEfectivo)],
      ["Transferencias", money(totalTransferencia)],
      ["Valor a consignar a DomiU", money(totalEmpresa)],
    ];
    doc.setFontSize(9.5);
    summary.forEach(([label, value]) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(label, 14, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(value, 195, y, { align: "right" });
      y += 7;
    });

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(14, y, 181, 14, 3, 3, "FD");
    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("GANANCIA DEL REPARTIDOR", 20, y + 9);
    doc.text(money(totalRepartidor), 189, y + 9, { align: "right" });
    y += 21;

    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(250, 204, 21);
    doc.roundedRect(14, y, 181, 59, 3, 3, "FD");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10.5);
    doc.text("CUENTAS OFICIALES PARA CONSIGNAR", 20, y + 10);
    doc.setFontSize(8.5);
    const accounts = [
      ["Nequi", "304 476 6270"],
      ["Llave Nequi Negocios", "0091441933"],
      ["DaviPlata - código del comercio", "0090258055"],
      ["Llave alfanumérica", "@PLATA3044766270"],
      ["Titular / responsable", "Kevin Leiva"],
    ];
    let accountY = y + 19;
    accounts.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 20, accountY);
      doc.setFont("helvetica", "normal");
      doc.text(value, 86, accountY);
      accountY += 6;
    });
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const note = doc.splitTextToSize(
      "Después de transferir, envía una captura del comprobante donde se vean el valor, la fecha, la hora y la referencia de la transacción.",
      168,
    );
    doc.text(note, 20, y + 51);
    y += 68;

    if (entregados.length > 0) {
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("Detalle de domicilios", 14, y);
      y += 6;

      const widths = [25, 35, 55, 23, 23, 23];
      const headers = ["Código", "Cliente", "Dirección", "Tarifa", "DomiU", "Repartidor"];
      doc.setFillColor(15, 23, 42);
      doc.rect(14, y, 181, 8, "F");
      doc.setTextColor(250, 204, 21);
      doc.setFontSize(6.7);
      let x = 16;
      headers.forEach((header, index) => {
        doc.text(header, x, y + 5);
        x += widths[index];
      });
      y += 11;

      entregados.forEach((pedido, index) => {
        if (y > 279) {
          doc.addPage();
          y = 16;
        }
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, y - 4, 181, 7, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(6.5);
        const values = [
          pedido.codigo || "—",
          String(pedido.cliente || "—").slice(0, 22),
          String(pedido.direccion || "—").slice(0, 38),
          money(pedido.precio),
          money(pedido.empresa_recibe),
          money(pedido.pago_repartidor),
        ];
        x = 16;
        values.forEach((value, valueIndex) => {
          doc.text(String(value), x, y);
          x += widths[valueIndex];
        });
        y += 7;
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`DomiU Magdalena · Página ${page} de ${pageCount}`, 105, 290, { align: "center" });
    }

    const arrayBuffer = doc.output("arraybuffer");
    const fileName = `Desprendible_${safeFileName(rep.nombre || "Repartidor")}_${new Date().toISOString().slice(0, 10)}.pdf`;
    return new Response(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error("[admin/desprendible]", error);
    return NextResponse.json({ error: error?.message || "No fue posible generar el desprendible" }, { status: 500 });
  }
}
