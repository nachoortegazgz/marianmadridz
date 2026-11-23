# Backlog activo — Marian Madrid — corte 2026-11-23

Este documento es la única matriz operativa de issues. El estado ejecutivo está en [PROJECT-STATUS](../PROJECT-STATUS.md); el plan y orden de ejecución, en [MASTER-EXECUTION-PLAN](../MASTER-EXECUTION-PLAN.md).

**Release:** **NO-GO**.

## P0 — integridad, fiscalidad y efectos externos

| Issue | Estado GitHub verificado | Acción pendiente | Restricción |
|---|---|---|---|
| [#525 CajaActual](https://github.com/nachoortegazgz/marianmadridz/issues/525) | Open · actualizado 2026-11-23 | PR #528 ya integra lock compartido; falta prueba concurrente/recuperación en Wix Runtime. | No mutar singleton live durante auditoría. |
| [#416 Compensaciones](https://github.com/nachoortegazgz/marianmadridz/issues/416) | Open · titular confirma #10032/#10033 como sintéticos QA | No generar asientos reales ni reintentar; verificar ausencia de efectos externos y resolver las compensaciones QA de forma trazable. CajaActual sigue pendiente. | No borrar, sobrescribir ni mutar ledgers; no ejecutar writers fiscales. |
| [#415 Maestro fiscal](https://github.com/nachoortegazgz/marianmadridz/issues/415) | Open · PR #556 integrada | MapaStaff/consumidores alineados; no existe CONFIG_SISTEMA canónico. Falta configuración legal verificada y Runtime. | No recrear DatosFiscales ni CONFIG_SISTEMA sin datos verificados. |
| [#520 Automatizaciones Wix](https://github.com/nachoortegazgz/marianmadridz/issues/520) | Open · actualizado 2026-11-23 | Última actualización: 7 PREINSTALLED ACTIVE; la APPLICATION «Configuración de control laboral» está INACTIVE, revisión 5. Inspeccionar efectos/historial de las siete preinstaladas y definir contención soportada. | No sortear disableStatusChange ni desinstalar apps para neutralizar triggers. |
| [#209 SIF/Veri*Factu](https://github.com/nachoortegazgz/marianmadridz/issues/209) | Open | Validación normativa, técnica, proveedor y asesoría; contrato común de huella y pruebas. | Mantener writers, firma, QR, emisión y remisión deshabilitados. |
| [#434 Release readiness](https://github.com/nachoortegazgz/marianmadridz/issues/434) | Open | Gate paraguas: consolidar evidencia de todos los P0/P1 y conservar NO-GO. | No duplicar implementación de issues especializadas. |

## PR de código integradas — 2026-11-23

| PR | Merge commit | CI offline | Gate pendiente |
|---|---|---|---|
| [#554](https://github.com/nachoortegazgz/marianmadridz/pull/554) | `1a55a4d23163b04e76d8953815bca7f38bb4d6e1` | Backend `45154872022` y secret scanning `45154871994`: SUCCESS | Wix Preview/Runtime, auditoría persistida por sesión y sincronización Git–Editor |
| [#551](https://github.com/nachoortegazgz/marianmadridz/pull/551) | `03a019eafed46fc39bcc53d80cc09c335951d15e` | Backend `45170143336` y secret scanning `45170143367`: SUCCESS tras rebase | Wix Preview/Runtime, permisos, idempotencia y concurrencia |
| [#556](https://github.com/nachoortegazgz/marianmadridz/pull/556) | `3f02e5bb125fbb20d10d40e614c7c3eb3202b106` | Backend `45170094804` y secret scanning `45170094802`: SUCCESS tras rebase | Configuración fiscal legal verificada y lectura Runtime; mantener fail-closed |
| [#569](https://github.com/nachoortegazgz/marianmadridz/pull/569) | `bf6e9966526716eef00ff1e304eb22459e2ef46e` | HEAD pre-merge: 79 suites / 732 PASS; Layer 1 364 PASS; Layer 2 244 PASS; SDK, ESLint y Gitleaks SUCCESS | Confirmar GitHub Integration SHA en Editor; Wix Local Editor/Runtime, concurrencia e idempotencia E2E |
| [#571](https://github.com/nachoortegazgz/marianmadridz/pull/571) | `08214a6b0b41c729004115e601daf09b6364b2b1` | Backend offline y Gitleaks SUCCESS | Mantener #416 abierta para acreditar ausencia de efectos externos; no reintentar compensaciones sintéticas |
| [#572](https://github.com/nachoortegazgz/marianmadridz/pull/572) | `dcd7452038912461bbc04f80f089a530d49aaf6e` | HEAD pre-merge: 79 suites / 734 PASS; Layer 1 366 PASS; Layer 2 244 PASS; SDK, ESLint y Gitleaks SUCCESS | Aplicar manualmente `#htmlTPV.txt` en Wix Draft y probar handshake en Preview/Runtime |



Confirmación del titular 2026-11-23: pedidos POS #10032 y #10033 son operaciones sintéticas de QA. Las tres compensaciones vinculadas no representan una obligación de crear asientos fiscales reales. Se mantiene #416 abierta hasta verificar ausencia de efectos externos y documentar resolución QA; no reintentar ni modificar datos CMS.

## P1 — gobierno y aceptación funcional

| Issue / área | Estado GitHub | Acción pendiente |
|---|---|---|
| [#210 Protección de main](https://github.com/nachoortegazgz/marianmadridz/issues/210) | Open | Administrador: PR obligatoria, checks requeridos, bloqueo force-push y borrado. API ha devuelto `protected=false`. |
| [#526 Reservas online durante QA](https://github.com/nachoortegazgz/marianmadridz/issues/526) | Closed · 2026-11-23 | No reactivar sin read-back y prueba negativa Runtime. Issue conserva evidencia histórica Published que contradice el read-back actual Draft; no asumir el estado de reservas solo por el cierre. |
| [#523 Cancelaciones CitasF2](https://github.com/nachoortegazgz/marianmadridz/issues/523) | Open · revalidado 2026-11-23 | 6/6 bookings nativos CANCELED; CitasF2 mantiene 5 CONFIRMED y 1 PENDING; dos native PAID vs CMS PENDING_LEDGER. Verificar event delivery/runtime y correlacionar #416. | No corregir proyección, reenviar eventos ni tocar pagos/ledgers por inferencia. |
| [#522 Canales de pago Bookings](https://github.com/nachoortegazgz/marianmadridz/issues/522) | Open · revalidado 2026-11-23 | 70 servicios visibles sin discrepancias; 24 hijos duales ocultos, F2 OFFLINE/noFee y native inPerson=true. Probar Writer con onlineBooking deshabilitado en Runtime. | No modificar masivamente flags ni servicios nativos. |
| TPV E2E | Pendiente · PR #569/#572 integradas | Confirmar SHA Velo en Editor; aplicar manualmente `#htmlTPV.txt` actualizado al HTML Component de Draft; comprobar que desaparecen `WIDGET_MESSAGE_TYPE_NOT_ALLOWED` y `WIDGET_HANDSHAKE_TIMEOUT`; después ejecutar pruebas de sesión, identidad Staff, ventas sintéticas, movimientos, devoluciones, X/Z, auditoría, retry, concurrencia y CMS. |
| Bookings/Payments E2E | Pendiente | Checkout, reserva, webhook, cancelación y devolución en Sandbox sin efectos externos reales. |

## P2 — integraciones

- Capa 3: SharePoint como repositorio de evidencia; Power Automate como transporte documental, sin gobernar Capa 1.
- Webhooks/crons: probar idempotencia, replay, concurrencia, autorización y recuperación.
- Exportaciones: verificar permisos, auditoría, minimización de datos y ausencia de secretos.

## P3 — calidad evolutiva

Accesibilidad, SEO, rendimiento, UX móvil, dependencias y limpieza de código. No desplazar los bloqueos P0/P1.

## Estado de estabilización de repositorio

- Corrección de aserciones TPV integrada por PR #543.
- Documentación consolidada por PR #544 y estabilizada por PR #545.
- PR #545 quedó fusionada en main mediante merge commit `9dbeacfc505bdfb58e8e1cdf9d566c8662cda739`. El HEAD pre-merge `57013eed25a5f8c755a2e5cd3434c792b3dec78c` pasó backend (run [45112082881](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082881)) y Gitleaks (run [45112082897](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082897)); el merge commit pasó backend (run [45112229859](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229859)) y Gitleaks (run [45112229890](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229890)).
- main sigue sin protección efectiva; #210 es un gate administrativo abierto.
- No se hicieron escrituras CMS, pagos, cambios de automatización ni publicación durante esta estabilización.
- Nueva revalidación Bookings V2/CitasF2 y catálogo dual en [auditoría](../audits/2026-11-23-bookings-revalidation.md).
- PR #554, #551 y #556 fusionadas en `main`; sus merge commits y CI se detallan arriba.

## Evidencia y navegación

- [PR #545](https://github.com/nachoortegazgz/marianmadridz/pull/545)
- [Plan maestro](../MASTER-EXECUTION-PLAN.md)
- [Estado operativo](../PROJECT-STATUS.md)
- [Índice documental](../README.md)

## Evidencia Wix CMS — 2026-11-23

Consultas de solo lectura con `consistentRead=true` (última relectura 2026-11-23): `CajaActual` 1 (ABIERTA desde 2026-11-21T08:12:21.994Z; `closedAt=null`; `conceptOperations={}`; `traceId=0`; apertura 300 EUR / esperado 320 EUR); `MovimientosCaja` 5 (todas sintéticas; 3 nuevas con origen TPV_QA_DEVELOPMENT); `CitasF2` 6 (5 CONFIRMED, 1 PENDING); `MapaStaff` 5 (3 STAFF, sin CONFIG_SISTEMA_FISCAL); `HistoricoCierresZ` 1 SIMULATED; `LibroAsientosContablesDetalle` 3 SIMULATED_ONLY. Los siete registros TPV-QA nuevos no cumplen el contrato de hooks actual y carecen de testRunId/siteId/sourceType/sessionId. No se mutaron colecciones.

Consulta directa Bookings Reader V2 del 2026-11-23 confirma los seis bookingId proyectados: 6/6 nativos CANCELED desde 2026-11-20; dos paymentStatus=PAID y cuatro NOT_PAID/UNDEFINED. CitasF2 mantiene 5 CONFIRMED y 1 PENDING; dos paymentStatus PENDING_LEDGER. Véase [auditoría Bookings V2 y catálogo dual](../audits/2026-11-23-bookings-revalidation.md). No cerrar caja ni corregir CitasF2 por inferencia.


## Criterio obligatorio de aceptación — reservas duales

El flujo no usa Wix Bookings multiservicio. El backend compone dos bookings individuales (F1 y F2) separados por un gap de exposición. La aceptación exige `F2.start = F1.end + exposureDuration`, gap no convertido en booking de F1/F2, política explícita de ocupación por otros servicios, mismo `resourceId`, asociación de pareja persistida, F2 `OFFLINE` con importe cero y ausencia de segundo cobro. Deben probarse colisiones de disponibilidad, concurrencia, reintentos, cancelación y reprogramación en Runtime. No clasificar las 348 reservas sin CitasF2 como huérfanas del flujo dual sin demostrar que pertenecen a servicios duales.


## Reconciliación ampliada Bookings V2 ↔ catálogo dual ↔ caja (2026-11-23)

Lectura de cuatro páginas Bookings Reader V2 y CMS consistente: 354 bookings (352 cancelados, 2 confirmados), 95 servicios CMS, 24 padres duales y 24 servicios F2 enlazados. Se identificaron 132 bookings en servicios padre/hijo duales (87 F1, 45 F2), todos cancelados; 222 pertenecen a otros servicios. Ninguno usa multiServiceBookingInfo. De los 132 duales, 130 no tienen fila CitasF2; 34 parejas solo son candidatas por mismo email/recurso y gap exacto, sin pairToken nativo. No reconciliar automáticamente.

Las seis filas actuales CitasF2 se componen de 2 fases duales y 4 reservas simples. La pareja dual mantiene pairToken/resourceId comunes y gap exacto de 40 minutos, pero ambos bookings nativos están CANCELED mientras CMS indica CONFIRMED.

**Bloqueo P0 relacionado con #416 — clasificación actualizada por confirmación del titular (2026-11-23):** los pedidos #10032 (92,45 EUR) y #10033 (18,15 EUR), incluidos su refund y las tres compensaciones PENDING_RECOVERY (+92,45; +18,15; -18,15 EUR), son artefactos sintéticos de QA, no ventas/cobros reales. No deben originar asientos fiscales reales ni reintentos de pago/refund/compensación. Se conserva el estado histórico sin borrado ni sobrescritura. #416 permanece abierta para demostrar ausencia de efectos externos y mantener separada la sesión singleton CajaActual; no usar writers ni mutar CMS.


## Causa raíz de #416 y prerequisitos fiscales (2026-11-23)

La escritura fiscal y contable permanece bloqueada intencionadamente: internalConfig.js declara LEDGER_WRITES_ENABLED=false, ACCOUNTING_LEDGER_WRITES_ENABLED=false y ALLOW_SIMULATION_RECORDS=false. eventLog.js devuelve FISCAL_LEDGER_WRITES_DISABLED antes de insertar en el ledger. events.js encola los pagos fallidos y el webhook de refund espera a que exista ORDER-{orderId}; si no lo encuentra, deja ORIGINAL_ORDER_LEDGER_MISSING. queueFiscalRecovery() genera identidad determinista con hash/dedupeKey y hace comprobación fuerte de duplicado.

MapaStaff contiene 5 registros (GESTORIA 1, TERCERO 1, STAFF 3) y no contiene el singleton CONFIG_SISTEMA_FISCAL. La ausencia de configuración es un bloqueo independiente: no activar LEDGER_WRITES_ENABLED hasta que configuración, firma/SIF, permisos y Runtime estén certificados.

Las tres compensaciones de #416 corresponden a operaciones sintéticas QA confirmadas por el titular: #10032 (+92,45 EUR), #10033 (+18,15 EUR) y refund #10033 (-18,15 EUR). No representan obligaciones económicas ni justifican asientos fiscales, pagos o refunds reales. No completar ni reintentar. Mantener evidencia histórica y documentar la resolución de QA de forma trazable, sin borrar ni modificar ledgers.


## Revalidación de sitio/Bookings — 2026-11-23 (solo lectura)

GetSiteContext indica que el sitio está Draft (Editor clásico, Velo habilitado, Premium; Wix Stores Catalog V3 e Invoices V1). Este estado reemplaza la referencia histórica Published de los snapshots anteriores.

Bookings Services V2 devuelve 94/94 servicios: 70 visibles, 24 ocultos; 74 con onlineBooking.enabled=true y 20 false. Los 70 visibles están habilitados; cuatro servicios F2 ocultos también están habilitados. Pago online: 70; presencial: 94. La lectura contradice el snapshot anterior 94/94 deshabilitados. No asumir que los flags cambiaron por una intervención concreta: no hay autoría ni historial de cambio disponible en esta lectura.

**NO-GO de publicación:** mantener el sitio Draft hasta identificar la divergencia y validar que los servicios F2 ocultos no admiten una reserva directa que eluda el flujo dual personalizado. No modificar los 94 flags en bloque. La prueba de rutas directas y Runtime queda pendiente.


## Integridad de TPV sintético — registros legacy fuera de contrato (2026-11-23)

CMS devuelve siete registros con prefijo TPV-QA-1795437582366: tres movimientos sintéticos en MovimientosCaja (+20, +35, -35 EUR), tres filas LibroAsientosContablesDetalle marcadas SIMULATED_ONLY y un cierre Z marcado SIMULATED/TPV_CUSTOM_QA. Carecen de testRunId, siteId, sourceType y sessionId; no hay ControlOperativo que los correlacione.

Los movimientos carecen de schemaVersion/hash/previousRecordHash. Los asientos incumplen assertAccountingLedgerRecord (journalEntryId, recordSource, documentId, sequenceNumber, desgloseDetallado y hashes ausentes). El cierre no cumple assertHistoricoCierresZ por fiscalPeriod/campos fiscales ausentes. El código actual en main rechazaría esos payloads; posible writer legacy, escritura CMS REST que elude hooks o desincronización Wix. Origen no acreditado.

No tocar ni borrar: son colecciones append-only. Mantener #435/#434 abiertos; identificar el escritor, demostrar aislamiento y exclusión de lectores fiscales. Estos registros no están correlacionados con #10032/#10033 y no resuelven #416.


Correlación de autoría: los siete registros TPV-QA comparten un único CMS owner, coincidente con el creador de los pedidos POS #10032/#10033; ambos pedidos comparten creador. Es una correlación de actor, no prueba de que los pedidos sean sintéticos ni de que no hubiera efecto económico. Mantenerlos como posibles hechos económicos hasta acreditación.


## Discrepancia de recuento MovimientosCaja

Snapshot auditado 2026-11-12: 10 filas (4 SMOKE_TEST, 1 INTERNAL/VENTA_ONLINE no sintética, 5 SIMULATED_PAYMENT secuencia 1–5). Lectura consistente actual 2026-11-23: 5 filas, todas sintéticas, totalCount=5 y hasNext=false. Diferencia de -5; la fila no sintética del snapshot no está presente. No se registraron IDs en el snapshot anterior y no hay historial CMS disponible en la consulta actual; causa desconocida. No limpiar ni reconstruir. Revisar backup/Activity Logs y confirmar si hubo reset autorizado. Mantener P0 de integridad abierto.


Seguimiento PR #566: el clasificador fiscal ahora reconoce esos marcadores legacy para excluirlos de lectores. No los convierte en registros válidos: los hooks de inserción y el lector TPV canónico siguen rechazando los payloads incompletos.


Actualización de gobierno 2026-11-23: PR #566 integrada en main con CI completo SUCCESS; el clasificador reconoce marcadores legacy de simulación, sin legitimar los registros ni habilitar writers. PR #568 documenta la discrepancia histórica 10→5 de MovimientosCaja; CI pendiente. Último main base de esta rama: a5e611da1d98b743e14ea6dc6f4bfee8b26e00a6.


ControlOperativo (63 registros) no contiene eventos CLEANUP/RESET/MIGRAT/PURGE/DELETE/TRUNCAT/RESTORE; src/ no tiene handler dataItemDeleted. Wix dispone de webhook REST Data Item Deleted, pero la suscripción no está verificada. No atribuir el delta a una limpieza sin Activity Logs/backup.
