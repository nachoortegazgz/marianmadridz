# TPV — backend, contratos y validación

**Estado de `main`:** PR #611 integrada en merge commit `62fdcb7b560f7eab16f1188ecf9227ae7b45d5cf` (2026-11-25). **Release: NO-GO.** La preparación de venta es read-only; no hay persistencia comercial, pagos ni writers fiscales habilitados.

## Criterio de ejecución vigente — flujo único

El TPV debe operar con un único flujo de backend, un contrato de dominio y una ruta de persistencia para cualquier dato. No se admiten ramas funcionales por etiquetas Sandbox/Live, sintético/real, Preview/Published o test-run. Las pruebas deben ejercitar la misma lógica mediante fixtures y dobles de test; no mediante un runtime paralelo. La especificación vinculante y el plan de migración están en [docs/TPV-UNIFIED-FLOW.md](../../../docs/TPV-UNIFIED-FLOW.md).

La implementación aún no cumple este criterio: el controlador importa tpvTestRuntime.web.js, el repositorio rechaza escrituras operativas y internalConfig.js conserva marcadores históricos. No retirar guard ni runtime hasta completar el contrato físico/fiscal de MovimientosCaja y probar la ruta única. Esta sección sustituye instrucciones anteriores de mantener escrituras/runtimes diferenciados por clasificación de datos.

## Arquitectura y autoridad

- `MovimientosCaja` es el ledger físico canónico. No crear `TransaccionesTPV` ni otro ledger alternativo.
- Wix CMS es SSOT transaccional; SharePoint solo custodia evidencia.
- Los ledgers son append-only; rectificaciones mediante nuevos registros trazables.
- No se generan nuevas ventas, pagos, devoluciones o cierres sintéticos. Los registros sintéticos históricos se conservan intactos y solo se leen mediante compatibilidad explícita.
- Frontend: presentación/orquestación. Backend/WebMethods: catálogo, importes, fiscalidad, permisos y reglas.
- No activar pagos reales, writers fiscales, pedidos ni efectos externos durante QA.

## Preparación de venta (PR #611)

### Backend
- `tpvSalePreparationCore.js`: normalización estricta, cantidades enteras, cálculo monetario en céntimos y reconciliación fiscal por línea.
- `tpvSalePreparation.js`: consulta productos y variantes mediante Wix Stores Catalog V3; servicios Bookings de precio fijo; profesional autorizado; lectura de tax settings y cálculo fiscal Wix.
- `tpvVentas.web.js`: `validarVentaBorrador` no confía en precios, impuestos ni totales enviados por el navegador.
- El resultado devuelve precios/base imponible/impuestos/totales calculados en backend y estado de preparación. No persiste datos.

### Frontend
- `tpvPageController.js` envía los datos mínimos de línea y método de pago.
- El widget solicita cotización al cambiar líneas, descarta respuestas obsoletas y presenta los importes backend.
- Pago/registro se bloquean si `saleReady !== true` o no existe capability de escritura.
- No se declara venta completada ni se limpia el ticket sin confirmación de persistencia.
- Líneas personalizadas, descuentos no autorizados y bonos/tarjetas regalo sin validación de saldo están bloqueados.

## Contrato de preescritura V1 (PR #612, integrado en main)

El módulo puro `tpvWriteV1Contract.js` delimita el primer writer sin persistir:
- Una única tasa impositiva verificable en todas las líneas. Una venta con más de una tasa queda bloqueada; no se selecciona una tasa representativa.
- Un único medio de pago admitido: efectivo, tarjeta o Bizum.
- El importe aplicado (importe recibido menos cambio) debe coincidir exactamente con el total recalculado por Wix.
- El pago en efectivo puede incluir cambio; la proyección aplica solo el importe neto recibido.
- La elegibilidad de este contrato NO acredita que el pago bancario se haya recibido ni autoriza escritura.
- `registrarVenta` recalcula catálogo e impuestos en backend y aplica el contrato V1 antes de devolver el bloqueo de persistencia. No confía en importes fiscales del navegador.

