# TPV QA — decisión de persistencia en Sandbox y límite del ledger

- **Fecha:** 2026-11-20
- **Estado:** DECISIÓN TÉCNICA — migración de persistencia bloqueada hasta rediseñar el modo QA
- **Baseline:** `main` en `106ec754f84c319da34623a3c55ba5585a9f993f`
- **Issue:** #435
- **Alcance:** TPV HTML, Velo backend, Wix CMS Sandbox/Live
- **Tipo de revisión:** estática del repositorio + metadatos CMS live + documentación oficial Wix. No se ejecutó Preview ni se escribieron datos.

## 1. Decisión ejecutiva

**No se debe sustituir mecánicamente `TPV_QA_*` por `CajaActual` y `MovimientosCaja`.** La autorización posterior del propietario (20-11-2026) confirma que todos los registros actuales son sintéticos, editables y que el sitio completo se reseteará antes del despliegue real. Esta autorización permite ejecutar pruebas persistentes controladas en las colecciones existentes, pero no justifica saltarse el contrato del ledger ni activar integraciones externas. El diseño actual de TPV QA depende de nueve colecciones separadas y almacena sesiones, ventas, líneas, pagos, reembolsos, movimientos de efectivo, tickets y auditoría. Esas colecciones ya no existen en CMS.

Las dos colecciones destino no son equivalentes:
- `CajaActual` es un singleton mutable que representa el estado/proyección de caja y contiene además los contadores de secuencia fiscal. No es un repositorio de ventas, pagos, sesiones QA ni tickets.
- `MovimientosCaja` es el ledger append-only fiscal. Sus registros requieren secuencia, hash/cadena, identidad de transacción, campos fiscales y trazabilidad. No es un almacén genérico de movimientos sintéticos.
- La proyección `CajaActual` debe derivarse de movimientos canónicos persistidos por el writer/proyector autorizado; no se puede actualizar desde el widget ni por una ruta QA paralela.
- `ControlOperativo` se reserva para locks, claims e idempotencia; no debe almacenar ventas o tickets.

Por tanto, se rechaza la migración mecánica, pero **se autoriza implementar un adaptador de pruebas sintéticas persistentes** sobre las colecciones existentes. Debe mantener la semántica de `CajaActual` como proyección y `MovimientosCaja` como registro de movimientos, etiquetar inequívocamente cada fila QA y excluirla de toda lectura fiscal/contable real. Los registros del test-run podrán editarse/eliminarse por identificador y marcador, sin tocar otras filas.

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

## 5. Diseño objetivo autorizado

1. `CajaActual` conserva el singleton de sesión/proyección. El modo de pruebas se marca explícitamente como `SIMULACION` y con `snapshotSource=TPV_QA_SYNTHETIC`; la apertura, arqueos y cierre actualizan esta proyección solo desde backend.
2. `MovimientosCaja` recibe exclusivamente eventos sintéticos marcados (`recordSource=TPV_QA_SYNTHETIC` y `movementType` con prefijo `SIMULATED_TPV_`). Los eventos usan un identificador de test-run, idempotencia y huella propia de QA. No consumen secuencias fiscales, no generan firma externa, QR AEAT ni comunicación fiscal y quedan excluidos de la cadena y agregaciones fiscales reales.
3. `ControlOperativo` conserva locks e idempotencia tipados. No almacena ventas ni tickets.
4. La capa de compatibilidad TPV traduce las entidades lógicas (sesión, venta, pago, devolución, movimiento de caja, ticket X/Z y auditoría) a `CajaActual` + eventos sintéticos en `MovimientosCaja`, sin crear colecciones QA.
5. Todos los escritores QA exigen autorización backend de administrador, `testRunId` validado y modo de simulación explícito. Ningún parámetro del frontend puede activar el modo ni cambiar el entorno.
6. Los eventos sintéticos deben quedar excluidos de `eventLog`, agregaciones fiscales, libros contables, facturas, conciliaciones reales y cierres fiscales. No se habilitan `LEDGER_WRITES_ENABLED` ni `ACCOUNTING_LEDGER_WRITES_ENABLED`.
7. El motor puro `qaTpvSimulation.mock.mjs` permanece como oráculo unitario para aritmética, conciliación, idempotencia y casos negativos.
8. No se crean colecciones nuevas ni se escriben colecciones de Wix Apps. Bookings, Orders, Payments, Wix Payments, Gift Cards, inventario, AEAT, email/SMS y hardware siguen fuera del test persistente, salvo lecturas no mutantes.
9. Se permite editar/eliminar exclusivamente filas creadas por el test-run identificado, una vez comprobado el marcador y el ID exacto. El reset final del sitio eliminará los datos sintéticos; no se hará truncate global ni se tocarán datos sin marcador.

