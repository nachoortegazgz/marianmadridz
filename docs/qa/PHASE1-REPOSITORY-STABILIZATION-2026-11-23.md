# Fase 1 — estabilización del repositorio — 2026-11-23

## Objetivo

Recuperar coherencia entre el código, los contratos de test y la documentación; identificar los gates de gobierno del repositorio y dejar una PR acotada para validar la corrección sin modificar main directamente.

## Diagnóstico verificado

- main HEAD: 0ba7b684d6f4d6465718ae4317d10d8f422de2ff.
- PR #541, #540, #542 y #543 están integradas en main. PR #537 quedó preservada en el historial de #541. PR #543 produjo el HEAD actual 0ba7b684d6f4d6465718ae4317d10d8f422de2ff.
- Backend offline quality gates falla en run 45105979742 sobre main.
- Secret scanning termina SUCCESS en run 45105979748.
- El fallo se localiza en src/backend/tests/tpv.native-reconciliation.contract.test.mjs. La aserción esperaba cuatro medios de pago, pero internalConfig.js define seis valores en TPV_PAYMENT_METHOD y tpvValidation.js obtiene Object.values(TPV_PAYMENT_METHOD).
- tpvCierresCore.js clasifica BONO y TARJETA_REGALO; tpvDevoluciones.web.js inicializa asignaciones con el enum completo. El fallo es una expectativa de test obsoleta, no evidencia de que deba reducirse el enum.
- La documentación TPV contenía una declaración contraria: decía que BONO y TARJETA_REGALO no estaban implementados. Se ha corregido distinguiendo el registro sintético de una redención/captura de valor real.
- main informa protected=false. Issue #210 permanece abierta; no hay herramienta de administración de branch protection/rulesets disponible en esta integración.

## Cambios preparados

Rama: chore/phase1-repository-stabilization-20261123.

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

**Pendiente:** CI backend completa y secret scanning sobre el HEAD de esta rama; revisión del diff; confirmación de que el único fallo de main desaparece.

## Riesgos y límites

- No se cambia el enum ni se habilita ningún pago real.
- BONO y TARJETA_REGALO siguen siendo métodos sintéticos; no se acredita consumo de saldo Wix Gift Cards ni contabilidad de pasivo.
- No se modifica main directamente desde PR #543.
- No se modifica CMS, Wix Editor, automatizaciones, reservas, pagos, fiscalidad ni datos.
- main continúa sin protección efectiva hasta que un administrador resuelva #210.

## Criterio de cierre de Fase 1

La fase quedará cerrada cuando:
1. CI backend y secret scanning terminan SUCCESS sobre la PR. **Cumplido** antes del merge (run 45106697984 y 45106698016). Post-merge backend SUCCESS, run 45107058637 (736/736); secret scanning SUCCESS, run 45107058755.
2. El diff se limita a test y documentación; sin cambios de runtime ni CMS. **Cumplido**: nueve archivos.
3. La PR se integre sin bypass de checks. **Cumplido**: PR #543 integrada después de CI verde.
4. Un administrador habilite protección de main y required checks, o documente una excepción temporal aprobada. **Pendiente**: issue #210 abierta; main protected=false.

La Fase 1 está **COMPLETADA EN CÓDIGO Y DOCUMENTACIÓN**. Queda pendiente la protección administrativa de main (#210) y el resultado final de CI post-merge. Esto no habilita release ni producción.
