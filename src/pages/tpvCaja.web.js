import wixData from "wix-data";

export const obtenerCajaActual = webMethod(
  Permissions.SiteMember,
  async () => {
    const result = await wixData
      .query("CajaActual")
      .eq("estado", "ABIERTA")
      .limit(1)
      .find();

    return result.items[0] || null;
  }
);

export const registrarMovimientoCaja = webMethod(
  Permissions.SiteMember,
  async (data) => {
    const importe = Number(data.importe);

    if (!data.cajaId || !data.tipoMovimiento || importe <= 0) {
      throw new Error("Datos de movimiento no válidos.");
    }

    const movimiento = {
      movimientoId: generarId("MOV"),
      cajaId: data.cajaId,
      tipoMovimiento: data.tipoMovimiento,
      importeBruto: importe,
      importeNeto: importe,
      importeEfectivo: importe,
      afectaEfectivo: true,
      metodoPago: "EFECTIVO",
      concepto: data.concepto || data.tipoMovimiento,
      estado: "CONFIRMADO",
      modoOperacion: "SINTETICO",
      origen: "TPV",
      fechaMovimiento: new Date()
    };

    const saved = await wixData.insert(
      "MovimientosCaja",
      movimiento
    );

    await actualizarSaldoCaja(data.cajaId, data.tipoMovimiento, importe);

    return saved;
  }
);

async function actualizarSaldoCaja(cajaId, tipo, importe) {
  const result = await wixData
    .query("CajaActual")
    .eq("cajaId", cajaId)
    .eq("estado", "ABIERTA")
    .limit(1)
    .find();

  const caja = result.items[0];

  if (!caja) {
    throw new Error("No existe una caja abierta.");
  }

  caja.efectivoEsperado = Number(caja.efectivoEsperado || 0);

  if (tipo === "ENTRADA") {
    caja.efectivoEsperado += importe;
  }

  if (tipo === "SALIDA" || tipo === "RETIRADA") {
    caja.efectivoEsperado -= importe;
  }

  await wixData.update("CajaActual", caja);
}

function generarId(prefijo) {
  return `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}
