# Reconciliación del backlog — estado actual 2026-11-23

**main:** ccdac0347e86f430c4f8086765815d9d5d7e00af  
**PRs integradas:** #541, #540, #542, #543 y #544. **PR #537:** preservada en el historial de #541 mediante merge commit 1bd1e2d02a741cc4ebad883524f3652ed6aa905b.  
**Último merge:** PR #544, documentación, merge commit ccdac0347e86f430c4f8086765815d9d5d7e00af.  
**Release:** **NO-GO**.

Esta matriz sustituye los estados de backlog anteriores que contradigan la fecha de corte. Las issues siguen siendo el registro de trabajo; su descripción puede contener evidencia histórica y no debe interpretarse como lectura live actual.

## Criterios

- **Abierta:** GitHub issue sigue abierta; no significa que toda la implementación esté pendiente.
- **Parcial/Runtime:** hay código o contención, pero falta evidencia en Wix Runtime/CMS.
- **Cerrada:** issue cerrada; mantener los controles de no regresión correspondientes.
- No cerrar issues con criterios Runtime sin ejecutar las pruebas requeridas.

## P0 — integridad transaccional y contención

| Issue | Estado GitHub | Acción vigente | Restricción |
|---|---|---|---|
| [#525 CajaActual](https://github.com/nachoortegazgz/marianmadridz/issues/525) | Abierta | Inventariar todos los escritores; demostrar lock/CAS compartido, idempotencia, reintentos y ausencia de lost updates. | No aceptar el lock de un solo writer como garantía global. No modificar singleton live durante auditoría. |
| [#416 Compensaciones y caja](https://github.com/nachoortegazgz/marianmadridz/issues/416) | Abierta | Conciliar cada compensación pendiente con su pedido/ledger/transacción original; documentar causa y plan de recuperación. | No reintentar, borrar, sobrescribir ni crear asientos por inferencia. |
| [#415 Maestro fiscal CMS](https://github.com/nachoortegazgz/marianmadridz/issues/415) | Abierta | Reconciliar MapaStaff y sus consumidores con el esquema físico actual; confirmar configuración fiscal. | No recrear DatosFiscales ni CONFIG_SISTEMA sin evidencia y decisión arquitectónica. |
| [#520 Automatizaciones Wix](https://github.com/nachoortegazgz/marianmadridz/issues/520) | Abierta | Inspeccionar la tarea/historial de la automatización APPLICATION y definir contención soportada de siete automatizaciones PREINSTALLED activas. | No sortear disableStatusChange ni desinstalar apps para evitar controles Wix. |
| [#434 Release readiness](https://github.com/nachoortegazgz/marianmadridz/issues/434) | Abierta | Consolidar todos los gates de release y conservar NO-GO. | Issue paraguas; no duplicar implementación de issues especializadas. |
| [#209 SIF/Veri*Factu](https://github.com/nachoortegazgz/marianmadridz/issues/209) | Estado no reconsultado en este corte | Confirmar estado GitHub y cerrar diseño/validación legal, técnica y de proveedor. | Writers, firma, QR y remisión siguen bloqueados hasta evidencia y autorización. |

## P1 — gobierno y pruebas funcionales

| Issue | Estado GitHub | Acción vigente |
|---|---|---|
| [#210 Protección de main](https://github.com/nachoortegazgz/marianmadridz/issues/210) | Abierta | Administrador debe exigir PR, checks obligatorios, bloquear force-push y borrado. API confirma protected=false. |
| [#526 Reservas online durante QA](https://github.com/nachoortegazgz/marianmadridz/issues/526) | Cerrada | Mantener la contención aplicada; prueba negativa Runtime antes de cualquier reactivación. |
| TPV E2E | Pendiente | Abrir caja, venta, pagos, movimientos, devolución, X, Z y cierre; validar roles, idempotencia, retry, concurrencia y CMS. |
| Bookings/Payments E2E | Pendiente | Checkout, reserva, webhook, cancelación y devolución en Sandbox sin efectos externos reales. |

## P2 — integraciones

- Capa 3: SharePoint almacena evidencia; Power Automate orquesta transporte documental. No puede modificar ni gobernar Capa 1.
- Webhooks/crons: probar idempotencia, replay, concurrencia, autorización y recuperación.
- Exportaciones: verificar que cada lectura/exportación está autorizada y auditada, sin exponer secretos ni datos no necesarios.

## P3 — calidad evolutiva

Accesibilidad, SEO, rendimiento, UX móvil, dependencias y limpieza de código. Prioridad posterior a integridad y aceptación operativa.

## Estado de Fase 1 — estabilización del repositorio

- main HEAD y PRs reconciliadas: verificados.
- Incidencia histórica: aserciones TPV desactualizadas; corregidas en PR #543. No persiste en el HEAD actual.
- Corrección completa integrada por PR #543 tras CI pre-merge SUCCESS.
- CI del HEAD actual ccdac0347e86f430c4f8086765815d9d5d7e00af: SUCCESS, Layer 1 364/364, Layer 2 255/255, suite offline 736/736, npm audit 0, contratos Wix SDK/eCommerce/TPV y ESLint (run 45107377657). Gitleaks full-history SUCCESS (run 45107377700).
- Secret scanning de main: SUCCESS.
- Protección de main: pendiente de administración (#210); main continúa sin protección.
- PR #543 y actualización documental #544 integradas en main. No se realizaron escrituras CMS ni cambios de configuración Wix.

## Evidencia

- [main commit](https://github.com/nachoortegazgz/marianmadridz/commit/ccdac0347e86f430c4f8086765815d9d5d7e00af)
- [CI backend correcto en HEAD actual](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45107377657)
- [Gitleaks full-history correcto](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45107377700)
- [Issue #210](https://github.com/nachoortegazgz/marianmadridz/issues/210)
- [Plan maestro](../MASTER-EXECUTION-PLAN.md)
- [Estado del proyecto](../PROJECT-STATUS.md)
