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
  
BLOQUE 2

## Lista técnica consolidada de bugs y mejoras pendientes

### 1. Registro de ventas pendientes

- Eliminar `medioPago` de `SALE_REGISTER`.
- Mantener siempre `payments: []` al registrar una venta pendiente.
- Rechazar en backend cualquier venta pendiente que reciba pagos:
  - Código: `TPV_PENDING_SALE_PAYMENTS_NOT_ALLOWED`.
- Validar nuevamente el estado fiscal y comercial antes de persistir.
- No mostrar ni almacenar una venta pendiente como cobrada.
- Diferenciar claramente:
  - Venta registrada.
  - Pago confirmado.
  - Venta conciliada.
  - Factura o ledger fiscal emitido.

### 2. Devoluciones

- Deshabilitar completamente el botón de devolución en el frontend.
- Cambiar el texto a: **“Devoluciones deshabilitadas”**.
- Mantener una respuesta controlada para llamadas antiguas:
  ```js
  case "REFUND":
      throw new Error("TPV_REFUND_PROVIDER_NOT_CONFIGURED");
  ```
- No importar ni ejecutar `registrarDevolucion` mientras no exista proveedor autorizado.
- No registrar devoluciones sintéticas como si fueran reembolsos reales.

### 3. Error crítico `traceId`

- Corregir `backend/tpv/tpvCatalogo.web.js`.
- Declarar `traceId` antes de utilizarlo en las líneas reportadas:
  - Línea 163.
  - Línea 248.
  - Línea 313.
- Usar un identificador de trazabilidad consistente por operación.
- No reutilizar variables fuera de su ámbito.
- Añadir pruebas de despliegue para:
  - Servicios.
  - Productos.
  - Variantes.
  - Personal.
  - Búsqueda de clientes.
- El controlador principal no contiene el error; la corrección debe hacerse en el módulo de catálogo.

### 4. Protocolo del widget Wix

- Mantener sin cambios:
  - `MM_READY`.
  - `MM_CONTEXT`.
  - `version: 1`.
- No sustituir el protocolo por `TPV_READY`.
- Validar:
  - Componente `htmlTPV`.
  - Versión de protocolo.
  - Estado de contexto.
  - Identificador de solicitud y respuesta.
- Validar un nonce o identificador de handshake para evitar aceptar contextos no relacionados.
- Mantener respuestas con pares consistentes:
  - `SALE_VALIDATE_RES`.
  - `SALE_REGISTER_RES`.
  - `CASHIER_STATE_RES`.
  - Etc.

### 5. Seguridad de `postMessage`

- No aceptar cualquier origen derivado de `document.referrer`.
- Usar una lista blanca de orígenes permitidos y configurados.
- Rechazar mensajes cuando:
  - El origen no esté autorizado.
  - `event.source` no sea `window.parent`.
  - Falte el nonce o contexto válido.
  - El tipo de respuesta no coincida con la solicitud.
- No confiar únicamente en controles visuales del frontend; la autorización real debe permanecer en backend.

### 6. Control de permisos y modo consulta

- Mantener `operationalWritesAvailable` como control global.
- Si está en modo consulta:
  - Deshabilitar cobros.
  - Deshabilitar devoluciones.
  - Deshabilitar aperturas, cierres y movimientos si no están autorizados.
  - Permitir únicamente lecturas y cálculos.
- No mostrar “operaciones autorizadas” si el backend no ha confirmado las escrituras.
- Cada operación sensible debe volver a validarse en backend, aunque el frontend la haya deshabilitado.

### 7. Pagos simulados

- Separar claramente:
  - Simulación de pago para pruebas.
  - Cobro real.
  - Registro comercial pendiente.
- No activar métodos de pago reales sin autorización explícita.
- No presentar efectivo, tarjeta o Bizum como pagos confirmados si solo se han introducido en pantalla.
- Mantener bloqueados:
  - Bizum.
  - Bono.
  - Tarjeta regalo.
  - Otros medios no verificados.
- Documentar que los importes introducidos en pruebas no generan cobros reales.

### 8. Coherencia frontend–backend

- Unificar nombres de propiedades entre ambos lados:
  - `lineItems` ↔ `lineas`.
  - `payments` ↔ `pagos`.
  - `method` ↔ `medioPago`.
  - `amount` ↔ `importe`.
  - `change` ↔ `importeCambio`.
- Evitar enviar campos no contemplados por el contrato de escritura.
- Validar cantidades como enteros positivos cuando el backend lo requiera.
- Validar importes con máximo de dos decimales.
- Rechazar líneas sin:
  - Tipo válido.
  - Identificador de catálogo.
  - Cantidad válida.

