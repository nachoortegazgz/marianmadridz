# TPV backend — mapa operativo vigente

**Estado:** CI offline PASS histórico; Wix Runtime no aceptado; release operativo/comercial NO-GO. Consultar [STATE-NOW](../../../docs/STATE-NOW.md) para el estado fechado y no tomar SHAs de este documento como estado actual.

## Módulos por responsabilidad

- `tpvRecordNature.js`: timestamp UTC server-side, lectura del corte de activación y clasificación SYNTHETIC/REAL.
- `tpvSalePreparation.js` / `tpvSalePreparationCore.js`: resolución de catálogo, normalización, importes e impuestos.
- `tpvWriteV1Contract.js`: elegibilidad de preescritura V1 (una tasa, EFECTIVO/TARJETA, total conciliado); no confirma pago ni persistencia.
- `tpvVentas.web.js`: WebMethods de preparación y registro de intención comercial; `registrarVenta` impone los mismos blockers del preflight.
- `tpvRepository.js`: persistencia de eventos físicos, proyección de sesión, idempotencia, lock y auditoría.
- `tpvCaja.web.js`, `tpvMovimientos.web.js`, `tpvCierres.web.js`, `tpvDevoluciones.web.js`, `tpvExport.web.js`: operaciones de caja/movimientos/cierres/devoluciones/exportación según contratos individuales.
- `tpvPermisos.web.js` / `tpvOperatorContext.js`: contexto de operador y permisos; autorización siempre backend.
- `tpvHistoricalCompat.js`: compatibilidad histórica acotada; no es runtime alternativo de escritura.
- `tpvNativeDirectory.js` y `tpvMovementContracts.js`: contratos/adaptación de catálogo y movimientos.

## Colecciones

- `TransaccionesTPV`: intención comercial pendiente/no contable.
- `MovimientosCaja`: ledger físico canónico append-only.
- `CajaActual`: proyección de sesión.
- `ControlOperativo`: locks, deduplicación y auditoría técnica.
- `HistoricoCierresZ`: cierres con contrato de integridad propio.

## Gates y límites por contexto

- La naturaleza temporal se deriva en backend; no aceptar valores del cliente.
- No existe un interruptor global de escritura fiscal/contable. Los writers recorren el mismo código en todos los entornos y aplican validaciones de dominio, autorización, configuración, locks e idempotencia.
- La falta de configuración fiscal debe producir un error específico y accionable en la operación afectada; no deshabilitar globalmente los writers ni las suites de pruebas.
- Los fixtures sintéticos se identifican mediante metadatos; los adaptadores simulados sustituyen solo infraestructura, no la lógica de negocio.
- Los tests deben cubrir explícitamente configuración ausente/inválida y recorrido válido con fixture. No fabricar configuración fiscal real para conseguir un PASS.
- `registrarVenta` no crea intención nueva cuando `saleReady=false` para la operación evaluada; los replays idempotentes se resuelven antes del gate.
- El TPV actual permanece MODO CONSULTA/`saleReady=false` según la última evidencia Runtime; este bloqueo productivo no impide desarrollar ni probar el dominio aislado.
- No activar pagos, Draft Orders, reembolsos, writers fiscales ni efectos externos durante QA.
- No mutar ni reutilizar `CajaActual` ABIERTA ni ledgers históricos compartidos para pruebas persistentes. Para pruebas Wix con escritura, usar ámbito aislado y writer canónico; en unitarias/contrato usar repositorios simulados.

## Validación

- CI histórico: 81 suites / 764 tests PASS offline (PR #640).
- Clasificación: pruebas de corte ausente, anterior, igualdad, posterior y timestamps inválidos.
- No acreditado en la última auditoría: Wix Preview/Runtime, UI E2E, permisos reales de rol, persistencia online, concurrencia Wix, hardware y recuperación.
- Los tests offline acreditan su nivel concreto; no sustituyen aceptación Runtime ni requieren habilitar producción.

La autoridad de flujo es [docs/TPV-UNIFIED-FLOW.md](../../../docs/TPV-UNIFIED-FLOW.md); el estado de aceptación es [docs/STATE-NOW.md](../../../docs/STATE-NOW.md).
