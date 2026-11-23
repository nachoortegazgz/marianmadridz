# Estado del proyecto — Marian Madrid

**Corte:** 2026-11-23  
**Repositorio:** nachoortegazgz/marianmadridz  
**main HEAD:** ccdac0347e86f430c4f8086765815d9d5d7e00af  
**Wix Site ID:** 188bed94-177c-4bc9-a9f0-35080d874f3e  
**Clasificación funcional:** entorno QA según declaración del propietario.  
**Release:** **NO-GO**.

Este documento es el resumen operativo actual. Los inventarios de CMS, snapshots y resultados antiguos se conservan en auditorías fechadas; no son lecturas live actuales.

## Estado ejecutivo

| Área | Estado | Evidencia / límite |
|---|---|---|
| Integración Git | Integrada | PR #541, #540, #542, #543 y #544 están merged; #537 preservada en historial de #541. |
| CI backend en HEAD actual | Correcto | Run 45107377657: Layer 1 364/364, Layer 2 255/255, suite offline 736/736, npm audit 0, SDK contracts y ESLint SUCCESS. |
| Secret scanning | Correcto | Gitleaks full-history SUCCESS, run 45107377700 sobre main HEAD actual. |
| Protección de main | No configurada | API devuelve protected=false; issue #210 abierta. |
| TPV código | Integrado, no aceptado en Runtime | Contratos y persistencia sintética implementados; Wix E2E pendiente. |
| Estado de publicación Wix | Draft (verificado por read-back 2026-11-23) | GetSiteContext devuelve Draft; Editor Wix, Velo habilitado, Premium y dominio personalizado. Las menciones Published de #520/#526 son históricas y no prevalecen sobre la lectura actual. No se ha publicado; sincronización SHA Git-Editor y Preview/Runtime siguen sin acreditar. |
| CMS y ledgers | No aceptado para operación | Integridad de CajaActual y compensaciones pendientes. |
| Fiscalidad/Veri*Factu | Bloqueado | No habilitar writers, emisión ni remisión. |
| Capa 3 | Pendiente de aceptación | SharePoint solo evidencia; no gobierna Capa 1. |

## Repositorio y CI

main está en ccdac0347e86f430c4f8086765815d9d5d7e00af. PR #543 se integró en 0ba7b684d6f4d6465718ae4317d10d8f422de2ff tras CI pre-merge verde. PR #544 integró la actualización documental final en ccdac0347e86f430c4f8086765815d9d5d7e00af. PR #541, #540 y #542 también están integradas; PR #537 quedó preservada en el historial de #541.

La regresión de test introducida por PR #542 se corrigió en PR #543 y ya está integrada en main. El workflow del HEAD actual ccdac0347e86f430c4f8086765815d9d5d7e00af pasa: 364/364 Layer 1, 255/255 Layer 2, 736/736 suite offline, npm audit 0, contratos SDK, ESLint y Gitleaks full-history SUCCESS.

main no tiene protección efectiva. La issue #210 sigue abierta y requiere intervención con permisos de administración para configurar required checks, PR obligatoria y bloqueo de force-push/borrado.

## TPV — contrato de pagos

Métodos sintéticos centralizados: EFECTIVO, TARJETA, BIZUM, BONO, TARJETA_REGALO y OTROS. Los seis aparecen en enum/validación/conciliación/devolución. BONO y TARJETA_REGALO no acreditan consumo de saldo ni integración real con Wix Gift Cards; no hay captura de valor real ni conciliación con proveedor. Las escrituras reales y fiscales permanecen deshabilitadas.

El detalle de identidad, roles, sesión, ventas, devoluciones, X/Z y matriz E2E está en qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md y src/backend/tpv/README.md.

## Backlog activo

### P0

- [#525](https://github.com/nachoortegazgz/marianmadridz/issues/525): serialización/CAS de CajaActual para todos los escritores; pruebas de concurrencia y recuperación.
- [#416](https://github.com/nachoortegazgz/marianmadridz/issues/416): conciliar compensaciones fiscales pendientes y singleton de caja sin mutar históricos.
- [#415](https://github.com/nachoortegazgz/marianmadridz/issues/415): alinear maestro fiscal MapaStaff, esquema físico y consumidores; no recrear colecciones por inferencia.
- [#520](https://github.com/nachoortegazgz/marianmadridz/issues/520): auditar ocho automatizaciones Wix activas y contener efectos por vías soportadas.
- [#434](https://github.com/nachoortegazgz/marianmadridz/issues/434): gate paraguas de release; mantener NO-GO.
- [#209](https://github.com/nachoortegazgz/marianmadridz/issues/209): diseño y validación SIF/Veri*Factu con AEAT, proveedor y asesoría; mantener writers deshabilitados.

### P1

- [#210](https://github.com/nachoortegazgz/marianmadridz/issues/210): proteger main y exigir CI.
- TPV E2E: flujo apertura → venta → pagos → movimientos → devolución → X/Z → cierre, permisos, retry, idempotencia y concurrencia.
- Bookings/Payments E2E: checkout, reservas, webhooks, cancelaciones y reembolsos en Sandbox.
- [#526](https://github.com/nachoortegazgz/marianmadridz/issues/526) está cerrada; la contención de reservas online se declara aplicada. Mantenerla y verificar el bloqueo efectivo antes de reactivar.

### P2/P3

Capa 3 y automatización documental; después accesibilidad, SEO, rendimiento, UX y optimización. No adelantar estas tareas sobre los bloqueos P0/P1.

## Condiciones de seguridad

- No escribir ni borrar registros append-only.
- No corregir CajaActual o compensaciones sin trazabilidad y autorización de los gates.
- No ejecutar pagos, devoluciones ni emisión fiscal reales.
- No reactivar automatizaciones o reservas online sin verificación de efectos.
- No publicar ni declarar producción hasta probar el SHA en Wix Runtime, CMS, permisos y rollback.

## Fuentes de trabajo

- Plan y secuencia: MASTER-EXECUTION-PLAN.md.
- Backlog detallado: qa/BACKLOG-RECONCILIATION-2026-11-23.md.
- Aceptación TPV: qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md.
- Auditoría Wix: qa/2026-11-23-tpv-wix-audit-validation.md.
- Relevo TPV: qa/2026-11-23-tpv-session-handoff.md.
- Contrato TPV: ../src/backend/tpv/README.md.