### 9. Idempotencia y operaciones pendientes

- Conservar claves idempotentes para aperturas, movimientos y ventas.
- No generar una nueva clave automáticamente cuando una operación haya quedado en estado desconocido.
- Mostrar al usuario que debe consultar el estado antes de repetir una operación.
- Mantener los códigos:
  - `TPV_TIMEOUT`.
  - `TPV_RECONCILIATION_REQUIRED`.
  - `TPV_IDEMPOTENCY_CONFLICT`.
- Verificar la respuesta persistida antes de mostrar “operación completada”.

### 10. Caja y sesiones

- Confirmar siempre:
  - Estado de sesión.
  - Operador autenticado.
  - Identificador de sesión.
  - Fecha de operación.
  - Fondo inicial.
- Impedir:
  - Abrir dos sesiones simultáneas.
  - Reabrir una sesión cerrada.
  - Cerrar con ventas pendientes no conciliadas.
  - Operar sin sesión abierta.
- Verificar después de cada escritura el estado real de `CajaActual`.

### 11. Cierre Z y Control X

- Mantener Control X como informe informativo sin modificar saldos.
- Mantener Cierre Z como operación bloqueante e irreversible para la sesión.
- Validar diferencias de efectivo y exigir motivo cuando proceda.
- No permitir cierre si existen:
  - Ventas pendientes.
  - Devoluciones pendientes.
  - Movimientos no conciliados.
  - Diferencias no justificadas.

### 12. Catálogo fiscal

- No permitir líneas con precio inexistente o no verificable.
- Validar moneda EUR.
- Validar precio fijo de servicios.
- Validar variantes y disponibilidad de productos.
- Rechazar artículos sin clasificación fiscal.
- Mostrar claramente cuándo el cálculo fiscal de Wix no está disponible.
- No permitir registrar una venta si el cálculo fiscal está incompleto o inconsistente.

### 13. HTML y estructura

- Mantener un único documento HTML completo.
- Eliminar duplicaciones de `DOCTYPE`, `<html>`, `<head>` y `<body>`.
- Revisar que todos los identificadores usados por JavaScript existan en el HTML.
- Evitar botones visualmente activos que ejecuten operaciones deshabilitadas.
- Cambiar textos ambiguos como:
  - “Devolución no habilitada”.
  - “Impresión pendiente”.
  - “Pago aplicado”.
- Usar textos que distingan consulta, simulación y operación real.

### 14. Exportaciones y auditoría

- Unificar `MOVEMENTS_EXPORT` y `CASH_MOVEMENTS_EXPORT` si representan la misma función.
- Eliminar tipos de mensaje no utilizados.
- Verificar que las exportaciones no incluyan datos sensibles innecesarios.
- Declarar siempre `traceId` cuando forme parte de la auditoría.
- Mantener protección contra fórmulas CSV.
- Informar si la exportación está truncada o incompleta.

### 15. Control de errores

- Añadir al catálogo todos los códigos usados por frontend y backend.
- Evitar respuestas genéricas cuando exista un código técnico conocido.
- Mantener mensajes en español para el usuario.
- Separar:
  - Mensaje público.
  - Detalle técnico.
  - Acción de recuperación.
  - Requiere conciliación.
  - Puede reintentarse.
- No afirmar que una operación se completó sin confirmación de persistencia.

### 16. Publicación y pruebas

- Confirmar de forma independiente:
  - Sitio publicado.
  - Pasarela real bloqueada.
  - Modo de prueba activo.
  - TPV accesible en `/tpv`.
  - Backend desplegado sin errores.
- Ejecutar pruebas sin pagos reales:
  - Carga de catálogo.
  - Selección de servicio.
  - Selección de producto y variante.
  - Cálculo fiscal.
  - Registro de venta pendiente.
  - Apertura de caja.
  - Entrada y salida de efectivo.
  - Control X.
  - Cierre Z.
  - Auditoría.
  - Exportaciones.
  - Rechazo de devoluciones.
  - Rechazo de pagos en ventas pendientes.
- Documentar por prueba:
  - Entrada.
  - Respuesta esperada.
  - Resultado real.
  - Evidencia.
  - Estado: aprobado, bloqueado o pendiente.

### Prioridad recomendada

1. Corregir `traceId` en `tpvCatalogo.web.js`.
2. Eliminar `medioPago` y forzar `payments: []`.
3. Bloquear devoluciones en frontend y backend.
4. Validar protocolo, origen y nonce.
5. Confirmar despliegue sin errores.
6. Ejecutar la batería de pruebas en modo simulado.
7. Publicar únicamente cuando todas las comprobaciones críticas estén aprobadas.

