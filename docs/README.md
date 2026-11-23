# Índice documental y reglas de vigencia

**Corte de reorganización:** 2026-11-23  
**Repositorio:** nachoortegazgz/marianmadridz

Este índice evita que informes históricos, handoffs y resúmenes duplicados se interpreten como fuentes operativas simultáneas.

## Jerarquía de autoridad documental

| Orden | Documento | Autoridad y uso |
|---|---|---|
| 1 | [PROJECT-STATUS.md](PROJECT-STATUS.md) | Único resumen operativo del estado, evidencias, riesgos y release gate vigente. |
| 2 | [MASTER-EXECUTION-PLAN.md](MASTER-EXECUTION-PLAN.md) | Plan, prioridades, secuencia y criterios de aceptación. No duplica el detalle del backlog. |
| 3 | [PROJECT-KNOWLEDGE-BASE.md](PROJECT-KNOWLEDGE-BASE.md) | Base consolidada de contexto, arquitectura, invariantes, contradicciones resueltas y mapa de trabajo. No sustituye el estado live, la directriz del propietario ni las fuentes especializadas. |
| 4 | [PROJECT-OWNER-DIRECTIVE-2026-11-20.md](PROJECT-OWNER-DIRECTIVE-2026-11-20.md) | Requisitos/objetivos expresos del propietario y precedencia de decisiones. |
| 5 | [qa/BACKLOG-RECONCILIATION-2026-11-23.md](qa/BACKLOG-RECONCILIATION-2026-11-23.md) | Estado GitHub de issues y acciones siguientes. Revalidar issues antes de actuar. |
| 6 | [TPV acceptance matrix](qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md) | Contratos y pruebas de aceptación funcional TPV. |
| 7 | [QA Environment SSOT](qa/QA-ENVIRONMENT-SSOT.md) | Clasificación funcional y reglas del entorno QA; no demuestra aislamiento Runtime. |
| 8 | [DOSSIER TÉCNICO CONSOLIDADO](../DOSSIER%20T%C3%89CNICO%20CONSOLIDADO.md) | Arquitectura, decisiones y contexto consolidado según sus cortes y addenda; no es fuente de estado live. |
| 9 | [DECISION-LOG](DECISION-LOG.md), [estándares](engineering/DEVELOPMENT-STANDARDS.md), [referencias CMS](reference/DICCIONARIO_DATOS_CMS.md) y [flujos](reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md) | Decisiones, normas técnicas, esquemas y flujos. Consultar con sus límites de fecha/entorno. |

La precedencia entre requisitos del propietario, normativa y documentación oficial Wix se define en `PROJECT-OWNER-DIRECTIVE-2026-11-20.md`. La tabla anterior organiza la navegación documental; no cambia esa precedencia.

## Reglas de vigencia

- Un documento de estado operativo no debe mantener copias de la tabla de issues ni repetir resultados CI completos; enlaza a la fuente especializada.
- Cada resultado CI debe identificar workflow run y SHA. El resultado de otro SHA no se traslada automáticamente.
- Un read-back de Wix Site Context describe el instante consultado; no demuestra el SHA ejecutado, Preview, Runtime, CMS ni ausencia de efectos.
- Las issues conservan el historial de sus hallazgos. Cuando una lectura actual contradiga una descripción antigua, registrar fecha y fuente sin reescribir la historia.
- Los documentos fechados de `audits/`, `qa/`, `milestones/` y `architecture/` son evidencia histórica/especializada, no snapshots live por defecto.
- No eliminar auditorías, snapshots CMS, fixtures o decisiones por antigüedad. Eliminar solo duplicados demostrados y después de revisar referencias y valor probatorio.
- Los handoffs de sesión son notas de relevo; no son SSOT ni sustituyen el plan, el estado o la matriz de aceptación.
- La base de conocimiento consolida contexto y resuelve precedencias documentales, pero no reemplaza una comprobación actual de código, Wix, CMS, integraciones o normativa.

## Documentos operativos vigentes

- [Estado del proyecto](PROJECT-STATUS.md)
- [Plan maestro](MASTER-EXECUTION-PLAN.md)
- [Base de conocimiento del proyecto](PROJECT-KNOWLEDGE-BASE.md)
- [Directriz del propietario](PROJECT-OWNER-DIRECTIVE-2026-11-20.md)
- [Backlog reconciliado](qa/BACKLOG-RECONCILIATION-2026-11-23.md)
- [Aceptación TPV](qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md)
- [Auditoría Wix de contexto TPV](qa/2026-11-23-tpv-wix-audit-validation.md)
- [Handoff resumido](qa/2026-11-23-tpv-session-handoff.md)
- [Backend TPV](../src/backend/tpv/README.md)

## Histórico que se conserva

Las auditorías, ADR, snapshots, runbooks y reportes fechados siguen disponibles en sus carpetas originales para preservar trazabilidad. Si su conclusión ha sido reemplazada, debe constar como histórica/supersedida y enlazar a la fuente vigente; no se deben usar para inferir el estado actual.
