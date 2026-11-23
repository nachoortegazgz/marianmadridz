# Reconciliación del backlog — 2026-11-23

**Repositorio:** `nachoortegazgz/marianmadridz`  
**main HEAD verificado:** `995c085aa2ef45fea6d57f95f86d4c75c7cf7f7d` (PR #536).  
**PR #541:** abierta sobre `main`; rama `feat/tpv-payment-exports-after-p0-20261123`; último HEAD de código validado `1d7e99d66fcc14165bf2482885e583176c2b06ef` (los commits posteriores de la rama son solo documentación).  
**CI de PR #541:** Backend offline quality gates SUCCESS (run 45100967570): Layer 1 364/364, Layer 2 255/255, suite offline completa 732/732; npm audit 0 vulnerabilidades, contratos Wix SDK/eCommerce/TPV y ESLint SUCCESS. Secret scanning SUCCESS (run 45100967567).  
**Estado Wix:** no se ha acreditado sincronización del SHA en Wix Editor ni runtime E2E.  
**Release:** **NO-GO**.

Este documento sustituye las matrices de seguimiento anteriores del plan maestro cuando haya contradicción. El bloque de estado superior refleja el corte de GitHub de 2026-11-23; los estados de issues se mantienen sujetos a la evidencia y límites indicados. La revisión es documental y de GitHub; no se han ejecutado escrituras CMS, cambios de automatizaciones, pagos, reembolsos, publicación ni despliegue.

## 1. Criterio de clasificación

- **VIGENTE:** requisito o riesgo aún no aceptado.
- **PARCIAL / RUNTIME:** corrección de código integrada; falta ejecución/aceptación Wix Runtime, Preview o navegador real.
- **BLOQUEADA:** requiere decisión del titular, Dashboard, proveedor externo, Wix Support o asesoría profesional.
- **SUPERSEDED / NO ACTIVA:** el objetivo original fue sustituido por arquitectura posterior; no debe seguir consumiendo trabajo como implementación pendiente.
- Una issue abierta no implica que su solución siga pendiente en código. No cerrar una issue si su criterio de aceptación incluye pruebas runtime todavía no ejecutadas.

## 2. Backlog vigente priorizado

### P0 — integridad, exposición y release gate

| Issue | Estado real a 23/11 | Trabajo vigente | Dependencia / límite |
|---|---|---|---|
| [#416](https://github.com/nachoortegazgz/marianmadridz/issues/416) | **VIGENTE — P0** | Conciliar las tres compensaciones `FISCAL_LEDGER/PENDING_RECOVERY` con pedidos, transacciones, reembolsos y ledger fuente. Determinar la evidencia fiscal/financiera que falta y preparar rectificación solo si procede. | No reintentar, no crear asientos ni modificar CajaActual, MovimientosCaja, ControlOperativo, pedidos #10032/#10033 o reembolsos por inferencia. |
| [#520](https://github.com/nachoortegazgz/marianmadridz/issues/520) | **PARCIAL — P0** | La automatización APPLICATION «Configuración de control laboral» está INACTIVE (revisión 5). Documentar trigger/acciones/efectos de las siete PREINSTALLED ACTIVE y determinar una contención soportada o una ventana segura de pruebas. | Wix impide cambiar estado (`disableStatusChange=true`). No sortear el bloqueo ni desinstalar apps. No E2E que pueda activar efectos externos desconocidos. |
| [#526](https://github.com/nachoortegazgz/marianmadridz/issues/526) | **PARCIAL — P0** | `onlineBooking.enabled=false` aplicado y verificado por read-back en 94/94 servicios. Falta prueba negativa de reservas desde Runtime y auditoría de rutas/WebMethods custom que puedan crear bookings. | El sitio sigue Published. Snapshot reversible: `docs/qa/snapshots/2026-11-22-bookings-online-booking-containment.json`. No reactivar sin decisión explícita. |
| [#525](https://github.com/nachoortegazgz/marianmadridz/issues/525) | **PARCIAL — P0** | Lock fiscal compartido integrado mediante PR #528; CI post-merge SUCCESS. Falta confirmar SHA instalado en Editor y probar concurrencia/recuperación en Runtime Sandbox acreditado. | No escribir en LIVE ni considerar las pruebas offline como garantía de concurrencia real. |
| [#209](https://github.com/nachoortegazgz/marianmadridz/issues/209) | **VIGENTE — P0** | Completar diseño/validación SIF-VERI*FACTU, anticipos, facturas, rectificaciones, hash, firma, remisión y conservación; revisión de gestoría/fiscal y normativa AEAT. | Writers y remisión permanecen deshabilitados. No declarar cumplimiento ni crear secretos ficticios de firmador. |
| [#415](https://github.com/nachoortegazgz/marianmadridz/issues/415) | **VIGENTE — P0, acotada** | Cerrar reconciliación del maestro fiscal/personas contra esquema CMS actual y consumidores reales; verificar configuración fiscal y dependencias externas. | No recrear `DatosFiscales` ni otras colecciones ausentes sin decisión/ADR. No inventar identidad fiscal ni habilitar writers. |
| [#434](https://github.com/nachoortegazgz/marianmadridz/issues/434) | **VIGENTE — release gate** | Mantener el NO-GO global y consolidar los gates P0/P1 de esta matriz, evidencia runtime, revisión legal y aceptación de release. | Es issue paraguas; no duplicar en ella la implementación detallada de issues especializadas. |
| [#441](https://github.com/nachoortegazgz/marianmadridz/issues/441) | **PARCIAL — P0** | El guard de canal POS está integrado en PR #445. Ejecutar E2E de canal POS/WEB, PAID/REFUNDED, canal ausente, pedido mixto y replay; comprobar que POS nunca entra en writers online. | La recuperación histórica corresponde a #416. No realizar pagos/reembolsos reales. |

### P1 — contratos, reservas, permisos y operación

| Issue | Estado real a 23/11 | Trabajo vigente | Dependencia / límite |
|---|---|---|---|
| [#523](https://github.com/nachoortegazgz/marianmadridz/issues/523) | **VIGENTE — P1** | Reconciliar las seis proyecciones CitasF2 frente a Bookings nativo CANCELED; verificar entrega del handler `wixBookingsV2_onBookingCanceled`, markers y la reserva histórica sin proyección. | No reinyectar eventos, cancelar/recrear bookings ni corregir proyecciones sin determinar origen y mecanismo permitido. |
| [#522](https://github.com/nachoortegazgz/marianmadridz/issues/522) | **VIGENTE — P2 acotada** | Resolver política de pago de los servicios ocultos consumidos por flujos internos/TPV. El mismatch está delimitado a los 24 servicios ocultos; no afecta a los 70 públicos en el snapshot revisado. | Confirmar SSOT de negocio. No modificar servicios masivamente. |
| [#435](https://github.com/nachoortegazgz/marianmadridz/issues/435) | **SUPERSEDED como migración; residual runtime** | El objetivo de migrar desde `TPV_QA_*` quedó sustituido por la arquitectura integrada de PR #516 y neutralización #533: `CajaActual` como proyección, `MovimientosCaja` append-only y `ControlOperativo` para locks/idempotencia. No queda trabajo de migración de código QA collections. | La presemilla/lectura Sandbox, identidades, aislamiento y E2E pertenecen al Bloque A/F2 TPV y al gate #434. Mantener este issue solo como referencia histórica o cerrarlo cuando el backlog residual esté transferido documentalmente. |
| [#290](https://github.com/nachoortegazgz/marianmadridz/issues/290) | **PARCIAL — P1** | Claims atómicos y fencing integrados mediante PR #289; probar delivery/replay y concurrencia en Wix Runtime, incluido crash entre side effect y finalización del claim. | Claim no equivale a exactly-once de cualquier sistema externo. |
| [#261](https://github.com/nachoortegazgz/marianmadridz/issues/261) | **PARCIAL — P1** | La configuración de permisos sensibles se documenta alineada; falta prueba efectiva de CMS_EDITOR, ADMIN y writers backend/hook en Runtime. | No reducir permisos ni modificar colecciones durante esta auditoría. |
| [#162](https://github.com/nachoortegazgz/marianmadridz/issues/162) | **PARCIAL — P1** | Journal/locks CAS y contención de reconciliador integrados; falta reconciliación segura de `DUAL_RESCHEDULE`, identidad de intención y pruebas de carrera en Wix Runtime. | Estado mixto o incierto permanece `REPAIR_REQUIRED`; no rollback especulativo. |
| [#188](https://github.com/nachoortegazgz/marianmadridz/issues/188) | **VIGENTE — P1** | Ejecutar QA autenticado de Mis reservas/Mis pedidos, ownership de Cart/Order, reservas duales y eventos de reprogramación. | Bloqueado hasta disponer de ventana E2E segura; no usar cuentas ni transacciones reales. |
| [#211](https://github.com/nachoortegazgz/marianmadridz/issues/211) | **VIGENTE — P1, bloqueada por entorno** | Preparar campaña E2E por capas: primero mocks/simuladores y contratos; después Wix Runtime con proveedor oficialmente configurado en modo prueba, notificaciones neutralizadas y entorno aislado. | Bookings online está deshabilitado; no hacer checkout/capturas/reembolsos reales. No asumir que Preview permite completar checkout de Bookings. |
| [#223](https://github.com/nachoortegazgz/marianmadridz/issues/223) | **VIGENTE — P1** | Persistir snapshot inmutable exacto antes de enviar paquete mensual/trimestral; identidad diferenciada MONTHLY/QUARTERLY, idempotencia y evidencia de despacho separada. | No enviar emails reales en QA ni mutar snapshots append-only. |
| [#210](https://github.com/nachoortegazgz/marianmadridz/issues/210) | **VIGENTE — P1** | Configurar branch protection/required checks de `main` con capacidad administrativa autorizada; verificar que bloquea merge sin CI requerido. | La lectura más reciente disponible en esta revisión no ha confirmado protección; no se debe inferirla de CI SUCCESS. |

### P2/P3 — seguridad residual, Capa 3 y calidad web

| Issue | Estado real a 23/11 | Trabajo vigente | Dependencia / límite |
|---|---|---|---|
| [#521](https://github.com/nachoortegazgz/marianmadridz/issues/521) | **VIGENTE — P1 antes de release** | Resolver por qué Accessibility Scans API no procesa ninguna página; ejecutar auditoría manual/automatizada alternativa de páginas críticas y repetir scan cuando Wix permita. | 121/121 fallidas y 0 procesadas no es resultado WCAG limpio. |
| [#173](https://github.com/nachoortegazgz/marianmadridz/issues/173) | **VIGENTE — P2** | Inventariar y, si negocio lo requiere, implementar pipeline Capa 3 mínimo; verificar Power Automate/SharePoint con IDs, permisos, snapshots, hash e idempotencia. | No afirmar que existe automatización no versionada. SharePoint solo evidencia; nunca escribe en Capa 1. |
| [#237](https://github.com/nachoortegazgz/marianmadridz/issues/237) | **IMPLEMENTACIÓN SUPERSEDED; QA nativo pendiente** | La retirada del inventario personalizado está completada en código según el estado consolidado. Solo queda comprobar en Runtime que Stores nativo gestiona stock/reservas/reposición sin writers custom activos y que los webhooks no fallan. | No borrar históricos ni colecciones legacy por higiene; validar consumidores antes de cualquier retirada física. |
| [#159](https://github.com/nachoortegazgz/marianmadridz/issues/159) | **PARCIAL — P2** | Emisión idempotente de display-token integrada; falta prueba de consumo concurrente en Wix Runtime y auditoría de consumidores no versionados/externos. | No crear consumidores o credenciales nuevas como parte del cierre. |
| [#164](https://github.com/nachoortegazgz/marianmadridz/issues/164) | **PARCIAL — P2** | Validación `MessageEvent.source` y origen confiable integrada; falta prueba real de navegador/Preview, incluyendo iframe hermano del mismo origen. | No relajar allowlist ni usar wildcard. |
| [#291](https://github.com/nachoortegazgz/marianmadridz/issues/291) | **PARCIAL — P2** | Validación de `controlType` persistido y borrado condicional integrados; falta confirmar semántica de operación en Wix Runtime. | No incluir ledgers ni WEBHOOK_EVENT en allowlist de borrado. |
| [#442](https://github.com/nachoortegazgz/marianmadridz/issues/442) | **VIGENTE como proceso** | Mantener revisión incremental del backlog tras hitos y antes del release. Esta revisión constituye el inventario inicial reconciliado; registrar futuras revisiones con SHA y evidencia. | No cerrar por haber realizado una única auditoría. |

## 3. Tareas retiradas del backlog activo

1. **Migración de TPV desde colecciones `TPV_QA_*` (#435):** ya no es un trabajo de implementación vigente. PR #516 sustituyó el repositorio antiguo y PR #533 consolidó nombres/contratos neutrales y append-only. No crear ni migrar colecciones QA. Las pruebas Sandbox/E2E siguen activas en F2 y #434.
2. **Retirada de inventario custom (#237):** la retirada de código está completada; queda únicamente aceptación runtime del comportamiento nativo Stores. No mantener como tarea de refactorización.
3. **Implementación de claims atómicos (#290), guard POS (#441), token idempotente (#159), validación de origen del widget (#164), borrado condicional (#291) y lock compartido de CajaActual (#525):** el código correspondiente ya está integrado. No reimplementar ni duplicar esos cambios; solo ejecutar las validaciones runtime pendientes indicadas.
4. **TPV PR #495:** excluida de ejecución y actualización por instrucción expresa del propietario. Se conserva intacta como referencia histórica; no rebase, cherry-pick, cierre ni merge. No es una tarea vigente ni una fuente de código para `main`.

## 4. Orden de ejecución recomendado

1. **F0 — Seguridad y control de efectos:** confirmar estado de siete automatizaciones PREINSTALLED y rutas custom de reservas; mantener contención 94/94. No iniciar E2E con efectos externos no clasificados.
2. **F1 — Integridad P0:** resolver #416 solo mediante conciliación documental y evidencia externa; validar runtime del lock #525; conservar todos los registros históricos.
3. **F2 — TPV Sandbox:** verificar SHA en Editor, toggle Sandbox, caja y seis identidades desde CMS Sandbox; comprobar aislamiento con lectura antes/después; después ejecutar idempotencia, payload conflictivo, reintentos, concurrencia, venta/devolución/X/Z. No tocar Online.
4. **F3 — Bookings y área privada:** resolver #523, validar #522 para servicios internos, y ejecutar #162/#188 solo en ventana controlada.
5. **F4/F5 — Stores y fiscalidad:** comprobar inventario nativo (#237 residual), POS guard (#441), SIF/VERI*FACTU (#209/#415) y snapshot de gestoría (#223). No activar writers fiscales.
6. **F6/F7 — Webhooks, Capa 3 y calidad:** completar runtime de #290/#159/#164/#291, pipeline #173 y accesibilidad #521.
7. **Gobierno/release:** proteger main (#210), mantener auditoría continua (#442) y no cambiar NO-GO de #434 hasta satisfacer todos los gates.

## 5. Baseline de Git y PR

- `main` HEAD verificado: `30a0c7a7cfb5629d939391c029d00db57bbe7ee5`.
- CI post-merge en ese SHA: workflow de Layer 1/2, regresión offline, contratos SDK y lint SUCCESS (run [45082870340](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45082870340)); Gitleaks full-history SUCCESS (run [45082870366](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45082870366)).
- La CI anterior es offline/estática; no demuestra Wix Runtime, sincronización Editor, CMS Sandbox, permisos efectivos ni E2E.
- PR #495 continúa abierta, divergente y no mergeable; está excluida por instrucción del propietario. No se ha modificado.
- No se ha escrito en Wix CMS ni se ha desplegado código durante esta revisión.

## 6. Decisión

**Backlog depurado a requisitos vigentes y validaciones pendientes.** Se eliminan de la ruta activa las migraciones y refactorizaciones ya sustituidas; se conservan los gates runtime, fiscales, de seguridad y de integridad que aún no tienen evidencia de aceptación. El release permanece **NO-GO**.
