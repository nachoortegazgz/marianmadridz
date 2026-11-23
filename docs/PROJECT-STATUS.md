# Estado operativo — Marian Madrid

**Corte de verificación:** 2026-11-23  
**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Integración documental:** PR #545, #546, #558, #559, #561, #562, #563, #564, #566, #569, #571, #572, #578, #579, #580 y #582 integradas. PR #580 incorpora el ajuste del handshake TPV; PR #582 alinea el estado documental con su merge y CI. Último commit de main verificado en este corte: `d2debad0b0ed39e94d0c91019f2d60552394ecec`. PR #581 y #583 siguen abiertas como borradores documentales redundantes/no integrados; su evidencia se consolida en esta actualización.  
**Release:** **NO-GO**. No autorizado publicar, operar comercialmente ni activar pagos/writers fiscales.

## Estado ejecutivo

| Área | Estado verificado | Límite |
|---|---|---|
| Código TPV / contratos | PR #543, #551, #554, #556, #566, #569, #572 y #580 integradas en `main`; #580 amplía `MM_READY` a 120 × 500 ms (60 s), frente al watchdog Velo de 65 s, y añade aserción contractual | Aplicar/sincronizar el HTML en `#htmlTPV` de Wix Draft y validar Preview/Runtime; E2E, concurrencia e inexistencia de efectos externos siguen pendientes. |
| CI de estabilización documental | **SUCCESS pre-merge y post-merge** | PR #545: backend [45112082881](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082881), Gitleaks [45112082897](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082897). Post-merge PR #545: backend [45112229859](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229859), Gitleaks [45112229890](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229890). PR #546: backend [45112483802](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112483802), Gitleaks [45112483786](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112483786); post-merge PR #546: backend [45112587480](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112587480), Gitleaks [45112587474](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112587474). |
| Calidad offline | PR #580 HEAD/CI de PR: Layer 1 30 suites / 369 PASS; Layer 2 17 / 245 PASS; suite completa 79 / 740 PASS / 0 FAIL; SDK Cart V2, Order Transactions, TPV SDK, ESLint y Secret scanning SUCCESS | Resultados del CI de PR; no equivalen a Preview/Runtime Wix ni prueban CMS live, fiscalidad, hardware o ausencia de efectos externos. No consta una ejecución independiente post-merge para el SHA `180c69d...`. |
| Protección de main | No configurada; issue #210 abierta | API devolvió `protected=false`; requiere administrador. |
| Wix Site Context | **Draft / no publicado**, confirmado por GetSiteContext y Query Sites V2 (2026-11-23); `published=false`, `viewUrl` vacío | `wix.config.json` apunta al mismo siteId y `main` es la rama por defecto; la sincronización Git→Editor no está acreditada por lectura del Editor. `#htmlTPV.txt` está fuera de las carpetas Velo y requiere aplicación manual en `#htmlTPV`. No se ha llamado a Publish/Unpublish. |
| Apps Wix observadas | Bookings, Forms & Payments, Gift Cards, Payments, Stores Catalog V3, Invoices V1, Members Area, Blog y Promote SEO | Instalación observada; no equivale a aceptación funcional de cada app. |
| Catálogo Bookings | 94 servicios nativos ↔ 95 filas CMS; 70 visibles con reserva online habilitada y sin discrepancias de pago | 24 hijos duales ocultos; F2 usa OFFLINE/noFee. Runtime de Writer pendiente. |
| Cancelaciones Bookings | 6/6 bookingId CitasF2 encontrados en Bookings V2; los 6 nativos CANCELED el 2026-11-20 | CitasF2 incluye 2 fases duales y 4 reservas simples; conserva 5 CONFIRMED y 1 PENDING. El titular declara #10032/#10033 como sintéticos QA, pero Get Order V1 devuelve `demo=false`, `imported=false` y `channelInfo.type=POS`; esa declaración no demuestra Test Mode ni ausencia de efectos económicos. Las tres compensaciones permanecen `PENDING_RECOVERY`; #416 sigue P0. |
| TPV | PR #551, #554, #569 y #572 fusionadas; contrato de sesión y bridge READY/CONTEXT corregido en `main` | Confirmar SHA Velo en Editor; copiar manualmente HTML actualizado; probar ausencia de errores bridge, permisos, idempotencia y concurrencia en Preview/Runtime. |
| CMS / ledgers | Relectura consistente 2026-11-23: CajaActual 1 ABIERTA (300 € apertura / 320 € esperado); MovimientosCaja 5 sintéticos; CitasF2 6; MapaStaff 5 sin CONFIG_SISTEMA_FISCAL; HistoricoCierresZ 1 SIMULATED; LibroAsientosContablesDetalle 3 SIMULATED_ONLY | No mutar CajaActual ni ledgers; investigar sesión abierta y reconciliar reservas sin alterar reservas nativas. |
| Automatizaciones | **Siete ACTIVE** según última actualización de issue #520 | Siete PREINSTALLED permanecen ACTIVE y protegidas; la automatización APPLICATION «Configuración de control laboral» está INACTIVE (revisión 5). Falta inspección de historial/efectos de las preinstaladas y contención soportada para E2E. |
| Fiscalidad / Veri*Factu | PR #556 fusionada; lector exige singleton fiscal canónico y falla cerrado | No existe CONFIG_SISTEMA verificado; no activar writers, firma, QR, emisión ni remisión. Validación Wix Runtime pendiente. |
| Capa 3 | Pendiente | SharePoint solo evidencia; no gobierna Capa 1. |

## Revalidación de ejecución — 2026-11-23

