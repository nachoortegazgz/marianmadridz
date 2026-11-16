# Auditoría de flujos y documentos contables/fiscales — 2026-11-14

**Sitio QA:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Base inspeccionada:** `main` en `7578f4832f3405dad4655f9ac978d0bc715b9033`  
**Tipo de auditoría:** lectura Wix CMS/Automations + inspección estática de código. Sin escrituras CMS, sin operaciones fiscales, sin pagos ni comunicaciones.

## 1. Resultado ejecutivo

1. No se acredita que todas las automatizaciones de apps estén desactivadas: Query Automations V2 devolvió 150; 143 `INACTIVE` y 7 `ACTIVE`. Las 7 activas son `PREINSTALLED` y todas tienen `disableStatusChange=true`; dos además tienen `readonly=true`.
2. Los escritores de caja/fiscalidad y contabilidad continúan fail-closed: `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false`, `ALLOW_SIMULATION_RECORDS=false`.
3. `DatosFiscales` no existe en el CMS live (GET colección y query de items: `WDE0025`). El código la declara como colección canónica y la necesita para resolver emisor/terceros. No hay base de datos fiscal operativa ni `CONFIG_SISTEMA` en este sitio.
4. Las colecciones de destino existen, pero no contienen documentos: `MovimientosCaja=0`, `LibroAsientosContablesDetalle=0`, `HistoricoCierresZ=0`, `PaquetesGestoria=0`.
5. Hay una discrepancia P1 en el cierre Z: sus dos escritores no completan los campos obligatorios CMS y comparten el mismo ID determinista con payloads distintos.
6. No se añadieron campos ni se modificaron flujos. La brecha Z necesita resolver el valor contractual de `recordDomain` y la propiedad del cierre antes de corregir y probar. La ausencia de `DatosFiscales` requiere esquema aprobado y datos legales verificados; no se crea un maestro fiscal vacío ni se inventan datos.

## 2. Entorno y automatizaciones

Lectura actual de Wix Automations V2, paginación completa:

| Estado | Cantidad |
|---|---:|
| Total | 150 |
| INACTIVE | 143 |
| ACTIVE | 7 |

Automatizaciones activas observadas:

| Automatización | Trigger | Acción | Locks |
|---|---|---|---|
| Notify customer when you save their card details | `wix_cashier-customers_card_saved` | email | `disableStatusChange` |
| Send an email to proceed with a task | `agent_maker-custom_agent_notification` | email | `disableStatusChange` |
| Aria Assistant send wix notification | `aria_assistant-aria_assistant_need_to_send_a_notification` | notificación | `readonly` + `disableStatusChange` |
| Send email confirmation to site members | `wix_sitemembers_app-member_email_confirmation_required` | email | `disableStatusChange` |
| Send subscription confirmation email | `wix_form_platform-subscription_confirmation_request` | email | `disableStatusChange` |
| cms items limit warning email | `wix_cms-cms_items_limit_approaching` | email | `readonly` + `disableStatusChange` |
| Send site members a reset password email | `wix_sitemembers_app-member_reset_password` | email | `disableStatusChange` |

Todas son `PREINSTALLED`. Wix Automation Activation Status ordena detenerse si `settings.readonly` o `settings.disableStatusChange` es true. No se intentó sortear los locks. Aunque estos triggers no son escritores contables propios, mantienen posibles efectos externos de email/notificación y el sitio no puede declararse globalmente aislado.

## 3. Inventario CMS live relevante

| Colección | Revisión | Campos | Documentos leídos | Uso |
|---|---:|---:|---:|---|
| `MovimientosCaja` | 80 | 88 | 0 | Ledger fiscal de movimientos/facturas |
| `LibroAsientosContablesDetalle` | 29 | 27 | 0 | Ledger de líneas de asiento PGC |
| `HistoricoCierresZ` | 39 | 62 | 0 | Evidencia append-only de cierre Z |
| `PaquetesGestoria` | 5 | 17 | 0 | Snapshots trimestrales para gestoría |
| `CajaActual` | 14 | 81 | 1 | Singleton mutable/proyección de caja |
| `DatosFiscales` | — | — | — | **No existe**: `WDE0025` |

El singleton `CajaActual` leído está en `ABIERTA`, con apertura y efectivo esperado/contado de 300 EUR, diferencia 0 y `traceId` vacío. Es una proyección mutable, no un justificante fiscal ni un ledger; no se ha modificado.

## 4. Flujos y documentos generados

### 4.1 Venta/cobro manual o TPV

**Ruta:** `cajas.web.js::registerManualTransaction` → `MovimientosCaja` → proyección `CajaActual` → claim/idempotencia en `ControlOperativo`.

