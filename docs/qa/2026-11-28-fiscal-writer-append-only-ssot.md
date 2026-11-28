# Corrección SSOT — escritores fiscales append-only

**Fecha:** 2026-11-28  
**Ámbito:** `MovimientosCaja`, `HistoricoCierresZ`, `LibroAsientosContablesDetalle` y consumidores de eventos económicos.  
**Decisión del propietario:** la inmutabilidad impide editar o borrar registros fiscales/contables/laborales ya persistidos; no impide insertar nuevos registros válidos.

## Regla normativa y técnica

1. Los writers pueden **añadir** registros nuevos cuando el hecho económico y sus datos estén completos y validados.
2. Los registros existentes no se actualizan ni eliminan para corregirlos. Las correcciones se representan mediante nuevos registros rectificativos, vinculados al original y con trazabilidad.
3. La idempotencia impide duplicar una misma operación; no debe confundirse con un bloqueo general de escrituras.
4. La secuencia, hash-chain, lock/fencing, autorización, validación de importes, identidad del emisor y configuración SIF siguen siendo controles obligatorios.
5. Una configuración o dato fiscal realmente ausente puede impedir **esa operación concreta** porque no es posible construir un registro válido. No debe traducirse en una política global que deshabilite todos los writers.
6. Las pruebas usan datos sintéticos aislados y secretos/configuración ficticios explícitamente marcados como fixtures. No se realizan cobros, reembolsos ni operaciones económicas reales.

## Verificación del código en main

HEAD consultado: `51c42cdf5b514e79079de0c7e6cb78be8e2fe3fa`.

**VERIFICADO en código:**
- `internalConfig.js`, `eventLog.js`, `cajas.web.js`, `accountingLedger.js` y `crons.js` no contienen `FISCAL_RUNTIME_POLICY`, `LEDGER_WRITES_ENABLED`, `ACCOUNTING_LEDGER_WRITES_ENABLED`, `ALLOW_SIMULATION_RECORDS` ni `FISCAL_LEDGER_WRITES_DISABLED`.
- `operational-writers.fail-closed.contract.test.mjs` comprueba que los writers no dependan de interruptores globales y exige validación de dominio, autorización, lock e inserción.
- `eventLog.transaction-id.required.test.mjs` verifica que `transactionId` sea obligatorio y no se fabrique un identificador sustituto.
- `events.native-booking-sync.test.mjs`, caso `EVENT-PAYMENT-09`, ejecuta el webhook eCommerce con fixtures sintéticos: comprueba inserción en `MovimientosCaja`, timestamps CMS, importe/base/IVA, método, canal, booking IDs, hash, secuencia, correlación por `ORDER-{orderId}` y replay idempotente sin duplicidad.
- `fiscalLedgerWriters.locking.test.mjs` verifica serialización, fencing y secuencia compartida entre escritores.

**CI documentado y verificado para el HEAD correctivo de PR #681:**
- Backend quality gates: run `46085729210`, job `140794719898`, conclusión SUCCESS; ejecutó Layer 1, Layer 2, suite offline completa, contratos SDK y ESLint.
- Secret scanning: run `46085729219`, job `140794719767`, conclusión SUCCESS.
- Suite offline documentada: 91 suites / 816 tests PASS.
- Esta evidencia corresponde al SHA validado en PR #681. No equivale a Wix Runtime ni a producción.

## Bloqueos que permanecen y su clasificación

No son un bloqueo normativo general a la escritura append-only:

- **CONFIG_SISTEMA_FISCAL ausente en CMS:** la lectura Wix del 28-11-2026 encontró cero registros canónicos en `MapaStaff`. El writer necesita identidad/configuración SIF verificada para construir el snapshot fiscal. Estado: **BLOQUEO DE DATOS/CONFIGURACIÓN**, no prohibición de insertar.
- **Secretos fiscales:** `registerManualTransaction` valida credenciales/NIF del emisor antes de escribir. Son prerequisitos de identidad y seguridad; no deben sustituirse por valores inventados.
- **Contrato físico CMS:** los campos required y hooks deben coincidir con el payload del writer. Un error de esquema es un fallo de contrato que debe corregirse, no saltarse.
- **Operación cerrada/rectificación:** un periodo cerrado o una corrección exige el tratamiento definido por el dominio (p. ej., registro rectificativo); nunca modificar el registro anterior.

## Criterio de aceptación

Para cada writer y evento económico, una prueba positiva debe demostrar:
- payload válido y completo para los campos aplicables;
- autorización y configuración válidas;
- un único insert append-only;
- `transactionId`/clave idempotente estable;
- secuencia y hash-chain íntegros;
- proyección/marker/claim correlacionados o estado PARTIAL explícito;
- replay idéntico sin duplicidad;
- payload distinto con la misma identidad rechazado;
- errores de CMS/configuración propagados sin convertirlos en éxito.

La auditoría operativa medirá por separado **datos recibidos**, **datos esperados**, **datos persistidos**, **datos conciliados** y **datos recuperados**. La meta 100 % se calcula sobre los campos aplicables y verificables, nunca rellenando datos ausentes ni descartando operaciones fallidas.

## Corrección de documentación histórica

Las referencias archivadas que describen `FISCAL_LEDGER_WRITES_DISABLED` o `LEDGER_WRITES_ENABLED=false` son fotografías de una implementación anterior. No describen el código vigente en el HEAD citado y no deben reutilizarse como diagnóstico actual. Se conservan por trazabilidad, subordinadas a este documento y al código actual.
