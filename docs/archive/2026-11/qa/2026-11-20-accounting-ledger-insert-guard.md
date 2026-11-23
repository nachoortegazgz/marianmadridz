# Auditoría de inserción — LibroAsientosContablesDetalle

Fecha: 2026-11-20  
Base de implementación: PR #452, integrada en `main` mediante merge commit `5cfbecd6849c56d162f0d20a11b620eb2bea0c54`.  
Estado: **código integrado y CI de PR verde; validación Wix Sandbox pendiente**.

## Hallazgo

El código de `src/backend/data.js` protegía `LibroAsientosContablesDetalle_beforeUpdate` y `_beforeRemove`, pero no exportaba `LibroAsientosContablesDetalle_beforeInsert`. La colección es un ledger contable append-only. El escritor legítimo identificado es `src/backend/accountingLedger.js::appendAccountingEntry`.

La ausencia del hook dejaba la integridad de las inserciones CMS manuales dependiente del escritor y de los permisos CMS. El esquema físico Wix auditado no marcaba campos required; eso no sustituye el contrato de dominio.

## Corrección integrada — PR #452

- Nuevo `assertAccountingLedgerRecord` en `src/backend/validation.js`.
- `dataAccess.insertItem` valida los registros de `LIBRO_ASIENTOS_CONTABLES_DETALLE` antes de la escritura elevada.
- Nuevo hook `LibroAsientosContablesDetalle_beforeInsert` en `src/backend/data.js`; normaliza `recordTimestamp` y valida el registro.
- Se exigen identidad, origen, periodo, fecha, secuencia positiva, importes finitos, desglose contable coherente, código de cuenta de seis dígitos, hashes SHA-256 con formato válido y trazabilidad.
- Se mantienen las protecciones append-only de update/remove.
- Se amplía la suite de hooks con casos válidos e inválidos.

## Validación verificada

- PR #452: https://github.com/nachoortegazgz/marianmadridz/pull/452
- Head validado: `940a6cf9fadb85ed414963eff2cfd1b28c82ed67`.
- Workflow #44667244690, Backend offline quality gates: **completed / success**.
- El job agregado de Layer 1, Layer 2, regresión offline, contratos SDK y lint finalizó SUCCESS.
- Merge commit: `5cfbecd6849c56d162f0d20a11b620eb2bea0c54`.

## Alcance y límites

- No se cambia el algoritmo de hash ni el orden de contabilización.
- No se habilita `ACCOUNTING_LEDGER_WRITES_ENABLED`.
- No se insertaron asientos ni se modificó el ledger Wix.
- La validación comprueba el formato de los hashes, pero no recalcula el hash ni demuestra por sí sola la continuidad criptográfica de la cadena.
- No demuestra que el plan contable, la cuenta o la imputación económica sean correctos.
- **Pendiente:** comprobar el hook real en Wix Sandbox con datos sintéticos y confirmar que las rutas de inserción Wix ejecutan el hook esperado. No publicar ni habilitar writers.

## Criterios pendientes

1. Verificar el hook en Sandbox con inserción sintética válida e inválida.
2. Confirmar que las rutas elevadas utilizadas no suprimen hooks.
3. Confirmar rechazo de update/remove en runtime.
4. Mantener pruebas de balance, idempotencia, concurrencia y cadena de hash del escritor.
5. No habilitar escrituras contables hasta completar la validación de dominio, runtime y autorización.

## Referencias oficiales Wix

- [Wix Data — beforeInsert](https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-insert).
- [Wix Data — About Data Hooks](https://dev.wix.com/docs/develop-websites/articles/databases/wix-data/hooks/about-data-hooks).
- [Wix Data — insert](https://dev.wix.com/docs/velo/apis/wix-data/insert).
