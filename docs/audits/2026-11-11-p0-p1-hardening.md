# Auditoría de hardening P0/P1 — 2026-11-11

## Baseline

- Repositorio: `nachoortegazgz/marianmadridz`
- Rama base: `main`
- SHA de partida: `d4eb1d62945f296d2a8f6eeb24e6f330a2eda385`
- Rama de trabajo: `audit/p0-p1-hardening`
- No se ha desplegado código en Wix ni se han mutado CMS, caja o ledgers.

## Cambios incluidos

1. `.github/workflows/backend-offline-quality.yml`: calidad offline en `push` a `main`, PR y ejecución manual.
2. `.github/workflows/secret-scan.yml`: Gitleaks full-history en PR/push a `main`; `actions/checkout` v6 y Gitleaks v3.0.0 fijadas a SHA verificados. Comentarios y artefactos automáticos desactivados.
3. `src/backend/internalConfig.js`: política canónica fail-closed:
   - `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`
   - `FISCAL_RUNTIME_POLICY.ACCOUNTING_LEDGER_WRITES_ENABLED=false`
   - `FISCAL_RUNTIME_POLICY.ALLOW_SIMULATION_RECORDS=false`
4. `src/backend/cajas.web.js`: guards en `registerManualTransaction` y `_registerZClosing`. El cierre Z autoriza primero al cajero en la entrada pública y luego evalúa la política; el guard común también cubre el caller interno.
5. `src/backend/eventLog.js`: guard en `registrarEventoEconomico`, antes de upsert de terceros, lock y persistencia. Cubre pedidos, reembolsos y rectificaciones que usan este writer.
6. `src/backend/accountingLedger.js`: `appendAccountingEntry` bloqueado por defecto y rechazo de marcadores de simulación antes de normalización, claim, lock o insert.
7. `src/backend/crons.js`: las compensaciones `FISCAL_LEDGER` y `RESYNC_LEDGER_ACCOUNTING` se omiten mientras sus writers estén deshabilitados. No incrementan intentos ni mutan la cola; el resumen y el log exponen `skippedByPolicy`.
8. `src/backend/tests/operational-writers.fail-closed.contract.test.mjs`: contratos estáticos que comprueban defaults, orden de guards, rechazo de datos sintéticos, pausa de recuperación y telemetría de elementos omitidos.
9. `src/backend/tests/frontend.backend-import-boundary.contract.test.mjs`: sustituto parcial del gate Wix incompatible; recorre `src/pages` y `src/public` y rechaza imports de módulos backend privados, permitiendo solo módulos `.web`.
10. `src/backend/tests/loader.mjs`: el harness offline habilita flags únicamente al importar la configuración en pruebas. El archivo de producción conserva todos los defaults en false; la prueba contractual lee el archivo fuente directamente.
11. `ESTADO_ACTUAL_PROYECTO.md` y `docs/PROJECT-STATUS.md`: corregida la descripción obsoleta de PR #284 como abierta.

## Controles existentes confirmados

- `STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false` y `ADJUSTMENTS_ENABLED=false` ya existen en `internalConfig.js`; `horario.web.js` consulta esta configuración.
- `bookingCore.js` y `bookingSaga.js` ya implementan locks, tokens de pareja y replay inspection. La saga calcula `payloadHash` y resuelve replay antes de consultar disponibilidad; payload distinto se rechaza y operaciones en curso devuelven estado ocupado. No se introduce una segunda idempotencia genérica.
- El webhook nativo conserva el `eventId` de Wix en `CitasF2.meta.eventId` y mantiene un marcador `WEBHOOK_EVENT`. No se añade `sourceEventId` al esquema CMS sin verificar su contrato.
- `fiscalDocuments.web.js` mantiene `ACCOUNTANT_SEND_ENABLED=false`; el envío Resend ya está bloqueado por configuración.

## Cambios deliberadamente no incluidos

### Regla Wix ESLint

Se intentó reactivar `@wix/cli/no-invalid-backend-import` como error. ESLint 8.25.0 con `@wix/eslint-plugin-cli@1.0.2` falla al cargar la regla con `ERR_INVALID_ARG_TYPE` antes de analizar el código (run `42985830795`). Se revirtió a `off` para no romper el gate. Reactivación pendiente de compatibilidad verificada o sustitución por regla estática propia.

### Entorno de producción y datos de prueba

No se usa `process.env`: su disponibilidad y semántica no están acreditadas en Wix Velo. Los marcadores sintéticos se rechazan mediante `isExplicitSimulationLedgerRecord` y una política backend por defecto cerrada; no se usa un filtro textual `SMOKE_TEST`, que sería evadible y podría rechazar datos legítimos.

### Reservas y proyecciones

No se añade un `requireIdempotencyKey` genérico ni una búsqueda-antes-de-insertar. Esas medidas no son atómicas y duplicarían los locks/replay existentes. La idempotencia se mantiene en los contratos actuales; ampliar su cobertura exige pruebas concurrentes en entorno aislado.

## Validación

- Gitleaks full-history con acciones fijadas a SHA: run `42986820996` completado con éxito sobre el head anterior.
- Backend offline quality sobre el head anterior `d0530449cfc6ccd063743ce707b4d18bdee0a89b`: run `42986821012` SUCCESS, 54 suites / 533 tests / 0 fallos; contratos SDK Wix, Bookings Reader V2 y ESLint correctos.
- Después de ese run se añadieron el contrato de imports frontend/backend y la telemetría `skippedByPolicy` con su aserción. **La nueva revisión aún necesita CI sobre su SHA actualizado**; no se reutiliza el resultado anterior como evidencia de la nueva cabeza.
- El escáner de imports es un control estático parcial, no se presenta como equivalente completo a `@wix/cli/no-invalid-backend-import`.
- Wix Runtime, Preview y E2E visual no están disponibles en este entorno. No se ha certificado runtime ni despliegue.
- No se han ejecutado pruebas locales: el contenedor no dispone del checkout del repositorio ni de la toolchain Wix compatible.

## Criterio de cierre

No fusionar si falla CI. No desplegar a Wix por el mero hecho de que CI offline pase. La activación de writers requiere pruebas de integración/runtime en un sitio QA aislado, revisión de permisos, idempotencia, concurrencia y recuperación, y autorización explícita.