La persistencia continúa cerrada por ausencia de configuración fiscal verificada, writer append-only canónico, evidencia del pago y aceptación Runtime. No se debe interpretar `writeContractV1.eligible=true` como `saleReady=true`.

## Evidencia Wix read-only — 2026-11-25

- 24 productos Stores y 70 servicios Bookings de precio fijo EUR.
- `taxSettings.getTaxSettings`: `taxIncludedInItemPrices=false`; el código admite modo inclusivo y exclusivo.
- Cálculo fiscal Wix probado en muestras de producto/servicio; el backend reconcilia importes por línea y falla cerrado ante resultados inconsistentes.
- 30 registros de inventario con `trackQuantity=true`, todos en ubicación virtual online. La ubicación física del salón existe, pero tiene 0 registros asignados.
- No se ha transferido ni inicializado stock. La ubicación física requiere recuento y asignación controlada antes de vender productos desde el TPV.
- La presentación pública del precio final al consumidor no está verificada.

## Bloqueos obligatorios

1. **Ledger:** `tpvRepository.insertTpvEvent()` falla cerrado mediante guard; `MovimientosCaja_beforeInsert` rechaza TPV_*. El builder actual no completa todos los campos fiscales obligatorios. Retirar un guard no constituye un writer válido.
2. **Fiscal:** no se encontró singleton `CONFIG_SISTEMA_FISCAL` (`MapaStaff`, `recordType=CONFIG_SISTEMA`, consulta 2026-11-25: 0 registros). `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`.
3. **Pagos presenciales:** no existe contrato de captura bancaria integrado. El flujo manual requiere confirmación del empleado tras comprobar el lector externo y conservar el justificante para conciliación; no se simula confirmación bancaria.
4. **Inventario:** 0 ítems en la ubicación física. No vender producto sin inventario físico validado por variante y ubicación.
5. **Precio al consumidor:** con IVA excluido del precio de catálogo y presentación pública no verificada, no se autoriza venta; RDL 1/2007 arts. 20.1.c y 60.2.c exige precio final completo.
6. **Runtime/hardware:** Wix Preview/Runtime, Epson, cajón monedero y lector externo no probados en esta validación.

## Resultado de preparación

`catalogVerified=true`, `taxVerified=true` para el cálculo de preparación; `paymentVerified=false`, `persisted=false`, `saleReady=false`. `inventoryVerified` solo puede considerarse para las líneas de servicio que no requieren stock; los productos permanecen bloqueados hasta validar inventario físico.

## CI acreditada

- Commit de código probado: `b3ed704fa6a7a37ddba4975e4c1136c681b4630f`.
- Backend offline quality gates: run `45555933654` PASS (package/lock, dependencias, npm audit, Layer 1, Layer 2, suite completa, SDK Wix y ESLint).
- Gitleaks full-history: run `45555933681` PASS.
- Merge PR #611: `62fdcb7b560f7eab16f1188ecf9227ae7b45d5cf`.
- Wix Preview/Runtime: no ejecutado. La CI no acredita ejecución en Wix.

## Secuencia técnica pendiente

1. Contrato de sesión de caja/venta e idempotencia que reutilice los controles existentes.
2. Writer append-only válido para `MovimientosCaja`, con todos los campos fiscales y compatibilidad explícita con hook/política de datos.
3. Configuración fiscal legalmente verificada, sin activar flags por conveniencia.
4. Confirmación manual del lector y registro de evidencia/conciliación, sin fingir captura bancaria por API.
5. Recuento y asignación de inventario físico por variante.
6. Verificación de precio final al consumidor.
7. Pruebas Runtime de permisos, concurrencia, idempotencia, hardware, caja, X/Z y recuperación.

No desplegar ni habilitar ventas reales hasta superar todos los gates, revisar diff y disponer de reversión.
