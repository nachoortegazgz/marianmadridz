# Hito QA — fixtures offline alineadas; aislamiento Runtime pendiente

**Fecha de corte:** 2026-11-14  
**Entorno:** 188bed94-177c-4bc9-a9f0-35080d874f3e  
**Repositorio:** nachoortegazgz/marianmadridz

## Hito completado — alineación de fixtures sintéticas

- PR #379 integrada en main.
- Merge commit: 27348a20bfb913fde43761d4c92dd46526a5e470.
- Site ID central de fixtures actualizado a la SSOT QA.
- Cliente sintético principal: Nacho Pitt; email fixture reservado nacho.pitt@example.test.
- Simuladores TPV, PSP y email sink comprueban el Site ID canónico exacto y fallan cerrados ante el ID supersedido.
- Ningún módulo runtime, CMS, ledger o configuración Wix fue modificado.

### Validación CI

Sobre el HEAD de PR ecdf16444057d8100d89991b68b1711022bfb71a:
- Layer 1: 24 suites / 307 tests PASS.
- Layer 2: 19 suites / 252 tests PASS.
- Regresión completa: 70 suites / 644 tests PASS.
- Wix SDK Cart V2, Order Transactions y Bookings Reader V2: PASS.
- ESLint: PASS.
- Secret scanning: PASS.

El CI valida los tests del repositorio, no Wix Runtime ni E2E externo.

## Próximo hito — aislamiento de efectos externos Wix

**BLOCKED_EXTERNAL_SIDE_EFFECTS**

La auditoría read-only de Wix Automations V2 devolvió 150 automatizaciones, con 10 activas y 140 inactivas. Las diez activas son preinstaladas y todas tienen al menos una restricción readonly o disableStatusChange; no se pueden desactivar por API sin vulnerar el lock. Varias ejecutan acciones de email o notificación.

Evidencia: docs/audits/2026-11-14-qa-automations-isolation.md.

### Criterios de aceptación

1. Las diez automatizaciones activas están desactivadas mediante mecanismo soportado por Wix/proveedor, o existe aislamiento QA equivalente documentado y probado.
2. Relectura read-only confirma el nuevo estado para los mismos IDs.
3. No existe camino de prueba que pueda emitir comunicaciones, cobros, efectos fiscales o escrituras fuera del alcance QA.
4. Los tests offline siguen verdes.
5. Runtime/E2E solo después de demostrar los cuatro criterios anteriores.

### Decisión operativa

No sortear locks, no desinstalar aplicaciones ni alterar automatizaciones preinstaladas a ciegas. Mantener pruebas offline/mock y auditorías read-only. Solicitar a Wix/proveedor el procedimiento soportado para neutralizar las automatizaciones bloqueadas. No declarar el entorno apto para Runtime/E2E hasta que exista evidencia verificable.


## Actualización de estado — 2026-11-14

### Evidencia CI y revalidación

- PR #381 (diagnóstico de suite manager email sink) integrada en main: 1c4f9c3322f323bc32012c8c042eb2c47aaaed44. Workflow 43627893841: completed/success; gates Layer 1, Layer 2, regresión offline, contratos SDK y ESLint en verde.
- PR #380 (auditoría de automatizaciones) integrada en main: e2150647e6203b5c964a0d414c5b0a5295a374fe. Secret scanning y Backend offline quality gates: success.
- Relectura Wix Automations V2: 150 automatizaciones; 10 ACTIVE, 140 INACTIVE; las 10 activas son PREINSTALLED y todas bloqueadas por readonly y/o disableStatusChange.
- Wix documenta que se debe detener cualquier desactivación API ante cualquiera de esos locks. No se realizaron escrituras.

### Hito siguiente

**CI/documentación QA: CERRADO. Aislamiento Wix Runtime/E2E: BLOQUEADO.** No iniciar Runtime/E2E que pueda disparar los diez triggers. Mantener offline/mock y read-only. La siguiente acción habilitante es obtener de Wix o de las apps propietarias un procedimiento soportado para neutralizar esas automatizaciones o un aislamiento QA equivalente, y volver a verificarlo por lectura.