- Wix `GetSiteContext`: Draft; Wix Editor clásico; Velo habilitado; Stores Catalog V3 e Invoices V1. No acredita SHA instalado ni ejecución Runtime.
- PR #554 — merge commit `1a55a4d23163b04e76d8953815bca7f38bb4d6e1`; CI backend `45154872022` y secret scanning `45154871994`, ambos SUCCESS en HEAD `03da5baaf154c104669d13067d2104cb80547c90`.
- PR #551 — merge commit `03a019eafed46fc39bcc53d80cc09c335951d15e`; tras rebase, backend `45170143336` y secret scanning `45170143367`, ambos SUCCESS en HEAD `d8fcfd749beeab6bfe655208d3ac37bec4e92108`.
- PR #556 — merge commit `3f02e5bb125fbb20d10d40e614c7c3eb3202b106`; tras rebase, backend `45170094804` y secret scanning `45170094802`, ambos SUCCESS en HEAD `324e169492d7c82bf6b428eb21a47c67a4185d74`.


- PR #569 — merge commit `bf6e9966526716eef00ff1e304eb22459e2ef46e`; HEAD pre-merge `7d324d181d847326ca184b05a86edd52f8f11461`: Layer 1 30/364 PASS, Layer 2 17/244 PASS, suite 79/732 PASS, SDK checks, ESLint y Gitleaks SUCCESS.

- PR #571 — merge commit `08214a6b0b41c729004115e601daf09b6364b2b1`: confirma pedidos POS #10032/#10033 como sintéticos QA por declaración del titular; no reintentar compensaciones ni crear asientos reales.
- PR #572 — merge commit `dcd7452038912461bbc04f80f089a530d49aaf6e`; HEAD pre-merge `307d0362e029238e40bdeb45cd1cfc6d516bc0db`: Layer 1 30/366 PASS; Layer 2 17/244 PASS; suite 79/734 PASS; SDK checks, ESLint y Gitleaks SUCCESS. Corrige allowlist MM_CONTEXT y handshake READY con reintentos.
- El HTML Component `#htmlTPV` no se ha actualizado en Wix Editor; el archivo raíz `#htmlTPV.txt` requiere aplicación manual en Draft. No declarar corregidos los errores en Runtime hasta probarlo.


- Declaración del titular 2026-11-23: pedidos POS #10032 (92,45 €) y #10033 (18,15 €) se generaron como operaciones sintéticas QA. **Contraste posterior de Wix Get Order V1:** ambos devuelven `demo=false`, `imported=false`, `channelInfo.type=POS`; por tanto, Wix no los clasifica como test orders. La declaración de QA no acredita Test Mode del proveedor ni ausencia de liquidación externa. #416 permanece P0 hasta obtener evidencia del proveedor/Dashboard sobre modo test/live, settlement y refund. No reintentar compensaciones, cobros ni devoluciones; no crear asientos ni alterar ledgers.
- El repo contiene `wix.config.json` con `siteId=188bed94-177c-4bc9-a9f0-35080d874f3e` y `uiVersion=15941`; GitHub confirma `main` como rama por defecto. La documentación oficial Wix establece que la rama por defecto sincroniza código con el Editor conectado. No se ha leído el panel GitHub Integration ni ejecutado `wix dev`; marcar sincronización como esperada, no verificada.
- Los tres cambios están integrados en Git; no hay validación Wix Runtime ni autorización de publicación.
- #525: el lock común ya está integrado por PR #528; falta demostrar concurrencia/recuperación en Wix Runtime.
- #415: PR #556 integrada; no existe CONFIG_SISTEMA canónico. No se inventa ni se crea sin datos legales verificados.
- La fuente detallada `NECESIDADES WEB MARIAN.txt` sigue sin estar disponible; no se infieren requisitos ausentes.

## Qué está completado

- PR #551 integrada: escrituras de proyección TPV neutrales y compatibilidad de lectura histórica.
- PR #554 integrada: `AUDIT_LIST` conectado al ledger de auditoría dedicado.
- PR #556 integrada: identidad fiscal basada exclusivamente en `CONFIG_SISTEMA` canónico, con fail-closed.
- Corrección de aserciones TPV desactualizadas mediante PR #543.
- Consolidación documental previa en PR #544.
- Estabilización documental consolidada mediante PR #545 y trazabilidad post-merge corregida por PR #546; ambas fusionadas en main con CI pre-merge y post-merge SUCCESS.
- Read-back Wix Site Context actual que devuelve Draft; la lectura resuelve el estado en el momento consultado, no la sincronización del código.

## Bloqueos prioritarios

