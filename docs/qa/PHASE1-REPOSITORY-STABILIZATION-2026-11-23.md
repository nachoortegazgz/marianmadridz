# Fase 1 — estabilización del repositorio — 2026-11-23

## Objetivo

Recuperar coherencia entre código, contratos de test y documentación; validar la corrección mediante PR y dejar identificados los controles de gobierno pendientes.

## Diagnóstico verificado

- main HEAD actual: ccdac0347e86f430c4f8086765815d9d5d7e00af.
- PR #541, #540, #542 y #543 están integradas; PR #544 actualizó documentación y produjo el HEAD actual. PR #537 quedó preservada en el historial de #541.
- Backend offline quality gates SUCCESS en el HEAD actual, run 45107377657: Layer 1 364/364, Layer 2 255/255, suite offline 736/736, npm audit 0, contratos Wix SDK/eCommerce/TPV y ESLint.
- Gitleaks full-history SUCCESS en run 45107377700.
- Los runs 45105979742/45105979748 y 45106697984/45106698016 son históricos; el fallo de aserciones se corrigió en PR #543. Los workflows actuales están referenciados arriba.
- El fallo se localiza en src/backend/tests/tpv.native-reconciliation.contract.test.mjs. La aserción esperaba cuatro medios de pago, pero internalConfig.js define seis valores en TPV_PAYMENT_METHOD y tpvValidation.js obtiene Object.values(TPV_PAYMENT_METHOD).
- tpvCierresCore.js clasifica BONO y TARJETA_REGALO; tpvDevoluciones.web.js inicializa asignaciones con el enum completo. El fallo es una expectativa de test obsoleta, no evidencia de que deba reducirse el enum.
- La documentación TPV contenía una declaración contraria: decía que BONO y TARJETA_REGALO no estaban implementados. Se ha corregido distinguiendo el registro sintético de una redención/captura de valor real.
- main informa protected=false. Issue #210 permanece abierta; no hay herramienta de administración de branch protection/rulesets disponible en esta integración.

## Cambios integrados

PR #543 integró la corrección de test y documentación técnica; PR #544 consolidó la actualización final de documentación. Ambas están merged en main.

1. Test TPV: sustituye la expectativa hard-coded de cuatro métodos por comprobaciones del enum canónico de seis valores, clasificación del resumen y asignación de devoluciones.
2. Matriz de aceptación TPV: actualiza la base a main actual y documenta el límite de BONO/TARJETA_REGALO.
3. MASTER-EXECUTION-PLAN: sustituye el baseline obsoleto por el estado actual, prioridades, secuencia y gates.
4. PROJECT-STATUS: elimina snapshots contradictorios del resumen ejecutivo y conserva los enlaces a auditorías especializadas.
5. BACKLOG-RECONCILIATION: actualiza el orden de prioridades y separa issues abiertas, cerradas y pruebas Runtime.
6. Relevo TPV y auditoría Wix TPV: retiran afirmaciones obsoletas de PR abierta/main intacta y reflejan la integración actual.
7. README TPV: elimina snapshots de CI/PR incompatibles y conserva contrato, límites de seguridad y aceptación pendiente.

## Archivos modificados

- src/backend/tests/tpv.native-reconciliation.contract.test.mjs
- docs/MASTER-EXECUTION-PLAN.md
- docs/PROJECT-STATUS.md
- docs/qa/BACKLOG-RECONCILIATION-2026-11-23.md
- docs/qa/2026-11-23-tpv-session-handoff.md
- docs/qa/2026-11-23-tpv-wix-audit-validation.md
- docs/qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md
- src/backend/tpv/README.md

## Validación

**Verificado en GitHub:** estado de main, PR #537/#540/#541, workflow fallido y secret scanning, test y contratos actuales, estado de protección de main.

**No ejecutado localmente:** no se dispone en esta sesión de un checkout/runtime de Node para ejecutar npm test o la suite Vitest de forma local. La validación automatizada debe proceder del workflow de GitHub disparado por la PR.

**Verificado:** CI del HEAD actual de main y secret scanning full-history SUCCESS. La prueba TPV ya no falla. No se ejecutó npm test localmente; la evidencia de suite procede del workflow GitHub.

## Riesgos y límites

- No se cambia el enum ni se habilita ningún pago real.
- BONO y TARJETA_REGALO siguen siendo métodos sintéticos; no se acredita consumo de saldo Wix Gift Cards ni contabilidad de pasivo.
- Los cambios se integraron mediante PR #543 y #544; no se realizaron pushes directos a main durante la estabilización.
- No se modifica CMS, Wix Editor, automatizaciones, reservas, pagos, fiscalidad ni datos.
- main continúa sin protección efectiva hasta que un administrador resuelva #210.
- Read-back directo de Wix Site Context (2026-11-23) confirma **Draft**, Wix Editor, Velo Enabled, plan Premium y dominio personalizado. Las referencias Published de #520/#526 son evidencia histórica y no describen el estado actual devuelto por Wix. No se ha publicado ni modificado el sitio.

## Criterio de cierre de Fase 1

La fase quedará cerrada cuando:
1. CI backend y secret scanning terminan SUCCESS sobre main actual. **Cumplido**: run 45107377657 (736/736, npm audit 0, SDK contracts, ESLint) y Gitleaks full-history run 45107377700.
2. El diff de PR #543/#544 se limita a test y documentación; sin cambios de runtime ni CMS. **Cumplido**.
3. Las PR se integren sin bypass de checks. **Cumplido**: PR #543 y #544 integradas tras CI verde.
4. Un administrador habilite protección de main y required checks, o documente una excepción temporal aprobada. **Pendiente**: issue #210 abierta; main protected=false.

La Fase 1 está **COMPLETADA EN CÓDIGO, PRUEBAS AUTOMATIZADAS Y DOCUMENTACIÓN**. Queda pendiente únicamente el gate administrativo de protección de main (#210). Esto no habilita release ni producción.
