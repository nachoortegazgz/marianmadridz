# QA — Retirada de inventario personalizado y delegación en Wix nativo

**Fecha:** 2026-11-10  
**PR de retirada:** [#238](https://github.com/nachoortegazgz/marianmadridz/pull/238) — fusionado  
**PR de corrección semántica:** [#240](https://github.com/nachoortegazgz/marianmadridz/pull/240) — pendiente  
**Baseline de retirada:** `main` en `0f1baa8d542fb90041ba3ec20f148eebe3479369`  
**Commit fusionado:** `fb853e3f78e973d7f2bab3eed25e3902acf76a20`  
**Estado:** CI offline verde; runtime Wix y E2E pendientes.

## 1. Objetivo y alcance

Retirar la implementación personalizada de stock, sus WebMethods, validaciones específicas, UI de staff y sincronización CMS. Wix Stores Catalog V3 y sus funciones nativas son la única autoridad de stock comercial.

No se cambian las colecciones ni los datos existentes. Los hooks de protección append-only de `MovimientosInventario` se conservan.

## 2. Evidencia previa

- Wix Orders Settings consultado en solo lectura (HTTP 200): `inventoryUpdateTrigger=ON_ORDER_PAID`; `createInvoice=false`.
- Wix Stores Catalog V3 activo; 30/30 inventory items auditados con tracking de cantidad en una ubicación.
- El módulo custom previo mantenía reservas y proyecciones CMS y podía invocar ajustes nativos de stock manuales; sus webhooks de pedidos/pagos/cancelación/reembolso estaban acoplados a esa capa.
- La UI staff exponía consumo interno, recepciones y conciliación manual.

## 3. Cambios fusionados en PR #238

| Archivo / área | Cambio |
|---|---|
| `src/backend/inventario.web.js` | Eliminado (1.695 líneas). |
| `src/backend/events.js` | Quitadas reserva, proyección de venta, liberación y proyección de restock custom. Se conserva marcador idempotente, ledger fiscal, estado CitasF2 y rectificación de reembolso. |
| `src/backend/crons.js` | Reconciliador marca pedidos con referencias de catálogo completas (Bookings, Stores y mixtos); no crea stock ni movimientos. |
| `src/pages/ZONA MARIAN.gn7mx.js` | Eliminadas imports y acciones custom de inventario. |
| `#htmlOnlyStaff.txt` | Eliminados panel, handlers y mensajes de inventario. |
| `src/backend/internalConfig.js` | Eliminado `INVENTORY_CONFIG`; se mantienen identificadores de colecciones históricas. |
| `src/backend/validation.js` | Eliminado `validateInventoryOrderLine`, ya sin consumidor. |
| Tests | Eliminado el test del writer retirado; añadida cobertura para webhooks sin stock custom y cron de pedidos mixtos. |

## 4. Integridad fiscal y datos

- `wixEcom_onOrderPaymentStatusUpdated` mantiene el registro económico, recuperación fiscal, proyección de caja y actualización de pagos Bookings.
- `wixEcom_onOrderRefunded` mantiene el ledger de reembolso y su idempotencia; Wix aplica el side effect nativo de restock cuando corresponde.
- `wixEcom_onOrderCanceled` mantiene la cancelación de reservas Bookings; no libera stock desde CMS.
- No se insertan nuevos registros en `MovimientosInventario`; sus hooks `beforeUpdate` y `beforeRemove` siguen protegiendo el histórico.
- No se ha modificado Wix CMS, stock, servicios, reservas, pagos ni Orders Settings.

## 5. CI offline — PR #238

**GitHub Actions run:** [42721311048](https://github.com/nachoortegazgz/marianmadridz/actions/runs/42721311048)

- Job: Layer 1 and 2 QA, offline regression, SDK contract and lint.
- 50 suites, 488 tests, 0 fallos.
- Contrato Wix eCommerce Cart V2: SUCCESS.
- Contrato Wix Bookings Reader V2: SUCCESS.
- ESLint: SUCCESS.
- El test de cron y el test de eventos Bookings/eCommerce pasaron; el test de hooks append-only también pasó.

## 6. Corrección semántica pendiente — PR #240

El marcador de `ORDER_CREATED` fusionado en PR #238 etiqueta la autoridad como `WIX_STORES_NATIVE`, aunque el handler también procesa pedidos Bookings y mixtos. PR #240 cambia el valor a `WIX_CATALOG_OWNER` y ajusta la expectativa del test; no modifica efectos de negocio ni datos. CI de esta corrección debe confirmarse antes de fusionar.

## 7. Pruebas runtime pendientes

1. Wix Local Editor/Preview: compra de producto con tracking activo; confirmar decremento nativo al pago.
2. Cancelación de pedido: comprobar la política nativa `restockAllItems` configurada por Wix.
3. Reembolso parcial/total: comprobar que el side effect nativo de restock se aplica solo cuando se solicita.
4. Confirmar que los webhooks no generan escrituras CMS de inventario.
5. Confirmar que venta y refund siguen creando movimientos económicos/fiscales correctos.
6. Verificar no regresión en pedidos Bookings, Stores y mixtos.

## 8. Reversión y despliegue

- PR #238 fusionado, pero no se ha publicado una nueva versión del sitio por esta intervención.
- Reversión técnica: revertir el merge commit antes de publicar. No requiere revertir datos porque no se han hecho mutaciones.
- No desplegar si falla CI de PR #240 o el E2E nativo de venta/cancelación/refund.
- La restauración de código custom no debe reactivar escrituras históricas ni modificar cantidades; cualquier reversión futura requiere nueva revisión de arquitectura.

## 9. Restricciones vigentes

No activar automatizaciones que contacten clientes. No realizar cargos reales, reservas reales, cambios de stock, escrituras CMS de producción ni publicación durante esta fase.
