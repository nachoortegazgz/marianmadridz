# Estado operativo — Marian Madrid

**Corte de verificación:** 2026-11-23  
**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Release:** **NO-GO**. No autorizado publicar, operar comercialmente ni activar pagos/writers fiscales.

## Estado ejecutivo

| Área | Estado verificado | Límite |
|---|---|---|
| Código TPV / contratos | Integrados en main por PR #543 | Aceptación Wix Runtime/E2E pendiente. |
| CI de estabilización documental | La versión previa de PR #545 pasó en HEAD `c1e2cc086c5954b39b91ba7072d0fb5ab1b75ded` | Backend run [45111242142](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45111242142); Gitleaks run [45111242155](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45111242155). La consolidación posterior debe validarse en el HEAD más reciente de la PR. |
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
- Estabilización y actualización de estado en PR #545; una versión previa de la rama superó ambos workflows. Los checks del último commit se consultan en la PR.
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