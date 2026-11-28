> **ACTUALIZACIÓN 2026-11-28 — documento histórico, no usar la tabla como estado vigente.**
>
> Esta auditoría antecede a la integración nativa implementada en la rama `feat/tpv-native-wix-commerce-2026-11-28`. Los hallazgos que siguen deben contrastarse con el código actual y con `tests/runtime/RUNTIME-TEST-PLAN.md`.
>
> **Implementado en código en esta rama (pendiente de CI final y Runtime Preview):**
> - Pedido nativo Wix Orders: creación, correlación por `channelInfo.externalOrderId`, lectura posterior y verificación de total/estado.
> - Venta TPV persistida antes del pedido Wix, con recuperación por clave idempotente.
> - Cobro en efectivo mediante `orderTransactions.addPayments` como pago offline; el TPV no simula un cobro de tarjeta ni procesa una pasarela.
> - Ledger de caja `TPV_PAYMENT` (`COBRO`), auditoría independiente de venta/pedido/pago y read-back `SALE_READBACK`.
> - El stock se gestiona por el flujo nativo de Wix Orders conforme a `settings.orderApprovalStrategy`; no existe un inventario paralelo del TPV.
> - `CASHIER_STATE` es read-only; el singleton `CajaActual` se inicializa en el comando explícito `SESSION_OPEN`.
> - El runner E2E no cierra sesiones preexistentes y ejecuta arqueo parcial, venta/pedido, Ticket X y Ticket Z.
>
> **Pendiente de validar o implementar antes de GO productivo:**
> - Ejecución real en Wix Editor Preview y read-back de CMS/Orders.
> - Cobro efectivo completo en Runtime, con confirmación física del efectivo y conciliación de caja.
> - Integración de terminal/proveedor para tarjeta; no se habilita con un `AddPayments` offline.
> - Devoluciones/reembolsos nativos, cancelación de pedidos pagados, factura/recibo y cumplimiento fiscal productivo.
> - Pruebas de permisos con usuarios/cajeros reales; Preview ejecuta como Admin y no acredita los roles productivos.
>
> **Evidencia:** CI offline se informa por SHA y no sustituye Runtime Preview. No se debe declarar PASS/GO hasta completar ambos niveles.
>
> ---

He contrastado los **40 bloqueos** de tu lista directamente contra el código real de los **29 módulos** auditados.

### Hallazgos previos importantes (discrepancias con el código actual)
Antes de ver el detalle, hay **4 puntos donde tu tabla no coincide con el código vigente** o genera **errores silenciosos graves**:
1. **Bloqueos #3, #4 y #5 (Contradicción crítica):** `TPV_PENDING_SALE_PAYMENTS_NOT_ALLOWED` **no existe** en el código actual. De hecho, `tpvPageController.js` **sí** envía `pagos` y `medioPago` a `registrarVenta()`, y `tpvWriteV1Contract.js` **exige** exactamente 1 pago (`TPV_WRITE_V1_PAYMENT_REQUIRED`). Si intentas guardar una venta sin pago (como sugiere la UI *"Registrar venta pendiente"*), **falla con `TPV_SALE_NOT_READY`**.
2. **Bloqueo #29 + #30 (Error silencioso de carrito):** Si una venta devuelve `PENDING` o `TPV_TIMEOUT`, `keyedAction()` deja `tpv_key_SALE` guardada en `sessionStorage`. Si el cajero modifica líneas del carrito y vuelve a guardar, **reutiliza silenciosamente la clave anterior** y falla con `TPV_IDEMPOTENCY_CONFLICT`.
3. **Bloqueo #37 (`traceId` en `tpvCatalogo.web.js`):** Ese fallo **ya está corregido** en el código actual (todos los `webMethod` declaran `const traceId = ...` al inicio).
4. **Bloqueo #38 (`exportarAuditoriaTPV`):** `tpvMovimientos.web.js` llama a `requireCajero(traceId)` **sin haberlo importado** (crash en runtime). Además, si falla `appendSaleAudit` en `registrarVenta`, devuelve `auditPersisted: false` dentro de un `PENDING` que el widget no inspecciona (**auditoría incompleta silenciosa**).

---

## Evaluación de los 40 bloqueos

**Leyenda de clasificación:**
* **Seguridad / Normativa / Integridad:** Bloqueo necesario e irrenunciable (no debe eliminarse).
* **Fricción temporal (V1):** Bloqueo puesto porque falta implementar el módulo/proveedor; impide operar como TPV profesional hasta completarlo.
* **Desalineado / Bug:** El bloqueo contradice otro módulo o produce un fallo silencioso.

