# Auditoría de persistencia — colecciones CMS personalizadas

**Fecha:** 2026-11-13  
**Sitio:** marianmadrid.es  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Naturaleza:** lecturas consistentes de CMS y Bookings Reader V2 + revisión estática de writers, validadores y jobs. Sin escrituras de producción.

## 1. Inventario físico

Wix devuelve 44 colecciones: 15 `NATIVE` y 29 `WIX_APP`. Las colecciones `WIX_APP` se han tratado como estrictamente de lectura. De las 15 `NATIVE`, 14 coinciden con `BUSINESS_COLLECTIONS` y existe además `RegistroIntegracion`, que no está en el mapa canónico de colecciones ni tiene writer/consumidor activo demostrado en `src/`.

| Colección | Registros live | Interpretación |
|---|---:|---|
| `CajaActual` | 1 | Singleton técnico `SIMULACION`; no es caja real |
| `CitasF2` | 0 | Proyección de reservas ausente |
| `ComplementosCatalogo` | 36 | Catálogo; campos críticos comprobados |
| `ControlOperativo` | 0 | Sin marcadores/alertas/locks en este corte |
| `DatosFiscales` | 1 | Tercero placeholder; falta `CONFIG_SISTEMA` |
| `HistoricoCierresZ` | 0 | Sin cierres fiscales |
| `PaquetesGestoria` | 0 | Sin snapshots documentales |
| `InventarioStockVenta` | 1 | Colección legacy, no fuente de verdad |
| `MovimientosInventario` | 1 | Fila histórica sintética; ledger legacy |
| `LibroAsientosContablesDetalle` | 0 | Writer existente pero deshabilitado |
| `MapaStaff` | 3 | Tres mapeos activos completos |
| `MovimientosCaja` | 0 | Escritor fiscal fail-closed |
| `RegistrosHorariosStaff` | 2 | Filas sintéticas QA sin HMAC |
| `ServiciosCatalogo` | 95 | 94 servicios + 1 plan |
| `RegistroIntegracion` | 0 | Colección no canónica sin writer activo |

