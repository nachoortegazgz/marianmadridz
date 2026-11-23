# Estado operativo — Marian Madrid

**Corte de verificación:** 2026-11-23  
**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Integración documental:** PR #545, #546 y #558 fusionadas. Último `main` verificado en `3f02e5bb125fbb20d10d40e614c7c3eb3202b106`.  
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
| TPV | PR #551 y #554 fusionadas; metadatos neutrales y lector de auditoría conectados en código | Falta sincronización Git–Wix Editor, Preview/Runtime, permisos efectivos, idempotencia y concurrencia real. |
| CMS / ledgers | Inspección solo lectura 2026-11-23: CajaActual 1 ABIERTA; MovimientosCaja 2; CitasF2 6; MapaStaff 5; HistoricoCierresZ 0; LibroAsientosContablesDetalle 0 | No mutar CajaActual ni ledgers; investigar sesión abierta y reconciliar reservas sin alterar reservas nativas. |
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
5. [#523 / #522 Reservas](https://github.com/nachoortegazgz/marianmadridz/issues/523): seis proyecciones CitasF2 pendientes de reconciliación y una reserva nativa sin proyección; comparar con Bookings sin modificar reservas nativas.
6. [#209 SIF/Veri*Factu](https://github.com/nachoortegazgz/marianmadridz/issues/209): validación legal/técnica con AEAT, asesoría y proveedor.
7. [#210 Protección de main](https://github.com/nachoortegazgz/marianmadridz/issues/210): ruleset y checks requeridos mediante administrador.
8. [#434 Release readiness](https://github.com/nachoortegazgz/marianmadridz/issues/434): conservar NO-GO hasta cierre de los gates.

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
- [Índice y jerarquía documental](README.md)
- [README backend TPV](../src/backend/tpv/README.md)
## Evidencia CMS solo lectura — 2026-11-23

- `CajaActual`: singleton `ABIERTA`, `openedAt=2026-11-21T08:12:21.994Z`, `closedAt=null`, `snapshotSource=MOVIMIENTOS_CAJA_RECONCILIADOS`, `conceptOperations={}` y `traceId=0`; `lastOperationType=RECONCILIATION_CORRECTION`. No se ejecutaron escrituras ni cierres.
- `MovimientosCaja`: 2 filas; ambas `synthetic=true`, `status=SIMULATED_SUCCESS` y `reconciliationStatus=RECONCILED`, con orígenes `TPV_SIMULATED_GATEWAY` y `TPV_FUNCTIONAL_TEST`. La presencia de `gatewayResponse` no demuestra llamada real a pasarela.
- `CitasF2`: 6 proyecciones; 5 `CONFIRMED`, 1 `PENDING`; 3 sin `pairToken`, 2 comparten token y 1 tiene token distinto. La auditoría consolidada previa registró los seis bookings nativos como `CANCELED`; no se repitió aquí esa consulta para respetar la frontera contractual TPV. [Evidencia detallada](qa/../audits/2026-11-23-repository-wix-cms-reconciliation.md#5-conciliación-bookings-v2-y-citasf2).
- `MapaStaff`: 5 registros, 3 `STAFF`; no existe `recordType=CONFIG_SISTEMA`. No se consultaron ni expusieron NIF.
- `HistoricoCierresZ` y `LibroAsientosContablesDetalle`: 0 registros.
- Todas las lecturas CMS se ejecutaron con `consistentRead=true`; no hubo mutaciones.
