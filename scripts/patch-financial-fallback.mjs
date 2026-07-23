import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`No se encontró el bloque requerido: ${label}`);
  }
  return source.replace(search, replacement);
}

function patchRiderPage() {
  const path = "src/app/repartidor/page.tsx";
  let source = readFileSync(path, "utf8");

  if (source.includes("const calcularParteEmpresa")) return;

  const currentBlock = `  const totalEmpresa =
    entregados
      .filter(esPagoEfectivo)
      .reduce((sum, pedido) => sum + Number(pedido.empresa_recibe || 0), 0) +
    pcEntregados
      .filter(esPagoEfectivo)
      .reduce(
        (sum, pedido) => sum + Number(pedido.comision_empresa || pedido.ganancia_empresa || 0),
        0,
      );`;

  const correctedBlock = `  const calcularParteEmpresa = (pedido: any) => {
    const registrada = Number(
      pedido.empresa_recibe || pedido.comision_empresa || pedido.ganancia_empresa || 0,
    );
    if (registrada > 0) return registrada;

    const tarifa = Number(pedido.precio || pedido.domicilio || 0);
    const pagoRepartidor = Number(pedido.pago_repartidor || 0);
    if (tarifa > 0 && pagoRepartidor > 0 && tarifa >= pagoRepartidor) {
      return tarifa - pagoRepartidor;
    }
    return 0;
  };
  const totalEmpresa =
    entregados
      .filter(esPagoEfectivo)
      .reduce((sum, pedido) => sum + calcularParteEmpresa(pedido), 0) +
    pcEntregados
      .filter(esPagoEfectivo)
      .reduce((sum, pedido) => sum + calcularParteEmpresa(pedido), 0);`;

  source = replaceRequired(
    source,
    currentBlock,
    correctedBlock,
    "cálculo de deuda del repartidor",
  );
  writeFileSync(path, source, "utf8");
}

function patchAdminApp() {
  const path = "src/components/AdminApp.tsx";
  let source = readFileSync(path, "utf8");

  if (!source.includes("function parteEmpresaPedido")) {
    source = replaceRequired(
      source,
      `const EMPRESA_PHONE = "3113748405";`,
      `const EMPRESA_PHONE = "3113748405";

function parteEmpresaPedido(pedido: any) {
  const registrada = Number(pedido?.empresa_recibe || 0);
  if (registrada > 0) return registrada;

  const tarifa = Number(pedido?.precio || pedido?.domicilio || 0);
  const pagoRepartidor = Number(pedido?.pago_repartidor || 0);
  if (tarifa > 0 && pagoRepartidor > 0 && tarifa >= pagoRepartidor) {
    return tarifa - pagoRepartidor;
  }
  return 0;
}`,
      "función financiera del panel administrador",
    );
  }

  source = source.replaceAll("(p.empresa_recibe || 0)", "parteEmpresaPedido(p)");
  writeFileSync(path, source, "utf8");
}

patchRiderPage();
patchAdminApp();
console.log("Respaldo financiero para comisiones faltantes aplicado.");
