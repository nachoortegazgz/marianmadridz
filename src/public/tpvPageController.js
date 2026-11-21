// public/tpvPageController.js

import {
  obtenerEstadoCaja,
  abrirSesionCaja,
  obtenerServicios,
  obtenerProductos,
  obtenerStaff,
  registrarVenta,
  registrarMovimientoCaja,
  registrarDevolucion,
  generarControlX,
  generarCierreZ,
  obtenerResumenCaja,
  obtenerMovimientosCaja
} from 'backend/tpv/tpvBackend';

const ALLOWED_ORIGIN = '*';

$w.onReady(() => {
  window.addEventListener('message', onMessage);
});

async function onMessage(event) {
  const message = event.data || {};
  const { type, payload = {}, messageId } = message;

  if (!type || !messageId) {
    return;
  }

  try {
    switch (type) {
      case 'MM_READY':
        reply(event, 'MM_CONTEXT', {
          status: 'SUCCESS',
          data: {
            component: 'htmlTPV',
            environment: 'LIVE',
            previewOnly: false
          }
        }, messageId);
        break;

      case 'CASHIER_STATE':
        await respond(
          event,
          messageId,
          'CASHIER_STATE_RES',
          obtenerEstadoCaja
        );
        break;

      case 'SESSION_OPEN':
        await respond(
          event,
          messageId,
          'SESSION_OPEN_RES',
          () => abrirSesionCaja({
            openingCash: toNumber(payload.openingCash),
            terminalId: payload.terminalId || 'TPV'
          })
        );
        break;

      case 'CATALOG_SERVICES':
        await respond(
          event,
          messageId,
          'CATALOG_SERVICES_RES',
          obtenerServicios
        );
        break;

      case 'CATALOG_PRODUCTS':
        await respond(
          event,
          messageId,
          'CATALOG_PRODUCTS_RES',
          () => obtenerProductos({
            limit: payload.limit || 100,
            cursor: payload.cursor || null
          })
        );
        break;

      case 'CATALOG_STAFF':
        await respond(
          event,
          messageId,
          'CATALOG_STAFF_RES',
          obtenerStaff
        );
        break;

      case 'SALE_REGISTER':
        await respond(
          event,
          messageId,
          'SALE_REGISTER_RES',
          () => registrarVenta({
            sessionId: payload.sessionId,
            lineItems: payload.lineItems || [],
            payments: payload.payments || [],
            subtotal: toNumber(payload.subtotal),
            tax: toNumber(payload.tax),
            total: toNumber(payload.total)
          })
        );
        break;

      case 'CASH_MOVEMENT':
        await respond(
          event,
          messageId,
          'CASH_MOVEMENT_RES',
          () => registrarMovimientoCaja({
            movementType: payload.movementType,
            amount: toNumber(payload.amount),
            reason: payload.reason || 'Movimiento de caja'
          })
        );
        break;

      case 'REFUND':
        await respond(
          event,
          messageId,
          'REFUND_RES',
          () => registrarDevolucion({
            saleId: payload.saleId,
            amount: toNumber(payload.amount),
            reason: payload.reason || 'Devolución'
          })
        );
        break;

      case 'TICKET_X':
        await respond(
          event,
          messageId,
          'TICKET_X_RES',
          () => generarControlX({
            sessionId: payload.sessionId,
            countedCash: toNumber(payload.countedCash)
          })
        );
        break;

      case 'TICKET_Z':
        await respond(
          event,
          messageId,
          'TICKET_Z_RES',
          () => generarCierreZ({
            sessionId: payload.sessionId,
            countedCash: toNumber(payload.countedCash),
            nextOpeningCash: toNumber(payload.nextOpeningCash)
          })
        );
        break;

      case 'SESSION_SUMMARY':
        await respond(
          event,
          messageId,
          'SESSION_SUMMARY_RES',
          () => obtenerResumenCaja({
            sessionId: payload.sessionId
          })
        );
        break;

      case 'AUDIT_LIST':
        await respond(
          event,
          messageId,
          'AUDIT_LIST_RES',
          obtenerMovimientosCaja
        );
        break;

      default:
        reply(
          event,
          `${type}_RES`,
          {
            status: 'ERROR',
            error: {
              code: 'UNKNOWN_MESSAGE',
              message: `Operación no soportada: ${type}`
            }
          },
          messageId
        );
    }
  } catch (error) {
    reply(
      event,
      `${type}_RES`,
      {
        status: 'ERROR',
        error: normalizeError(error)
      },
      messageId
    );
  }
}

async function respond(event, messageId, responseType, operation) {
  const result = await operation();

  reply(
    event,
    responseType,
    {
      status: 'SUCCESS',
      data: result || {}
    },
    messageId
  );
}

function reply(event, type, payload, messageId) {
  event.source.postMessage(
    {
      type,
      payload,
      messageId,
      version: 1
    },
    ALLOWED_ORIGIN
  );
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeError(error) {
  return {
    code: error?.code || 'TPV_ERROR',
    message: error?.message || 'No se pudo completar la operación.'
  };
}

La versión anterior del backend usaba varios métodos con sufijo `SANDBOX`; por tanto, todavía habría que renombrar o adaptar esas exportaciones antes de considerarlo listo para producción LIVE.