| Nº | Bloqueo | Clasificación | ¿Error silencioso / colateral? | Verificación en código real |
|---:|---|---|---|---|
| **1** | Modo consulta global (`operationalWritesAvailable`) | **Seguridad / Integridad** | **Sí (UX):** deshabilita botones en `updateControlAvailability()` sin explicar al cajero qué permiso/sesión falta. | En `obtenerPermisosTPV` está en `true`, pero `issueTicketZ` y `exportAudit` vienen en `false`. |
| **2** | Cobros deshabilitados (`data-method disabled`) | **Fricción temporal (V1)** | **Sí (Flujo):** contradice a `tpvWriteV1Contract.js`, que exige 1 pago para registrar la venta. | Solo `EFECTIVO` y `TARJETA` se habilitan si `saleQuote` es válido; el texto sigue diciendo *"Cobros deshabilitados"*. |
| **3** | Ventas sin pagos (`SALE_REGISTER`) | **Desalineado / Bug** | **Sí:** hoy el backend **rechaza** ventas sin pago (`TPV_WRITE_V1_PAYMENT_REQUIRED`). | `getTpvWriteV1Blockers` bloquea si `pagos.length === 0`. |
| **4** | `TPV_PENDING_SALE_PAYMENTS_NOT_ALLOWED` | **Desalineado (Obsoleto)** | **No existe en código:** la tabla describe una regla antigua ya invertida. | `tpvPageController.js` sí mapea y envía `pagos` a `registrarVenta()`. |
| **5** | `medioPago` omitido en `registrarVenta()` | **Desalineado (Obsoleto)** | **No existe en código:** `tpvPageController.js` sí envía `medioPago`. | `registrarVenta` recibe `medioPago` y `pagos`, aunque los marca `confirmed: false`. |
| **6** | Devoluciones bloqueadas (`case "REFUND"`) | **Fricción temporal (V1)** | **No:** lanza `TPV_REFUND_DISABLED` explícito (no `TPV_REFUND_PROVIDER_NOT_CONFIGURED`, que viene de `tpvDevoluciones.web.js`). | Impide pruebas `DEV-01` a `DEV-04`. |
| **7** | Botón `#refund` bloqueado | **Fricción temporal (V1)** | **Sí (UX):** `PERMANENTLY_DISABLED` ignora incluso si el backend habilitara `requestRefund`. | Bloqueo doble UI + Controller + Backend. |
| **8** | Tarifa personalizada (`#tabPersonalizada`) | **Fricción temporal (V1)** | **No:** muestra *toast* explicativo al pulsar. | Bloquea `VEN-06` y precios libres. |
| **9** | Bizum bloqueado | **Fricción temporal (V1)** | **No:** botón deshabilitado con *tooltip*. | `PAYMENT_METHODS` en widget solo incluye `EFECTIVO` y `TARJETA`. |
| **10** | Bono bloqueado | **Fricción temporal (V1)** | **No:** backend devuelve `TPV_PAYMENT_METHOD_NOT_VERIFIED`. | Falta consultar saldo real. |
| **11** | Tarjeta regalo bloqueada | **Fricción temporal (V1)** | **No:** `consultarTarjetaRegalo` devuelve `TPV_GIFT_CARDS_NOT_CONFIGURED`. | Falta integración nativa. |
| **12** | Otros medios bloqueados | **Fricción temporal (V1)** | **No:** rechazado por contrato V1 (`TPV_PAYMENT_METHOD_UNSUPPORTED`). | Correcto mientras no exista conciliación. |
| **13** | Pago dividido bloqueado (`payments.length >= 1`) | **Fricción temporal (V1)** | **No:** muestra *toast* en UI y `TPV_WRITE_V1_SPLIT_TENDER_UNSUPPORTED` en backend. | Impide `PAG-05` (pago mixto), aunque `tpvPagos.web.js` ya calcula mixtos. |
| **14** | Cambio limitado al efectivo | **Seguridad / Integridad** | **No:** valida en UI (`#htmlTPV.txt`) y en backend (`TPV_CHANGE_REQUIRES_CASH`). | Correcto: tarjeta no da cambio. |
| **15** | Ticket vacío bloqueado | **Integridad** | **No:** *toast* en UI y `TPV_LINES_REQUIRED` en backend. | Correcto. |
| **16** | Registro sin sesión bloqueado | **Seguridad / Integridad** | **No:** `TPV_SESSION_REQUIRED` / `TPV_SESSION_NOT_OPEN`. | Imprescindible para cuadre de caja. |
| **17** | Apertura sin previsualización | **Integridad** | **No:** `TPV_SESSION_PREVIEW_REQUIRED`. | Evita aperturas ciegas. |
| **18** | Apertura duplicada (`abrirSesionCaja`) | **Seguridad / Integridad** | **No:** `TPV_PREVIOUS_SESSION_NOT_CLOSED` / `TPV_SESSION_ALREADY_CLOSED_TODAY`. | Imprescindible. |
| **19** | Apertura con previsualización obsoleta | **Integridad** | **No:** `TPV_SESSION_PREVIEW_STALE`. | Imprescindible frente a concurrencia. |
| **20** | Cierre con ventas pendientes | **Normativa / Integridad** | **Sí (Bloqueo total):** hoy **todas** las ventas quedan en `PENDING_PAYMENT`, bloqueando el 100 % de cierres Z. | La regla es correcta, pero requiere implementar confirmación de ventas (`CONFIRMED`). |
| **21** | Cierre con devoluciones pendientes | **Normativa / Integridad** | **No:** `TPV_PENDING_REFUNDS_PREVENT_CLOSE`. | Correcto y necesario. |
| **22** | Cierre con diferencias no justificadas | **Normativa / Integridad** | **No:** `TPV_COUNT_DIFFERENCE_REASON_REQUIRED` (≥3 caracteres). | Correcto para auditoría de descuadres. |
| **23** | Producto sin variante válida | **Integridad** | **No:** *toast* en UI y `TPV_PRODUCT_VARIANT_REQUIRED` en backend. | Correcto. |
| **24** | Servicio sin precio fijo | **Integridad** | **No:** `TPV_SERVICE_PRICE_NOT_FIXED`. | Correcto mientras no exista tarifa libre autorizada. |
| **25** | Línea sin clasificación fiscal | **Normativa (Fiscal)** | **No:** `TPV_LINE_TAX_CLASSIFICATION_UNSUPPORTED`. | Imprescindible para IVA correcto. |
| **26** | Cálculo fiscal incompleto | **Normativa (Fiscal)** | **No:** valida contra `@wix/ecom` (`taxCalculation`). | Imprescindible. |
| **27** | Moneda distinta de EUR | **Normativa / Integridad** | **No:** `TPV_CATALOG_CURRENCY_MISMATCH` / `TPV_TAX_CURRENCY_MISMATCH`. | Correcto. |
| **28** | Descuentos bloqueados | **Fricción temporal (V1)** | **No:** `TPV_DISCOUNT_NOT_CONFIGURED`. | Necesario hasta definir permisos y recálculo fiscal de descuentos; hoy bloquea `VEN-06`. |
| **29** | Reintento tras timeout (`TPV_TIMEOUT`) | **Integridad (Idempotencia)** | **Sí (Colateral):** si tras el timeout el usuario edita el carrito, `sessionStorage` conserva la `idempotencyKey` anterior y la nueva venta falla con `TPV_IDEMPOTENCY_CONFLICT`. | Falta limpiar `tpv_key_SALE` al modificar `state.items` o usar clave derivada del carrito. |
| **30** | Operación con clave inválida | **Seguridad / Integridad** | **No:** `TPV_INVALID_IDEMPOTENCY_KEY`. | Imprescindible. |
| **31** | Exportación truncada | **Integridad / Normativa** | **No:** aborta descarga CSV si `truncated === true`. | Correcto; evita libros incompletos. |
| **32** | Comunicación sin origen (`PARENT_ORIGIN_UNAVAILABLE`) | **Seguridad** | **Sí (Entornos):** si cambias de subdominio de Preview en Wix, falla cerrado sin poder operar. | Correcto por seguridad; mantener `PARENT_ORIGIN_ALLOWLIST` al día. |
| **33** | Mensajes de otra ventana (`event.source`) | **Seguridad** | **Sí (Silencioso):** `return;` silencioso en listener. | Correcto (anti-spoofing). |
| **34** | Respuestas de otro origen (`event.origin`) | **Seguridad** | **Sí (Silencioso):** `return;` silencioso en listener. | Correcto (anti-XSS/CSRF en iframe). |
| **35** | Protocolo incompatible (`MM_READY`/`MM_CONTEXT`) | **Integridad** | **No:** verifica `component === "htmlTPV"`, `protocolVersion === 1` y `HANDSHAKE_NONCE`. | Correcto. |
| **36** | Catálogo sin precio | **Integridad** | **No:** `TPV_CATALOG_PRICE_UNAVAILABLE`. | Correcto. |
| **37** | Error de catálogo por `traceId` | **Desalineado (Corregido)** | **No:** `traceId` ya está declarado en `tpvCatalogo.web.js`. | Ya resuelto en el código actual. |
| **38** | Auditoría sin trazabilidad | **Normativa / Bug** | **Sí (2 fallos):** 1) `exportarAuditoriaTPV` crashea (`requireCajero` no importado); 2) si falla `appendSaleAudit` en `registrarVenta`, devuelve `auditPersisted: false` dentro de `PENDING` y la UI no avisa. | La exigencia es correcta, pero su implementación actual tiene bug de runtime y fallo silencioso en UI. |
| **39** | Operación sin permiso | **Seguridad** | **No:** cada `webMethod` valida `requireTpvOperator` / `requireAdmin` en servidor. | Imprescindible. *(Fricción aparte: `obtenerPermisosTPV` tiene `issueTicketZ: false` y `exportAudit: false` para `ADMIN` aunque existen).* |
| **40** | Contexto Wix no autorizado (`onContextReady`) | **Seguridad** | **No:** bloquea el arranque si falla config o permisos. | Imprescindible. |