Los permisos de colección devueltos por Data Collections V2 son `ADMIN` para insert/update/remove/read en las 15 colecciones. Esto no sustituye la auditoría separada de permisos efectivos de Content Manager (issue #261).

### Discrepancia de recuentos entre cortes

El recuento actual se repitió con dos métodos REST independientes (`Count Data Items` y `Query Data Items`, ambos con `consistentRead=true`). Ambos devuelven cero para `ControlOperativo`, `MovimientosCaja` y `LibroAsientosContablesDetalle`.

Esto contradice el informe live del 2026-11-12 (`docs/qa/2026-11-12-live-cms-field-completeness.md`), que había devuelto respectivamente 11, 10 y 1 filas para el mismo Site ID. No se puede concluir que esos registros hayan sido eliminados, ni que la lectura anterior fuese incorrecta. Queda abierta una discrepancia de procedencia/identidad del conjunto de datos: hay que comparar IDs internos de colección, sitio/contexto de autorización, revisiones y el método exacto de lectura usado en ambos cortes. Por el principio append-only, no se ejecuta ninguna restauración, recreación o escritura compensatoria hasta reconciliar esta discrepancia.


## 2. Reservas — incidencia P1

Lectura paginada de Bookings Reader V2: 346 reservas (73 CONFIRMED, 255 CANCELED, 18 CREATED). `CitasF2` contiene cero filas.

Para las 73 confirmadas:
- 56 tienen servicio, fechas, resourceId y scheduleId utilizables.
- 17 no tienen resourceId y el snapshot no ofrece staff identity suficiente para resolverlo.
- Una de las 56 completas tiene paymentStatus PAID y está ligada a un pedido eCommerce; no debe proyectarse/contabilizarse por la reconciliación de reservas no pagadas.
- Las otras 55 son candidatas técnicas a proyección no financiera.
- La rutina `reconcileMissingConfirmedBookingProjections` existe en `crons.js` y está declarada en `jobs.config` cada hora en los minutos 15 y 45. El código proyecta reservas confirmadas no pagadas con campos completos y alerta los casos sin recurso o con estado financiero bloqueante. No hay evidencia de ejecución runtime; no se ha invocado manualmente.

Para las 18 CREATED, 13 disponen de campos de reserva suficientes y 5 carecen de recurso. La proyección inicial depende del evento Bookings Created.

### Defecto de contrato Velo corregido en PR #327 e integrado en main

La documentación oficial de Velo define:
- Booking Created: `wixBookings_onBookingCreated`.
- Booking Rescheduled: `wixBookings_onBookingRescheduled`.
- Booking Confirmed: `wixBookingsV2_onBookingConfirmed`.
- Booking Canceled: `wixBookingsV2_onBookingCanceled`.

El código exportaba los dos primeros con prefijo `wixBookingsV2_`, que no coincide con el contrato de Velo. PR #327 corrige las exportaciones, conservando los handlers de dominio, la reclamación idempotente por `metadata.id`, el parser del payload y las escrituras actuales. Las pruebas contractuales y de integración se actualizaron y la PR está integrada en `main`.

**Límite causal:** el nombre incorrecto explica por qué Wix no puede invocar esos dos handlers con el nombre documentado. No prueba por sí solo por qué faltan las 73 proyecciones históricas: también hay que confirmar SHA publicado, delivery y logs. El handler Confirmed ya tenía el nombre V2 correcto. La corrección no hace backfill ni crea registros por sí misma.

## 3. Catálogos y personal

### ServiciosCatalogo

- 95 filas: 94 SERVICE y 1 PRICING_PLAN.
- Cero serviceId duplicados.
- Todas las duraciones de servicio cumplen `totalDuration = phase1Duration + exposureDuration + phase2Duration`.
- Un servicio, **Rayos V** (`serviceId=1383a39a-9b14-46c4-a8c2-bc9045534a1f`), carece de `taxIncluded`. Sí tiene precio 20 EUR y `tipoImpositivo=0.21`.
- `taxIncluded` figura en la matriz de trazabilidad de catálogo, pero el esquema físico y el hook actual no lo exigen y la búsqueda de consumidores backend no encontró uso del campo. No se infiere ni se rellena `true/false`: hay que confirmar el tratamiento de precio con el propietario/gestor y contrastarlo con el servicio nativo antes de normalizarlo.

La lectura adicional de Wix Tax Settings devuelve `taxIncludedInItemPrices=false` (ajuste global efectivo del checkout). Sin embargo, los otros 93 servicios y los 36 complementos personalizados tienen `taxIncluded=true`; Rayos V es el único sin valor. Esto es una discrepancia entre metadato CMS y ajuste global, no una base para sobrescribir el catálogo: el ajuste global de Wix gobierna el cálculo del checkout, y el código backend examinado no consume `taxIncluded` para calcular el impuesto. Se mantiene como incidencia de contrato/datos; no se cambia el precio ni el IVA.

Hay además una comparación directa: **Barba Perfecta: Arreglo y Perfilado** tiene `taxIncluded=true` en `ServiciosCatalogo`, mientras su línea del pedido pagado #10030 devuelve `taxInfo.taxIncludedInPrice=false`. En cambio, las líneas Bookings de #10017 y #10018 devuelven `true`. La evidencia confirma que el flag fiscal efectivo puede diferir por línea y que el metadato CMS no debe tratarse como autoridad de checkout. El backend fiscal utiliza el desglose fiscal de la línea/pedido Wix. La discrepancia requiere decisión de negocio/gestor sobre la semántica del campo personalizado; no se actualiza ni el catálogo ni el ajuste global.

### ComplementosCatalogo

36 filas; `addonId`, `sku`, nombre, precio, `taxIncluded` y `tipoImpositivo` están poblados en todos los registros examinados. Sin duplicados de addonId ni SKU.

### MapaStaff

3/3 activos; `staffMemberId`, `resourceId`, `scheduleId`, `memberId` y `active` presentes. Sin duplicados de staffMemberId ni resourceId.

## 4. Fiscal, contable, laboral y caja

- `DatosFiscales`: falta `recordType=CONFIG_SISTEMA`. El registro existente es un tercero placeholder; no se usa como emisor.
- `MovimientosCaja`: 0; `LEDGER_WRITES_ENABLED=false`. No generar hechos retroactivos sin evidencia y aprobación fiscal.
- `LibroAsientosContablesDetalle`: 0; `appendAccountingEntry` existe, pero `ACCOUNTING_LEDGER_WRITES_ENABLED=false` y la aprobación de reglas PGC sigue pendiente.
- `HistoricoCierresZ`: 0; no existe un ledger comercial válido sobre el que cerrar.
- `PaquetesGestoria`: 0; Capa 3 y despacho siguen deshabilitados.
- `CajaActual`: conserva el singleton `SINGLE_ITEM_ID` / `CAJA_PRINCIPAL` en estado `SIMULACION`. El writer lo rechaza para movimientos reales.
- `RegistrosHorariosStaff`: dos filas sintéticas QA sin `signature`. El CMS marca signature opcional, pero `assertRegistrosHorariosStaff` exige HMAC SHA-256 de 64 hex y el writer firma antes de insertar. `STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false`; no editar las dos filas ni habilitar escrituras sin probar secuencia/idempotencia/concurrencia.
- `ControlOperativo`: 0 en el corte. Los handlers y crons usan esta colección para reclamaciones, dedupe y alertas. La ausencia actual no demuestra que nunca se hayan ejecutado, pero no hay evidencia persistida actual que acredite los flujos.

## 5. Inventario

Las directrices vigentes fijan Wix Stores Catalog/Inventory como única SSOT de stock. `InventarioStockVenta` y `MovimientosInventario` son legacy y no deben recibir nuevas escrituras. Se conserva la fila histórica existente; no se crean movimientos paralelos ni proyecciones que dupliquen los efectos nativos de Wix.

## 6. Colección RegistroIntegracion

La colección existe físicamente y tiene campos genéricos para eventos/entrega, pero no está en `BUSINESS_COLLECTIONS`, no se han encontrado escritores ni consumidores activos en `src/`, y su recuento es cero. No se añade un writer por el mero hecho de existir el esquema. Si se decide activarla, antes se necesita contrato aprobado, owner del dato, fuente de verdad, idempotency key, retención y consumidores.

## 7. Cambios y pruebas

Cambio ejecutable integrado mediante PR #327 (merge squash `14d4d1d0a1992cfa62876b4c5c1c521314bf746a`):
- `src/backend/events.js`: nombres Velo correctos para Created y Rescheduled.
- `src/backend/tests/events.backend-events.contract.test.mjs`: assertions de los nombres oficiales.
- `src/backend/tests/events.order-id-validation.contract.test.mjs`: reclamación idempotente para los nombres oficiales.
- `src/backend/tests/events.native-booking-sync.test.mjs`: llamadas a exports oficiales.

Documentación:
- Este informe.
- Actualización de la auditoría previa de proyección y del dossier/matriz de estado para no conservar nombres de handlers incorrectos.

Sin escrituras Wix, pagos, reservas, stock, caja, ledgers ni publicación.

## 8. Validación y despliegue pendiente

**CI verificada sobre el HEAD de PR #327 (`decb52a5044ca3aa60ea8ab9a39ea66a11696654`):**
- Layer 1: 22 suites, 288 PASS, 0 FAIL.
- Layer 2: 17 suites, 239 PASS, 0 FAIL.
- Regresión completa: 66 suites, 611 PASS, 0 FAIL.
- Contratos Wix Cart V2, Order Transactions y Bookings Reader V2: PASS.
- ESLint: PASS.
- Gitleaks full-history: PASS.
- CI posterior al merge sobre `main` (`14d4d1d0a1992cfa62876b4c5c1c521314bf746a`): PASS.

**Pendiente de Wix Runtime:**
1. Sincronizar `main` con Wix Editor y publicar manualmente por el propietario.
2. Verificar en Runtime los handlers Created/Rescheduled mediante logs existentes o una operación controlada y autorizada; no usar reservas reales como prueba sin plan de reversión/compensación aprobado.
3. Revisar la ejecución del cron de reconciliación y los logs de su traceId.
4. Releer CMS: `CitasF2` debe mostrar únicamente las proyecciones elegibles; los 17 sin recurso y la reserva PAID deben quedar en revisión, no inventar asignaciones.
5. Confirmar no duplicados por bookingId y estado/slot coherente con Bookings Reader V2.

**Estado:** auditoría de colecciones completada; corrección de handlers integrada en `main`; runtime de reservas y cierre fiscal/contable siguen pendientes.