1. [#525 CajaActual](https://github.com/nachoortegazgz/marianmadridz/issues/525): lock compartido integrado por PR #528; falta prueba de concurrencia real en Wix Runtime.
2. [#416 Compensaciones](https://github.com/nachoortegazgz/marianmadridz/issues/416): reconciliar registros pendientes con evidencia original.
3. [#415 Maestro fiscal](https://github.com/nachoortegazgz/marianmadridz/issues/415): PR #556 integrada; no existe CONFIG_SISTEMA canónico en MapaStaff. Mantener fail-closed hasta disponer de datos legales verificados, ligado a #209.
4. [#520 Automatizaciones](https://github.com/nachoortegazgz/marianmadridz/issues/520): siete PREINSTALLED ACTIVE; APPLICATION «Configuración de control laboral» INACTIVE (revisión 5). Inspeccionar efectos/historial de las siete preinstaladas y contención soportada.
5. [#523 Reservas](https://github.com/nachoortegazgz/marianmadridz/issues/523): seis proyecciones CitasF2 divergen del estado nativo CANCELED; dos bookings nativos PAID y sus proyecciones PENDING_LEDGER deben correlacionarse con #416. No reinyectar eventos ni corregir estados por inferencia.
6. [#522 Canales Bookings](https://github.com/nachoortegazgz/marianmadridz/issues/522): los 70 servicios visibles están coherentes; 24 hijos duales ocultos se crean por F2 OFFLINE/noFee. Runtime Writer pendiente; no modificar flags sin evidencia.
7. [#209 SIF/Veri*Factu](https://github.com/nachoortegazgz/marianmadridz/issues/209): validación legal/técnica con AEAT, asesoría y proveedor.
8. [#210 Protección de main](https://github.com/nachoortegazgz/marianmadridz/issues/210): ruleset y checks requeridos mediante administrador.
9. [#434 Release readiness](https://github.com/nachoortegazgz/marianmadridz/issues/434): conservar NO-GO hasta cierre de los gates.

La issue [#526](https://github.com/nachoortegazgz/marianmadridz/issues/526) está cerrada. Su descripción conserva una lectura histórica Published; el read-back directo posterior de Site Context devuelve Draft. La prueba negativa Runtime de reservas/efectos externos sigue pendiente.

## Invariantes de seguridad

- No borrar ni sobrescribir ledgers append-only.
- No corregir CajaActual ni compensaciones por inferencia.
- No ejecutar pagos, reembolsos, facturación o comunicaciones reales durante QA.
- No reactivar reservas ni automatizaciones sin verificación de estado y efectos.
- No declarar producción por CI offline o estado Draft.
- No publicar hasta verificar SHA Git-Wix, permisos, CMS, Runtime/E2E, rollback y autorización.

## Documentos de detalle

- [Plan maestro](MASTER-EXECUTION-PLAN.md)
- [Backlog GitHub reconciliado](qa/BACKLOG-RECONCILIATION-2026-11-23.md)
- [Aceptación TPV](qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md)
- [Auditoría de contexto Wix](qa/2026-11-23-tpv-wix-audit-validation.md)
- [Conciliación TPV con Wix POS/eCommerce/CMS](qa/TPV-WIX-NATIVE-RECONCILIATION-AUDIT-2026-11-23.md)
- [Revalidación Bookings V2 y dual](audits/2026-11-23-bookings-revalidation.md)
- [Índice y jerarquía documental](README.md)
- [README backend TPV](../src/backend/tpv/README.md)
## Evidencia CMS solo lectura — 2026-11-23

- `CajaActual`: singleton `ABIERTA`, `openedAt=2026-11-21T08:12:21.994Z`, `closedAt=null`, `snapshotSource=MOVIMIENTOS_CAJA_RECONCILIADOS`, `conceptOperations={}` y `traceId=0`; `lastOperationType=RECONCILIATION_CORRECTION`. No se ejecutaron escrituras ni cierres.
- `MovimientosCaja`: 2 filas; ambas `synthetic=true`, `status=SIMULATED_SUCCESS` y `reconciliationStatus=RECONCILED`, con orígenes `TPV_SIMULATED_GATEWAY` y `TPV_FUNCTIONAL_TEST`. La presencia de `gatewayResponse` no demuestra llamada real a pasarela.
- `CitasF2`: 6 proyecciones; 5 `CONFIRMED`, 1 `PENDING`; 3 sin `pairToken`, 2 comparten token y 1 tiene token distinto. Consulta directa Bookings Reader V2: 6/6 nativos `CANCELED` el 2026-11-20; dos conservan `paymentStatus=PAID` mientras CMS indica `PENDING_LEDGER`. No se mutaron. [Revalidación](audits/2026-11-23-bookings-revalidation.md).
- `MapaStaff`: 5 registros, 3 `STAFF`; no existe `recordType=CONFIG_SISTEMA`. No se consultaron ni expusieron NIF.
- `HistoricoCierresZ` y `LibroAsientosContablesDetalle`: 0 registros.
- Todas las lecturas CMS se ejecutaron con `consistentRead=true`; no hubo mutaciones.


## Contrato dual personalizado — precisión arquitectónica (2026-11-23)

Wix Bookings V2 no se utiliza como motor de multiservicio. La composición de dos fases es responsabilidad del backend Marian Madrid: dos bookings individuales e independientes (F1 y F2), vinculados por la identidad de pareja del flujo dual. Entre ambas existe un **gap de exposición** que no constituye una reserva F1/F2. F2 debe comenzar exactamente en `F1.end + exposureDuration`; la disponibilidad de ambas fases debe corresponder al mismo `resourceId` (profesional/recurso).

Evidencia estática: `src/backend/reservas.web.js` declara las correcciones `DUAL-GAP-01` y `DUAL-GAP-02` (búsqueda del slot F2 en el instante local exacto calculado), y `DUAL-PERF-01` (consulta F1/F2 por jornada en paralelo). El módulo `src/backend/booking/bookingSaga.js` declara la orquestación de reserva simple y dual con gap. Esta evidencia no sustituye una ejecución Wix Runtime.

Criterios de aceptación Runtime pendientes: (1) F1 y F2 son bookings nativos independientes; (2) `F2.start = F1.end + exposureDuration` sin redondeo; (3) el intervalo de exposición no constituye un booking F1/F2; (4) F1 y F2 mantienen el mismo resourceId; (5) la ocupación del gap por otros servicios se valida según la política operativa aprobada; (6) cancelación/reprogramación/reintento conserva la pareja e idempotencia; (7) F2 se crea `OFFLINE`, importe cero y sin segundo checkout/cobro. No usar el endpoint de multiservicio de Wix ni interpretar la ausencia de multiservicio nativo como defecto.


## Clasificación nativa dual y conciliación económica (2026-11-23)

Consulta Wix de solo lectura, con cuatro páginas de Bookings Reader V2 y contraste de ServiciosCatalogo/Bookings Services V2:
- 354 bookings nativos: 352 CANCELED, 2 CONFIRMED; 0 tienen multiServiceBookingInfo.
- 95 filas CMS, 24 servicios padre duales y 24 servicios F2 enlazados; los 48 IDs se encuentran en Bookings Services V2.
- 132 bookings históricos pertenecen a ese conjunto dual: 87 F1 y 45 F2; los 132 están CANCELED. Los otros 222 bookings pertenecen a servicios fuera del conjunto dual.
- 130 de los 132 bookings duales no tienen proyección CitasF2. Una heurística de mismo email, recurso y gap exacto encuentra 34 parejas candidatas (no autoritativas, sin pairToken nativo); quedan 53 F1 y 11 F2 sin pareja candidata. No crear proyecciones automáticamente.
- Las seis filas actuales de CitasF2 se clasifican como dos fases duales y cuatro reservas simples. La pareja dual tiene pairToken y resourceId comunes, y gap de 40 minutos coincidente con el catálogo; sus bookings nativos están cancelados mientras las proyecciones siguen CONFIRMED.

**Bloqueo P0 de conciliación económica:** los pedidos #10032 (92,45 EUR, PAID, método Cash) y #10033 (18,15 EUR, FULLY_REFUNDED) están asociados a dos proyecciones simples Barba Perfecta, ambas con booking nativo CANCELED y CitasF2.paymentStatus=PENDING_LEDGER, totalAmount=0, sin cashMovementId. #10033 tiene transacción REFUNDED y refund registrado. En ControlOperativo hay tres compensaciones PENDING_RECOVERY vinculadas a esos dos pedidos: +92,45 EUR (#10032), +18,15 EUR y -18,15 EUR (#10033). El refund señala ORIGINAL_ORDER_LEDGER_MISSING. MovimientosCaja tiene 5 filas, todas sintéticas y sin orderId/bookingId; no hay movimiento correlacionado. LibroAsientosContablesDetalle permanece vacío. No se ha escrito ni corregido ningún ledger.

La clasificación demuestra que la ausencia de CitasF2 no debe aplicarse indiscriminadamente a todas las reservas: hay 222 reservas de servicios no duales y 130 reservas históricas en servicios duales sin proyección. Las 34 parejas son solo candidatas; su origen y vínculo deben acreditarse antes de reconciliar.


## Causa raíz verificada — bloqueo fiscal y recuperaciones (2026-11-23)

El estado PENDING_RECOVERY de #10032/#10033 es consecuencia de los gates fail-closed actuales, no una autorización para reintentar escrituras:
- src/backend/internalConfig.js: FISCAL_RUNTIME_POLICY mantiene LEDGER_WRITES_ENABLED=false, ACCOUNTING_LEDGER_WRITES_ENABLED=false y ALLOW_SIMULATION_RECORDS=false.
- src/backend/eventLog.js: registrarEventoEconomico() devuelve FISCAL_LEDGER_WRITES_DISABLED antes de cualquier inserción o reserva de secuencia.
- src/backend/events.js: el webhook de pago encola recuperación cuando registrarEventoEconomico no devuelve SUCCESS/PARTIAL; processCompletedEcommerceRefund() busca primero ORDER-{orderId} y, si falta, encola WAIT_FOR_ORIGINAL_ORDER_LEDGER / ORIGINAL_ORDER_LEDGER_MISSING.
- src/backend/cajas.web.js: queueFiscalRecovery() usa identidad determinista hash/dedupeKey y comprueba duplicado antes de considerar la cola idempotente.
- MapaStaff tiene 5 registros (1 GESTORIA, 1 TERCERO, 3 STAFF) y no contiene CONFIG_SISTEMA_FISCAL. Por tanto, además del gate de Runtime, falta el maestro fiscal canónico.

Los tres registros PENDING_RECOVERY vinculados a #10032/#10033 son coherentes con ese flujo: +92,45 EUR (#10032), +18,15 EUR (#10033) y -18,15 EUR (#10033). El último espera el asiento original ausente. No reintentar ni completar recuperaciones mientras LEDGER_WRITES_ENABLED siga false y falte la configuración canónica.

**Criterio de salida P0:** determinar si #10032/#10033 son operaciones QA sintéticas o hechos económicos reales mediante evidencia externa de origen (app creadora, checkout, recibos/caja y, si procede, banco/adquirente); validar configuración fiscal y SIF; certificar Runtime en entorno aislado; reconciliar primero el pago original de #10032 y #10033, y después el refund de #10033, con nuevos registros trazables sin sobrescribir ni borrar ledger. No basta con cambiar un booleano ni con el estado PAID/REFUNDED de Wix.


## Revalidación de estado del sitio y disponibilidad Bookings — 2026-11-23

GetSiteContext actual (site 188bed94-177c-4bc9-a9f0-35080d874f3e; actualización de Wix 23-11-2026 08:59): sitio **Draft**, plan Premium, Editor clásico, Velo habilitado, Europe/Madrid, EUR. Apps instaladas: Bookings, Forms & Payments, Gift Cards, Invoices V1, Members Area, Wix Payments y Stores Catalog V3. La evidencia anterior de Published queda como snapshot histórico, no como estado actual.

Consulta consistente de Bookings Services V2 (94/94): 70 servicios visibles, 24 ocultos; onlineBooking.enabled=true en 74 y false en 20; los 70 visibles están habilitados, y cuatro servicios F2 ocultos también tienen onlineBooking habilitado. Payment online habilitado en 70 y presencial en 94. Esto contradice la evidencia anterior de 94/94 online deshabilitados; se debe tratar como regresión o divergencia de snapshots hasta identificar el cambio y su autoría. El sitio Draft evita asumir exposición pública actual, pero si se publica, los 70 servicios visibles están configurados para reserva online.

**Gate de publicación:** mantener Draft. Antes de publicar, verificar por ID los 24 servicios F2 ocultos, las cuatro fases secundarias con onlineBooking activo, rutas directas/SEO y el comportamiento del writer F2 OFFLINE/importe cero. No cambiar flags masivamente ni probar rutas con reservas reales. La disponibilidad de F2 por URL directa no se ha validado en Runtime.


## Auditoría de persistencia TPV sintética legacy — 2026-11-23

Consulta CMS consistente: siete registros comparten el prefijo TPV-QA-1795437582366 y timestamp 2026-11-23 12:39:42Z: tres MovimientosCaja (+20 SALE CASH, +35 SALE CARD, -35 REFUND CARD), tres LibroAsientosContablesDetalle (+20, +35, -35, projectionStatus=SIMULATED_ONLY) y un HistoricoCierresZ (recordDomain=TPV_CUSTOM_QA, closingStatus=SIMULATED, totalOperations=3, totalCash=20, NOT_SIGNED).

Los siete carecen de testRunId/siteId/sourceType/sessionId y no hay ControlOperativo correlacionado. Los tres movimientos carecen de schemaVersion/hash/previousRecordHash; los tres asientos incumplen assertAccountingLedgerRecord (faltan journalEntryId, recordSource, documentId, sequenceNumber, desgloseDetallado y hashes); el cierre incumple assertHistoricoCierresZ por ausencia de fiscalPeriod y otros campos fiscales. El código actual en data.js/validation.js rechazaría estas formas; los marcadores no cumplen _isCurrentSyntheticTpvRow. Origen no acreditado: writer legacy, REST/CMS bypass o Wix Runtime desincronizado. No se ha ejecutado Preview Sandbox ni se ha identificado el autor.

No limpiar ni actualizar: MovimientosCaja, LibroAsientosContablesDetalle e HistoricoCierresZ son append-only. Separar estos registros del caso económico #10032/#10033; no contienen orderId/bookingId y no resuelven compensaciones. Investigar writer/data plane y demostrar que lectores/agregadores excluyen SIMULATED_ONLY antes de habilitar TPV Runtime. Incidencias #435 y #434 actualizadas.


Confirmación del titular (2026-11-23): los pedidos POS #10032 y #10033 son operaciones sintéticas de QA. La coincidencia del actor común no demuestra por sí sola ausencia de movimiento externo. La auditoría nativa posterior de pedidos y transacciones se documenta en [TPV-WIX-NATIVE-RECONCILIATION-AUDIT-2026-11-23](qa/TPV-WIX-NATIVE-RECONCILIATION-AUDIT-2026-11-23.md): ambos existen como pedidos POS nativos, con transacciones registradas y sin providerTransactionId informado. No se reintentan compensaciones ni se crean asientos reales.


## Discrepancia histórica de MovimientosCaja — 2026-11-23

El snapshot de 2026-11-12 (mismo siteId) registraba 10 filas: 4 SMOKE_TEST, 1 INTERNAL/VENTA_ONLINE clasificada no sintética y 5 SIMULATED_PAYMENT con sequenceNumber 1–5. La consulta actual con consistentRead=true y returnTotalCount=true devuelve 5 filas, todas sintéticas (totalCount=5, hasNext=false). Diferencia: -5 filas frente al snapshot histórico; la fila antes clasificada como no sintética ya no aparece. El snapshot antiguo no guardó IDs, por lo que no se puede identificar el conjunto desaparecido ni atribuir la causa. No se ha mutado nada en esta sesión. No afirmar limpieza autorizada ni borrado no autorizado; revisar Activity Logs/backup y confirmar si hubo reset/limpieza entre el 12 y el 23 de noviembre. P0 integridad abierto hasta explicar la diferencia.


Seguimiento tras PR #566: isExplicitSimulationLedgerRecord() ahora reconoce los marcadores legacy TPV_QA_DEVELOPMENT + TPV_FUNCTIONAL_TEST + synthetic=true, projectionStatus=SIMULATED_ONLY y eventType terminado en _SIMULATED para excluirlos de lectores fiscales/contables. Esto no convierte las filas en asientos válidos: los hooks de inserción y el lector TPV canónico siguen rechazando los payloads legacy por falta de contrato completo, hashes y aislamiento.


Auditoría de ControlOperativo para explicar el delta: 63 registros, sin controlType/kind/status/operationType/traceId con términos CLEANUP/RESET/MIGRAT/PURGE/DELETE/TRUNCAT/RESTORE. No hay handler dataItemDeleted ni wixData_onDataItemDeleted en src/. Wix ofrece el webhook REST Data Item Deleted, pero no hay evidencia de suscripción ni historial en la conexión actual. Esto no prueba que no existiera limpieza; la autoría sigue sin resolver.


## Conciliación TPV personalizado ↔ Wix nativo — 2026-11-23

- Auditoría de solo lectura de pedidos POS #10032/#10033, historial de transacciones Wix Payments y colecciones CajaActual, MovimientosCaja, ControlOperativo, HistoricoCierresZ, LibroAsientosContablesDetalle, CitasF2 y MapaStaff.
- Los eventos TPV sintéticos (20 € efectivo, 35 € tarjeta, −35 € devolución) concilian internamente a 20 € y coinciden con el Z_SIMULATED y tres proyecciones SIMULATED_ONLY. No enlazan con los pedidos POS nativos #10032/#10033.
- Los tres registros COMPENSATION vinculados a #10032/#10033 permanecen PENDING_RECOVERY; no reintentar ni generar ledger real por confirmación del titular de que son QA.
- CajaActual permanece ABIERTA (300 € apertura / 320 € esperado), con referencias nativas nulas y envelope TPV V2 no acreditado. No mutar.
- CitasF2 mantiene dos proyecciones CONFIRMED/PENDING_LEDGER para bookings nativos documentados como CANCELED/PAID. #523 sigue abierta.

### Ampliación de alcance POS — consulta completa 1–24 noviembre

- La consulta paginada de Search Orders para estados APPROVED/CANCELED/PENDING/REJECTED devuelve 5 pedidos con canal POS: #10030–#10034. Search Orders no devuelve INITIALIZED. #10032/#10033 son sintéticos QA por confirmación del titular; #10030 (18,15 €), #10031 (27,71 €) y #10034 (18,15 €) siguen sin clasificación.
- Los tres no clasificados no tienen referencias en MovimientosCaja ni LibroAsientosContablesDetalle; ControlOperativo tampoco devuelve markers asociados. No inferir si son reales o QA.
- #10030: pedido PAID, booking nativo CANCELED/PAID y sin refund en historial. #10034: pedido PAID y booking nativo CONFIRMED/PAID, sin proyección CitasF2. #10031 es producto tienda.
- Los cuatro bookings asociados a pedidos POS consultados: #10030 y #10032/#10033 están CANCELED/PAID; #10034 está CONFIRMED/PAID. CitasF2 carece de proyección para #10030 y #10034.
- Wix Payments Transactions API devuelve cinco transacciones POS, todas sin providerTransactionId. No es evidencia de liquidación bancaria ni de ausencia de movimiento externo.
- Revisión estática: TPV usa simulador de pagos sin llamadas a pasarela; `ALLOW_NATIVE_WRITES=false`, `allowNativePayments=false`, `allowNativeRefunds=false`. Solo lee catálogo/servicios nativos. `CajaActual` ABIERTA no cumple el envelope que exige `assertTpvCajaIntegrity`; inferencia estática: el TPV debe fallar cerrado hasta resolver el singleton. No se invocaron writers ni se mutó la fila.
- Se actualiza informe [TPV-WIX-NATIVE-RECONCILIATION-AUDIT-2026-11-23](qa/TPV-WIX-NATIVE-RECONCILIATION-AUDIT-2026-11-23.md). Solicitar clasificación del titular para #10030/#10031/#10034 antes de cualquier actuación económica/fiscal. No mutar datos ni reintentar compensaciones.
- Sin cambios Wix/CMS, pedidos, transacciones, pagos, refunds ni ledgers. Release NO-GO.


## Correcciones QA — TPV, disponibilidad dual y CajaActual — 2026-11-23

- **TPV bridge:** PR #572 ya había corregido el allowlist de `MM_CONTEXT` y los reintentos de `MM_READY`. En esta rama se amplía el watchdog específico a 65 s y se registran `receivedType`, `receivedVersion` y `allowedTypes` en rechazos, además de `attemptedType` en errores de envío. No se ha validado todavía en Wix Preview. El código versionado no acredita sincronización del Editor; `#htmlTPV.txt` debe seguir aplicándose al HTML Component por el flujo habitual.
- **Disponibilidad F1/F2:** el log del 23-11-2026 15:09:20Z precede al merge de PR #574 (16:15:58Z). La consulta nativa posterior del 24-11 devuelve 124 slots F1, 122 F2 internos y 109 parejas exactas con mismo `resourceId`; 15 F1 carecen de F2 posterior antes del cierre de disponibilidad. No cambiar gap ni staff. Informe: [DUAL-BOOKING-AVAILABILITY-REPRO-2026-11-24](qa/DUAL-BOOKING-AVAILABILITY-REPRO-2026-11-24.md).
- **BUG-04 / sequenceCounters:** se endurece la normalización para analizar cadenas JSON y rechazar valores no objeto/arrays con error de esquema uniforme. Matiz de auditoría: `assertCajaActualRecord` ya rechazaba arrays y escalares en el hook final; el defecto demostrado era que el helper de normalización no hacía esa comprobación, no que el hook completo aceptase necesariamente esos valores. Pruebas añadidas para objeto, JSON válido, null y valores inválidos.
- **BUG-14 / FROM_ADDRESS:** no cambiar `noreply@marianmadrid.com` por `.es` hasta verificar el dominio remitente en el proveedor Resend. El dominio público del sitio y la allowlist de destinatarios no demuestran la verificación del dominio emisor. La configuración permanece intacta.
- **Conciliación POS:** PR #576 está integrada en main. #10030, #10031 y #10034 siguen sin clasificación del titular; no crear movimientos, asientos ni refunds. #10030 continúa como caso de atención por booking CANCELED con pedido PAID y sin refund visible.
- **Seguridad:** no se han creado reservas, pedidos, pagos, devoluciones, asientos, facturas ni movimientos reales. Wix CMS y los ledgers permanecen sin cambios. Release NO-GO.


## Revalidación de integraciones Wix — 2026-11-23 19:42 Europe/Madrid

**Código Git:** PR #577 integrada en `main`, merge commit `37c74f24a13f4d097a7494587c78ef89ea7e3db7`. CI post-merge documentada como SUCCESS: Backend offline quality gates, Layer 1, Layer 2, suite offline completa, Wix Cart SDK, Wix Transactions SDK, Wix TPV SDK, ESLint y secret scanning (runs `45232928165` y `45232928095`).

**Wix Site Context:** el sitio sigue en Draft, Editor clásico, Velo habilitado, timezone Europe/Madrid, EUR. La fecha de actualización devuelta por GetSiteContext es 2026-11-23 17:31, anterior al merge de PR #577 (17:55). Esto no demuestra que Git Integration esté desincronizada, pero tampoco permite acreditar que el SHA `37c74f2...` esté instalado. No se ha leído un SHA Velo del Editor ni ejecutado Preview/Runtime. El HTML Component `#htmlTPV` requiere aplicación manual de `#htmlTPV.txt`.

### CMS / data plane

Lectura oficial de Site Data Usage con `consistentRead=true`:
- Total LIVE: 218 elementos.
- Total SANDBOX: 112 elementos.
- `CajaActual`: 1 LIVE / 1 SANDBOX.
- `MovimientosCaja`: 5 LIVE / 2 SANDBOX.
- `ControlOperativo`: 63 LIVE / 3 SANDBOX.
- `CitasF2`: 6 LIVE / 6 SANDBOX.
- `MapaStaff`: 5 LIVE / 5 SANDBOX.
- `ServiciosCatalogo`: 95 LIVE / 95 SANDBOX.
- `HistoricoCierresZ`: 1 LIVE / 0 SANDBOX.
- `LibroAsientosContablesDetalle`: 3 LIVE / 0 SANDBOX.

Consultas CMS de solo lectura con `consistentRead=true` devuelven las filas LIVE:
- `CajaActual`: singleton `ABIERTA`, apertura 300 EUR, efectivo/esperado 320 EUR, `traceId=0`, `lastOperationType=RECONCILIATION_CORRECTION`. No cerrar ni corregir por inferencia.
- `MovimientosCaja`: 5 filas sintéticas; 3 asociadas al lote `TPV-QA-1795437582366` y 2 con trazas históricas `TPV-SIM-*` / `TPV-FUNC-*`. No se ha demostrado movimiento bancario ni se ha modificado ninguna fila.
- `CitasF2`: 6 proyecciones; dos con `paymentStatus=PENDING_LEDGER`, una pareja dual con `pairToken` compartido y una tercera fila dual independiente. No se han corregido estados.
- `MapaStaff`: 5 filas (GESTORIA, TERCERO y 3 STAFF); no se encontró `CONFIG_SISTEMA` en los campos consultados.
- `HistoricoCierresZ`: 1 cierre sintético. `LibroAsientosContablesDetalle`: 3 filas sintéticas del mismo lote.

**Límite de entorno:** los recuentos SANDBOX proceden de Site Data Usage. Las consultas de elementos realizadas mediante CMS Data Items API devuelven el data plane LIVE; no se han inspeccionado las 2 filas SANDBOX de MovimientosCaja ni la sesión Sandbox desde Local Editor/Preview. Por tanto, los recuentos no equivalen a aceptación E2E ni demuestran aislamiento funcional.

### Automatizaciones Wix

Query Automations V2 paginada con cursor y deduplicación:
- 159 automatizaciones distintas.
- 7 `ACTIVE`; 152 `INACTIVE`.
- Origen: 118 PREINSTALLED, 34 APPLICATION, 6 USER, 1 RECIPE.
- Las 7 activas son PREINSTALLED y todas devuelven `settings.disableStatusChange=true`; dos también `settings.readonly=true`.
- La automatización APPLICATION `Configuración de control laboral` no está activa; su estado `INACTIVE` / revisión 5 ya estaba verificado.
- No se ejecutó Test Automation ni se modificó configuración/estado.

**Decisión:** no intentar eludir los bloqueos Wix ni desinstalar aplicaciones. Los tests E2E que puedan disparar correo, notificaciones, cobros o acciones externas siguen bloqueados hasta disponer de aislamiento de triggers/entorno acreditado. El estado ACTIVE no demuestra ejecuciones recientes ni cancela ejecuciones ya iniciadas.

### Estado de aceptación

- Código y CI GitHub: PASS para el SHA indicado.
- CMS live: lectura y recuentos verificados; incidencias de integridad sin resolver.
- Wix Draft: confirmado.
- SHA Git-Wix: pendiente de acreditar.
- HTML Component TPV: pendiente de sincronización manual.
- Wix Preview/Runtime, concurrencia, idempotencia y E2E: no ejecutados.
- Fiscalidad/Veri*Factu y writers económicos: permanecen bloqueados.
- Release: **NO-GO**.

Se actualizaron los issues #416, #435, #520 y #523 con esta revalidación. No se realizaron escrituras CMS, cambios en automatizaciones, pagos, reservas, devoluciones, facturas, cierres, ledgers ni publicación.


## Conciliación Bookings V2 ↔ eCommerce ↔ CitasF2 — 2026-11-23

Consulta de solo lectura por los seis `bookingId` presentes en `CitasF2`, mediante Bookings Reader V2 con `withEcomOrder=true` y `withEcomTransactions=true`:
- 6/6 proyecciones CMS encontraron su booking nativo.
- 6/6 bookings nativos están en estado `CANCELED`.
- Dos bookings tienen `paymentStatus=PAID` y `selectedPaymentOption=ONLINE`, mientras sus proyecciones CMS permanecen `PENDING_LEDGER`.
  - Pedido #10032: 92,45 EUR, `APPROVED` / `PAID`, balance 0,00 EUR.
  - Pedido #10033: 18,15 EUR, `APPROVED` / `FULLY_REFUNDED`, `refundSumAmounts=18.15` EUR.
- Un booking nativo presenta `paymentStatus=UNDEFINED` mientras CMS refleja `NOT_PAID`.
- Los otros tres bookings presentan `NOT_PAID` / `OFFLINE` en Wix y `NOT_PAID` en CMS.
- La pareja dual con `pairToken=6a24393428b6f7d5` conserva el mismo recurso, pero ambos bookings nativos están cancelados. Existe otra fila dual con token distinto.

**Compensaciones en ControlOperativo:** siguen existiendo tres registros `PENDING_RECOVERY`, todos con `attempts=0`: +92,45 EUR para #10032 (composición de pedido no soportada por el recovery automático), +18,15 EUR para #10033 (writer fiscal deshabilitado) y −18,15 EUR del refund #10033 (`ORIGINAL_ORDER_LEDGER_MISSING`). El titular confirmó previamente que los pedidos #10032 y #10033 son sintéticos de QA.

**Ledger y caja:** las tres filas de `LibroAsientosContablesDetalle` corresponden al lote TPV-QA, tienen `projectionStatus=SIMULATED_ONLY` y `estadoEnvioAEAT=NOT_SENT`; no son asientos de los pedidos #10032/#10033. Las cinco filas actuales de `MovimientosCaja` son sintéticas y no contienen referencias a esos orderId/bookingId. El singleton `CajaActual` continúa ABIERTA.

**Interpretación:** los estados de booking, order y proyección CMS no son equivalentes. El booking #10033 sigue indicando `PAID` aunque su pedido nativo está `FULLY_REFUNDED`; no reconstruir el estado económico desde el booking. No se ejecutó recovery, refund, replay de webhook ni writer fiscal. No se modificaron `CitasF2`, `ControlOperativo`, pedidos, caja ni ledgers.

**Criterio pendiente:** mantener #416 y #523 abiertas hasta definir reconciliación append-only, demostrar entrega/replay de eventos y validar el flujo en Runtime aislado. Ninguna de estas lecturas autoriza una corrección destructiva ni una recuperación económica automática.


### Detalle de transacciones nativas de #10032 / #10033 — 2026-11-23

Lectura oficial de Order Transactions API (sin mutaciones):
- **#10032:** un payment `APPROVED` por 92,45 EUR, `paymentMethod=Cash`, `offlinePayment=false`, `gatewayTransactionId` presente y `providerTransactionId` no devuelto; no existe refund record.
- **#10033:** un payment `REFUNDED` por 18,15 EUR, `paymentMethod=Other Payment Method`, `offlinePayment=false`, `gatewayTransactionId` presente y `providerTransactionId` no devuelto. El refund record por 18,15 EUR tiene `refundStatus=SUCCEEDED`, `externalRefund=false`, `gatewayRefundId` presente y `providerRefundId` no devuelto.

**Discrepancia de contrato:** la combinación `paymentMethod=Cash` / `offlinePayment=false` de #10032 no encaja con la definición oficial de Wix: `offlinePayment` indica si el pago fue realizado offline (por ejemplo, efectivo o marcado como pagado en Business Manager). La respuesta tampoco identifica el proveedor de pago. En #10033 Wix registra un refund `SUCCEEDED` y `externalRefund=false`, pero no devuelve un identificador de refund del proveedor.

**Conclusión limitada:** la API acredita los estados de los registros nativos, no una liquidación bancaria ni la identidad del PSP. Tampoco permite afirmar ausencia de efectos externos solo porque los pedidos fueran clasificados por el titular como sintéticos. Mantener #416 como P0 hasta contrastar modo de prueba / settlement con el proveedor o una evidencia equivalente. No reintentar, cobrar, devolver ni modificar transacciones.


## Corrección TPV — ventana de reintentos del handshake — 2026-11-23

La auditoría del protocolo detectó una desalineación concreta: `#htmlTPV.txt` dejaba de emitir `MM_READY` tras 50 intentos × 500 ms (25 s), mientras `src/public/tpvPageController.js` mantenía un watchdog de 65 s. Si el listener Velo no estaba listo durante la ventana de 25 s, el iframe dejaba de reintentar antes de que venciera el watchdog y podía terminar en `WIDGET_HANDSHAKE_TIMEOUT`.

Corrección integrada mediante [PR #580](https://github.com/nachoortegazgz/marianmadridz/pull/580), merge commit `180c69d9e200266e85f6f0974f1b6a01a7c172a3`:
- Extiende los reintentos a 120 × 500 ms (60 s), conservando 5 s de margen antes del watchdog de 65 s.
- `tpv-widget.contract.test.mjs` calcula y comprueba que la ventana de reintentos es positiva y estrictamente inferior al timeout Velo.
- CI de PR SUCCESS: Layer 1 30 suites / 369 pruebas; Layer 2 17 suites / 245 pruebas; suite offline completa 79 suites / 740 pruebas; SDK Cart V2, Order Transactions, TPV SDK, ESLint y Secret scanning SUCCESS.
- El cambio no modifica el protocolo, la allowlist, las operaciones de negocio ni las políticas de pagos/ledger.
- Pendiente: aplicar el HTML actualizado al componente `#htmlTPV` del Draft y validar Wix Preview; el merge no acredita sincronización del Editor.

La corrección elimina la desalineación temporal conocida en el código versionado, pero no certifica el runtime ni resuelve la caja singleton incoherente.


## Reconciliación documental de estado — 2026-11-23 (corte posterior a PR #580/#582)

### Código y GitHub
- main tiene como último commit verificado d2debad0b0ed39e94d0c91019f2d60552394ecec (PR #582, actualización documental).
- PR #580 está integrada en main, merge commit 180c69d9e200266e85f6f0974f1b6a01a7c172a3. El HTML fuente #htmlTPV.txt usa HANDSHAKE_RETRY_MS=500 y HANDSHAKE_MAX_ATTEMPTS=120; el controlador mantiene handshakeTimeoutMs=65000. La prueba src/backend/tests/tpv-widget.contract.test.mjs comprueba que el producto intervalo × intentos es positivo y menor que el watchdog.
- CI de la PR #580: Layer 1 30 suites / 369 PASS; Layer 2 17 suites / 245 PASS; suite offline 79 suites / 740 PASS; SDK Cart V2, Order Transactions, TPV SDK, ESLint y Secret scanning SUCCESS. Es CI de PR; no se afirma una ejecución Wix Preview/Runtime ni una ejecución independiente post-merge.
- PR #582 integra la actualización documental del merge y los resultados de CI. PR #581 y #583 permanecen abiertas en estado draft y contienen cambios documentales solapados; no se consideran integradas ni fuente de estado de main.

### Estado de publicación Wix
- Query Sites V2 account-level para el siteId indicado devuelve published=false y viewUrl vacío; GetSiteContext devuelve Draft.
- La consulta también devuelve domainConnected=true, premium=true, editorType=EDITOR; esos atributos no cambian el estado de publicación.
- No se ejecutó Publish/Unpublish. La no publicación reduce la exposición pública, pero no demuestra que las automatizaciones programadas o internas estén inactivas.
- No se ha acreditado SHA Velo instalado en Editor ni actualización del HTML Component #htmlTPV. El archivo #htmlTPV.txt está versionado en Git y la actualización del componente sigue pendiente de aplicación/validación en Draft.

### Pedidos POS #10032 / #10033 — clasificación y riesgo
- Get Order V1 devuelve para ambos demo=false, imported=false, channelInfo.type=POS y createdBy correspondiente al propietario del sitio.
- Se conserva como **declaración del titular** que fueron operaciones sintéticas de QA; no se presenta como hecho verificado por Wix. El indicador nativo demo=false significa que Wix no los clasifica como test orders.
- Order Transactions API observó #10032 con payment APPROVED por 92,45 EUR, método Cash, offlinePayment=false, sin refund; #10033 con payment REFUNDED por 18,15 EUR y refund SUCCEEDED, externalRefund=false. La API no acredita el modo del proveedor ni liquidación bancaria.
- **P0 abierto (#416):** obtener evidencia del Dashboard/PSP sobre modo test/live, liquidación y devolución, y confirmar el origen operativo. No repetir cobros/refunds, no reintentar compensaciones y no modificar pedidos, CMS, caja o ledgers para despejar la incidencia.

### Incidencias y límites vigentes
- #416 permanece P0: singleton CajaActual y tres compensaciones PENDING_RECOVERY sin resolución acreditada. Mantener writers fiscales/contables cerrados.
- #523 permanece abierta: seis proyecciones CitasF2 divergen de seis bookings nativos cancelados; no reinyectar eventos ni corregir proyecciones hasta verificar el registro/delivery de handlers y definir reconciliación idempotente.
- El sitio sigue Draft/no publicado; no hay autorización de despliegue. No modificar reservas nativas, pedidos, refunds, caja ni ledgers como parte de esta actualización documental.
- **Release: NO-GO.** CI GitHub no sustituye pruebas Wix Preview/Runtime, concurrencia, idempotencia, E2E ni validación fiscal.
