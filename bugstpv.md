He auditado los **29 módulos** completos (`#htmlTPV.txt`, `TPV.c518w.js`, `tpvPageController.js` y toda la capa `backend/tpv/*`).

### Diagnóstico general
La base de ingeniería y seguridad es **muy sólida** en sus cimientos:
* Handshake *fail-closed* con `PARENT_ORIGIN_ALLOWLIST` + `HANDSHAKE_NONCE`.
* Identidad del operador resuelta exclusivamente en servidor (`resolveTpvContext` / `getTpvOperatorContext`), nunca desde el cliente.
* Aritmética monetaria en céntimos (`toMinorUnits` / `fromMinorUnits`) y cálculo fiscal delegado en `@wix/ecom` (`taxCalculation.calculateTax`).
* Idempotencia con huella (`requestFingerprint`), *locks* optimistas con versión (`withTpvSessionLock` en `CONTROL_OPERATIVO`) y *ledger* físico encadenado por SHA-256 en `MOVIMIENTOS_CAJA`.

Sin embargo, **en su estado actual el TPV tiene bugs bloqueantes que impiden completar un ciclo operativo real (vender → cobrar → cerrar Z → exportar)** y varios flujos profesionales clave están deshabilitados o *stubbeados*.

---

## 1. Bugs Críticos / Bloqueantes

### B1. `registrarVenta` devuelve `PENDING`, lo que rompe `#htmlTPV.txt` y atasca la clave idempotente
* **Archivos:** `backend/tpv/tpvVentas.web.js` (`registrarVenta` → `salePendingEnvelope`) y `#htmlTPV.txt` (`call()`, `keyedAction()`, `#saveSale.onclick`).
* **Causa:** `registrarVenta` siempre responde con `tpvPending("TPV_PAYMENT_PROVIDER_NOT_CONFIGURED", ...)` (`status: "PENDING"`). En `#htmlTPV.txt`, `call()` interpreta `response.status === "PENDING"` como un **rechazo de Promise** (`rejectStructured`).
* **Impacto doble:**
  1. Al pulsar *Registrar venta pendiente*, siempre salta el `catch` con un *toast* de error, no limpia el carrito (`state.items`) ni actualiza `state.lastSale`.
  2. `keyedAction("SALE", ...)` solo borra `sessionStorage.removeItem("tpv_key_SALE")` en el `.then()`, por lo que la clave UUID queda **atascada** en `sessionStorage` y la **siguiente venta distinta fallará con `TPV_IDEMPOTENCY_CONFLICT`**.

### B2. Toda venta registrada bloquea permanentemente el Cierre Z
* **Archivos:** `backend/tpv/tpvVentas.web.js`, `backend/tpv/tpvCierres.web.js` (`generarCierreZ`) y `backend/tpv/tpvRepository.js` (`getPendingTpvSales`).
* **Causa:** `registrarVenta` guarda todas las ventas en `TRANSACCIONES_TPV` con `status: "PENDING_PAYMENT"`, y **no existe ningún WebMethod** que las confirme (`CONFIRMED`). Al intentar ejecutar `generarCierreZ`, `getPendingTpvSales(sessionId)` encuentra esa venta y lanza `TPV_PENDING_SALES_PREVENT_CLOSE`.
* **Impacto:** En cuanto se registra una venta en una sesión, la caja **no puede cerrarse**.

### B3. `ReferenceError` en `exportarAuditoriaTPV` (crash garantizado en runtime)
* **Archivo:** `backend/tpv/tpvMovimientos.web.js` (`exportarAuditoriaTPV`).
* **Causa:** La línea 3 importa `{ requireAdmin, requireTpvOperator } from "backend/security"`, pero `exportarAuditoriaTPV` ejecuta `await requireCajero(traceId);`, función que **no está importada** en el archivo.
* **Impacto:** Cualquier llamada a `AUDIT_EXPORT` falla en runtime con `ReferenceError: requireCajero is not defined`.

