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

- Gitleaks full-history con acciones fijadas a SHA: run `43002171132` SUCCESS sobre el HEAD `903a5e6ada3d9092e8f2fa1dcb6bf9a9d95167ee`.
- Backend offline quality sobre ese mismo HEAD: run `43002170980` SUCCESS, 55 suites / 534 tests / 0 fallos; contratos SDK Wix, Bookings Reader V2 y ESLint correctos.
- Esta auditoría se actualiza después con cambios exclusivamente documentales; no se modificó código funcional ni pruebas tras el HEAD validado.
- El escáner de imports es un control estático parcial, no se presenta como equivalente completo a `@wix/cli/no-invalid-backend-import`.
- Wix Runtime, Preview y E2E visual no están disponibles en este entorno. No se ha certificado runtime ni despliegue.
- No se han ejecutado pruebas locales: el contenedor no dispone del checkout del repositorio ni de la toolchain Wix compatible.

## Criterio de cierre

No fusionar si falla CI. No desplegar a Wix por el mero hecho de que CI offline pase. La activación de writers requiere pruebas de integración/runtime en un sitio QA aislado, revisión de permisos, idempotencia, concurrencia y recuperación, y autorización explícita.


## Addendum — conciliación de reembolsos eCommerce (2026-11-11)

### Cambios de esta rama
- Se conserva el evento Velo estable wixEcom_onOrderPaymentStatusUpdated para pagos y se amplía para detectar PARTIALLY_REFUNDED/FULLY_REFUNDED.
- Se añade wixEcom_onOrderUpdated como segundo disparador, filtrado a pedidos parcialmente o totalmente reembolsados.
- La lectura autoritativa se realiza con @wix/ecom.orderTransactions.listTransactionsForSingleOrder y auth.elevate.
- El helper puro backend/refundTransactions.js solo acepta refunds con todas las transacciones terminales. Concilia summary.refunded.amount con la suma de transacciones SUCCEEDED; FAILED aporta cero. Un resumen positivo sin transacciones satisfactorias o una discrepancia se rechaza.
- El writer conserva REFUND-{orderId}-{refundId}, límite acumulado, lock fiscal, prorrateo y residual en el último reembolso.
- SDK_CONFIG.CURRENCY_CODE=EUR refleja la moneda verificada del sitio; el procesador rechaza cualquier order.currency distinto.
- No se activa el evento Velo onOrderTransactionsUpdated, que figura como Developer Preview y no garantiza expresamente una notificación en cada cambio de estado de un refund ya creado.

### Pruebas añadidas
- Siete pruebas unitarias para estados, importes, identidades, resumen inconsistente y fallos.
- Prueba integrada offline de venta, refund pendiente, moneda incorrecta, reembolso parcial mixto, reembolso total posterior, residual exacto de IVA, estado CitasF2, replay y concurrencia.
- Gate CI para verificar la disponibilidad de orderTransactions.listTransactionsForSingleOrder en el @wix/ecom instalado.

### Estado de validación
- HEAD de código validado: 48b509f39d4e6f6b32c8bb4a23b59fcebc3886a0.
- Backend offline quality run 43034820298: SUCCESS, 56 suites / 543 tests / 0 fallos.
- Contratos SDK Wix, incluido @wix/ecom.orderTransactions.listTransactionsForSingleOrder, Bookings Reader V2 y ESLint: SUCCESS.
- Gitleaks full-history run 43034820526: SUCCESS sobre el mismo HEAD de código.
- Las ejecuciones anteriores con fallo/cancelación (e986f8be y b14c64a7) quedan superadas por el resultado verde de 48b509f.
- Las actualizaciones posteriores a 48b509f en este informe y QA-SIMULATION son exclusivamente documentales; no modifican código ni pruebas.
- Wix Runtime, E2E publicado y QA aislado siguen pendientes. No hay escrituras CMS, pagos, reembolsos ni despliegues reales.
- La conciliación multimoneda no está habilitada; el ledger histórico no almacena moneda por movimiento. Solo se admiten pedidos en la moneda canónica EUR.

### Bloqueos antes de merge
1. Revisión humana completa del diff completo del PR y del historial incremental; preferir squash merge cuando proceda.
2. Validar en un sitio QA aislado la transición PAID → PARTIALLY_REFUNDED → FULLY_REFUNDED, refunds con varias transacciones, estados pendientes/fallidos, eventos duplicados y desordenados.
3. Confirmar el comportamiento de entrega/reintento de eventos Velo ante errores y transacciones aún pendientes.
4. No fusionar ni desplegar mientras el sitio QA aislado no exista y no se haya verificado el runtime.


## Addendum operativo — aislamiento de automatizaciones nativas Wix (2026-11-11)

La auditoría de notificaciones dejó de ser solo lectura tras la autorización expresa del propietario. Se intentó pausar 76 automatizaciones activas objetivo (75 con email y una con WhatsApp), conservando el objeto de configuración completo y cambiando únicamente `configuration.status`.

- 67 cambios confirmados por lectura posterior: 66 email y 1 WhatsApp.
- Nueve automatizaciones de email permanecen activas por restricciones Wix `readonly` y/o `disableStatusChange`; no se forzó ni se modificó su estructura.
- Las cuatro automatizaciones WhatsApp están inactivas (tres ya lo estaban y una se pausó).
- Cero emails, WhatsApp o SMS enviados.
- El número sintético `666724634` no se configuró ni recibió mensajes: la acción nativa `whatsapp-send-message` no tiene una receta pública soportada para editar destinatarios mediante API.
- El guard backend Resend no intercepta las automatizaciones nativas Wix. El aislamiento de notificaciones no está completo mientras los nueve flujos sigan activos.

Detalle, IDs, restricciones y decisión: [auditoría de aislamiento de notificaciones](2026-11-11-wix-automation-recipient-isolation.md).

### Criterio actualizado de merge

La CI offline del HEAD `d30e03473fe2bfe39b93a881ef4b765fcd72691d` pasó: run `43038637356`, 57 suites / 548 tests / 0 fallos; Gitleaks run `43038637350` SUCCESS. No hay revisiones humanas registradas. Siguen pendientes la revisión humana completa, la validación Wix runtime/E2E aislada de pagos/reembolsos y la resolución/aislamiento de los nueve flujos de email nativos activos. La pausa de WhatsApp sí está verificada, pero no existe todavía una ruta WhatsApp soportada configurada al móvil sintético.

El PR permanece draft y sin merge. La CI offline no acredita ejecución de eventos, permisos ni persistencia en Wix Runtime. No se debe desplegar el código: los writers fiscales/contables quedan fail-closed por defecto y el entorno Wix runtime no ha sido validado.


## Cierre de PR #286 — merge en main (2026-11-11)

PR #286 se integró mediante squash en `main` el 2026-11-11 15:00:16 UTC; merge commit `0d8f6efc581bc6a3d892702ba1c32af73e829888`. El estado de draft/abierto descrito en el addendum previo queda superado.

CI del HEAD anterior al merge: run `43043480302` SUCCESS (57 suites / 548 tests / 0 fallos); Gitleaks run `43043480366` SUCCESS; contratos SDK Wix, Order Transactions, Bookings Reader V2 y ESLint SUCCESS.

El merge no equivale a publicación. No se ha desplegado código Wix ni se han mutado CMS, pagos, pedidos o ledgers. Writers fiscales/contables continúan deshabilitados por defecto. Runtime/E2E aislado de reembolsos y resolución de nueve automatizaciones nativas de email activas siguen siendo gates previos al despliegue.
