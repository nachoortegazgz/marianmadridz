# Auditoría de ejecución — brechas de registro de datos

**Proyecto:** Marian Madrid · `www.marianmadrid.es`  
**Fecha de auditoría:** 2026-11-09  
**Base inspeccionada:** rama `main` del repositorio `nachoortegazgz/marianmadridz`  
**Tipo de cambio:** documentación de auditoría; no modifica código, CMS ni datos operativos.

## 1. Objetivo

Reconciliar el plan de ejecución aportado con el código que existe actualmente en `main`, identificar qué brechas de persistencia siguen abiertas y establecer una secuencia segura para cerrarlas. El informe aportado referencia `main (cb24e40)`; el código inspeccionado ahora presenta una estructura y contratos posteriores, por lo que no se han aplicado sus tareas de forma literal.

## 2. Resultado ejecutivo

| Tarea del plan | Estado en `main` | Evidencia / conclusión |
|---|---|---|
| D-01 / C-01 — persistir `scheduleId` en CitasF2 | **PARCIALMENTE RESUELTA** | `src/backend/booking/bookingCore.js::_persistBooking` exige GUID y escribe `BOOKING_FIELDS.SCHEDULE_ID`. Sin embargo, `src/backend/validation.js::assertCitasF2` y el hook `CitasF2_beforeInsert` de `src/backend/data.js` no exigen `scheduleId`. El contrato físico CMS también requiere comprobación en Wix. |
| D-02 / C-03 — `orderId` en movimientos de pedido | **IMPLEMENTADA EN WRITER PRINCIPAL** | `src/backend/events.js::wixEcom_onOrderPaymentStatusUpdated` pasa `orderId` y `transactionId` a `registrarEventoEconomico`; el flujo de recuperación fiscal también conserva `orderId`. Falta validar el esquema físico CMS y el CSV exportado. |
| D-03 / C-04 — intención `order_created` | **BRECHA ABIERTA / ADR-02 NECESARIO** | `wixEcom_onOrderCreated` verifica/deduplica el evento y llama a `reserveOrderInventoryInternal`; no crea un registro de intención de compra ni proyecta `orderId` y líneas en una colección de intención. No se debe escribir en CitasF2 sin decisión de dominio. |
| D-04 / C-06 — arqueos X append-only | **NO IMPLEMENTADA EN EL MÓDULO INSPECCIONADO** | No se encontró `registerXCount` ni colección `ArqueosCaja` en `src/backend/cajas.web.js` / `internalConfig.js`. Requiere ADR-03 y esquema CMS. |
| D-05 / C-07 — actas de recuento de inventario | **NO IMPLEMENTADA EN EL MÓDULO INSPECCIONADO** | No se encontró `registerRecuentoInventario` ni colección `ActasRecuentoInventario` en `src/backend/inventario.web.js` / `internalConfig.js`. Requiere ADR-03 y esquema CMS. |
| D-06 / ADR-04 — facturas recibidas pagadas por banco | **DESTINO CANÓNICO DEFINIDO** | La regla canónica indicada por el responsable del sistema es que los procesos que no pasan por caja física (incluidas facturas recibidas y pagos bancarios a proveedores) se consolidan en `LibroAsientosContablesDetalle`. No deben generar movimientos ficticios en `MovimientosCaja` ni actualizar `CajaActual`. Se debe verificar el contrato de campos y el writer contable existente antes de conectar estos procesos. |

## 3. Contradicciones del plan que impiden ejecución literal

### 3.1 Enums de reserva

La decisión del responsable del sistema fija `CANCELED` como único valor canónico tanto en el contrato CMS de CitasF2 como en los mapeos internos. `CANCELLED` debe desaparecer de enums, escritores, validadores, consumidores, pruebas y documentación activa. La traducción desde el estado nativo Wix debe conservar el contrato nativo y mapearlo explícitamente a `CITAS_BOOKING_STATUS.CANCELED`. Cualquier registro histórico con el valor anterior requiere inventario y migración controlada, nunca una sustitución masiva no auditada.

### 3.2 DISPLAY_TOKEN

El plan B-04 propone añadir `DISPLAY_TOKEN` a `CONTROL_TYPE`. Ya está declarado en `src/backend/internalConfig.js`. No procede duplicar la constante. Sí queda pendiente verificar que los hooks y la documentación describen correctamente su naturaleza efímera y su política de borrado.

### 3.3 Destino de las intenciones de compra

El handler `order_created` tiene responsabilidad actual de reserva de inventario, no de registrar una intención comercial en una colección propia. La existencia de Wix Orders no autoriza a reutilizar CitasF2. ADR-02 debe decidir si Wix Orders es suficiente como SSOT de la intención y si basta una proyección de auditoría, o si se necesita una colección NATIVE específica. No se debe crear una segunda fuente de verdad del pedido.

