# Estado consolidado del proyecto y plan de cierre

Fecha de corte: 2026-11-20  
Repositorio: `nachoortegazgz/marianmadridz`  
Rama: `main`  
Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`  
Último SHA verificado: `7672bac4b4207ba87c9688fa34f38752a253ae86`

## 1. Dictamen ejecutivo

**NO-GO para producción comercial.** La calidad offline del backend ha avanzado, pero siguen abiertos bloqueos fiscales, de conciliación, de seguridad de integración y de validación Wix Runtime. No se debe publicar ni habilitar writers económicos/fiscales/contables por el mero hecho de que CI esté verde.

El propietario declaró que el sitio está en desarrollo y que los registros fiscales/contables son sintéticos y editables, con reset previo a producción. Esta declaración permite diseñar pruebas controladas, pero no convierte una colección LIVE en Sandbox ni autoriza pagos reales, remisiones AEAT o efectos externos.

## 2. Estado verificado del repositorio

- `main` apunta a `7672bac4b4207ba87c9688fa34f38752a253ae86`.\n- PR #453 integrada: consolidación documental (`9aa92a9ef7408ab9b431694463ca1ffe2dedacfa`).\n- PR #454 integrada: auditoría de productores y bypasses CMS (`06766afbcdf7f8d32d34ccbb3f1ff68a242f8bca`).\n- PR #455 integrada: validación central de `PaquetesGestoria` (`7672bac4b4207ba87c9688fa34f38752a253ae86`).
- PR #450 integrada: `11e6cefd838cfd8f18301ddff534e2edd8849743`.
- PR #451 integrada: `bdbdb2467294c781bfc090cd8429d7c060413d15`.
- PR #452 integrada: `5cfbecd6849c56d162f0d20a11b620eb2bea0c54`.
- PR #452 workflow #44667244690: completed / success sobre head `940a6cf9fadb85ed414963eff2cfd1b28c82ed67`; job agregado de Layer 1/2, regresión offline, contratos SDK y lint: SUCCESS.
- No se encontraron PR abiertas en la consulta posterior a PR #455.
- La rama `main` continúa sin protección: API de branch devuelve `protected=false`, `protection.enabled=false`, checks obligatorios desactivados. La integración no dispone de permiso administrativo para corregirlo.
- La consulta de status checks del merge SHA no devolvió statuses asociados. PR #455 sí superó CI: Layer 1 333/333, Layer 2 266/266, suite offline 688/688, SDK contracts, npm audit (0 advisories), ESLint y secret scanning SUCCESS. No se declara workflow post-merge.
- No se ha ejecutado Wix Local Editor, Preview ni E2E desde esta sesión. No se declara sincronización local/runtime verificada.

## 3. Hitos integrados

### Seguridad de canal POS — PR #445/#446
- Se corrigió el tratamiento de pedidos POS en el webhook fiscal online.
- El flujo online exige canal WEB verificado; canales distintos requieren revisión manual.
- Queda pendiente la conciliación de las compensaciones históricas asociadas a pedidos 10032 y 10033 (#441/#416).

### Protección de ledger fiscal — PR #447/#448
- Eliminado fallback SIF no verificado.
- Configuración fiscal fail-closed.
- No existe todavía configuración SIF física completa ni conformidad VERI*FACTU.
- Writers fiscales permanecen deshabilitados.

### Gobierno de workflows — PR #449
- Referencias de upload-artifact fijadas a SHA oficial.
- La protección de main sigue pendiente (#210).

### ControlOperativo — PR #450
- Contrato físico alineado con revisión 93.
- `payload` OBJECT requerido y allowlist de campos físicos.
- Registros históricos terminales preservados; compensaciones pendientes no reintentadas.

### Contratos CMS — PR #451
- Refuerzo de validación/hook para colecciones de negocio.
- Se bloquean rutas de cierre Z sin `recordDomain` y responsable de sistema aprobados.
- No se han habilitado writers.

### Auditoría de productores CMS — PR #454\n- Auditoría estática de ocho colecciones críticas y sus productores, DAL, hooks y rutas de escritura.\n- No se localizó bypass directo activo de `@wix/data` en los módulos backend revisados.\n- `CajaActual` requiere endurecer la política DAL de transiciones; cierre Z sigue bloqueado por `recordDomain`.\n- Informe: [cms-producer-and-bypass-audit](./2026-11-20-cms-producer-and-bypass-audit.md).\n\n### Validación central de PaquetesGestoria — PR #455\n- `assertPaquetesGestoriaRecord` centralizado en `validation.js`, invocado desde DAL y hook.\n- CI PR #455: Layer 1 333/333, Layer 2 266/266, suite offline 688/688; SDK, npm audit, ESLint y secret scanning SUCCESS.\n\n### Ledger contable — PR #452
- Añadido beforeInsert y validación central append-only.
- CI de PR verde; hook Wix Sandbox pendiente.
- Hash validado por formato, no recomputado por el hook.

### Retirada ONLYSTAFF — PR #444
- Página y archivo de interfaz retirados.
- No se borraron colecciones ni registros laborales.
- No equivale a retirar el dominio laboral completo.

### TPV QA — PR #439/#440
- QA migra a `CajaActual` y `MovimientosCaja`, sin colecciones `TPV_QA_*`.
- La ruta QA exige seed Sandbox explícito y metadatos de test-run; no inicializa la caja LIVE.
- E2E TPV Sandbox pendiente (#435).

## 4. Bloqueos y backlog abierto

La consulta actual identificó 19 issues abiertas. El estado resumido siguiente combina evidencia de código y runtime documentada; cada issue debe revalidarse antes de cerrarse.

| Issue | Prioridad | Estado / acción |
|---|---|---|
| #434 | P0 | Gate de predespliegue; mantener NO-GO hasta resolver todos los bloqueos. |
| #209 | P0 | SIF/VERI*FACTU incompleto; requiere definición legal/técnica, esquema, firma y remisión probada. |
| #415 | P0 | Completar maestro fiscal y esquema físico; no inventar CONFIG_SISTEMA. |
| #416 | P0 | Conciliar compensaciones fiscales pendientes y singleton CajaActual antes de writers. |
| #290 | P0 | Verificar claims atómicos y concurrencia en Wix Runtime. |
| #441 | P0 | Código POS corregido; actualizar issue y resolver compensaciones históricas. |
| #159 | P1 | Idempotencia implementada; falta QA Wix concurrente de consumo/removeById. |
| #162 | P1 | Recuperación dual implementada parcialmente; E2E y escenarios inciertos pendientes. |
| #164 | P1 | Validación MessageEvent integrada; navegador/Wix Preview pendiente. |
| #188 | P1 | Área privada cliente requiere E2E autenticado. |
| #210 | P1 | Activar branch protection/ruleset con permisos owner/admin. |
| #211 | P1 | E2E Bookings + Payments + eventos reales de Sandbox. |
| #223 | P1 | Persistir snapshot exacto/versionado antes de enviar paquete Gestoría. |
| #237 | P1 | Verificar que Wix Stores Catalog V3 sea autoridad única de inventario. |
| #261 | P1 | E2E con colaborador CMS_EDITOR; permisos privilegiados verificados, pero rol real no probado. |
| #291 | P1 | Validar conditional bulkRemove y carreras en runtime Wix. |
| #435 | P1 | Ejecutar TPV E2E Sandbox con testRunId. |
| #442 | P1 | Mantener gobierno de backlog; actualizar después de cada hito. |
| #173 | P2 | Verificar Power Automate/SharePoint end-to-end; no afirmar automatización no demostrada. |

## 5. Riesgos estructurales conocidos

1. **Conciliación:** existen tres compensaciones `FISCAL_LEDGER/PENDING_RECOVERY` históricas, incluidos pedidos POS; no reintentar automáticamente.
2. **Caja:** la lectura histórica encontró singleton `CajaActual` ABIERTA y fechas incoherentes; requiere investigación de solo lectura y plan de conciliación.
3. **Fiscalidad:** no existe configuración SIF completa; no habilitar remisión ni leyendas VERI*FACTU.
4. **Permisos:** las colecciones críticas se devolvieron como PRIVILEGED en auditoría posterior; falta demostrar el comportamiento con CMS_EDITOR.
5. **Cierres Z:** `recordDomain` y la identidad de cron no tienen contrato aprobado; ruta debe permanecer fail-closed.
6. **Gestoría:** no enviar hasta persistir el snapshot exacto que se entrega.
7. **Runtime:** CI offline no sustituye Preview, Sandbox, eventos nativos ni pruebas de identidad.
8. **Integración:** `main` sin protección permite integración sin checks obligatorios.
9. **Estado Wix:** existe discrepancia histórica entre Draft/published=false y un informe posterior que indica Published. Confirmar estado real y entorno antes de cualquier escritura.

## 6. Plan de acción mínimo y ordenado

### P0-A — Baseline y control de cambios
1. Mantener el trabajo en ramas y PR; no push directo a main.
2. Configurar branch protection/ruleset mediante owner/admin.
3. Revalidar estado Wix, publicación, entorno Sandbox, permisos y snapshot de esquemas.
4. Confirmar que no existen PR abiertas y reconciliar todas las issues.

### P0-B — Integridad y conciliación
1. Auditoría estática de productores y bypasses CMS completada (PR #454); falta E2E de hooks/permisos en Sandbox y endurecer `CajaActual`.
2. Reconciliar las tres compensaciones pendientes y CajaActual sin reintentos ciegos.
3. Completar prueba de atomicidad/idempotencia de webhooks.
4. Probar beforeInsert/update/remove y permisos en Sandbox con identidad adecuada.
5. Resolver contratos de cierre Z y cron sin introducir valores por defecto no aprobados.

### P0-C — Fiscalidad
1. Aprobar modelo de identidad y configuración SIF.
2. Acordar ampliación del esquema físico MapaStaff.
3. Verificar contrato normativo y técnico vigente con documentación oficial y asesoría competente.
4. Implementar firma/remisión solo con proveedor, certificado y representación válidos.
5. Mantener writers deshabilitados hasta completar pruebas y aprobación.

### P1 — E2E de operaciones
1. Reservas simples/duales, reprogramación y cancelación.
2. Cart V2, pagos Sandbox, refunds y webhooks.
3. TPV, caja, movimientos y cierre sintéticos.
4. Wix Stores e inventario nativo.
5. Área cliente y permisos colaborador.
6. Gestoría: snapshot inmutable, versionado y envío controlado.

### P2 — Capa documental
1. Verificar flujos Power Automate y bibliotecas SharePoint.
2. Probar exportación con documentos sintéticos y trazabilidad de entrega.
3. Confirmar que SharePoint no modifica Wix CMS.

### Release gate
No declarar GO hasta que:
- P0 cerrados con evidencia;
- CI verde y branch protection activa;
- E2E Wix Sandbox completados;
- permisos, secretos y writers auditados;
- conciliación histórica documentada;
- revisión legal/fiscal aplicable completada;
- rollback y reset preproducción ensayados;
- diff y documentación revisados;
- publicación autorizada expresamente.

## 7. Límites de esta consolidación

- Los estados de PR, merge SHA, workflow #44667244690 y branch protection se consultaron directamente en GitHub.
- Los hallazgos CMS y runtime citados proceden de auditorías read-only anteriores documentadas en issues e informes; no se repitieron todas las consultas Wix durante esta actualización.
- No se ejecutó código local, Wix Preview, Wix Sandbox ni operaciones CMS.
- No se habilitó ningún writer, no se enviaron pagos, no se remitieron datos AEAT y no se publicó el sitio.

## 8. Punto de continuación

Siguiente intervención recomendada: **cerrar H-01 de `CajaActual`** definiendo transiciones válidas y endureciendo la frontera DAL sin romper los productores de caja y TPV QA. En paralelo, priorizar la conciliación P0 de las tres compensaciones y CajaActual; después ejecutar pruebas de hooks/permisos en Sandbox. Mantener cierre Z y writers fiscales bloqueados.