### B4. Inconsistencia de estados `"CONFIRMED"` vs `"CONFIRMADA"` en ventas
* **Archivos:** `backend/tpv/tpvRepository.js` (`getCommittedTpvSales`, `_shouldProject`, `_writeCajaProjection`), `backend/tpv/tpvVentas.web.js` y `backend/tpv/tpvMovimientos.web.js` (`mapMovementRecord`).
* **Causa:** `TRANSACCIONES_TPV` y `getCommittedTpvSales` usan estados en inglés (`"PENDING_PAYMENT"`, `"CONFIRMED"`), mientras que `_shouldProject`, `_writeCajaProjection` y `mapMovementRecord` comprueban `record.status === "CONFIRMADA"`.
* **Impacto:** Aunque una venta pasara a `"CONFIRMED"`, `exportarMovimientosCaja` la descartaría en `mapMovementRecord` (`if (sourceType === "TPV_SALE" && record.status !== "CONFIRMADA") return null;`) y no aparecería en la exportación.

### B5. `registrarVenta` bloquea cualquier venta que incluya productos
* **Archivo:** `backend/tpv/tpvVentas.web.js` (`buildSaleReadiness`).
* **Causa:** `if (containsProducts) saleReadinessBlockers.push("INVENTORY_POLICY_NOT_CONFIGURED");` se añade de forma incondicional.
* **Impacto:** Es imposible registrar ventas de productos (`CAT-04`, `VEN-02`, `VEN-03`) en `registrarVenta`, aunque el catálogo V3 y las variantes se carguen bien.

---

## 2. Bugs Funcionales y de Contrato (UI ↔ Controller ↔ Backend)

### B6. El cliente seleccionado en el TPV se descarta al guardar la venta
* **Archivos:** `#htmlTPV.txt` (`state.customerIdentityId`), `public/tpvPageController.js` (`SALE_REGISTER`), `backend/tpv/tpvVentas.web.js` (`registrarVenta`) y `backend/tpv/tpvNativeDirectory.js` (`resolveTpvContact`).
* **Causa:** El widget permite buscar y seleccionar cliente (`customerIdentityId`), y `tpvNativeDirectory.js` implementa `resolveTpvContact(contactId)` precisamente para revalidarlo en servidor antes de persistir la venta. Sin embargo, `#saveSale.onclick` **no envía `customerIdentityId`**, `tpvPageController.js` **no lo reenvía** y `registrarVenta` **no lo acepta ni llama a `resolveTpvContact`**.

### B7. `obtenerPermisosTPV` deshabilita funciones que el backend ya implementa
* **Archivo:** `backend/tpv/tpvPermisos.web.js` (`obtenerPermisosTPV`).
* **Causa:** Devuelve de forma fija `issueTicketZ: false` y `exportAudit: false` incluso cuando `rolWebsite === "ADMIN"`.
* **Impacto:** En `#htmlTPV.txt`, los botones **Cierre Z** (`#ticketZ`) y **Exportar auditoría** (`#exportAudit`) quedan permanentemente deshabilitados en la UI, aunque sus WebMethods y rutas en `tpvPageController.js` existen.

### B8. Dos flujos incompatibles para cerrar la caja (`SESSION_CLOSE` vs `TICKET_Z`)
* **Archivos:** `backend/tpv/tpvCaja.web.js` (`cerrarSesionCaja`), `backend/tpv/tpvCierres.web.js` (`generarCierreZ`) y `backend/tpv/tpvRepository.js` (`latestTpvSession`).
* **Causa:**
  * `cerrarSesionCaja` inserta un movimiento `"CIERRE"` en `MOVIMIENTOS_CAJA` y actualiza `CAJA_ACTUAL`, pero **no** crea el registro `TICKET_Z`.
  * `generarCierreZ` crea el registro `TICKET_Z` y proyecta `CAJA_ACTUAL.cashRegisterStatus = "CERRADA"`, pero **no** inserta el movimiento `"CIERRE"` en `MOVIMIENTOS_CAJA` ni llama a `closeTpvCajaSessionProjection`.
* **Impacto:** Dependiendo de qué endpoint se invoque, falta o bien el movimiento de cierre en el ledger físico o bien el informe Z fiscal/operativo.