**Documento:** registro fiscal de movimiento/venta, con número de serie, fechas, naturaleza del movimiento, canal y medio de pago, importe, desglose fiscal, identidad de emisor/destinatario, referencias de pedido/reserva/reembolso, secuencia, hash, firma y QR cuando el firmador responde.

Campos CMS requeridos de `MovimientosCaja` que el builder construye estáticamente: `hash`, `amount`, `numSerieFactura`, `sequenceNumber`, `transactionId`, `previousRecordHash`, `recordTimestamp`, `schemaVersion`, `traceId`, `movementType`, `totalAmount`, `paymentMethod`, `channelType`, `operationDescription`, `staffResourceId`, `tipoFactura`, `fechaExpedicionFactura`, `tipoImpositivo`, `fiscalPeriod`.

El writer está bloqueado antes de cualquier escritura por `LEDGER_WRITES_ENABLED=false`. No existe documento live con el que verificar read-after-write.

### 4.2 Pago de pedido Wix eCommerce / reservas pagadas

**Ruta:** `events.js::wixEcom_onOrderPaymentStatusUpdated` → resolución de importe e impuestos de líneas → payload fiscal → `eventLog.js::registrarEventoEconomico` → `MovimientosCaja` → `CajaActual` y proyecciones secundarias.

El payload incluye tipo de evento/movimiento, método/canal, orderId/transactionId, total, base, cuota, tipo impositivo, descripción, fechas, datos fiscales del emisor y líneas/desglose; las reservas vinculadas se conservan mediante `linkedBookingIds`. Si falla el ledger, existen rutas de recuperación en `ControlOperativo`/crons; no equivalen a un documento fiscal persistido.

**Estado:** bloqueado por `LEDGER_WRITES_ENABLED=false`; cero movimientos live. La proyección `CitasF2` no sustituye el registro fiscal.

### 4.3 Reembolso eCommerce

**Ruta:** `events.js::wixEcom_onOrderUpdated` → `processOrderRefundTransactions` → consulta del movimiento original y de reembolsos acumulados → `registrarEventoEconomico` → nuevo registro rectificativo en `MovimientosCaja`.

El documento debe conservar `orderId`, `refundId`, `transactionId=REFUND-<orderId>-<refundId>`, importe negativo, referencia al movimiento/factura original, tipo de factura rectificativa, motivo, impuestos con signo y hash encadenado. No se actualiza ni elimina el movimiento original.

**Estado:** bloqueado por el mismo gate fiscal; cero movimientos live.

### 4.4 Pago de reserva / anticipo y cancelación rectificativa

**Pago:** `citasManager.web.js` llama a `registerBookingPayment`, que delega en `registerManualTransaction`; el documento destino es `MovimientosCaja`, con `bookingId/linkedBookingIds`, `orderId`, `transactionId`, tratamiento de anticipo y referencias de aplicación.

**Cancelación:** el webhook de Bookings construye una rectificativa y llama a `registrarEventoEconomico`; el destino vuelve a ser `MovimientosCaja`, como nuevo registro, nunca una modificación del original.

**Estado:** bloqueados por `LEDGER_WRITES_ENABLED=false`. La política de anticipos permanece P0: no activar depósitos hasta cerrar factura, IVA, aplicación del saldo y rectificación.

### 4.5 Cierre Z manual y cron

**Ruta manual:** `cajas.web.js::registerZClosing` → `_registerZClosing` → `HistoricoCierresZ` → actualización de `CajaActual`.

**Ruta de proyección secundaria:** `eventLog.js::_proyectarSegunTipoEvento` → `_proyectarCierreZ` → `HistoricoCierresZ`.

**Documento:** cierre diario con periodo, fecha, totales por medio de pago, ventas brutas, reembolsos, propinas/ajustes, base/cuota netas, número de operaciones, primera/última factura y secuencia, hashes inicial/final, integridad, firma/estado de firma, responsable, origen y trazabilidad.

**Defecto P1 verificado contra esquema live:**

Campos obligatorios de `HistoricoCierresZ`: `closeDate`, `fiscalPeriod`, `totalTaxAmount`, `totalTaxBase`, `totalOnline`, `totalBizum`, `totalCard`, `totalCash`, `closedBy`, `recordDomain`, `operationDate`, `traceId`.

- `_registerZClosing` no envía `closeDate`, `fiscalPeriod`, `totalTaxAmount`, `totalTaxBase`, `closedBy` ni `recordDomain`. Envía `netTaxAmount` y `netTaxableAmount`, que son otros campos físicos y no sustituyen los obligatorios.
- `_proyectarCierreZ` solo envía `closeDate`, `operationDate`, `traceId` y parte de los snapshots; omite los demás obligatorios.
- Ambos usan `_id=Z_<fecha>`, pero generan payloads diferentes. Existe riesgo de colisión e idempotencia ambigua.
- `_registerZClosing` fija `closingSource="CRON"` incluso cuando la entrada es manual. `_proyectarCierreZ` usa `MOVIMIENTOS_CAJA_EVENT`, mientras el diccionario CMS documenta `MANUAL/CRON`.

