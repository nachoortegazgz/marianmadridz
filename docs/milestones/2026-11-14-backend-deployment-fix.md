# Hito — corrección de errores de deployment backend

**Estado: CERRADO — CI PASS (offline)**

**Fecha:** 2026-11-14  
**Deployment de origen:** `686cb2af-c530-4f89-a9d7-18baa3f9eb0a`  
**Repositorio:** `nachoortegazgz/marianmadridz`

## Objetivo

Resolver los tres errores de análisis Wix:

- `backend/data.js`: `assertCajaActualRecord` no definido en dos hooks.
- `backend/validation.js`: `partial` no definido.

## Primera intervención integrada

PR #373: https://github.com/nachoortegazgz/marianmadridz/pull/373  
Merge en `main`: `1b39ebb22c885f50320b7d52f5bc336cc0570ee5`.

La intervención importó `assertCajaActualRecord`, corrigió su validación de `sequenceCounters` y declaró la opción `partial` del validador fiscal. Añadió pruebas específicas.

## Incidencias detectadas en CI de PR #373

- Gitleaks full-history: PASS.
- Layer 1: FAIL porque `data.js` importaba `assertMapaStaffRecord`, ausente en los exports de `validation.js`.
- La prueba SSOT esperaba solo `ABIERTA/CERRADA`, omitiendo el sentinel QA `SIMULACION`.
- Layer 2 no llegó a ejecutarse en ese workflow.

La fusión de PR #373 no se consideró validación.

## Corrección y validación final

PR correctiva #374: https://github.com/nachoortegazgz/marianmadridz/pull/374  
Rama: `fix/ci-regression-and-milestone-2026-11-14`  
HEAD validado: `da96c1b50f1910a287aea718bc6025d295e30e2b`.  
Merge en `main`: `1de381ecb6495e17a3eae5b75b43e8493166988a`.

Correcciones implementadas:

1. Restaurar el export `assertMapaStaffRecord` consumido por `data.js`.
2. Validar `staffMemberId`, `resourceId`, `scheduleId`; validar `memberId` si se proporciona; mantener `thirdPartyId` como TEXT opaco; comprobar tipos de `active` y `schemaVersion`.
3. Añadir pruebas del contrato MapaStaff.
4. Alinear la prueba de estados de caja con el sentinel QA `SIMULACION`.
5. Hacer que `CONFIG_SISTEMA` rechace `thirdPartyType` no nulo.
6. Registrar evidencia en estado del proyecto, decisiones y log QA.

**Resultado CI sobre el mismo SHA:**

| Gate | Resultado |
|---|---|
| Layer 1 | PASS — 24 suites / 307 tests |
| Layer 2 | PASS — 19 suites / 252 tests |
| Regresión completa | PASS — 70 suites / 644 tests |
| Wix SDK Cart V2 + Data | PASS |
| Wix Order Transactions | PASS |
| Wix Bookings Reader V2 | PASS |
| ESLint | PASS |
| Gitleaks full-history | PASS |

**Conclusión:** PR #374 está integrada en `main`. El CI completo del HEAD de PR pasó; el workflow del merge commit está pendiente de confirmación. El hito de código queda CERRADO — CI PASS (offline), sin equivalencia a runtime Wix.

## Límites y riesgos pendientes

- Wix Runtime/E2E permanece `BLOCKED_ENVIRONMENT`: la conexión no resuelve el Site ID QA en esta sesión.
- El diccionario CMS contiene un addendum que describe MapaStaff consolidado (42 campos), mientras que el baseline y el código activo mantienen el contrato separado MapaStaff/DatosFiscales. No se infiere cuál está desplegado ni se migra ese contrato con esta corrección.
- No se han realizado escrituras CMS, pagos, cambios de permisos, publicación ni despliegue. Producción queda fuera del alcance.

CI offline PASS acredita las pruebas versionadas y los contratos SDK comprobados; no acredita el runtime Wix ni E2E externo.