# TPV QA — decisión de persistencia en Sandbox y límite del ledger

- **Fecha:** 2026-11-20
- **Estado:** DECISIÓN TÉCNICA — migración de persistencia bloqueada hasta rediseñar el modo QA
- **Baseline:** `main` en `106ec754f84c319da34623a3c55ba5585a9f993f`
- **Issue:** #435
- **Alcance:** TPV HTML, Velo backend, Wix CMS Sandbox/Live
- **Tipo de revisión:** estática del repositorio + metadatos CMS live + documentación oficial Wix. No se ejecutó Preview ni se escribieron datos.

## 1. Decisión ejecutiva

**No se debe sustituir mecánicamente `TPV_QA_*` por `CajaActual` y `MovimientosCaja`.** El diseño actual de TPV QA depende de nueve colecciones separadas y almacena sesiones, ventas, líneas, pagos, reembolsos, movimientos de efectivo, tickets y auditoría. Esas colecciones ya no existen en CMS.

Las dos colecciones destino no son equivalentes:
- `CajaActual` es un singleton mutable que representa el estado/proyección de caja y contiene además los contadores de secuencia fiscal. No es un repositorio de ventas, pagos, sesiones QA ni tickets.
- `MovimientosCaja` es el ledger append-only fiscal. Sus registros requieren secuencia, hash/cadena, identidad de transacción, campos fiscales y trazabilidad. No es un almacén genérico de movimientos sintéticos.
- La proyección `CajaActual` debe derivarse de movimientos canónicos persistidos por el writer/proyector autorizado; no se puede actualizar desde el widget ni por una ruta QA paralela.
- `ControlOperativo` se reserva para locks, claims e idempotencia; no debe almacenar ventas o tickets.

Por tanto, **se rechaza la migración de los registros sintéticos QA a esas dos colecciones** mientras el objetivo sea mantener intactos los ledgers y las garantías fiscales. La migración mecánica introduciría datos que no cumplen el contrato fiscal o rompería la proyección de caja.

## 2. Evidencia del repositorio

Baseline `106ec754...`:
- `src/backend/internalConfig.js` declara nueve IDs `TPV_QA_*`.
- `src/backend/tpv/tpvQaRepository.js` limita expresamente la persistencia a esas colecciones mediante `ALLOWED_QA_COLLECTIONS`.
- Consumidores de esos repositorios: `tpvCaja.web.js`, `tpvMovimientos.web.js`, `tpvVentas.web.js`, `tpvDevoluciones.web.js`, `tpvCierres.web.js`, `tpvCierresCore.js`, `tpvAuditoria.web.js` y el controlador/widget TPV.
- `src/backend/cajas.web.js` mantiene la ruta canónica `MovimientosCaja → CajaActual`; `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false` y `ALLOW_SIMULATION_RECORDS=false` permanecen fail-closed.
- `src/backend/fiscalLedgerLock.js` utiliza `CajaActual` para asignar y mantener secuencias fiscales. Sus contadores no deben compartirse con IDs o secuencias de pruebas.
- `docs/architecture/ADR-CASH-REGISTER-SESSION-CONTROL.md` documenta que `CajaActual` es proyección mutable, `MovimientosCaja` ledger append-only y que la fila `SIMULACION` no es saldo operativo.
- `docs/audits/2026-11-14-tpv-contract-gap-audit.md` ya documenta que el writer fiscal está deshabilitado y que la simulación offline existente es un motor en memoria, no persistencia Wix.

## 3. Estado CMS observado

Consulta de metadatos CMS live del 2026-11-20:
- `CajaActual`: colección NATIVE existente, 1 elemento LIVE y 0 SANDBOX en el corte consultado.
- `MovimientosCaja`: colección NATIVE existente, 0 elementos LIVE y 0 SANDBOX.
- Las nueve colecciones `TPV_QA_*` declaradas por el código no existen.
- No se modificaron esquemas, permisos, elementos, datos ni sincronización Sandbox → Live.

La consulta de management API no prueba qué base usa una sesión Preview. La validación del contexto Sandbox debe hacerse desde Wix Editor/Local Editor Preview con Wix Data SDK.

## 4. Límite importante de Wix Sandbox

La documentación oficial Wix distingue:
- Sandbox: copia de colecciones CMS nativas utilizada por Editor/Preview.
- Live: datos utilizados por el sitio publicado.
- Con Sandbox habilitado, las llamadas Wix Data desde Preview operan contra la copia Sandbox y sus cambios persisten en esa copia.
- Excepción crítica: las colecciones de Wix Apps no tienen copia Sandbox; las modificaciones hechas a esas colecciones durante Preview pueden afectar Live.