No se corrige aún: `recordDomain` es obligatorio pero no tiene enum ni valor de negocio documentado; además, hay que decidir un único writer/propietario del ID Z y el contrato de `closedBy` para cierres automáticos. Añadir más campos no resuelve estos defectos: los campos necesarios ya existen.

### 4.6 Asiento contable PGC

**Writer:** `accountingLedger.js::appendAccountingEntry` → inserta una fila por línea en `LibroAsientosContablesDetalle`.

Cada línea contiene `entryId`, `recordTimestamp`, `concept`, `lineNumber`, `origenTipo`, `origenRegistro`, `sourceMovementId`, `cashMovementId` si aplica, `entryDate`, `fiscalPeriod`, `accountCode`, `debitAmount`, `creditAmount`, `previousRecordHash`, `recordHash` y `traceId`. El writer valida cuentas de seis dígitos, líneas consecutivas, solo debe o haber por línea, suma de debe=haber, hash-chain e idempotencia. Los campos opcionales `bookingId`, `orderId`, `resourceId`, `payloadFiscal`, `idSistemaInformatico`, `desgloseDetallado` y `accountingAmount` se aportan solo cuando el origen los tiene.

**Estado:** el esquema live contiene todos los campos obligatorios y el writer los asigna. No se encontró ningún consumidor productivo de `appendAccountingEntry`; las únicas referencias de llamada localizadas son la propia definición y sus tests. El mapeo evento→cuentas está deshabilitado hasta aprobar PGC/reglas. Además, `ACCOUNTING_LEDGER_WRITES_ENABLED=false`; cero asientos live. No hay automatización contable de facturas recibidas/proveedores acreditada.

### 4.7 Resumen fiscal y paquete para gestoría

**Lecturas:** `fiscalAggregator.web.js::getQuarterlyTaxSummaryInternal` genera un borrador de resumen trimestral; `getLibroRegistroFacturasExpedidasInternal` genera filas del libro a partir de `MovimientosCaja`. No son documentos fiscales oficiales ni presentan un Modelo 303/130 oficial.

**Documento persistido:** `fiscalDocuments.web.js::createManagerPackageVersion` construye un snapshot trimestral en `PaquetesGestoria` con:
- Cabecera: `periodType`, `fiscalYear`, `fiscalQuarter`, `packageVersion`, `packageStatus=PREPARED`, `snapshotHash`, `schemaVersion`, `source=FISCAL_AGGREGATOR`, `traceId`, `createdAt`.
- `summaryData`: ejercicio, trimestre, meses, NIF emisor, operaciones totales/fiscales, conteo de ventas/reembolsos/propinas/ajustes, borradores de IVA e ingresos, totales, desglose por forma de pago, desglose mensual, desglose por tipo de IVA y paginación.
- `invoiceData[]`: orden, número de factura, fecha, tipo/naturaleza, tratamiento fiscal, referencia rectificativa, forma de pago, base, tipo/cuota, total, concepto, origen, orderId, refundId, timestamp, hash corto/completo, reservas vinculadas y transactionId.

El esquema `PaquetesGestoria` ya contiene todos los campos requeridos por el writer. El snapshot usa insert-only, versionado create-only y SHA-256; no actualiza snapshots anteriores. La mensualidad aún no está implementada.

**Bloqueo:** `DatosFiscales` no existe en el CMS live. El agregador requiere el NIF de emisor de `recordType=CONFIG_SISTEMA` (con fallback histórico de lectura a TERCERO/EMISOR); el maestro ausente impide verificar identidad fiscal y puede impedir generar el paquete. No hay paquetes persistidos. El envío a gestoría está desactivado y no se considera parte de la generación del snapshot.

## 5. Reconciliación de campos y documentos

| Documento / destino | Resultado de cotejo estático | Resultado live |
|---|---|---|
| Movimiento/factura interna `MovimientosCaja` | Los 19 campos CMS obligatorios se construyen en `eventLog`/writer TPV. No hay prueba de persistencia runtime. | 0 documentos |
| Desglose fiscal `desgloseDetallado` | CMS declara `OBJECT`, pero el builder y los tests lo tratan como array. El hook normaliza `lineItems` a `{items:[]}`, pero no aplica la misma normalización a `desgloseDetallado`. Debe alinearse tipo/forma antes de runtime. | 0 documentos |
| `payloadAEAT` | No se escribe como campo independiente. El writer TPV pasa `aeatPayload` y el hook lo integra en `payloadFiscal.aeatPayload`; tests contractuales preservan esa forma. No duplicar ni renombrar sin ADR. | 0 documentos |
| Asiento `LibroAsientosContablesDetalle` | Writer asigna todos los campos requeridos; no tiene caller productivo ni reglas PGC aprobadas. | 0 líneas |
| Cierre `HistoricoCierresZ` | Dos writers omiten campos obligatorios y comparten ID con payload distinto. | 0 cierres |
| Snapshot `PaquetesGestoria` | Writer asigna todos los campos requeridos y valida hash/tamaño; depende de datos fiscales de origen. | 0 snapshots |
| Maestro fiscal `DatosFiscales` | Código lo requiere; colección no existe en el sitio actual. | `WDE0025` |