## 6. Acciones prohibidas hasta cerrar el diseño

- No reemplazar nombres `TPV_QA_*` mecánicamente por nombres de colecciones.
- No habilitar `LEDGER_WRITES_ENABLED` ni `ACCOUNTING_LEDGER_WRITES_ENABLED`.
- No invocar firmador fiscal, QR AEAT, pasarela de pagos, reembolso nativo, notificaciones ni hardware.
- No editar/eliminar filas preexistentes sin marcador y `testRunId` de la prueba.
- No hacer truncate global ni sincronizar Sandbox a Live sin reconciliación.
- No escribir a Wix Stores, Bookings, Gift Cards, Orders, Payments o colecciones nativas de Wix Apps durante Preview.
- No sincronizar Sandbox a Live.
- No borrar ni reescribir datos históricos.

## 7. Plan de cierre

- [x] Confirmar el baseline y los consumidores estáticos de `TPV_QA_COLLECTIONS`.
- [x] Confirmar la semántica arquitectónica de `CajaActual`, `MovimientosCaja` y `ControlOperativo`.
- [x] Contrastar el aislamiento Sandbox/Live con documentación oficial Wix.
- [x] Registrar la decisión de no realizar una migración mecánica.
- [x] Registrar autorización expresa del propietario para pruebas persistentes con datos sintéticos/editables y reset integral previo a despliegue.
- [ ] Inspeccionar consumidores, hooks y permisos; diseñar adaptador lógico hacia `CajaActual`/`MovimientosCaja`.
- [ ] Implementar escritor QA aislado, con marcador, idempotencia, hash QA independiente y protección ADMIN; mantener los gates fiscales/contables reales cerrados.
- [ ] Adaptar sesiones, ventas, pagos, devoluciones, arqueos, tickets X/Z y resúmenes al contrato de las dos colecciones.
- [ ] Ejecutar suite offline completa y CI; revisión de diff.
- [ ] Ejecutar pruebas persistentes desde Wix Preview/Sandbox y verificar que Live no cambia; management API no se usará para fingir Sandbox.
- [ ] Ejecutar pruebas de permisos, concurrencia, idempotencia, conciliación y limpieza selectiva por testRunId.
- [ ] Completar E2E UI/runtime y registrar evidencias antes de cerrar #435.

## 8. Resultado de esta intervención

**Hito documental.** No se modificó código, CMS, permisos, secretos, pagos, ledger, caja, configuración Wix ni despliegue. La autorización del propietario habilita el siguiente hito de implementación y pruebas sintéticas persistentes, pero no declara validado el TPV ni ejecutado Preview.


## 9. Aclaración del propietario — 20/11/2026

El propietario confirma que el sitio está en fase de desarrollo/pruebas, que todos los registros contables y fiscales actuales son sintéticos y editables, y que el sitio completo se reseteará antes del despliegue real. Esta instrucción se toma como autorización para generar, modificar y retirar datos sintéticos identificados por test-run en las colecciones existentes, incluida la proyección `CajaActual` y los movimientos `MovimientosCaja`. No autoriza operaciones con dinero real ni efectos en proveedores externos. Los datos preexistentes sin marcador de test-run se preservan hasta comprobar su identidad.
