# Consolidación de políticas TPV y errores accionables — 2026-11-27

## Decisiones adoptadas

1. **Un único contrato en todos los entornos.** Se elimina la clasificación de registros como `REAL`, `SYNTHETIC`, `SIMULATION` o equivalentes. El backend genera `recordTimestamp` UTC, pero no consulta `productionActivationAt`, no escribe `recordNature` y no filtra registros por esas etiquetas.
2. **Sin bloqueos globales fiscales/contables.** No se usa un interruptor global para deshabilitar writers. `assertTpvOperationalLedgerConfigured` valida únicamente el tipo de ledger; la falta de campos/configuración fiscal, importes, identidad o hashes se devuelve como error de dominio concreto antes de persistir.
3. **Errores explícitos.** `tpvError.js` normaliza excepciones: conserva código, mensaje público, remediación, detalle técnico acotado y retryability. Los WebMethods TPV de caja, movimientos, cierres, catálogo, pagos, exportación y auditoría usan el normalizador. Fallos de auditoría post-write se reflejan como `auditPersisted=false` y `auditErrorCode`, además de log técnico.
4. **No borrar.** DAL individual, bulk y hooks CMS deniegan el borrado. Los crons de retención reciben un resultado explícito `skipped` con `CMS_BULK_DELETE_PROHIBITED`; no eliminan registros.
5. **Edición controlada.** Las intenciones comerciales TPV y proyecciones operativas admiten actualización validada. Los ledgers fiscales/contables contabilizados, registros laborales y cierres conservan la evidencia original y se corrigen mediante nuevos eventos rectificativos trazables; no se permite sobrescribir una factura/asiento ya contabilizado.

## Cambios de código

- `src/backend/tpv/tpvRecordNature.js`: conserva solo generación de timestamp UTC neutral.
- `src/backend/tpv/tpvRepository.js`: retira el hard gate fiscal y unifica la lectura de eventos TPV actuales/legacy sin clasificación por naturaleza.
- `src/backend/tpv/tpvVentas.web.js`: elimina el blocker `FISCAL_CONFIG_UNVERIFIED`; mantiene requisitos comerciales y de pago/inventario/precio que no son flags fiscales globales.
- `src/backend/validation.js`: elimina validación `recordNature` y contrato especial de `TPV_TEST_RUN`.
- `src/backend/fiscalAggregator.web.js`, `src/backend/exports/exportContract.js`, `src/backend/cajas.web.js` y `src/backend/tpv/tpvExport.web.js`: no suprimen registros por etiquetas de entorno.
- `src/backend/data.js`: permite proyección TPV en `CajaActual`, actualiza intenciones TPV con validación del registro completo y bloquea borrado de colecciones protegidas.
- `src/backend/dataAccessPolicy.js` y `src/backend/dataAccess.js`: prohibición global de delete y bulk delete.
- `src/backend/accountingLedger.js`: sustituye borrado del lock por actualización CAS de expiración/liberación.
- `src/backend/tpv/tpvUtils.js`: descarta metadatos de clasificación aportados por cliente; los campos canónicos de backend siguen protegidos.

## Riesgos y límites

- Los registros legacy no se reescriben ni migran en esta intervención. Sus etiquetas antiguas dejan de gobernar filtros de negocio; la validez fiscal depende de campos, importes y hash.
- Los crons de purga ya no eliminan filas: la retención física requiere una política de archivo/exportación autorizada que no contradiga la regla no-delete. Puede aumentar el volumen de `ControlOperativo`.
- No se habilita proveedor de pago, remisión AEAT, firma Veri*Factu, notificaciones ni hardware.
- No se modifica la caja live ABIERTA ni se escriben colecciones CMS live.
- Los ledgers contabilizados siguen siendo rectificables mediante nuevos registros, no por edición directa del original.

## Validación

- Pruebas nuevas/actualizadas: normalización de errores, hooks no-delete, DAL no-delete, bulk no-delete, lectores sin clasificación, transacciones TPV editables y metadata neutral.
- **CI:** pendiente de ejecución sobre el HEAD final de PR #651.
- **Wix Runtime E2E:** no ejecutado. No declarar runtime PASS.
