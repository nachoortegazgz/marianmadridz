# Backlog activo — Marian Madrid — corte 2026-11-23

Este documento es la única matriz operativa de issues. El estado ejecutivo está en [PROJECT-STATUS](../PROJECT-STATUS.md); el plan y orden de ejecución, en [MASTER-EXECUTION-PLAN](../MASTER-EXECUTION-PLAN.md).

**Release:** **NO-GO**.

## P0 — integridad, fiscalidad y efectos externos

| Issue | Estado GitHub verificado | Acción pendiente | Restricción |
|---|---|---|---|
| [#525 CajaActual](https://github.com/nachoortegazgz/marianmadridz/issues/525) | Open · actualizado 2026-11-23 | Inventariar todos los writers; demostrar lock/CAS global, idempotencia, retry, ausencia de lost updates y recuperación. | No mutar singleton live durante auditoría. |
| [#416 Compensaciones](https://github.com/nachoortegazgz/marianmadridz/issues/416) | Open · actualizado 2026-11-23 | Conciliar cada compensación con pedido/ledger/transacción fuente y definir recuperación trazable. | No reintentar, borrar, sobrescribir ni crear asientos por inferencia. |
| [#415 Maestro fiscal](https://github.com/nachoortegazgz/marianmadridz/issues/415) | Open | Reconciliar MapaStaff, esquema físico y consumidores; confirmar configuración fiscal. | No recrear DatosFiscales ni CONFIG_SISTEMA sin evidencia/ADR. |
| [#520 Automatizaciones Wix](https://github.com/nachoortegazgz/marianmadridz/issues/520) | Open · actualizado 2026-11-23 | Auditar las 8 ACTIVE documentadas: 7 PREINSTALLED y 1 APPLICATION; inspeccionar definición e historial de la APPLICATION y contención soportada. | No sortear disableStatusChange ni desinstalar apps para neutralizar triggers. |
| [#209 SIF/Veri*Factu](https://github.com/nachoortegazgz/marianmadridz/issues/209) | Open | Validación normativa, técnica, proveedor y asesoría; contrato común de huella y pruebas. | Mantener writers, firma, QR, emisión y remisión deshabilitados. |
| [#434 Release readiness](https://github.com/nachoortegazgz/marianmadridz/issues/434) | Open | Gate paraguas: consolidar evidencia de todos los P0/P1 y conservar NO-GO. | No duplicar implementación de issues especializadas. |

## P1 — gobierno y aceptación funcional

| Issue / área | Estado GitHub | Acción pendiente |
|---|---|---|
| [#210 Protección de main](https://github.com/nachoortegazgz/marianmadridz/issues/210) | Open | Administrador: PR obligatoria, checks requeridos, bloqueo force-push y borrado. API ha devuelto `protected=false`. |
| [#526 Reservas online durante QA](https://github.com/nachoortegazgz/marianmadridz/issues/526) | Closed · 2026-11-23 | No reactivar sin read-back y prueba negativa Runtime. Issue conserva evidencia histórica Published que contradice el read-back actual Draft; no asumir el estado de reservas solo por el cierre. |
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
- En PR #545 HEAD `c1e2cc086c5954b39b91ba7072d0fb5ab1b75ded`: Backend offline quality gates SUCCESS, run [45111242142](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45111242142); Secret scanning SUCCESS, run [45111242155](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45111242155).
- main sigue sin protección efectiva; #210 es un gate administrativo abierto.
- No se hicieron escrituras CMS, pagos, cambios de automatización ni publicación durante esta estabilización.

## Evidencia y navegación

- [PR #545](https://github.com/nachoortegazgz/marianmadridz/pull/545)
- [Plan maestro](../MASTER-EXECUTION-PLAN.md)
- [Estado operativo](../PROJECT-STATUS.md)
- [Índice documental](../README.md)