# Estado operativo — Marian Madrid

**Corte de verificación:** 2026-11-23  
**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Integración documental:** PR #545, #546, #558 y #559 fusionadas. Último `main` verificado en `75b6fc2b6172ae8e8ea38536c28eace208d10d69`.  
**Release:** **NO-GO**. No autorizado publicar, operar comercialmente ni activar pagos/writers fiscales.

## Estado ejecutivo

| Área | Estado verificado | Límite |
|---|---|---|
| Código TPV / contratos | PR #543, #551 (metadatos), #554 (auditoría) y #556 (identidad fiscal) fusionadas en `main`; CI offline de las tres PR en SUCCESS | Wix Runtime/E2E, sincronización Git–Editor y aislamiento de efectos externos pendientes. |
| CI de estabilización documental | **SUCCESS pre-merge y post-merge** | PR #545: backend [45112082881](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082881), Gitleaks [45112082897](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082897). Post-merge PR #545: backend [45112229859](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229859), Gitleaks [45112229890](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229890). PR #546: backend [45112483802](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112483802), Gitleaks [45112483786](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112483786); post-merge PR #546: backend [45112587480](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112587480), Gitleaks [45112587474](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112587474). |
| Calidad offline | CI por PR: #554 79 suites / 725 tests; #551 79 / 726; #556 79 / 728; backend y secret scanning en SUCCESS en los HEAD validados | No existe evidencia de Wix Runtime/E2E ni CI post-merge sobre el merge commit. La CI offline no prueba CMS live, fiscalidad ni hardware. |
| Protección de main | No configurada; issue #210 abierta | API devolvió `protected=false`; requiere administrador. |
| Wix Site Context | **Draft**, read-back directo 2026-11-23 | Wix Editor, Velo habilitado, Premium, dominio personalizado, EUR, Europe/Madrid. No demuestra SHA sincronizado ni Runtime. |
| Apps Wix observadas | Bookings, Forms & Payments, Gift Cards, Payments, Stores Catalog V3, Invoices V1, Members Area, Blog y Promote SEO | Instalación observada; no equivale a aceptación funcional de cada app. |
| Catálogo Bookings | 94 servicios nativos ↔ 95 filas CMS; 70 visibles con reserva online habilitada y sin discrepancias de pago | 24 hijos duales ocultos; F2 usa OFFLINE/noFee. Runtime de Writer pendiente. |
| Cancelaciones Bookings | 6/6 bookingId CitasF2 encontrados en Bookings V2; los 6 nativos CANCELED el 2026-11-20 | CitasF2 conserva 5 CONFIRMED y 1 PENDING; dos nativos PAID. Correlación #416 y delivery Runtime pendientes. |
| TPV | PR #551 y #554 fusionadas; metadatos neutrales y lector de auditoría conectados en código | Falta sincronización Git–Wix Editor, Preview/Runtime, permisos efectivos, idempotencia y concurrencia real. |
| CMS / ledgers | Relectura consistente 2026-11-23: CajaActual 1 ABIERTA (300 € apertura / 320 € esperado); MovimientosCaja 5 sintéticos; CitasF2 6; MapaStaff 5 sin CONFIG_SISTEMA_FISCAL; HistoricoCierresZ 1 SIMULATED; LibroAsientosContablesDetalle 3 SIMULATED_ONLY | No mutar CajaActual ni ledgers; investigar sesión abierta y reconciliar reservas sin alterar reservas nativas. |
| Automatizaciones | **Siete ACTIVE** según última actualización de issue #520 | Siete PREINSTALLED permanecen ACTIVE y protegidas; la automatización APPLICATION «Configuración de control laboral» está INACTIVE (revisión 5). Falta inspección de historial/efectos de las preinstaladas y contención soportada para E2E. |
| Fiscalidad / Veri*Factu | PR #556 fusionada; lector exige singleton fiscal canónico y falla cerrado | No existe CONFIG_SISTEMA verificado; no activar writers, firma, QR, emisión ni remisión. Validación Wix Runtime pendiente. |
| Capa 3 | Pendiente | SharePoint solo evidencia; no gobierna Capa 1. |

## Revalidación de ejecución — 2026-11-23

- Wix `GetSiteContext`: Draft; Wix Editor clásico; Velo habilitado; Stores Catalog V3 e Invoices V1. No acredita SHA instalado ni ejecución Runtime.
- PR #554 — merge commit `1a55a4d23163b04e76d8953815bca7f38bb4d6e1`; CI backend `45154872022` y secret scanning `45154871994`, ambos SUCCESS en HEAD `03da5baaf154c104669d13067d2104cb80547c90`.
- PR #551 — merge commit `03a019eafed46fc39bcc53d80cc09c335951d15e`; tras rebase, backend `45170143336` y secret scanning `45170143367`, ambos SUCCESS en HEAD `d8fcfd749beeab6bfe655208d3ac37bec4e92108`.
- PR #556 — merge commit `3f02e5bb125fbb20d10d40e614c7c3eb3202b106`; tras rebase, backend `45170094804` y secret scanning `45170094802`, ambos SUCCESS en HEAD `324e169492d7c82bf6b428eb21a47c67a4185d74`.
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


Propietario/origen ampliado: los siete registros TPV-QA tienen un único CMS _owner y ese propietario coincide con el createdBy.userId de los pedidos POS #10032/#10033. Los dos pedidos comparten también el mismo creador. Esto acredita un actor común entre el test-run y los pedidos, pero no demuestra que los pedidos sean sintéticos ni que las operaciones no tuvieran efecto económico. No se exponen identificadores personales; la clasificación QA/real sigue pendiente de evidencia del titular/recibos/adquirente.
