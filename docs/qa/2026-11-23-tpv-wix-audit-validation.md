# Validación de auditoría Wix — TPV (23-11-2026)

## Alcance y referencia

Repositorio: `nachoortegazgz/marianmadridz`  
Rama: `feat/tpv-neutral-contract-block1-v2-20261123`  
PR: #537 (abierta; no fusionada)  
Alcance: inspección estática de los contratos de venta, apertura de caja, cierre Z, persistencia lógica y nomenclatura de estados.

Esta validación no equivale a una ejecución Wix Runtime ni a una prueba E2E en Preview.

## Resultado por hallazgo

| Hallazgo de la auditoría | Resultado | Evidencia / decisión |
|---|---|---|
| 1. `SALE_REGISTER`: `lines/payments` frente a `lineas/pagos` | No reproducido en la rama revisada | El widget envía `lineItems/payments`; `tpvPageController.js` transforma cada línea a `lineas` con `tipoLinea`, `itemId`, `varianteId`, `concepto`, `cantidad`, `precioUnitario`, `descuentoImporte`, `impuestosImporte`, `profesionalId` y `stockAfectado`. Los pagos se convierten a `pagos` con `medioPago`, `importe` e `importeCambio`. `tpvVentas.web.js` pasa esos campos a `validateSaleDraft`; el validador exige exactamente `lineas/pagos`. |
| 2. Apertura `abrirCaja` frente a `abrirSesionCaja` | No reproducido | El controlador importa `abrirSesionCaja` desde `tpvCaja.web`, lo llama en `SESSION_OPEN`; el módulo exporta `abrirSesionCaja`. |
| 3. Unidad de `countedCash` en Z | Verificado correcto | El controlador transmite euros como `countedCash`. `generarCierreZ` convierte con `toMinorUnits(input.countedCash, "COUNTED_CASH")` y persiste `countedCashMinor`. |
| 4. Colecciones lógicas con prefijo SANDBOX | Corregido previamente | `TPV_COLLECTIONS` utiliza `TPV_LOGICAL_*`; `TPV_LEGACY_COLLECTIONS` conserva los discriminadores anteriores para compatibilidad. Son discriminadores lógicos, no IDs de colecciones CMS. |
| 5. `_ensureCajaActualForSandbox` | Ya neutralizado | El helper activo es `_ensureCajaActual`. No se requiere renombrado adicional. |
| 5. `LEGACY_TPV_LEDGER_SOURCE` | Mantener temporalmente | Se usa para reconocer registros históricos. También existe una ruta de continuidad/proyección de una sesión histórica; retirarla sin migrar/cerrar sesiones podría bloquear el TPV. No eliminar hasta disponer de migración compatible y pruebas de transición. |
| 6. Estados `GENERADO_SINTETICO` y `CERRADO_SINTETICO` | Corregido en esta intervención | Ticket X usa `status: GENERADO`; Ticket Z usa `status: CERRADO`; ambos incluyen `sourceType: SYNTHETIC` como campo separado. Los estados de venta/pago conservan su contrato existente y no se renombraron sin revisar todos sus consumidores. |

## Cambios aplicados

- `src/backend/tpv/tpvCierres.web.js`: neutralizados los estados de los eventos Ticket X y Ticket Z; se incorpora `sourceType` explícito en cada registro.
- `src/backend/internalConfig.js`: comentario de política actualizado para describir los controles explícitos source/site/version/session/hash y el carácter histórico del marcador legacy.
- `src/backend/tests/tpv.qa.persistence.policy.test.mjs`: fixtures de integridad y locks actualizados para metadata neutral, conservando una prueba explícita de compatibilidad histórica.
- `src/backend/tests/tpv.web-modules.contract.test.mjs`: aserciones actualizadas y prueba estática para estados neutrales X/Z y conversión de importe de Z.

## Riesgos y límites

1. La persistencia de Ticket X/Z sigue siendo sintética; `sourceType: SYNTHETIC` no significa conciliación nativa ni escritura en Wix Payments, Wix Invoices o un proveedor.
2. La compatibilidad de sesiones históricas no debe retirarse hasta definir y probar la transición de `CajaActual`.
3. El cambio de estados de Ticket X/Z puede afectar consumidores externos no presentes en el repositorio; se requiere validación en Preview y revisión de integraciones antes de publicar.
4. La auditoría estática no acredita permisos Wix efectivos, comportamiento del CMS, locks distribuidos en runtime ni ausencia de carreras.

## Validación ejecutada

- Inspección de los archivos y contratos citados en la tabla.
- Comprobación de que la apertura importa una exportación existente.
- Comprobación del mapeo DTO completo entre widget, controlador y validador.
- Comprobación de la conversión euros → céntimos en Ticket Z.
- Comprobación de los discriminadores lógicos neutrales y del helper neutral.
- No se ejecutaron tests locales ni CI en esta intervención: la integración no devolvió ejecuciones ni checks asociados al último commit consultado.
- No se ejecutaron escrituras CMS, pagos, devoluciones, cambios en LIVE ni publicación.

## Estado

**Parcial — no apto para declarar E2E validado.** La lista concreta de la auditoría queda atendida en sus correcciones válidas de código y tests estáticos, pero el gate de aceptación sigue pendiente de CI verificable y pruebas Wix Preview apertura → venta → Ticket X/Z, incluyendo reintento y conciliación.