### B9. `buildTpvSessionSummary` consulta `VENTA_LINEAS` de forma insegura
* **Archivo:** `backend/tpv/tpvCierresCore.js` (`buildTpvSessionSummary`) y `backend/tpv/tpvRepository.js` (`queryTpvRecords`).
* **Causa:** `buildTpvSessionSummary` ejecuta `queryTpvRecords(TPV_COLLECTIONS.VENTA_LINEAS, undefined)` sin filtro de sesión. `queryTpvRecords` busca `TPV_EVENT_MOVEMENT_TYPES[TPV_COLLECTIONS.VENTA_LINEAS]`: si `VENTA_LINEAS` no está en ese mapa, lanza `TPV_COLLECTION_NOT_ALLOWED` (rompiendo `obtenerEstadoCaja`, `obtenerResumenCaja`, `generarTicketX` y `generarCierreZ`); si sí está, lee toda la colección histórica en memoria hasta el límite de 10.000 registros.

### B10. `obtenerEstadoCaja` carece de `try/catch`
* **Archivo:** `backend/tpv/tpvCaja.web.js` (`obtenerEstadoCaja`).
* **Causa:** A diferencia del resto de WebMethods de `tpvCaja.web.js`, no envuelve su cuerpo en `try/catch`. Si `requireTpvOperator`, `resolveTpvContext` o `readTpvCajaSnapshot` falla (p. ej. `TPV_CASH_REGISTER_NOT_PRESEEDED`), propaga una excepción cruda sin `normalizeTpvError`.

### B11. Doble clic posible en el modal de Cierre Z
* **Archivo:** `#htmlTPV.txt` (`$("ticketZ").onclick`).
* **Causa:** A diferencia de `saveSale`, `exportMovements`, `exportAudit` y `ticketX`, el callback de confirmación del modal de `ticketZ` no comprueba ni activa `state.busy`. Aunque la idempotencia de backend protege contra duplicados, un doble clic rápido puede lanzar una segunda petición concurrente que reciba `TPV_SESSION_IN_PROGRESS`.

---

## 3. Brechas para funcionar como TPV Profesional (frente a la Matriz de Pruebas)

| Área | Estado real en código auditado | Qué falta implementar |
|---|---|---|
| **Reservas de cliente (`CLI-03`, `CLI-04`)** | `obtenerReservasClienteTPV` (`tpvCatalogo.web.js`) devuelve `items: []` fijo. | Consultar `@wix/bookings` filtrando por `contactId` y permitir vincular `bookingId` a la línea/venta. |
| **Cobro efectivo y tarjeta (`PAG-01..04`)** | No hay escritura en `TPV_COLLECTIONS.PAGOS`, ni creación de `orderId` en `@wix/ecom`, ni captura con `@wix/payments`. | Implementar el flujo de confirmación de pago: efectivo (registro inmediato en `PAGOS` + `MOVIMIENTOS_CAJA` y pedido manual en Wix eCommerce) y tarjeta (checkout/terminal + webhook/confirmación de estado). |
| **Pago mixto (`PAG-05`)** | `tpvWriteV1Contract.js` bloquea explícitamente >1 medio de pago (`TPV_WRITE_V1_SPLIT_TENDER_UNSUPPORTED`) y `#htmlTPV.txt` limita `state.payments.length >= 1`. | Levantar la restricción V1 cuando se soporte el desglose multipago (`validarDesglosePagos` ya lo soporta aritméticamente en `tpvPagos.web.js`). |
| **Stock (`CAT-04`, `CAT-05`, `TEST-04`)** | `obtenerVariantesProducto` lee `inStock`, pero ni `registrarVenta` ni `prepareTpvSaleCatalog` validan cantidad disponible ni descuentan inventario en `@wix/stores` Inventory. | Validar stock suficiente en `prepareTpvSaleCatalog` y descontar/revertir inventario al confirmar venta o devolución. |
| **Descuentos y Tarifa personalizada (`VEN-06`)** | `normalizeTpvSaleLineRequests` y `tpvValidation.js` rechazan cualquier descuento (`TPV_DISCOUNT_NOT_CONFIGURED`) y `#tabPersonalizada` está `disabled`. | Definir tabla/regla de descuentos autorizados por rol en backend y recalcular base + IVA tras descuento. |
| **Facturación / Recibos (`FAC-01..03`)** | No hay integración con `@wix/invoices` ni numeración correlativa de tickets/facturas simplificadas; `#printLast` está deshabilitado. | Conectar emisión de recibo/factura simplificada (con serie, NIF, base e IVA) y habilitar plantilla térmica 80 mm para `#printLast` (reutilizando el CSS `@media print` ya existente). |
| **Devoluciones (`DEV-01..04`)** | `registrarDevolucion` (`tpvDevoluciones.web.js`) solo audita el intento y devuelve `TPV_REFUND_PROVIDER_NOT_CONFIGURED`; `tpvPageController.js` lanza `TPV_REFUND_DISABLED`; `#htmlTPV.txt` tiene `refund` en `PERMANENTLY_DISABLED`. | Implementar devolución total/parcial contra venta `CONFIRMED`, reembolso en `Payments`/efectivo, reposición de stock y apunte inverso sin borrar el original. |
| **Paginación de servicios (`CAT-01`)** | `obtenerServicios` y `resolveServices` cargan una única página de 100 servicios y fallan con `TPV_SERVICE_CATALOG_PAGE_INCOMPLETE` si hay >100. | Iterar con `offset` mientras `hasNext === true` hasta un límite razonable. |

