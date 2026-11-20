# Auditoría de inserción — LibroAsientosContablesDetalle

Fecha: 2026-11-20  
Base: main `f6936838bb9be448ce5022729ea767087dd0855a`  
Estado: implementación propuesta en rama; CI y Wix runtime pendientes.

## Hallazgo

El código de `src/backend/data.js` protegía `LibroAsientosContablesDetalle_beforeUpdate` y `_beforeRemove`, pero no exportaba `LibroAsientosContablesDetalle_beforeInsert`. La colección es un ledger contable append-only. El escritor legítimo identificado es `src/backend/accountingLedger.js::appendAccountingEntry`, que construye cada línea con identificador determinista, fecha, periodo, importes, desglose, hash anterior, hash actual y traceId.

La ausencia del hook dejaba la integridad del insert dependiente del escritor y de los permisos CMS. El esquema físico Wix live tiene cero campos marcados required; eso no sustituye el contrato de dominio.

## Corrección propuesta

- Nuevo `assertAccountingLedgerRecord` en `validation.js`.
- `dataAccess.insertItem` ejecuta el validador para `LIBRO_ASIENTOS_CONTABLES_DETALLE` después de la política de autorización y antes de la escritura elevada.
- Nuevo hook `LibroAsientosContablesDetalle_beforeInsert` normaliza `recordTimestamp` y valida el registro.
- El validador exige identidad, origen, periodo, fecha, secuencia positiva, importes finitos, desglose contable coherente, código de cuenta de seis dígitos, hashes SHA-256 y trazabilidad.
- Las protecciones append-only existentes para update/remove se mantienen.
- Se amplía la suite de hooks con casos válidos e inválidos.

## Alcance y límites

- No se cambia el algoritmo de hash ni el orden de contabilización.
- No se habilita `ACCOUNTING_LEDGER_WRITES_ENABLED`.
- No se insertan asientos en Wix ni se modifica el ledger.
- La validación no demuestra que el plan contable, la cuenta o la imputación económica sean correctos; eso sigue sujeto a reglas aprobadas de dominio.
- Pendiente ejecutar CI y, después, comprobar el hook en Wix Sandbox con datos sintéticos. No publicar.

## Criterio de aceptación

1. Un insert incompleto o con importes/proyección/hash inválidos se rechaza antes de persistir.
2. El escritor `appendAccountingEntry` conserva sus pruebas de balance, idempotencia, concurrencia y cadena de hash.
3. Update y remove siguen rechazados.
4. CI completa verde.
5. Wix Sandbox valida el hook real sin tocar datos contables reales.