---

## Conclusión práctica

* **Mantén intactos** los bloqueos de **seguridad, idempotencia, origen/nonce, permisos en backend, integridad de sesión/caja y validación fiscal** (`#1, #14–#27, #29–#36, #38–#40`). No son fricción innecesaria: son lo que evita descuadres, cobros duplicados y fraudes.
* **Resuelve primero los 4 errores silenciosos / contradicciones reales:**
  1. Alinear `#saveSale` / `registrarVenta` / `tpvWriteV1Contract.js` (decidir si la venta sin pago se permite o si al pagar en efectivo/tarjeta se confirma a `CONFIRMED` para no bloquear el Cierre Z #20).
  2. Limpiar `tpv_key_SALE` en `sessionStorage` cuando cambie el contenido del ticket (evita el falso `TPV_IDEMPOTENCY_CONFLICT` tras #29).
  3. Corregir `requireCajero` en `exportarAuditoriaTPV` y mostrar alerta explícita si `auditPersisted === false` (#38).
  4. Habilitar `issueTicketZ` y `exportAudit` para `ADMIN` en `obtenerPermisosTPV` (#39).
* **Levanta progresivamente las fricciones temporales V1** (`#2, #7, #8, #9–#13, #28`) conforme conectes cada integración (Wix Payments/Manual, Wix Invoices, Descuentos e Inventario).

* 

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


## Diagnóstico de redundancias frente a funciones nativas de Wix

> Basado en el HTML TPV y el controlador compartidos. Para confirmar todo el backend sería necesario revisar también los módulos `tpvVentas`, `tpvCaja`, `tpvCatalogo`, `tpvPermisos` y `tpvCierres`.

### 1. Impuestos y preparación fiscal

| Lógica personalizada | Función nativa relacionada | Evaluación |
|---|---|---|
| `SALE_VALIDATE` calcula y valida impuestos antes de registrar la venta. | Configuración fiscal de Wix Stores, Bookings y checkout. | **Necesaria solo si el TPV presencial necesita una cotización previa.** |
| `tax`, `impuestosTotal`, `taxVerified`, `saleReadinessBlockers`. | Wix ya calcula impuestos en checkout y catálogo. | **Duplicación parcial.** Puede producir diferencias entre el TPV y el checkout nativo. |
| Validaciones como `TPV_TAX_ROUNDING_MISMATCH`, `TPV_TAX_REGION_EXCLUDES_TAX` y `TPV_TAX_CURRENCY_MISMATCH`. | Reglas fiscales y regionales configuradas en Wix. | **Necesarias como controles de seguridad**, pero no deberían sustituir la configuración fiscal nativa. |
| Clasificación fiscal manual por línea. | Categorías, precios y configuración fiscal del producto/servicio en Wix. | **Fuente de fricción.** Debe consumirse desde Wix, no mantenerse duplicada en código. |
| Bloqueo de múltiples tipos de IVA. | Wix puede gestionar impuestos según configuración. | **Posible restricción artificial** del contrato V1, no una limitación necesariamente nativa. |

**Recomendación:** Wix debe ser la fuente fiscal única. El TPV solo debería solicitar una cotización, mostrarla y conservar la referencia devuelta por Wix.

---

### 2. Catálogo de productos y servicios

| Lógica personalizada | Función nativa relacionada | Evaluación |
|---|---|---|
| `CATALOG_SERVICES`, `CATALOG_PRODUCTS`, `CATALOG_VARIANTS`. | Wix Bookings y Wix Stores Catalog V3. | **Necesaria como adaptador del TPV.** |
| `precioMinor`, `precioFijo`, `requiereSeleccionVariante`. | Precios y variantes nativas. | **Redundancia si se mantienen precios propios.** |
| Validación de disponibilidad de variantes. | Inventario y catálogo de Wix Stores. | **Necesaria como comprobación**, no como inventario alternativo. |
| `tipoLinea: PRODUCTO/SERVICIO`. | El origen nativo ya identifica producto o servicio. | **Necesaria para unificar el ticket**, pero no debe crear una clasificación independiente. |
| `TPV_PRODUCT_NOT_AVAILABLE_IN_POS`. | Visibilidad, disponibilidad e inventario de Wix. | **Correcta como regla específica del TPV**, si existe una política presencial real. |
| Cache o copia local del catálogo. | Catálogo nativo de Wix. | **Redundante y peligrosa** si no se invalida con cada cambio. |

**Recomendación:** mantener solo un adaptador de lectura. No duplicar nombre, precio, variante, stock ni clasificación fiscal.

---

### 3. Pagos y cobros

| Lógica personalizada | Función nativa relacionada | Evaluación |
|---|---|---|
| Métodos `EFECTIVO`, `TARJETA`, `BIZUM`, `BONO`, `TARJETA_REGALO`. | Wix Payments, Gift Cards y checkout. | **Duplicación parcial.** |
| `payments: []` y `medioPago` eliminado. | Estado real de Wix Payments. | **Correcto para modo consulta**, pero no es un cobro. |
| `paymentAmount`, `applied`, `pending`, `change`. | Checkout y flujo de pago nativo. | **Necesario solo para una futura simulación local.** |
| Bloqueo de Bizum, bonos y tarjetas regalo por código. | Configuración y saldo de Wix. | **Fuente de fricción** si Wix ya puede determinar su disponibilidad. |
| Restricción a un único medio de pago. | Contrato personalizado `V1`. | **Limitación propia**, no necesariamente nativa. |
| Cambio calculado en frontend. | TPV físico o proceso de caja. | **Necesario para efectivo**, pero debe confirmarse en backend. |

**Recomendación:** separar dos modos explícitos:

- **Venta pendiente:** sin pagos ni medios declarados.
- **Cobro real:** utilizar el flujo nativo de Wix Payments/checkout, no un registro paralelo.

---

### 4. Ventas pendientes y ledger fiscal

| Lógica personalizada | Función nativa relacionada | Evaluación |
|---|---|---|
| `SALE_REGISTER` registra una venta pendiente. | Pedidos, pagos, invoices o registros comerciales de Wix. | **Necesaria solo si se requiere un flujo presencial que Wix no cubre directamente.** |
| `commercialRecordReady`, `persisted`, `saleReadiness`. | Estados propios del sistema nativo. | **Posible duplicación de estados.** |
| `TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED`. | Wix Invoices, Orders o registros fiscales nativos. | **Bloqueo de seguridad**, pero crea un segundo sistema contable. |
| `lineas`, `pagos`, `medioPago` transformados por el controlador. | Modelos nativos de Wix. | **Necesario como traducción**, no como modelo persistente adicional. |

**Riesgo principal:** tener una venta en el ledger del TPV y otra en Wix, con estados distintos.

**Recomendación:** decidir una única fuente de verdad: pedido, factura o registro comercial nativo. El TPV no debería crear un ledger fiscal paralelo.

---

### 5. Permisos

| Lógica personalizada | Función nativa relacionada | Evaluación |
|---|---|---|
| `obtenerPermisosTPV()`. | Roles y permisos de colaboradores de Wix. | **Necesaria solo para capacidades específicas del TPV.** |
| `operationalWritesAvailable`. | Permisos nativos y autorización de Web Methods. | **Duplicación de control.** |
| `capabilities.createSale`, `issueTicketZ`, `readAudit`, etc. | Roles de Wix y permisos backend. | **Útil para la interfaz**, pero no debe ser la autorización final. |
| Bloqueos en `updateControlAvailability()`. | Permisos y visibilidad nativos. | **Fuente de fricción** si el usuario tiene permiso en Wix pero el mapa TPV no lo refleja. |
| Autorización repetida en cada módulo backend. | Sistema de roles de Wix. | **Necesaria como defensa**, aunque debe centralizarse. |

**Recomendación:** usar Wix como autoridad de identidad y roles. Mantener únicamente una capa de capacidades específicas del TPV, sin duplicar roles completos.

---

### 6. Colecciones CMS y permisos

| Lógica personalizada | Función nativa relacionada | Evaluación |
|---|---|---|
| Bloqueos de escritura por código. | Permisos de colección CMS y permisos de backend. | **Redundancia parcial.** |
| Estados como `operationalWritesAvailable`. | Permisos de lectura/escritura de Wix CMS. | **Puede duplicar o contradecir la configuración del dashboard.** |
| Protección manual de campos y operaciones. | Roles de colección, permisos del sitio y Web Methods. | **Necesaria para reglas de negocio**, no para sustituir permisos de colección. |
| Uso de colecciones como ledger, auditoría o caja. | Wix Data/CMS no es necesariamente un sistema contable transaccional. | **Riesgo arquitectónico.** |

**Recomendación:** separar:

- Permiso técnico: CMS/Wix.
- Regla de negocio: backend TPV.
- Auditoría: registro inmutable o sistema diseñado para ello.

No usar bloqueos de código para compensar permisos mal configurados en el dashboard.

---

### 7. Caja y sesiones

| Lógica personalizada | Función nativa relacionada | Evaluación |
|---|---|---|
| `CASHIER_STATE`, `SESSION_OPEN`, `TICKET_X`, `TICKET_Z`. | Wix no ofrece necesariamente una caja física completa equivalente. | **Principalmente necesaria.** |
| `CajaActual`, movimientos, arqueos y sesiones. | No parece existir un TPV nativo completo para este flujo presencial. | **Necesaria si se requiere caja física.** |
| Apertura condicionada por `nextSessionPreview`. | No es una función nativa equivalente. | **Control válido de integridad.** |
| Verificaciones repetidas en frontend y backend. | El backend debería ser la fuente de control. | **Redundancia de validación**, aunque el frontend puede mostrar estados. |
| Cierre Z bloqueado por ventas pendientes. | Regla operativa del negocio. | **Necesaria**, no redundante. |

**Recomendación:** conservar este módulo, pero concentrar la lógica de estado en backend y convertir el frontend en una vista.

---

### 8. Auditoría y trazabilidad

| Lógica personalizada | Función nativa relacionada | Evaluación |
|---|---|---|
| `AUDIT_LIST`, `AUDIT_EXPORT`, `traceId`. | Historiales y registros de Wix. | **Necesaria para operaciones TPV específicas.** |
| `controllerBuild`, `bridgeId`, `traceId`. | Herramientas de diagnóstico de Wix. | **Útil para soporte**, no debe mezclarse con auditoría comercial. |
| Exportación CSV propia. | Exportaciones nativas de Wix. | **Necesaria solo si Wix no ofrece el informe requerido.** |
| Auditoría de cada botón. | Logs técnicos de Wix. | **Duplicación si se almacenan ambos sin un propósito definido.** |

**Recomendación:** diferenciar claramente:

- Auditoría comercial.
- Auditoría de caja.
- Log técnico.
- Registro de errores.

---

### 9. Comunicación frontend–backend

| Lógica personalizada | Función nativa relacionada | Evaluación |
|---|---|---|
| `MM_READY` / `MM_CONTEXT`. | Comunicación estándar del componente HTML de Wix. | **Necesaria para integrar el TPV personalizado.** |
| `postMessage`, `messageId`, `requestId`, `responseType`. | Wix ya proporciona el puente de componente. | **Necesario como contrato propio**, pero debe ser mínimo. |
| Validación manual de `PARENT_ORIGIN`. | Frontera de confianza del componente Wix. | **Necesaria como defensa**, pero puede duplicar controles del bridge. |
| Handshake con reintentos durante 60 segundos. | Bridge de Wix y ciclo de vida del componente. | **Posible complejidad excesiva.** |
| Nonce adicional aún no implementado. | Seguridad del bridge. | **Mejora recomendable**, no función comercial. |

---

### 10. Mensajería y errores

| Lógica personalizada | Función nativa relacionada | Evaluación |
|---|---|---|
| `ERROR_CATALOG`. | Errores de Web Methods y Wix. | **Necesario para traducir errores técnicos al usuario.** |
| `publicErrorMessage()`. | Mensajes nativos de Wix. | **Correcto como capa de presentación.** |
| Códigos propios para cada validación. | Validaciones nativas del catálogo, pagos y caja. | **Duplicación parcial**, pero útil para reglas TPV. |
| `recoverable`, `retryable`, `requiresReconciliation`. | Estados de operación de Wix. | **Necesario para operaciones críticas**, si se aplica coherentemente. |

---

## Principales fuentes de fricción detectadas

1. **Fiscalidad duplicada:** configuración en Wix más reglas fiscales en backend y frontend.
2. **Permisos duplicados:** permisos de dashboard/CMS más `capabilities` y bloqueos locales.
3. **Pagos duplicados:** métodos nativos de Wix más pagos simulados del TPV.
4. **Estados duplicados:** estados nativos más `saleReady`, `commercialRecordReady`, `persisted` y `operationalWritesAvailable`.
5. **Catálogo duplicado:** datos nativos más precios, variantes y clasificación transformados por código.
6. **Auditoría duplicada:** logs de Wix, auditoría TPV, `traceId` y exportaciones propias.
7. **Bloqueos excesivos en frontend:** el usuario puede tener autorización nativa, pero la interfaz continuar mostrando “modo consulta”.
8. **Contrato V1 demasiado restrictivo:** un solo medio de pago, sin devoluciones y sin pagos en ventas pendientes.
9. **Inconsistencia de nombres:** `payments/pagos`, `amount/importe`, `method/medioPago`, `lineItems/lineas`.
10. **Dos posibles fuentes contables:** Wix y el ledger propio del TPV.

## Procesos que deberían conservarse

- Adaptación del catálogo nativo al ticket TPV.
- Gestión de caja física, sesiones, arqueos y cierre Z.
- Control X.
- Idempotencia y conciliación.
- Auditoría específica de operaciones TPV.
- Adaptación del puente HTML–Wix.
- Reglas de negocio que Wix no cubre, como impedir cerrar con ventas pendientes.

## Procesos que deberían eliminarse o simplificarse

- Precios y clasificación fiscal duplicados.
- Roles completos duplicados en `obtenerPermisosTPV()`.
- Ledger fiscal paralelo.
- Declaración de `medioPago` en ventas pendientes.
- Devoluciones sintéticas.
- Bloqueos de medios de pago que Wix ya pueda resolver.
- Estados duplicados sin una definición única.
- Exportaciones que repitan informes nativos sin aportar datos adicionales.

He auditado los **33 módulos adicionales de `/src/backend`** (núcleo fiscal, reservas, eventos Wix, seguridad, acceso a datos y *crons*).

### Valoración general de `/src/backend`
La capa de infraestructura del backend está **muy trabajada** en seguridad y control de concurrencia:
* **Acceso a datos y políticas (`dataAccess.js`, `dataAccessPolicy.js`, `data.js`):** cero `suppressAuth`, capa única `@wix/data` con *hooks* y políticas *append-only* estrictas.
* **Concurrencia (`fiscalLedgerLock.js`, `webhookEventClaims.js`):** *locks* distribuidos mediante `bulkPatchItems` con *compare-and-swap* (`version`/`expiresAt`) y *fencing*.
* **Observabilidad y secretos (`logger.js`, `secretAccess.js`, `security.js`):** sanitización recursiva de PII/secretos, *rate limiter* GCRA persistente y verificación de identidad por `memberId` + `contactId` en Bookings Staff API.

Sin embargo, la auditoría cruzada revela **6 bugs críticos/altos**, destacando una **colisión estructural grave entre `backend/tpv/*` y el núcleo fiscal (`cajas.web.js` / `eventLog.js`)**.

---

## 1. Bugs Críticos y Altos en `/src/backend`

### B-BK-01 (Crítico) — Colisión de cadenas y esquemas entre `backend/tpv/*` y el núcleo fiscal
* **Archivos:** `backend/tpv/tpvRepository.js` vs `backend/cajas.web.js`, `backend/eventLog.js`, `backend/fiscalAggregator.web.js`, `backend/fiscalLedgerLock.js`.
* **Causa:** Ambos subsistemas escriben sobre las **mismas colecciones físicas (`MovimientosCaja` y `CajaActual`)** con contratos incompatibles:
  1. **Dos cadenas paralelas en `MovimientosCaja`:** `tpvRepository.js` inserta registros con `recordSource: "TPV_LEDGER"`, iniciando su propio `sequenceNumber` desde `1` y con un formato de `hash` propio (sin `tipoImpositivo` ni `_buildInternalFiscalChainPayload`). Sin embargo, `cajas.web.js` (`_getLastMovement`, `verifyFiscalHashChainIntegrity`), `eventLog.js` (`_getLastCashEvent`) y `fiscalAggregator.web.js` (`_fetchQuarterMovements`) consultan `MovimientosCaja` con `.gt("sequenceNumber", 0)` **sin filtrar `recordSource !== "TPV_LEDGER"`**.
  2. **Sobrescritura de `CajaActual` (`CAJA_PRINCIPAL`):** `_sessionCajaPatch` en `tpvRepository.js` reinicia `sequenceCounters: {}` y exige `snapshotSource: "TPV_LEDGER"` + `conceptOperations.tpvRuntime`, mientras `cajas.web.js` (`_updateCajaActual`) espera `sequenceCounters.appliedMovementIds` y `netAmount`, y `fiscalLedgerLock.js` guarda `seqGlobal` / `[yearKey]` en `sequenceCounters`.
* **Impacto en producción:** En cuanto coexistan un movimiento TPV y una venta/reserva online:
  * `verifyFiscalHashChainIntegrity()` y el cron diario `systemHealthCheck` fallan con `FISCAL_CHAIN_CORRUPTED` o `MOVEMENT_NUMERIC_FIELD_INVALID:tipoImpositivo`.
  * `fiscalAggregator.web.js` (resúmenes 303/130 y libro de facturas) crashea al leer registros TPV sin `tipoImpositivo`.
  * Se mezclan las secuencias (`sequenceNumber` y `previousRecordHash`) entre eventos TPV y ventas online.

### B-BK-02 (Crítico) — `registerZClosing` y `verifyNightlyZClosing` siempre fallan
* **Archivos:** `backend/cajas.web.js` (`_registerZClosing`, líneas 1818 y 1996) y `backend/crons.js` (`verifyNightlyZClosing`).
* **Causa:**
  * En `_registerZClosing`: `const recordDomain = authorizeCashier ? "" : _safeTrim(options?.recordDomain);` y más abajo `if (!hasValidClosedBy || !recordDomain) return { error: { code: "Z_CLOSING_REQUIRED_FIELDS_UNRESOLVED" } };`. Como `registerZClosing` (público para cajero/admin) pasa `authorizeCashier = true`, **`recordDomain` siempre es `""`** y el cierre Z público es **imposible de ejecutar**.
  * A su vez, el cron `verifyNightlyZClosing` llama a `registerZClosingInternal(ymd, { traceId })` sin pasar `closedBy` ni `recordDomain`, por lo que el cierre automático nocturno **también falla cada noche** con `Z_CLOSING_REQUIRED_FIELDS_UNRESOLVED` y dispara la alerta `NIGHTLY_Z_CLOSING_MANUAL_REQUIRED`.

### B-BK-03 (Alto) — `citasManager.web.js` rompe la idempotencia y recuperación parcial de pagos
* **Archivo:** `backend/citasManager.web.js` (`_validatePaymentCitaSet` L847 y `_validatePaymentIdempotency` L890).
* **Causa:** Ambos validadores leen `const existingOrderId = _safeTrim(meta.orderId || "");` ignorando `cita[FIELD_ORDER_ID]` (el campo raíz `orderId`). Sin embargo, `_setCitasPaymentState` y `events.js` (`_markCitasPaidByBookingIds`) **eliminan `meta.orderId`** (`delete meta[key]`) y guardan `orderId` exclusivamente en la raíz `cita.orderId`.
* **Impacto:** En un par dual con escritura parcial (`PAID` en F1, pendiente en F2) o en un reintento de `confirmPayment` con el **mismo `orderId`**, `existingOrderId` se evalúa como `""` y rechaza la recuperación con `"Booking has already been paid with another order."`.

### B-BK-04 (Alto) — `events.js` desincroniza `eventType` al marcar reembolsos como procesados
* **Archivo:** `backend/events.js` (`_handleWixEcom_onOrderPaymentStatusUpdated` L1871 y `_handleWixEcom_onOrderUpdated` L2573).
* **Causa:**
  * `_handleWixEcom_onOrderPaymentStatusUpdated` consulta `isEventProcessed(eventId, "ORDER_PAYMENT_STATUS_UPDATED")`, pero si el pedido es un reembolso guarda `markEventAsProcessed(eventId, "ORDER_REFUND_STATUS_UPDATED")` (omitiendo además `traceId` y `metadata`).
  * `_handleWixEcom_onOrderUpdated` consulta `isEventProcessed(eventId, "ORDER_UPDATED")`, pero guarda `markEventAsProcessed(eventId, "ORDER_REFUND_ORDER_UPDATED")`.
* **Impacto:** Como `getWebhookEventClaimId` calcula el SHA-256 de `[eventType, eventId]`, `isEventProcessed` siempre devuelve `false` en reintentos de eventos de reembolso (quedando únicamente protegido por `WEBHOOK_CLAIM` mientras el claim siga activo).

### B-BK-05 (Alto) — 3 crons de `crons.js` quedan ciegos tras 50 registros históricos
* **Archivo:** `backend/crons.js` (`reconcileUnknownTransactions` L1020, `reconcileInconsistentDualPairs` L1284 y `retryCompletionRequired` L1697).
* **Causa:** Los tres consultan `ControlOperativo` con `.eq("controlType", ...).limit(50)` **sin paginar ni ordenar ni filtrar por estado**, y luego filtran en memoria (`status === "RESULT_UNKNOWN"`, `REPAIR_REQUIRED`, `COMPLETION_RETRY_REQUIRED`). Como `cleanExpiredBookingControl` ya no elimina los registros `COMPLETED` (los retiene todos), en cuanto existan 50 registros `IDEMPOTENCY` o `SYSTEM_FLAG` antiguos, **las nuevas incidencias nunca entran en la ventana de los 50 primeros** y quedan sin reconciliar para siempre.

### B-BK-06 (Medio) — Bug de regex doblemente escapada en `fiscalHashPayload.js`
* **Archivo:** `backend/fiscalHashPayload.js` (línea 55).
* **Causa:** `const match = /GMT([+-])(\\d{2}):?(\\d{2})/.exec(madridStr);` usa `\\d` dentro de un literal `/.../`, por lo que busca una barra invertida literal seguida de `d` y **nunca hace match** (siempre cae al cálculo manual por diferencia horaria). *(En `cajas.web.js` y `eventLog.js` sí está escrito correctamente como `\d{2}`).*

---

## 2. Observaciones de Arquitectura y Mejoras Recomendadas

1. **Separar físicamente o unificar el contrato `TPV_LEDGER` vs `MovimientosCaja` fiscal:**
   * **Opción recomendada (limpia):** Que el TPV físico (`backend/tpv/*`) use su propia colección operativa para movimientos de caja/arqueos/tickets X/Z (o que `cajas.web.js`, `eventLog.js` y `fiscalAggregator.web.js` excluyan explícitamente `ne("recordSource", "TPV_LEDGER")` en todas sus consultas de cadena secuencial y agregación fiscal, y que el TPV no comparta el singleton `CAJA_PRINCIPAL` de `cajas.web.js`).
   * Mientras compartan `MovimientosCaja` y `CajaActual`, ambos flujos se rompen mutuamente.
2. **Corregir `_registerZClosing` (`cajas.web.js`) y `verifyNightlyZClosing` (`crons.js`):**
   * Definir `recordDomain` en `internalConfig.js` (en lugar de esperar que venga en `options` mientras se prohíbe al cajero enviarlo) y dotar al cron nocturno de una identidad de sistema válida si se quiere permitir el cierre automático, o restringir el cron a verificación + alerta.
3. **Corregir `citasManager.web.js`:**
   * Usar `cita?.[FIELD_ORDER_ID] || meta.orderId || ""` de forma consistente en `_validatePaymentCitaSet` y `_validatePaymentIdempotency`.
4. **Corregir los 3 crons de `crons.js`:**
   * Paginar con `.skip()` / bucle o guardar un campo indexado de estado pendiente para que `reconcileUnknownTransactions`, `reconcileInconsistentDualPairs` y `retryCompletionRequired` no queden bloqueados por registros `COMPLETED` antiguos.
5. **Veri\*Factu (`aeatHash.js`):**
   * Confirmado en código: `aeatHash.js` (contrato oficial AEAT v0.1.2) está correctamente aislado y **no cableado** a `eventLog.js` ni a `cajas.web.js`, por lo que debe mantenerse la política actual de **no dar Veri\*Factu por operativo** hasta su integración y homologación completa.
  
He auditado los **8 módulos adicionales** que completan la lógica personalizada (**páginas** `servicio-2.js`, `calendario-2.js`, `zonamarian.js` y **motor de reservas** `bookingCore.js`, `bookingSaga.js`, `bookingUtils.js`, `dualRescheduleJournal.js`, `dualRescheduleReconciliation.js`).

### Valoración general
El motor transaccional de reservas (`bookingSaga.js`, `bookingCore.js`, `bookingUtils.js` y la pareja de reprogramación dual `dualRescheduleJournal.js` / `dualRescheduleReconciliation.js`) tiene un nivel técnico **muy alto**:
* Validación estricta del contrato SDK V2 (`_id`, fechas ISO UTC/Madrid, *gap* exacto, `doubleBooked`, verificación de `resource._id` asignado).
* Cart V2 aislado al miembro autenticado (`memberId` + `contactId` + `openAccess !== true`) con limpieza automática (`deleteCartV2`) ante fallo.
* Máquina de estados de reprogramación dual determinista y reconciliación *read-only* limpia.

Los problemas principales se concentran en **`zonamarian.js`** (conectado a endpoints rotos o retirados del backend) y en detalles de flujo en **`calendario-2.js`** y **`bookingSaga.js`**.

---

## 1. Bugs y Desalineaciones Detectadas

### B-PG-01 (Crítico) — `pages/zonamarian.js` llama a endpoints de backend rotos o retirados
* **Archivo:** `pages/zonamarian.js` (`ACTIONS` y `onContextReady`).
* **Causa doble:**
  1. **`Z_CLOSING` siempre falla:** invoca `registerZClosing(payload?.diaKey || null, { traceId })` en `backend/cajas.web.js`, el cual (como detectamos en `B-BK-02`) fuerza `recordDomain = ""` cuando `authorizeCashier === true` y devuelve siempre `Z_CLOSING_REQUIRED_FIELDS_UNRESOLVED`.
  2. **`CREATE_SNAPSHOT`, `DOCUMENT_PREPARED`, `DOCUMENT_DOWNLOAD` siempre fallan:** `onContextReady` envía `enableDocuments: true`, pero esas tres acciones llaman a `createManagerPackageVersion`, `getPreparedManagerPackages` y `downloadManagerPackageVersion` en `backend/fiscalDocuments.web.js`, las cuales fueron desactivadas y devuelven **siempre `ERROR: PACKAGE_STORAGE_REMOVED`**. En cambio, `previewManagerPackage` (única operativa) no está conectada en `ACTIONS`.
* **Impacto:** Desde `zonamarian.js` no se puede ejecutar el Cierre Z ni consultar/descargar paquetes de gestoría.

### B-PG-02 (Medio) — `pages/calendario-2.js`: `activeBookingMessageId` bloquea reintentos legítimos tras cancelar login
* **Archivo:** `pages/calendario-2.js` (`handleBooking`).
* **Causa:** `activeBookingMessageId = messageId` se asigna **antes** de `ensureBookingMemberSession()`. Si el usuario cierra el diálogo de login (`AUTH_REQUIRED`) y el widget reintenta la reserva sin regenerar `messageId`, `messageId === activeBookingMessageId` lo bloquea como `DUPLICATE_REQUEST`.
* **Mejora:** Limpiar `activeBookingMessageId = ""` cuando falle por `AUTH_REQUIRED` (antes de llamar a `processDualBooking`).

### B-PG-03 (Bajo/Medio) — `pages/zonamarian.js`: fallback inseguro de selector `$w(...)`
* **Archivo:** `pages/zonamarian.js` (`const widget = $w("#htmlAdministracion") || $w("#htmlAdmin");`).
* **Causa:** En Wix Velo, `$w("#idInexistente")` puede devolver un objeto/wrapper no nulo sin `postMessage` en lugar de `null`. Conviene comprobar `typeof $w("#htmlAdministracion")?.postMessage === "function"` antes de pasar al fallback `#htmlAdmin`.

### B-BK-07 (Bajo — Optimización de cuota CMS) — Doble liberación de *locks* en `bookingSaga.js`
* **Archivos:** `backend/booking/bookingSaga.js` (paso `LockSlots` + bloque `finally`).
* **Causa:** Cuando falla `Step 2` (`CreateBookings`), `saga.execute()` ejecuta la compensación de `LockSlots` (que llama a `_bestEffortUnlockAll`), y al salir del `try`, el bloque `finally` de `executeBookingSaga` **vuelve a ejecutar `_bestEffortUnlockAll`** sobre los mismos `lockKeys`.
* **Impacto:** Aunque es idempotente (`alreadyReleased: true`), duplica lecturas `getItem` sobre `ControlOperativo` en cada fallo, consumiendo cuota de Wix Data (donde el sistema ya contempla el error `WDE0014`). Basta vaciar `lockKeys = []` tras liberar en la compensación de `LockSlots`.

### B-BK-08 (Documentación / Mantenimiento) — Comentario obsoleto contradictorio en `bookingCore.js`
* **Archivo:** `backend/booking/bookingCore.js` (`_resolveWriteLocation`).
* **Causa:** El comentario indica `BookedSlot.Location usa id, no _id`, mientras el código devuelve correctamente `{ _id: incoming, locationType: "OWNER_BUSINESS" }` (acorde a `V5022` y `_assertPristineSlotContract`). Conviene actualizar el comentario para evitar regresiones futuras.

---

## 2. Mejoras Recomendadas para Completar la Integración

1. **Reparar `pages/zonamarian.js` + `cajas.web.js` + `fiscalDocuments.web.js`:**
   * En `fiscalDocuments.web.js` / `zonamarian.js`: reemplazar las acciones retiradas (`CREATE_SNAPSHOT`, `DOCUMENT_PREPARED`, `DOCUMENT_DOWNLOAD`) por `previewManagerPackage` (y `listAccountantRecipients` si aplica) o poner `enableDocuments: false` mientras no haya almacenamiento aprobado.
   * Resolver `recordDomain` en `cajas.web.js` para que `Z_CLOSING` desde `zonamarian.js` pueda ejecutarse.
2. **Alinear la UX de autenticación en `pages/servicio-2.js` (`handlePricingPlanPurchase`):**
   * `calendario-2.js` verifica/solicita sesión de miembro con `ensureBookingMemberSession()` antes de llamar a `processDualBooking`, mientras `servicio-2.js` llama directo a `checkout.startOnlinePurchase(service.pricingPlanId)`. Conviene asegurar sesión de miembro o manejar explícitamente el error de autenticación si el visitante no está logueado.
3. **Ajustar ventana de timeout/reintentos en `pages/calendario-2.js`:**
   * `AVAILABILITY_ATTEMPT_TIMEOUT_MS` es de `45000 ms` con 2 reintentos (hasta `210000 ms`), mientras los WebMethods de Wix tienen un límite rígido de ejecución (~59 s) y `reservas.web.js` usa `15000 ms`. Reducir el timeout por intento en frontend a ~`20000 ms` evita esperas largas al usuario si Wix corta el WebMethod.
4. **Módulos sin incidencias detectadas:**
   * `bookingUtils.js`, `dualRescheduleJournal.js` y `dualRescheduleReconciliation.js` son consistentes, puros y no presentan bugs funcionales.
  
   *  