---

## 4. Plan de Mejoras y Refactorización Priorizado

1. **Fase 1 — Corregir bugs bloqueantes inmediatos (sin cambiar arquitectura):**
   * Importar `requireCajero` (o unificar con `requireTpvOperator`/`requireAdmin`) en `tpvMovimientos.web.js` para arreglar `exportarAuditoriaTPV`.
   * Añadir `try/catch` con `normalizeTpvError` en `obtenerEstadoCaja` (`tpvCaja.web.js`).
   * Unificar `cerrarSesionCaja` y `generarCierreZ` en un único flujo transaccional que escriba el movimiento `"CIERRE"`, el documento `TICKET_Z` y actualice `CAJA_ACTUAL`.
   * Corregir `buildTpvSessionSummary` para obtener las líneas desde `TRANSACCIONES_TPV` (`sale.lineas`) de la propia sesión en lugar de hacer un *full scan* a `VENTA_LINEAS`.
   * Limpiar `sessionStorage` en `#htmlTPV.txt` cuando una venta queda registrada como `PENDING_PAYMENT` de forma controlada (o distinguir `PENDING` real de red de "venta registrada pendiente de cobro") y unificar `"CONFIRMED"` en lugar de `"CONFIRMADA"`.
2. **Fase 2 — Completar el circuito Venta → Pago → Stock → Cliente:**
   * Pasar `customerIdentityId` desde `#htmlTPV.txt` → `tpvPageController.js` → `registrarVenta` y validarlo con `resolveTpvContact`.
   * Implementar `obtenerReservasClienteTPV` contra `@wix/bookings`.
   * Implementar la confirmación de cobro en `EFECTIVO` y `TARJETA` (pasando ventas a `CONFIRMED`, escribiendo en `PAGOS` y actualizando inventario en `@wix/stores`) para desbloquear tanto la venta de productos como el Cierre Z.
   * Habilitar `issueTicketZ` y `exportAudit` para `ADMIN` en `obtenerPermisosTPV`.
3. **Fase 3 — Endurecimiento de rendimiento y UX:**
   * Sustituir en `exportarMovimientosCaja` y `exportarAuditoriaTPV` las descargas completas de 6 colecciones (`maxRecords: 10000`) por consultas filtradas por `sessionId` o paginadas por cursor (como ya hace `tpvExport.web.js`) para evitar *timeouts* de Wix Velo (~14 s).
   * Habilitar la impresión térmica 80 mm de tickets de venta (`#printLast`) reutilizando el motor `@media print` ya presente en `#htmlTPV.txt`.
   * Desbloquear devoluciones (`tpvDevoluciones.web.js` + retirar `refund` de `PERMANENTLY_DISABLED`) una vez integrado el proveedor de reembolsos.
