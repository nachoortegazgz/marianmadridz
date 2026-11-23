# Backlog activo — Marian Madrid — corte 2026-11-23

Este documento es la única matriz operativa de issues. El estado ejecutivo está en [PROJECT-STATUS](../PROJECT-STATUS.md); el plan y orden de ejecución, en [MASTER-EXECUTION-PLAN](../MASTER-EXECUTION-PLAN.md).

**Release:** **NO-GO**.

## P0 — integridad, fiscalidad y efectos externos

| Issue | Estado GitHub verificado | Acción pendiente | Restricción |
|---|---|---|---|
| [#525 CajaActual](https://github.com/nachoortegazgz/marianmadridz/issues/525) | Open · actualizado 2026-11-23 | PR #528 ya integra lock compartido; falta prueba concurrente/recuperación en Wix Runtime. | No mutar singleton live durante auditoría. |
| [#416 Compensaciones](https://github.com/nachoortegazgz/marianmadridz/issues/416) | Open · actualizado 2026-11-23 | Conciliar cada compensación con pedido/ledger/transacción fuente y definir recuperación trazable. | No reintentar, borrar, sobrescribir ni crear asientos por inferencia. |
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

## P1 — gobierno y aceptación funcional

| Issue / área | Estado GitHub | Acción pendiente |
|---|---|---|
| [#210 Protección de main](https://github.com/nachoortegazgz/marianmadridz/issues/210) | Open | Administrador: PR obligatoria, checks requeridos, bloqueo force-push y borrado. API ha devuelto `protected=false`. |
| [#526 Reservas online durante QA](https://github.com/nachoortegazgz/marianmadridz/issues/526) | Closed · 2026-11-23 | No reactivar sin read-back y prueba negativa Runtime. Issue conserva evidencia histórica Published que contradice el read-back actual Draft; no asumir el estado de reservas solo por el cierre. |
| [#523 Cancelaciones CitasF2](https://github.com/nachoortegazgz/marianmadridz/issues/523) | Open · revalidado 2026-11-23 | 6/6 bookings nativos CANCELED; CitasF2 mantiene 5 CONFIRMED y 1 PENDING; dos native PAID vs CMS PENDING_LEDGER. Verificar event delivery/runtime y correlacionar #416. | No corregir proyección, reenviar eventos ni tocar pagos/ledgers por inferencia. |
| [#522 Canales de pago Bookings](https://github.com/nachoortegazgz/marianmadridz/issues/522) | Open · revalidado 2026-11-23 | 70 servicios visibles sin discrepancias; 24 hijos duales ocultos, F2 OFFLINE/noFee y native inPerson=true. Probar Writer con onlineBooking deshabilitado en Runtime. | No modificar masivamente flags ni servicios nativos. |
| TPV E2E | Pendiente | Identidad Staff, roles, sesión, ventas sintéticas, movimientos, devoluciones, X/Z, auditoría, retry, concurrencia y CMS en Preview/Runtime. |
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

Consultas de solo lectura con `consistentRead=true`: `CajaActual` 1 (ABIERTA desde 2026-11-21T08:12:21.994Z; `closedAt=null`; `conceptOperations={}`; `traceId=0`; `lastOperationType=RECONCILIATION_CORRECTION`); `MovimientosCaja` 2 (ambas filas `synthetic=true`, `SIMULATED_SUCCESS`, `RECONCILED`, origen `TPV_SIMULATED_GATEWAY` y `TPV_FUNCTIONAL_TEST`); `CitasF2` 6 (5 CONFIRMED, 1 PENDING; tres `pairToken` vacíos, dos iguales y uno distinto); `MapaStaff` 5 (3 STAFF, sin CONFIG_SISTEMA); `HistoricoCierresZ` 0; `LibroAsientosContablesDetalle` 0. No se mutaron colecciones.

Consulta directa Bookings Reader V2 del 2026-11-23 confirma los seis bookingId proyectados: 6/6 nativos CANCELED desde 2026-11-20; dos paymentStatus=PAID y cuatro NOT_PAID/UNDEFINED. CitasF2 mantiene 5 CONFIRMED y 1 PENDING; dos paymentStatus PENDING_LEDGER. Véase [auditoría Bookings V2 y catálogo dual](../audits/2026-11-23-bookings-revalidation.md). No cerrar caja ni corregir CitasF2 por inferencia.


## Criterio obligatorio de aceptación — reservas duales

El flujo no usa Wix Bookings multiservicio. El backend compone dos bookings individuales (F1 y F2) separados por un gap de exposición. La aceptación exige `F2.start = F1.end + exposureDuration`, gap no ocupado, mismo `resourceId`, asociación de pareja persistida, F2 `OFFLINE` con importe cero y ausencia de segundo cobro. Deben probarse colisiones de disponibilidad, concurrencia, reintentos, cancelación y reprogramación en Runtime. No clasificar las 348 reservas sin CitasF2 como huérfanas del flujo dual sin demostrar que pertenecen a servicios duales.
