# Estado operativo — Marian Madrid

**Corte de verificación:** 2026-11-23  
**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Integración documental:** PR #545 y PR #546 fusionadas en `main`. El SHA actual se consulta en la referencia viva de la rama `main`, no se fija en este resumen para evitar snapshots obsoletos.  
**Release:** **NO-GO**. No autorizado publicar, operar comercialmente ni activar pagos/writers fiscales.

## Estado ejecutivo

| Área | Estado verificado | Límite |
|---|---|---|
| Código TPV / contratos | Integrados en main por PR #543 | Aceptación Wix Runtime/E2E pendiente. |
| CI de estabilización documental | **SUCCESS pre-merge y post-merge** | PR #545: backend [45112082881](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082881), Gitleaks [45112082897](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082897). Post-merge PR #545: backend [45112229859](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229859), Gitleaks [45112229890](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229890). PR #546: backend [45112483802](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112483802), Gitleaks [45112483786](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112483786); post-merge PR #546: backend [45112587480](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112587480), Gitleaks [45112587474](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112587474). |
| Calidad offline | Layer 1 364/364; Layer 2 255/255; suite 736/736; npm audit 0; contratos SDK Wix/eCommerce/TPV y ESLint SUCCESS | No prueba CMS live, Wix Runtime, E2E, fiscalidad ni hardware. |
| Protección de main | No configurada; issue #210 abierta | API devolvió `protected=false`; requiere administrador. |
| Wix Site Context | **Draft**, read-back directo 2026-11-23 | Wix Editor, Velo habilitado, Premium, dominio personalizado, EUR, Europe/Madrid. No demuestra SHA sincronizado ni Runtime. |
| Apps Wix observadas | Bookings, Forms & Payments, Gift Cards, Payments, Stores Catalog V3, Invoices V1, Members Area, Blog y Promote SEO | Instalación observada; no equivale a aceptación funcional de cada app. |
| TPV | Código y pruebas estáticas integrados | Roles, Staff resource mapping, concurrencia, CMS y flujos E2E pendientes. |
| CMS / ledgers | No aceptado para operación | CajaActual y compensaciones siguen siendo bloqueos P0. |
| Automatizaciones | Ocho ACTIVE según auditoría de issue #520 | Una APPLICATION y siete PREINSTALLED; falta inspección de historial/tarea y contención soportada. |
| Fiscalidad / Veri*Factu | Bloqueado | No activar writers, firma, QR, emisión ni remisión. |
| Capa 3 | Pendiente | SharePoint solo evidencia; no gobierna Capa 1. |

## Qué está completado

- Corrección de aserciones TPV desactualizadas mediante PR #543.
- Consolidación documental previa en PR #544.
- Estabilización documental consolidada mediante PR #545 y trazabilidad post-merge corregida por PR #546; ambas fusionadas en main con CI pre-merge y post-merge SUCCESS.
- Read-back Wix Site Context actual que devuelve Draft; la lectura resuelve el estado en el momento consultado, no la sincronización del código.

## Bloqueos prioritarios

1. [#525 CajaActual](https://github.com/nachoortegazgz/marianmadridz/issues/525): serialización/CAS compartido para todos los writers.
2. [#416 Compensaciones](https://github.com/nachoortegazgz/marianmadridz/issues/416): reconciliar registros pendientes con evidencia original.
3. [#415 Maestro fiscal](https://github.com/nachoortegazgz/marianmadridz/issues/415): alinear MapaStaff, esquema físico y consumidores.
4. [#520 Automatizaciones](https://github.com/nachoortegazgz/marianmadridz/issues/520): inspeccionar y contener ocho automatizaciones ACTIVE por vías soportadas.
5. [#209 SIF/Veri*Factu](https://github.com/nachoortegazgz/marianmadridz/issues/209): validación legal/técnica con AEAT, asesoría y proveedor.
6. [#210 Protección de main](https://github.com/nachoortegazgz/marianmadridz/issues/210): ruleset y checks requeridos mediante administrador.
7. [#434 Release readiness](https://github.com/nachoortegazgz/marianmadridz/issues/434): conservar NO-GO hasta cierre de los gates.

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