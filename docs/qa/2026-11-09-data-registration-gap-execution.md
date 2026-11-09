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
| D-06 / ADR-04 — facturas recibidas pagadas por banco | **DECISIÓN BLOQUEADA** | `PAGO_PROVEEDOR` existe como movimiento del ledger de caja, pero el plan advierte correctamente que un pago bancario no debe producir una salida ficticia de caja. Además, `FacturasRecibidas` figura en `FORBIDDEN_COLLECTIONS` de `internalConfig.js`. La alternativa de crear esa colección contradice la configuración vigente y no puede implementarse sin decisión formal que resuelva la prohibición. |

## 3. Contradicciones del plan que impiden ejecución literal

### 3.1 Enums de reserva

El plan propone cambiar el estado CMS a `CANCELED` y erradicar `CANCELLED`. El código actual separa ambos dominios: `BOOKING_STATUS.CANCELED` representa el valor nativo Wix, mientras que `CITAS_BOOKING_STATUS.CANCELLED` es el valor CMS. `bookingCore.js` traduce el estado nativo al CMS. Cambiarlo por búsqueda/reemplazo rompería la frontera entre contratos.

**Decisión:** no ejecutar B-01 ni migración de datos hasta que la SSOT aprobada y el esquema físico CMS determinen expresamente el valor canónico de CitasF2.

### 3.2 DISPLAY_TOKEN

El plan B-04 propone añadir `DISPLAY_TOKEN` a `CONTROL_TYPE`. Ya está declarado en `src/backend/internalConfig.js`. No procede duplicar la constante. Sí queda pendiente verificar que los hooks y la documentación describen correctamente su naturaleza efímera y su política de borrado.

### 3.3 Destino de las intenciones de compra

El handler `order_created` tiene responsabilidad actual de reserva de inventario, no de registrar una intención comercial en una colección propia. La existencia de Wix Orders no autoriza a reutilizar CitasF2. ADR-02 debe decidir si Wix Orders es suficiente como SSOT de la intención y si basta una proyección de auditoría, o si se necesita una colección NATIVE específica. No se debe crear una segunda fuente de verdad del pedido.

### 3.4 Facturas recibidas

La alternativa de crear `FacturasRecibidas` es incompatible con `FORBIDDEN_COLLECTIONS`. La alternativa de usar `MovimientosCaja` con `TRANSFERENCIA` no debe simular una salida de efectivo ni confundir factura recibida, obligación con proveedor y pago bancario. ADR-04 debe separar, como mínimo, el documento recibido, su obligación contable y su liquidación bancaria; no se implementará una escritura hasta definir el modelo canónico y su relación con el libro de asientos.

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
3. **ADR-03:** decidir y aprobar colecciones ledger separadas para arqueos X y actas de recuento; nunca sobrescribir `CajaActual` ni el stock para representar históricos.
4. **ADR-04:** resolver la prohibición de `FacturasRecibidas` y separar documento, deuda y pago bancario.
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
