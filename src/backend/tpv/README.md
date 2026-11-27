# TPV backend — mapa operativo vigente

**Main:** `f0b30c31c8ad924e42f8790338fa223716026420` al consolidar la sesión.  
**PR #640:** clasificación temporal y gate de venta integrados.  
**Estado:** CI offline PASS; Wix Runtime no aceptado; release NO-GO.

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

## Gates y límites

- La naturaleza temporal se deriva en `tpvRecordNature.js`; no aceptar valores del cliente.
- Sin singleton `MapaStaff/CONFIG_SISTEMA` y `productionActivationAt`, los registros válidos se clasifican SYNTHETIC.
- `registrarVenta` no crea intención nueva cuando `saleReady=false`; los replays idempotentes se resuelven antes del gate.
- El TPV actual permanece MODO CONSULTA/`saleReady=false`; no se ha acreditado venta persistida, pago o movimiento físico Runtime.
- No activar pagos, Draft Orders, reembolsos, writers fiscales ni efectos externos durante QA.
- No mutar ni reutilizar `CajaActual` ABIERTA ni ledgers históricos para pruebas.

## Validación

- PR #640: 81 suites / 764 tests PASS offline.
- Clasificación: pruebas de corte ausente, anterior, igualdad, posterior y timestamps inválidos.
- No ejecutado: Wix Preview/Runtime, UI E2E, permisos reales de rol, persistencia online, concurrencia Wix, hardware y recuperación.
- Los tests offline y contratos no sustituyen aceptación Runtime.

La autoridad de flujo es [docs/TPV-UNIFIED-FLOW.md](../../../docs/TPV-UNIFIED-FLOW.md); el estado de aceptación es [docs/STATE-NOW.md](../../../docs/STATE-NOW.md).
