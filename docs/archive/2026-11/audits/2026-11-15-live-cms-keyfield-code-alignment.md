# Alineación de writers con keyfields CMS live — 2026-11-15

## Alcance y evidencia

Lectura read-only de Wix Data Collections API sobre el sitio QA `188bed94-177c-4bc9-a9f0-35080d874f3e`, el 2026-11-15.

| Colección | Revisión live | Campos físicos | Campos required |
|---|---:|---:|---:|
| `RegistrosHorariosStaff` | 1 | 47 | 14 |
| `LibroAsientosContablesDetalle` | 7 | 103 | 0 |

No se ejecutaron escrituras CMS ni se activaron writers. Los esquemas live, no los snapshots históricos del diccionario, son el contrato físico para este cambio.

## LibroAsientosContablesDetalle

El writer conserva el modelo de entrada de doble partida, pero lee y persiste exclusivamente keyfields existentes en la colección:

| Dato de asiento/línea | Keyfield CMS |
|---|---|
| Identidad del asiento | `journalEntryId` |
| Orden de línea | `sequenceNumber` |
| Documento fuente | `documentId` |
| Concepto | `operationDescription` |
| Tipo de movimiento | `movementType` |
| Colección/origen | `recordSource` |
| Fecha de operación (`DATE`, `YYYY-MM-DD`) | `fechaOperacion` |
| Importe absoluto de línea | `amount` |
| Importe con signo (Debe positivo / Haber negativo) | `accountingAmount` |
| Signo | `accountingSign` |
| Cuenta y desglose Debe/Haber | `desgloseDetallado` OBJECT |
| Huella de la fila | `hash` |
| Enlace de cadena | `previousRecordHash` |
| Relación explícita con caja (dentro de `desgloseDetallado`) | `desgloseDetallado.cashMovementId` |

`accountCode`, `debitAmount` y `creditAmount` quedan dentro del OBJECT `desgloseDetallado`; no se escriben como campos de primer nivel porque no existen en el esquema live. Las consultas de idempotencia usan `journalEntryId` y `sequenceNumber`; la cadena lee/escribe `hash`.

El contrato de entrada interno de `appendAccountingEntry` pasa a usar los nombres canónicos de CMS (`journalEntryId`, `documentId`, `operationDescription`, `movementType`, `recordSource`, `fechaOperacion`, `sequenceNumber`). No se mantiene un alias silencioso de los nombres anteriores.

## RegistrosHorariosStaff

El writer y el validador ahora cubren los keyfields required live que faltaban:

- `recordId`: identificador de evento generado en backend, distinto de `_id` y `traceId`.
- `source`: `WIX_WEB_METHOD`.
- `workDate`: campo CMS `DATE`, almacenado como texto `YYYY-MM-DD` derivado de `recordedAt` en `Europe/Madrid`.
- `timeZone`: `Europe/Madrid`.
- `recordHash`: SHA-256 del payload canónico del evento.
- `schemaVersion`: `1`.

`recordedTime` es DATETIME en el esquema live, mientras `workDate` es DATE y se persiste como `YYYY-MM-DD`, por lo que el writer deja de enviar texto `HH:MM:SS` y persiste el instante como Date. El cálculo de `dayKey` y `monthKey` usa `Intl.DateTimeFormat` con `Europe/Madrid` a partir del instante real; no convierte el instante a una fecha local artificial dependiente del timezone del runtime.

La firma HMAC v1 cubre los campos canónicos nuevos y el campo `registeredBy` real. La verificación de registros históricos sin `schemaVersion=1` conserva el conjunto de campos HMAC anterior para no invalidar retrospectivamente registros preexistentes.

## Límites que permanecen bloqueados

- `ACCOUNTING_LEDGER_WRITES_ENABLED=false`.
- `STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false`.
- `STAFF_CLOCKING_CONFIG.ADJUSTMENTS_ENABLED=false`.
- No se habilita ningún writer, cron, hook de negocio ni runtime Wix.
- La adaptación laboral genera `recordHash` por evento; no introduce todavía una cadena global `previousRecordHash` ni resuelve exclusión mutua/transiciones concurrentes. Estas garantías siguen siendo requisito previo para habilitar fichajes.
- La adaptación contable no habilita reglas automáticas PGC ni determina cuentas: el mapeo de cuentas sigue requiriendo aprobación funcional.

## Validación

**Resultado CI verificado (2026-11-15, run 1310): PASS.** Layer 1: 24 suites / 307 tests; Layer 2: 19 suites / 252 tests; regresión completa: 70 suites / 644 tests, 0 fallos. Contratos SDK Wix, ESLint y Secret scanning también PASS. La ejecución cubre mocks/offline y contratos; no equivale a persistencia runtime en Wix.


## Estado de integración

- PR #388 integrada en `main` mediante squash commit `beeb3ed0e28533cdaf10aa5858e36f4bc713480c`.
- La integración actualiza contratos de writer/validación, no habilita escrituras de negocio.
- `ACCOUNTING_LEDGER_WRITES_ENABLED=false`, `STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false` y `ADJUSTMENTS_ENABLED=false` permanecen cerrados.
- No se ejecutaron escrituras CMS, pruebas runtime, pagos, comunicaciones ni despliegues.
- Pendiente: pruebas Wix Local Editor y runtime aislado cuando se haya demostrado que las automatizaciones activas no pueden producir efectos externos.
