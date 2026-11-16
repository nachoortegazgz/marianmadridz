import wixData from "wix-data";

import { Permissions, webMethod } from "wix-web-module";

export const registrarVenta = webMethod(
  Permissions.SiteMember,
  async (venta) => {
    const metodoPago = normalizarMetodo(venta.metodoPago);
    const total = Number(venta.total);

    const movimiento = {
      movimientoId: generarId("MOV"),
      cajaId: venta.cajaId,
      tipoMovimiento: "VENTA",
      subtipoMovimiento: "TPV",
      operacionId: generarId("OP"),
      ticketId: generarId("TICKET"),
      metodoPago,
      importeBruto: total,
      importeNeto: total,
      importeEfectivo: metodoPago === "EFECTIVO" ? total : 0,
      afectaEfectivo: metodoPago === "EFECTIVO",
      concepto: resumirLineas(venta.lineas),
      estado: "CONFIRMADO",
      modoOperacion: "SINTETICO",
      origen: "TPV",
      esReversion: false,
      fechaMovimiento: new Date()
    };

    const saved = await wixData.insert(
      "MovimientosCaja",
      movimiento
    );

    return {
      movimientoId: saved.movimientoId,
      operacionId: saved.operacionId,
      ticketId: saved.ticketId
    };
  }
);

function normalizarMetodo(metodo) {
  return ["EFECTIVO", "TARJETA", "BIZUM", "OTROS"]
    .includes(metodo)
    ? metodo
    : "OTROS";
}

function resumirLineas(lineas = []) {
  return lineas
    .map(item => `${item.cantidad} x ${item.concepto}`)
    .join(", ");
}

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}`;
}