## 6. Decisiones de esquema

No se añadieron campos:
- Los campos requeridos de `MovimientosCaja`, `LibroAsientosContablesDetalle`, `HistoricoCierresZ` y `PaquetesGestoria` ya existen.
- El defecto Z es de mapeo/contrato, no de ausencia de columnas.
- `DatosFiscales` no es una colección existente a la que añadir campos. Su creación requiere reconciliar el contrato aprobado y aportar identidad legal/fiscal verificable; no se crea con placeholders ni se inventan NIF, régimen o configuración Veri*Factu.
- No se altera ningún ledger append-only ni se migra ningún dato.

## 7. Plan de corrección y validación

1. Resolver el contrato de `HistoricoCierresZ`: valor permitido de `recordDomain`, semántica de `closedBy`, valores de `closingSource`, y designación de un solo writer/ID determinista. Después, corregir ambos caminos o retirar el proyector secundario solo si se demuestra que no tiene consumidores.
2. Resolver el contrato de `desgloseDetallado`: elegir entre tipo CMS ARRAY (coherente con el dominio y tests) o un objeto `{items:[]}` con lector/hook compatibles. No asumir que OBJECT y ARRAY son intercambiables.
3. Reponer el maestro `DatosFiscales` con esquema aprobado y datos legales verificados, incluyendo el singleton `CONFIG_SISTEMA_FISCAL`; mantener Veri*Factu desactivado hasta completar revisión legal/técnica.
4. Aprobar plan de cuentas y reglas PGC; conectar callers productivos de `appendAccountingEntry` únicamente después de validar el origen y los mapeos.
5. Mantener gates fiscales/contables cerrados hasta pruebas offline, contratos, Wix runtime, idempotencia/concurrencia, read-after-write y conciliación documento→CMS.
6. Resolver las 7 automatizaciones preinstaladas activas mediante procedimiento soportado por Wix/app propietaria. No sortear locks; reconsultar estados antes de runtime/E2E.

## 8. Estado de validación

- **Verificado en Wix read-only:** 150 automatizaciones (143 INACTIVE / 7 ACTIVE), locks de las 7 activas, 41 colecciones, esquemas/revisiones/campos de las cinco colecciones de destino, ausencia de `DatosFiscales`, y cero documentos en los cuatro destinos fiscales/contables.
- **Verificado en código:** guards fail-closed, writers, campos requeridos, campos omitidos en cierre Z, falta de caller productivo de `appendAccountingEntry`, construcción del paquete y forma de `desgloseDetallado`.
- **Declarado por el propietario:** el sitio es QA y sus datos son sintéticos.
- **Pendiente de ejecución:** inserción runtime, lectura posterior, prueba E2E, validación de hooks Wix en runtime, publicación del código Velo desde Git y verificación de hash/release.
- **Sin cambios:** ninguna escritura CMS, ninguna modificación de esquema, ningún movimiento fiscal/contable, ningún cierre Z, ningún pago/reembolso, ningún email/notificación, ningún despliegue Wix.

## Fuentes técnicas oficiales

- [Wix Automations — Activation Status](https://dev.wix.com/docs/api-reference/business-management/automations/skills/automations-activation-status)
- [Wix CMS — Data Types in Wix Data](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-types-in-wix-data)
- [Wix CMS — Data Collections API](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/introduction)
- [Wix CMS — Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)

## Addendum de aislamiento externo — 2026-11-16

La revalidación posterior del Site ID QA devuelve 8 automatizaciones ACTIVE (no 7): siete PREINSTALLED bloqueadas por `disableStatusChange=true` y una automatización de origen APPLICATION, `Creación de TPV física personalizada`, programada a diario a las 01:45 y con acción `Delegate to AI Custom Agent`. El task ID es `d56d7590-7eb7-4e4f-94ac-2ca9fa465fcf`; su contenido e integraciones no se han podido verificar. Se mantiene el bloqueo de Runtime/E2E hasta inspección en Agent Maker. No se ha modificado ninguna automatización ni ejecutado tareas IA.

Evidencia completa: `docs/audits/2026-11-14-qa-automations-isolation.md`, addendum 2026-11-16.
