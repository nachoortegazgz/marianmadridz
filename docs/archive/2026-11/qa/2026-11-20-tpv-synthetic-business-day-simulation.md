# Simulacro TPV — jornada sintética de negocio

**Fecha de preparación:** 2026-11-20  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Escenario:** `TPVQA-DEV-20261120-DAY01`  
**Naturaleza:** simulación determinista offline; no ejecuta Wix Runtime ni persiste en CMS.

## Objetivo y límites

Evaluar los contratos reales de validación de ventas del backend TPV con un conjunto coherente de operaciones de un día de peluquería/estética. El simulacro importa `validateSaleDraft()` y `makeSyntheticPayload()`; genera los eventos únicamente en memoria. No llama a WebMethods de escritura, CMS, Wix Payments, Bookings, Stores, fiscalidad, correo, SharePoint ni hardware.

Las identidades, referencias de catálogo y documentos del escenario llevan prefijo QA y son datos ficticios. No representan clientes, profesionales, artículos ni operaciones reales.

## Datos de escenario

- Fondo inicial de caja: 150,00 EUR.
- Clientes: `QA-CLI-0001` a `QA-CLI-0003`.
- Profesionales: `QA-STAFF-0001` y `QA-STAFF-0002`.
- Catálogo: `SRV-CORTE`, `SRV-MANICURA`, `PRD-CHAMPU`, `PRD-MASCARILLA`.
- Tres ventas totalmente cobradas:
  - Venta 001: corte y peinado 45,00 + impuesto informado 9,45; champú 18,00 + impuesto informado 3,78. Total 76,23 EUR. Efectivo recibido 100,00; cambio 23,77; efectivo aplicado 76,23.
  - Venta 002: manicura 32,50 + impuesto informado 6,83. Total 39,33 EUR. Bizum simulado.
  - Venta 003: mascarilla 24,90 + impuesto informado 5,23. Total 30,13 EUR. Tarjeta simulada.
- Devolución sintética de 30,13 EUR asociada a la venta 003, entregada en efectivo.
- Movimiento de caja: entrada 20,00 EUR y salida 12,00 EUR.

Los impuestos son importes explícitos de fixture para comprobar el contrato del backend. El simulacro no determina el tipo impositivo aplicable ni sustituye la validación fiscal/legal.

## Resultado esperado de conciliación

| Métrica | Resultado |
|---|---:|
| Ventas | 3 |
| Venta bruta | 145,69 EUR |
| Devolución | 30,13 EUR |
| Venta neta de devoluciones | 115,56 EUR |
| Cobrado en efectivo aplicado | 76,23 EUR |
| Cobrado por tarjeta | 30,13 EUR |
| Cobrado por Bizum | 39,33 EUR |
| Fondo inicial | 150,00 EUR |
| Entrada de caja | 20,00 EUR |
| Salida de caja | 12,00 EUR |
| Devolución en efectivo | 30,13 EUR |
| **Efectivo esperado en cajón** | **204,10 EUR** |

Fórmula del cajón: 150,00 + 76,23 + 20,00 − 12,00 − 30,13 = 204,10 EUR. El cambio entregado ya está descontado del efectivo aplicado; no se resta por segunda vez.

## Pruebas incluidas

Archivo: `src/backend/tests/tpv.business-day.simulation.test.mjs`.

1. Validación de tres ventas con líneas de servicio/producto, importes e impuestos explícitos y medios de pago mixtos entre operaciones.
2. Conciliación del cajón en unidades menores (céntimos).
3. Separación de efectivo recibido, cambio y efectivo aplicado.
4. Repetición de clave idempotente en el modelo de escenario sin duplicar la venta.
5. Rechazo de precisión inválida y sobrepago; reconocimiento de pago parcial.
6. Comprobación de marcadores sintéticos y ausencia de persistencia/efectos externos.
7. Aislamiento de identidades y referencias de catálogo ficticias.

El replay de idempotencia aquí prueba la fixture en memoria; **no** demuestra la atomicidad del repositorio CMS ni la concurrencia de los WebMethods. Las pruebas de caja, devoluciones, ticket X/Z, reservas, stock y cierres tampoco quedan certificadas por este simulacro.

## Ejecución

La suite se incorpora automáticamente al runner canónico porque termina en `.test.mjs`:

```powershell
npm test
```

Prueba aislada:

```powershell
node --no-warnings --loader ./src/backend/tests/loader.mjs ./src/backend/tests/tpv.business-day.simulation.test.mjs
```

## Interpretación del resultado

- **Offline PASS:** el contrato puro de validación de venta y los invariantes aritméticos del escenario superan las pruebas.
- **No equivale a Wix Sandbox E2E:** no se han ejecutado WebMethods contra el data plane Wix.
- **TPV QA persistente continúa bloqueado:** `TPV_QA_RUNTIME_POLICY.ENABLED=false` en configuración canónica. El override del loader solo vive dentro del proceso de pruebas offline.
- No se modificó `CajaActual`, `MovimientosCaja`, `TpvSandboxIdentities`, `ControlOperativo` ni ningún ledger.
- No se habilitaron pagos, escrituras fiscales/contables, notificaciones ni hardware.

## Bloqueos y siguientes pruebas necesarias

1. Acreditar aislamiento por invocación WebMethod y lectura/escritura exclusiva del CMS Sandbox.
2. Crear fixtures de identidad y sesión dentro de un Sandbox demostrado; no usar el singleton LIVE.
3. Ejecutar ventas, movimientos, devoluciones, arqueo, tickets X/Z, replays y concurrencia contra Wix Sandbox.
4. Resolver H-01: atomicidad y concurrencia de todos los escritores de `CajaActual`.
5. Ejecutar regresión completa y pruebas runtime antes de habilitar persistencia QA.

**Conclusión:** el escenario aporta datos y comprobaciones reproducibles sobre la validación de ventas y la aritmética de caja. No habilita el TPV ni permite declarar funcional la jornada completa en Wix Runtime.
