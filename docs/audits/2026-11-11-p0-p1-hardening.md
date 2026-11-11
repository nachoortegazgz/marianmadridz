# Auditoría de hardening P0/P1 — 2026-11-11

## Baseline

- Repositorio: `nachoortegazgz/marianmadridz`
- Rama base: `main`
- SHA de partida verificado: `d4eb1d62945f296d2a8f6eeb24e6f330a2eda385`
- Rama de trabajo: `audit/p0-p1-hardening`
- Alcance: endurecimiento fail-closed de escritores fiscales, CI y auditoría de riesgos. No se ha desplegado código en Wix.

## Cambios incluidos

1. `.github/workflows/backend-offline-quality.yml`: el workflow de calidad se ejecuta también en `push` a `main`, además de pull requests y ejecución manual.
2. `.eslintrc.json`: `@wix/cli/no-invalid-backend-import` permanece en `off`. Al activarla como `error`, ESLint 8.25.0 + `@wix/eslint-plugin-cli` 1.0.2 falla al cargar la regla con `TypeError [ERR_INVALID_ARG_TYPE]: The "to" argument must be of type string. Received undefined` en `accountingLedger.js`. No se mantiene una configuración que rompe el gate completo; reactivación pendiente de compatibilidad verificada o sustitución por una regla estática propia.

3. `src/backend/internalConfig.js`: nueva política canónica `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false` y `ALLOW_SIMULATION_RECORDS=false`.
4. `src/backend/cajas.web.js`: bloqueo fail-closed en `registerManualTransaction` y en `_registerZClosing`, compartido por la entrada pública y el cron interno.
5. `src/backend/eventLog.js`: bloqueo fail-closed en `registrarEventoEconomico`, antes de upsert de terceros, lock y persistencia; cubre eventos de pedidos, reembolsos y rectificaciones que pasan por este writer.
6. Los escritores manual y de eventos rechazan `isExplicitSimulationLedgerRecord(...)` salvo que `ALLOW_SIMULATION_RECORDS` esté explícitamente activado. En producción permanece `false`; el harness offline lo activa solo para fixtures sintéticos.
9. `src/backend/tests/operational-writers.fail-closed.contract.test.mjs`: contratos de orden de guardas frente a efectos secundarios y confirmación de que fichajes/ajustes siguen bloqueados.
10. `src/backend/tests/loader.mjs`: el harness offline inyecta `LEDGER_WRITES_ENABLED=true` solo al importar `internalConfig.js`, para probar los happy paths existentes. La prueba contractual lee el archivo fuente y exige el default productivo `false`.
11. `.github/workflows/secret-scan.yml`: Gitleaks full-history scan en PR/push a `main` y ejecución manual; sin comentarios automáticos ni artefactos de resultados.

## Controles existentes confirmados

- `src/backend/internalConfig.js` declara `STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false` y `ADJUSTMENTS_ENABLED=false`.
- `src/backend/horario.web.js` importa la configuración canónica; la cobertura de cada WebMethod y de cada rama de escritura debe revisarse mediante pruebas antes de considerar certificado el bloqueo.
- `src/backend/booking/bookingCore.js` y `booking/bookingSaga.js` ya implementan locks, tokens de pareja, estados de escritor y replay inspection. No se introduce un segundo mecanismo de idempotencia genérico.
- `src/backend/fiscalDocuments.web.js` mantiene `ACCOUNTANT_SEND_ENABLED=false`; el despacho Resend ya está bloqueado por configuración.

## Riesgos pendientes — no implementados deliberadamente

### P0 fiscal

No se añadió `process.env`: su disponibilidad y semántica no están acreditadas en Wix Velo. Se añadió un flag canónico fail-closed en backend y se conectó a los tres escritores identificados: manual, evento económico (incluye webhooks de pedido/refund) y cierre Z. La política no bloquea lectores, reconciliación de eventos ya persistidos ni cola de recuperación. Los marcadores de simulación se rechazan antes de upsert/persistencia salvo en el harness offline. Antes de activar debe probarse en Wix QA aislado y revisarse cualquier nuevo writer.

### P0/P1 caja y fichajes

No se añadió un interruptor operacional global: podría bloquear compensaciones y recuperaciones legítimas. Fichajes ya tienen flags canónicos desactivados y se añadió una prueba contractual de que los guards preceden a firma e inserción. Los escritores de caja fiscal y el writer contable append-only quedan deshabilitados por la política nueva. No se bloquea el proyector de caja por separado: no puede recibir una operación nueva sin pasar por uno de los escritores fiscalmente bloqueados.

### P1 reservas y proyecciones

No se añadió una búsqueda-antes-de-insertar como garantía de unicidad: no es atómica bajo concurrencia. La siguiente intervención debe extender los locks/transaction writer existentes, validar igualdad de payload para una misma clave y demostrar replay concurrente. La identidad `sourceEventId` debe exigirse en proyecciones de eventos que realmente dispongan de ella; no en todas las proyecciones internas.

### Datos de prueba

No se añadió un filtro por substring `SMOKE_TEST`: es evadible y puede rechazar datos legítimos. Hace falta un marcador de entorno/origen tipado, controlado por backend y compatible con los esquemas CMS existentes, más pruebas que acrediten que se rechaza antes de persistir.

### Escaneo de secretos

Se añadió Gitleaks Action v3.0.0 y actions/checkout v6 están fijadas a SHA de commit verificados, con checkout de historial completo. La acción informa resultado de análisis en GitHub Actions; se desactivaron comentarios y artefactos. La primera ejecución del workflow terminó con éxito (run `42986042556`).

## Validación

- No hay checkout local ni Wix CLI en este entorno; la validación se ejecuta mediante GitHub Actions.
- El primer intento con la regla Wix reactivada falló al cargar el plugin (run `42985830795`); la regla se revirtió a `off` para restaurar la capacidad de lint.
- La suite offline de ese intento registró 522 pass / 10 fail en dos suites porque el harness heredado importaba el nuevo flag productivo `false`; el harness se corrigió para inyectar `true` solo en pruebas, mientras el contrato estático comprueba el default `false`.
- Gitleaks full-history con acciones fijadas a SHA: run `42986393386` completado con éxito.
- Backend offline quality: run `42986042849` pendiente al redactar esta actualización; registrar su resultado final antes de cerrar la PR.
- No se ha accedido a Wix Runtime, no se han mutado CMS/ledgers y no se ha publicado el sitio.

## Criterio de cierre

No fusionar si falla CI. No desplegar a Wix por el mero hecho de que CI offline pase. Los bloqueos fiscales, caja y fichajes requieren pruebas de integración y runtime en un sitio QA aislado, además de revisión de permisos, idempotencia, concurrencia y recuperación.
