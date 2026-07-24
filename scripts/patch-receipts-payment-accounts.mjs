import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`No se encontró el bloque requerido: ${label}`);
  }
  return source.replace(search, replacement);
}

const path = "src/components/AdminApp.tsx";
let source = readFileSync(path, "utf8");

if (!source.includes("const descargarPdfSeguro")) {
  source = replaceRequired(
    source,
    `  const exportarPDF = (datos: any[], titulo: string, columnas: { header: string; key: string }[]) => {`,
    `  const descargarPdfSeguro = (doc: jsPDF, nombreArchivo: string) => {
    try {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombreArchivo;
      enlace.rel = "noopener";
      enlace.style.display = "none";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error("No se pudo descargar el PDF mediante Blob:", error);
      doc.save(nombreArchivo);
    }
  };

  const exportarPDF = (datos: any[], titulo: string, columnas: { header: string; key: string }[]) => {`,
    "descarga segura de PDF",
  );

  source = replaceRequired(
    source,
    `    doc.save(\`${"${titulo}"}_${"${new Date().toISOString().slice(0, 10)}"}.pdf\`);
    ok("PDF exportado");`,
    `    try {
      descargarPdfSeguro(doc, \`${"${titulo}"}_${"${new Date().toISOString().slice(0, 10)}"}.pdf\`);
      ok("PDF exportado");
    } catch (error) {
      console.error("Error exportando PDF:", error);
      fail("No se pudo descargar el PDF. Intenta nuevamente.");
    }`,
    "exportación general de PDF",
  );
}

if (!source.includes("CUENTAS PARA CONSIGNAR A DOMIU")) {
  source = replaceRequired(
    source,
    `    y += 22;

    // Detalle pedidos`,
    `    y += 22;

    // Cuentas oficiales para consignar el pago
    if (y > 205) {
      doc.addPage();
      y = 18;
    }
    doc.setDrawColor(250, 204, 21);
    doc.setFillColor(255, 251, 235);
    doc.roundedRect(14, y, 182, 62, 3, 3, "FD");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CUENTAS PARA CONSIGNAR A DOMIU", 20, y + 10);
    doc.setTextColor(180, 83, 9);
    doc.text(\`Valor a consignar: ${"${f(totalEmpresa)}"}\`, 190, y + 10, { align: "right" });

    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    const cuentasPago = [
      ["Nequi", "304 476 6270"],
      ["Llave Nequi Negocios", "0091441933"],
      ["DaviPlata - Codigo del comercio", "0090258055"],
      ["Llave alfanumerica", "@PLATA3044766270"],
      ["Titular / responsable", "Kevin Leiva"],
    ];
    let cuentaY = y + 19;
    cuentasPago.forEach(([etiqueta, valor]) => {
      doc.setFont("helvetica", "bold");
      doc.text(\`${"${etiqueta}"}:\`, 20, cuentaY);
      doc.setFont("helvetica", "normal");
      doc.text(valor, 82, cuentaY);
      cuentaY += 6;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const avisoPago = doc.splitTextToSize(
      "Despues de transferir, envia una captura del comprobante donde se vean claramente el valor, la fecha, la hora y la referencia de la transaccion.",
      168,
    );
    doc.text(avisoPago, 20, y + 52);
    y += 70;

    // Detalle pedidos`,
    "cuentas oficiales en el desprendible",
  );
}

if (!source.includes("const nombreSeguro = String(rep.nombre")) {
  source = replaceRequired(
    source,
    `    doc.save(\`Desprendible_${"${rep.nombre.replace(/\\s+/g, \"_\")}"}_${"${new Date().toISOString().slice(0, 10)}"}.pdf\`);
    ok("Desprendible descargado");`,
    `    const nombreSeguro = String(rep.nombre || "Repartidor").trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
    const nombreArchivo = \`Desprendible_${"${nombreSeguro}"}_${"${new Date().toISOString().slice(0, 10)}"}.pdf\`;
    try {
      descargarPdfSeguro(doc, nombreArchivo);
      ok("Desprendible descargado");
    } catch (error) {
      console.error("Error descargando desprendible:", error);
      fail("No se pudo descargar el desprendible. Intenta nuevamente.");
    }`,
    "descarga individual del desprendible",
  );
}

if (!source.includes("Descargar desprendible de ${l.rep.nombre}")) {
  source = replaceRequired(
    source,
    `                            <button onClick={() => descargarDesprendible(l.rep.id)} disabled={l.count === 0} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-red-500/20 border border-red-500/20"><FileDown size={14} /></button>`,
    `                            <button type="button" onClick={() => descargarDesprendible(l.rep.id)} disabled={l.count === 0} title={l.count === 0 ? "Sin domicilios entregados" : "Descargar desprendible PDF"} aria-label={\`Descargar desprendible de ${"${l.rep.nombre}"}\`} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-red-500/20 border border-red-500/20"><FileDown size={14} /></button>`,
    "botón de descarga del desprendible",
  );
}

writeFileSync(path, source, "utf8");
console.log("Descarga de desprendibles y cuentas de pago incorporadas.");
