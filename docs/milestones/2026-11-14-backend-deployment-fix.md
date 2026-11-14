# Hito — corrección de errores de deployment backend

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

## Resultado de CI de PR #373

- Gitleaks full-history: PASS.
- Layer 1: FAIL.
- Causa bloqueante adicional: `data.js` importaba `assertMapaStaffRecord`, pero `validation.js` no exportaba ese símbolo. La suite offline mostró el fallo de carga en múltiples suites.
- Segundo fallo independiente: `unit.ssot.v5011.test.mjs` esperaba solo `ABIERTA/CERRADA`, aunque `internalConfig.js` incluye también `SIMULACION` como sentinel explícito del banco QA.
- Los gates posteriores de Layer 2 no llegaron a ejecutarse por el fallo de Layer 1. Los contratos SDK se ejecutaron y pasaron; ESLint se lanzó, pero el job ya estaba en estado fallido.

**Conclusión:** la PR #373 fue fusionada, pero no superó CI. No se certifica como hito validado.

## Corrección posterior

Rama: `fix/ci-regression-and-milestone-2026-11-14`.

Cambios:
1. Recuperar el export `assertMapaStaffRecord` que sigue siendo consumidor activo en los hooks de `data.js`.
2. Validar las identidades Wix obligatorias `staffMemberId`, `resourceId`, `scheduleId`; validar `memberId` si se proporciona; mantener `thirdPartyId` como TEXT opaco, no como GUID ni FK fiscal; validar tipos de `active` y `schemaVersion`.
3. Añadir pruebas unitarias del contrato.
4. Actualizar la aserción del enum para reconocer `SIMULACION` como sentinel QA sin confundirlo con los estados productivos.
5. Registrar el incidente y el estado de validación en el estado del proyecto, el registro de decisiones y el log QA.

## Límites y riesgos pendientes

- La validación de esta rama depende del CI completo; hasta PASS el hito sigue abierto.
- Existe una discrepancia documental entre el addendum del diccionario que describe MapaStaff consolidado (42 campos) y el baseline/código de `main` que describen MapaStaff separado de DatosFiscales. No se infiere cuál está desplegado ni se migra el contrato con esta corrección.
- Wix Runtime/E2E permanece `BLOCKED_ENVIRONMENT`: el conector no resuelve el Site ID QA en esta sesión.
- No se han realizado escrituras CMS, pagos, cambios de permisos, publicación ni despliegue. Producción queda fuera del alcance.

## Criterio de cierre

El hito solo podrá marcarse **CERRADO — CI PASS** cuando la PR correctiva supere Layer 1, Layer 2, regresión completa, contratos SDK, ESLint y Gitleaks en el mismo SHA. El deployment Wix QA debe verificarse después, cuando exista acceso al contexto QA. CI offline PASS no equivale a runtime Wix validado.