Fuentes oficiales:
- [Wix — About Testing Your Code in Preview Mode](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/testing-monitoring/testing-troubleshooting/about-testing-your-code-in-preview-mode)
- [Wix — Velo Testing and Debugging](https://dev.wix.com/docs/velo/articles/getting-started/testing-and-debugging)
- [Wix — Sandbox and Live Collections](https://support.wix.com/en/article/cms-about-sandbox-and-live-collections-and-syncing)

Sandbox proporciona aislamiento de datos CMS nativos en Preview; **no convierte un ledger fiscal en un almacén de fixtures ni permite saltarse sus invariantes**. Tampoco se debe confiar en Sandbox para proteger escrituras a colecciones de Wix Apps.

## 5. Diseño objetivo seguro

1. Mantener `MovimientosCaja` exclusivamente para movimientos de negocio válidos, creados por el writer canónico con sus campos fiscales, secuencia, hash, idempotencia y controles aprobados.
2. Mantener `CajaActual` exclusivamente como singleton/proyección de la caja real, derivada del ledger. No insertar ventas, líneas, pagos, reembolsos o tickets dentro de sus campos libres.
3. Mantener `ControlOperativo` exclusivamente para control efímero tipado (locks/claims/idempotencia), no como sustituto de tablas de negocio.
4. Para QA funcional sin persistencia CMS: reutilizar/extender el motor puro en memoria `src/backend/tests/fixtures/qaTpvSimulation.mock.mjs`, y conectar la UI a un adaptador de simulación sin efectos persistentes, sin PSP, stock, Bookings, facturación, AEAT, email/SMS o hardware.
5. Para validar integración de persistencia Wix real, crear un **sitio de pruebas dedicado** con colecciones y datos propios, separado del sitio oficial; no usar el ledger de la web productiva como base de fixtures. Si el requisito exige expresamente cero colecciones QA, no hay actualmente un destino persistente equivalente que cumpla ese requisito.
6. Si el negocio exige persistencia de operaciones sintéticas en este mismo sitio, se necesita una decisión explícita que autorice un modelo de simulación persistente separado y su esquema. Eso contradice el requisito actual de no recrear colecciones QA y no se implementará por inferencia.

## 6. Acciones prohibidas hasta cerrar el diseño

- No reemplazar nombres `TPV_QA_*` por `CajaActual` o `MovimientosCaja` en imports, allowlists o queries.
- No habilitar `LEDGER_WRITES_ENABLED`, `ALLOW_SIMULATION_RECORDS` ni pagos.
- No cambiar el estado de la fila live `CajaActual` `SIMULACION`, ni su saldo/contadores.
- No crear movimientos sintéticos en `MovimientosCaja`.
- No escribir a Wix Stores, Bookings, Gift Cards, Orders, Payments o colecciones nativas de Wix Apps durante Preview.
- No sincronizar Sandbox a Live.
- No borrar ni reescribir datos históricos.

## 7. Plan de cierre

- [x] Confirmar el baseline y los consumidores estáticos de `TPV_QA_COLLECTIONS`.
- [x] Confirmar la semántica arquitectónica de `CajaActual`, `MovimientosCaja` y `ControlOperativo`.
- [x] Contrastar el aislamiento Sandbox/Live con documentación oficial Wix.
- [x] Registrar la decisión de no realizar una migración mecánica.
- [ ] Inspeccionar y probar el motor en memoria existente; definir su contrato de UI y sus pruebas de regresión.
- [ ] Implementar adaptador QA sin persistencia y retirar WebMethods que prometen persistencia no disponible, después de mapear consumidores y mantener compatibilidad del bridge.
- [ ] Ejecutar Preview E2E desde Local Editor con Sandbox habilitado y demostrar que Live permanece intacto.
- [ ] Para persistencia Wix E2E, aprobar y preparar un sitio QA dedicado, con su propia configuración, CMS y secretos de prueba.
- [ ] Mantener el sitio oficial en NO-GO para cobros, devoluciones, emisión fiscal y despliegue TPV hasta completar gates P0/P1.

## 8. Resultado de esta intervención

**Solo documentación.** No se modificó código, CMS, permisos, secretos, pagos, ledger, caja, configuración Wix ni despliegue. Esta decisión evita una migración destructiva y delimita el trabajo siguiente. El informe no declara validado el TPV ni ejecutado Preview.
