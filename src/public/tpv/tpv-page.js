import {
  obtenerCajaActual,
  registrarMovimientoCaja
} from "backend/tpvCaja.web";
import { registrarVenta } from "backend/tpvVentas.web";

let lineasVenta = [];
let cajaActual = null;

$w.onReady(async function () {
  configurarEventos();
  await cargarCaja();
  recalcularVenta();
});

function configurarEventos() {
  $w("#chargeButton").onClick(cobrarOperacion);
  $w("#pendingButton").onClick(guardarOperacionPendiente);
  $w("#cancelButton").onClick(limpiarOperacion);

  $w("#cashInButton").onClick(() => abrirDialogoMovimiento("ENTRADA"));
  $w("#cashOutButton").onClick(() => abrirDialogoMovimiento("SALIDA"));

  $w("#paymentMethodDropdown").onChange(recalcularVenta);
  $w("#receivedInput").onInput(calcularCambio);

  $w("#searchInput").onInput(buscarCatalogo);
}

async function cargarCaja() {
  try {
    cajaActual = await obtenerCajaActual();

    if (!cajaActual || cajaActual.estado !== "ABIERTA") {
      $w("#cashStatusText").text = "Caja cerrada";
      $w("#chargeButton").disable();
      mostrarMensaje("Abre una caja antes de cobrar.");
      return;
    }

    $w("#cashStatusText").text = "Caja abierta";
    $w("#chargeButton").enable();

  } catch (error) {
    mostrarMensaje("No se pudo cargar el estado de la caja.");
    console.error(error);
  }
}

function recalcularVenta() {
  const neto = lineasVenta.reduce(
    (total, linea) => total + linea.cantidad * linea.precioUnitario,
    0
  );

  const impuestos = lineasVenta.reduce(
    (total, linea) => total + linea.impuesto,
    0
  );

  const total = neto + impuestos;

  $w("#netText").text = formatearEuros(neto);
  $w("#taxText").text = formatearEuros(impuestos);
  $w("#totalText").text = formatearEuros(total);

  calcularCambio();
}

function calcularCambio() {
  const total = obtenerTotal();
  const recibido = Number($w("#receivedInput").value || 0);
  const cambio = Math.max(0, recibido - total);

  $w("#changeText").text = formatearEuros(cambio);
}

async function cobrarOperacion() {
  if (!lineasVenta.length) {
    mostrarMensaje("Añade al menos un concepto.");
    return;
  }

  const metodoPago = $w("#paymentMethodDropdown").value;
  const total = obtenerTotal();
  const recibido = Number($w("#receivedInput").value || total);

  if (metodoPago === "EFECTIVO" && recibido < total) {
    mostrarMensaje("El importe recibido es inferior al total.");
    return;
  }

  const operacion = {
    cajaId: cajaActual.cajaId,
    lineas: lineasVenta,
    metodoPago,
    total,
    importeRecibido: recibido,
    cambio: Math.max(0, recibido - total),
    modoOperacion: "SINTETICO"
  };

  try {
    const resultado = await registrarVenta(operacion);

    mostrarMensaje(
      `Operación ${resultado.operacionId} registrada correctamente.`
    );

    limpiarOperacion();
    await cargarCaja();

  } catch (error) {
    console.error(error);
    mostrarMensaje("No se pudo registrar la operación.");
  }
}

async function abrirDialogoMovimiento(tipoMovimiento) {
  const importe = Number($w("#movementAmountInput").value || 0);
  const concepto = $w("#movementConceptInput").value || "";

  if (!importe || importe <= 0) {
    mostrarMensaje("Introduce un importe válido.");
    return;
  }

  try {
    await registrarMovimientoCaja({
      cajaId: cajaActual.cajaId,
      tipoMovimiento,
      importe,
      concepto,
      afectaEfectivo: true,
      modoOperacion: "SINTETICO"
    });

    mostrarMensaje("Movimiento de caja registrado.");
    await cargarCaja();

  } catch (error) {
    console.error(error);
    mostrarMensaje("No se pudo registrar el movimiento.");
  }
}

async function guardarOperacionPendiente() {
  mostrarMensaje("La operación se guardará como pendiente.");
}

function limpiarOperacion() {
  lineasVenta = [];
  $w("#saleLinesRepeater").data = [];
  $w("#receivedInput").value = "";
  recalcularVenta();
}

async function buscarCatalogo() {
  const texto = $w("#searchInput").value.trim();

  if (!texto) {
    return;
  }

  // Conectar aquí con Bookings o Stores según el tipo de elemento.
}

function obtenerTotal() {
  return lineasVenta.reduce(
    (total, linea) =>
      total + linea.cantidad * linea.precioUnitario + linea.impuesto,
    0
  );
}

function formatearEuros(valor) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(valor || 0);
}

function mostrarMensaje(texto) {
  $w("#messageText").text = texto;
  $w("#messageText").show();
}
