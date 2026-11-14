# Auditoría de contrato TPV y caja — 2026-11-14

## 1. Alcance

Revisión estática de la rama QA; no se ejecutaron escrituras Wix/CMS, pagos, facturas, emails ni operaciones externas. Esta auditoría describe el backend actual, no el estado de ejecución del sitio QA.

## 2. Hallazgos verificados

| ID | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| TPV-01 | Los métodos aceptados por el writer no coinciden con el contrato de negocio QA. | `src/backend/internalConfig.js`: `PAYMENT_METHOD` declara `EFECTIVO`, `TARJETA`, `BIZUM`, `TRANSFERENCIA`, `WIX_PAYMENTS`. `cajas.web.js::registerManualTransaction` rechaza valores fuera del enum. | `TARJETAS`, `OTROS`, `OTROS_PENDIENTE` no son admitidos por el writer real. |
| TPV-02 | La proyección de caja solo reconoce efectivo, tarjeta y Bizum presencial. | `cajas.web.js::_updateCajaActual` (aprox. líneas 1046–1152) retorna `SUCCESS/skipped` para otros métodos/canales. | `OTROS` y otros canales no actualizan `CajaActual`; el mensaje SUCCESS requiere especial cuidado por el consumidor. |
| TPV-03 | El cierre Z no consolida el método `OTROS`. | `cajas.web.js::_registerZClosing` suma efectivo, tarjeta, Bizum y Wix Payments online. | No se puede cerrar una conciliación completa con el catálogo de medios propuesto sin definir tratamiento. |
| TPV-04 | No hay validador explícito de líneas en el writer manual. | `registerManualTransaction` persiste `lineItems: inDto.lineItems || []`; `validation.js` no expone un contrato de ticket que compruebe cantidad × PVP, neto + IVA y suma de líneas. | El writer fiscal no acredita por sí mismo las igualdades económicas exigidas por el plan QA. |
| TPV-05 | La escritura fiscal permanece deshabilitada por configuración fail-closed. | `internalConfig.js::FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`; `registerManualTransaction` devuelve `FISCAL_LEDGER_WRITES_DISABLED`. | No se debe habilitar el writer real para pruebas; se necesita un flujo sintético separado. |
| TPV-06 | Las pruebas de caja offline siembran el singleton directamente. | `tests/site.flows.offline.test.mjs::seedCajaPrincipal`. No se identificó un WebMethod de apertura de caja en los exports inspeccionados. | Los escenarios de apertura y cierre no validan todavía un ciclo completo de caja desde API pública. |
| TPV-07 | El harness de tests sustituye las tres constantes fiscales fail-closed al importar `internalConfig.js`. | `tests/loader.mjs` sustituye `LEDGER_WRITES_ENABLED: false`, `ACCOUNTING_LEDGER_WRITES_ENABLED: false` y `ALLOW_SIMULATION_RECORDS: false` por `true` dentro del loader offline. | Es una capacidad de test, no una autorización runtime. Debe permanecer aislada y documentada; conviene sustituirla gradualmente por dobles explícitos por suite. |

## 3. Acción ejecutada

Se añadió `src/backend/tests/fixtures/qaTpvSimulation.mock.mjs` y su suite `qa.tpv-simulation.mock.test.mjs`. Es un motor puro, en memoria y sin imports de Wix, CMS, PSP, signer, email, webhook ni stock. Requiere environment TEST, `enabled=true`, coincidencia exacta con el Site ID QA designado y `testRunId` sintético.

El motor:
- Valida líneas con cantidad × PVP y conciliación base imponible + impuesto.
- Usa unidades monetarias menores (céntimos) y rechaza resultados de línea con fracciones de céntimo.
- Acepta los medios declarados por negocio: EFECTIVO, TARJETAS, BIZUM, OTROS y OTROS_PENDIENTE.
- Excluye OTROS_PENDIENTE del importe liquidado y devuelve estado PARTIALLY_SETTLED.
- Comprueba que los importes liquidados + pendientes coinciden con el total y rechaza sobrepagos.
- Aplica idempotencia por clave y rechaza reutilización conflictiva.
- Devuelve metadatos `isSynthetic=true`, `sourceEnvironment=TEST`, `realPayment=false`, `persisted=false`.

Se añadió la suite al gate Layer 1. Los cambios son dobles de prueba y no se importan desde el runtime de producción.

## 4. Límites

- No se modifica el enum real `PAYMENT_METHOD`, el writer fiscal, la proyección `CajaActual`, el cierre Z ni los schemas CMS.
- No se simula todavía el asiento contable ni la cadena fiscal Veri*Factu; eso requeriría un contrato independiente y no debe confundirse con un mock de pagos.
- No se considera certificado el flujo Wix E2E ni el entorno QA runtime.
- No se usa el motor para producir registros fiscales reales ni como sustituto de una integración de pago.

## 5. Próximos pasos

1. Ejecutar la suite nueva en CI y revisar el diff.
2. Definir un contrato de caja con el propietario del dominio: semántica de `CajaActual.netAmount`, desglose por medios, devoluciones, OTROS y pagos pendientes.
3. Diseñar y probar apertura/cierre de caja en un adaptador sintético independiente; nunca sembrar el singleton como única prueba de apertura.
4. Implementar validación de DTO económica pura en backend y reutilizarla desde writers solo tras cerrar el contrato y añadir regresión.
5. Separar gradualmente la inyección de políticas del loader para evitar activar globalmente writers en todas las suites offline.
6. Acceder al sitio QA designado para inventario runtime, automatizaciones y configuración de aplicaciones; no usar producción como fallback.