### 3.4 Facturas recibidas

No se crea una colección paralela `FacturasRecibidas` para estos datos. El registro contable de estos procesos se consolida en `LibroAsientosContablesDetalle`. La clasificación del asiento debe distinguir documento/obligación, pago y cuenta de contrapartida, conforme al contrato contable aprobado; nunca se representa el pago bancario como salida de caja física.

### 3.5 Estado del dossier frente a código

El dossier indexado describe enums, destinos y writers que no coinciden plenamente con `main`. El plan no debe tratarse como especificación ejecutable hasta reconciliar la versión SSOT, el dossier y el commit real de código.

## 4. Acciones ya realizadas en esta rama

- Se inspeccionaron los writers y validadores de reservas, eCommerce, caja e inventario en `main`.
- Se contrastaron los criterios D-01 a D-06 y los ADR asociados con el estado actual del código.
- Se identificaron dos tareas ya cubiertas a nivel de writer (D-01 y D-02), una parcial por falta de validación de frontera (D-01), y las brechas abiertas D-03 a D-05.
- Se documentaron los bloqueos de ADR-02, ADR-03 y ADR-04 y las contradicciones de enums.
- No se hicieron escrituras CMS, migraciones de datos, movimientos fiscales, reservas, pagos, cambios de stock ni despliegues.

## 5. Ruta segura de ejecución

1. **ADR-01:** reconciliar formalmente enums y esquemas contra la SSOT aprobada. No migrar valores existentes por sustitución textual.
2. **ADR-02:** decidir el tratamiento de `order_created` sin duplicar Wix Orders ni contaminar CitasF2.
3. **ADR-03:** decidir y aprobar colecciones ledger separadas para arqueos X y actas de recuento. `CajaActual` es un único item de proyección realtime; `MovimientosCaja` conserva cada movimiento, su tipo, detalle, importes y acumulados. No sobrescribir el histórico ni el stock para representar recuentos.
4. **ADR-04:** formalizar el contrato de asientos de procesos no-caja en `LibroAsientosContablesDetalle`; no crear movimientos ficticios de caja.
5. Completar C-01/C-03 con comprobación del esquema físico CMS y validadores de frontera.
6. Implementar únicamente writers aprobados, con idempotencia, autorización backend, `traceId`, pruebas unitarias/de integración y verificación en Wix Local Editor.
7. No publicar hasta superar QA E2E y revisar reversión. Los ledgers append-only no se revierten mediante borrado.

## 6. Criterios de cierre verificables

- Cada evento de origen tiene identificador nativo, `traceId`, clave idempotente y resultado persistido o error recuperable.
- Ningún webhook se marca procesado antes de completar su persistencia o dejar una recuperación durable.
- Ninguna proyección CMS se declara completa si falta un campo requerido por el contrato físico.
- Las operaciones contables/fiscales se escriben una sola vez en su ledger canónico y las rectificaciones son nuevos registros trazables.
- Los registros de arqueo y recuento son históricos append-only y no se almacenan como una simple actualización de un singleton.
- Pruebas offline, contratos SDK y E2E en Wix Local Editor quedan enlazados a commit y versión de esquema.

## 7. Estado de validación

- **Verificado en código:** rutas y funciones citadas en esta auditoría, consultadas en `main`.
- **Declarado por el dossier/plan:** prioridades, obligaciones de arquitectura y criterios normativos aportados.
- **Inferido:** impacto de la ausencia de writers a partir de la inspección estática; requiere confirmar consumidores y flujos activos.
- **Pendiente:** esquema físico CMS, configuración real de hooks Wix, pruebas en Local Editor, scopes, conectores M365/Power Automate, validación normativa por asesoría y ejecución E2E.
- **No ejecutado:** tests, escrituras CMS, migraciones, simulaciones transaccionales y despliegues.


## 8. Contratos canónicos aclarados por el responsable del sistema

- Estado CMS de cancelación: `CANCELED` (único valor; eliminar `CANCELLED`).
- Libro contable: `LibroAsientosContablesDetalle` (nombre exacto y canónico).
- Operaciones que no pasan por caja física: consolidación en `LibroAsientosContablesDetalle`; no generan movimientos en `MovimientosCaja` ni mutan `CajaActual`.
- `CajaActual`: singleton de estado/saldo actualizado en tiempo real por cada movimiento físico.
- `MovimientosCaja`: ledger detallado de cada movimiento físico, con tipo, detalle y acumulados.
