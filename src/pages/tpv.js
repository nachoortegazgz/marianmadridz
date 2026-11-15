import {
  obtenerCajaActual,
  registrarMovimientoCaja
} from "backend/tpvCaja.web";

import {
  registrarVenta
} from "backend/tpvVentas.web";

let cajaActual;
let lineas = [];

$w.onReady(async () => {
  conectarEventos();
  cajaActual = await obtenerCajaActual();
  actualizarEstadoCaja();
  recalcularTotales();
});

function conectarEventos() {
  $w("#chargeButton").onClick(cobrar);
  $w("#cashInButton").onClick(() => registrarMovimiento("ENTRADA"));
  $w("#cashOutButton").onClick(() => registrarMovimiento("SALIDA"));
  $w("#paymentMethodDropdown").onChange(recalcularTotales);
  $w("#receivedInput").onInput(calcularCambio);
}

async function cobrar() {
  if (!cajaActual || cajaActual.estado !== "ABIERTA") {
    mostrarMensaje("La caja está cerrada.");
    return;
  }

  if (!lineas.length) {
    mostrarMensaje("Añade un servicio o producto.");
    return;
  }

  const total = obtenerTotal();
  const metodoPago = $w("#paymentMethodDropdown").value;

  try {
    const resultado = await registrarVenta({
      cajaId: cajaActual.cajaId,
      lineas,
      total,
      metodoPago,
      modoOperacion: "SINTETICO"
    });

    mostrarMensaje(`Venta registrada: ${resultado.ticketId}`);
    lineas = [];
    recalcularTotales();
    cajaActual = await obtenerCajaActual();
    actualizarEstadoCaja();

  } catch (error) {
    console.error(error);
    mostrarMensaje("No se pudo registrar la venta.");
  }
}

async function registrarMovimiento(tipoMovimiento) {
  const importe = Number($w("#movementAmountInput").value);

  if (!importe || importe <= 0) {
    mostrarMensaje("Introduce un importe válido.");
    return;
  }

  await registrarMovimientoCaja({
    cajaId: cajaActual.cajaId,
    tipoMovimiento,
    importe,
    concepto: $w("#movementConceptInput").value,
    modoOperacion: "SINTETICO"
  });

  mostrarMensaje("Movimiento registrado.");
  cajaActual = await obtenerCajaActual();
  actualizarEstadoCaja();
}

function obtenerTotal() {
  return lineas.reduce(
    (total, linea) =>
      total + linea.cantidad * linea.precioUnitario + linea.impuestos,
    0
  );
}

function recalcularTotales() {
  const subtotal = lineas.reduce(
    (total, linea) => total + linea.cantidad * linea.precioUnitario,
    0
  );

  const impuestos = lineas.reduce(
    (total, linea) => total + Number(linea.impuestos || 0),
    0
  );

  $w("#subtotalText").text = euros(subtotal);
  $w("#taxText").text = euros(impuestos);
  $w("#totalText").text = euros(subtotal + impuestos);
}

function calcularCambio() {
  const cambio =
    Number($w("#receivedInput").value || 0) - obtenerTotal();

  $w("#changeText").text = euros(Math.max(0, cambio));
}

function actualizarEstadoCaja() {
  $w("#cashStatusText").text =
    cajaActual?.estado === "ABIERTA"
      ? "Caja abierta"
      : "Caja cerrada";
}

function euros(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(value || 0);
}

function mostrarMensaje(texto) {
  $w("#messageText").text = texto;
  $w("#messageText").show();
}
