# Hito TPV-01 — núcleo único y clasificación temporal

**Estado:** implementación principal integrada; aceptación Runtime pendiente.  
**PR de implementación:** #640.  
**Release:** NO-GO.

## Objetivo

Unificar interfaz, contratos, WebMethods, validación y persistencia sin runtime de negocio paralelo. La marca sintético/real se deriva en backend y no selecciona una ruta de ejecución.

## Entregables integrados

- Retirada del runtime separado de pruebas de la ruta activa; compatibilidad histórica queda aislada para lectura/validación donde existan consumidores.
- Clasificador backend `tpvRecordNature.js` con timestamp UTC de servidor y lectura del corte único desde `MapaStaff/CONFIG_SISTEMA.productionActivationAt`.
- Persistencia de `recordTimestamp` y `recordNature` en los escritores TPV cubiertos por PR #640: eventos físicos, sesión proyectada, auditoría e intención comercial.
- Validación temporal estricta y rechazo de timestamp/corte inválidos o configuración ambigua.
- `registrarVenta()` aplica los mismos `saleReadinessBlockers` que `validarVentaBorrador()`; no persiste una intención nueva si no está lista.
- Contrato documental de colecciones: `TransaccionesTPV` intención comercial no contable; `MovimientosCaja` ledger físico; `ControlOperativo` locks/auditoría; `CajaActual` proyección.

## Evidencia

- PR #640 integrada en main.
- CI de PR #640: 81 suites, 764 tests, 0 fallos.
- El código de clasificación se cubre en límites sin corte, antes, igualdad, después y entradas inválidas.
- La revisión de la PR incluye pruebas contractuales para el gate de venta y la ausencia de Draft Orders/pagos externos.

## No incluido / pendiente

- No se ha ejecutado Wix Preview ni Wix Runtime E2E.
- No se ha demostrado sincronización del SHA Git con el Editor Wix.
- No existe registro `MapaStaff/CONFIG_SISTEMA` ni corte `productionActivationAt` en el read-back del 2026-11-27; la clasificación real permanece inactiva.
- El widget TPV permanece MODO CONSULTA y `saleReady=false`.
- No se ha probado venta persistida, movimiento físico, caja, cierre, devolución, conciliación ni hardware.
- El writer fiscal/contable y jornada siguen fail-closed.

## Criterio de cierre del hito

1. Tests unitarios/contrato/CI PASS en el SHA integrado.
2. Preview con fingerprint del build y bridge funcional.
3. WebMethods probados con permisos de rol y fixtures sintéticos aislados.
4. Pruebas de idempotencia, concurrencia, timeout/recovery y reconciliación.
5. Read-back Wix que confirme exactamente una escritura por operación y proyección consistente.
6. Ningún efecto externo real y rollback probado.

El hito está integrado en código, pero no aceptado como funcional en Runtime hasta completar los puntos 2–5.
