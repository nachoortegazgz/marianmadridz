# Estado actual — 2026-11-27

**MVP operativo/comercial: NO-GO.** Desarrollo y QA offline con fixtures: PASS. Wix Runtime E2E, publicación y sincronización Git-Wix: no acreditados.

## Git y CI

- Repositorio: `nachoortegazgz/marianmadridz`.
- PR #650 integrada: `transactionId` obligatorio en el writer fiscal manual, fingerprint de replay y validación del movimiento antes de persistir. Mapping AEAT no integrado.
- PR #651 integrada en `main` mediante squash: merge commit `abf862c9e7cbdc393c0186f650ed30f57aaeeee6`. Código validado `7771f4c6bb7da61ecf60bd58708b26d5331745dd`; CI completo PASS.
- CI de ese HEAD: **PASS**. Layer 1: 29 suites / 376 tests; Layer 2: 16 suites / 249 tests; suite completa: 81 suites / 763 tests; 0 fallos. Gitleaks, npm audit, contratos SDK Wix y ESLint: PASS.
- CI no acredita Wix Runtime ni sincronización Git-Wix. PR no integrada.

## Cambios consolidados en PR #651

- Error TPV común: código estable, mensaje público seguro, remediation, retryability, `traceId` y metadatos de persistencia/recuperación. `technicalDetail` se limita al código seguro; no se reenvían mensajes brutos ni datos de proveedor al frontend.
- DAL: `bulkRemove` y `assertBulkRemoveAllowed` deniegan borrado físico. `removeById` solo permite retirada lógica CAS para tipos operativos autorizados (cachés, token, lock y rate limit).
- Crons: cachés, tokens, locks y rate limits se retiran lógicamente; idempotencia, flags y evidencia de auditoría se conservan. No se purgan ledgers ni evidencia.
- Locks del ledger contable: adquisición y liberación con CAS versionado y verificación de resultado.
- Hooks CMS: ledgers físicos, contables, cierres, jornada y eventos webhook append-only; intención comercial solo admite cambios validados.
- TPV reader: valida identidad, hash, secuencia, timestamp y envelope antes de tratar un registro como ledger. Sin clasificador genérico por entorno.
- Marcadores explícitos de smoke/fixture se excluyen de lecturas fiscales/recibos cuando el contrato lo exige; etiquetas genéricas REAL/SYNTHETIC/SIMULATION no clasifican negocio.
- Corregido `TransaccionesTPV_beforeInsert` para no referenciar un registro previo inexistente.

## Wix/CMS — último read-back documentado

- Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`; Editor clásico, Velo habilitado, Draft.
- TPV page ID `yl5th`, ruta vigente `/tpv` (read-back Wix API, 27-11-2026; `published=false`).
- Recuentos observados: `CajaActual=1` (ABIERTA), `MovimientosCaja=5`, `HistoricoCierresZ=1`, `TransaccionesTPV=0`, `ControlOperativo=78`, `MapaStaff=5`, `CitasF2=11`, `LibroAsientosContablesDetalle=3`, `RegistrosHorariosStaff=0`.
- No había `recordType=CONFIG_SISTEMA` ni `productionActivationAt` en los cinco MapaStaff consultados.
- Lectura fechada 27-11-2026; no es consulta live actual. No se hicieron escrituras en esas auditorías.

## Pendientes

1. Auditar `eventLog.js` y consumidores: sigue existiendo fallback `TX_${sequenceNumber}`; el contrato global de `transactionId` no está cerrado.
2. Mapping AEAT oficial de alta/anulación, tipo, serie/número, fecha, importes y hash previo. No inferirlo desde el hash interno ni recalcular históricos.
3. Wix Preview/Runtime E2E con fixture/sesión aislada y writer canónico. No reutilizar `CajaActual` ABIERTA ni activar pagos/remesas.
4. Reconciliar las seis divergencias Bookings/CitasF2 con proceso backend idempotente.
5. Validar transporte Capa 3 SharePoint/Graph/Power Automate en tenant aislado.
6. Confirmar SHA/fingerprint instalado en Wix. No publicar como parte de esta PR.

## Evidencia

Cada PASS identifica SHA, entorno, comando/flujo y resultado. No extrapolar CI a Runtime ni declarar E2E sin ejecución real.
