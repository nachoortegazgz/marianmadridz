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
| D-01 / C-01 — persistir `scheduleId` en CitasF2 | **IMPLEMENTADA EN RAMA; CI PENDIENTE** | `_persistBooking` lo exige y persiste; ahora `assertCitasF2` también exige GUID, por lo que los hooks `CitasF2_beforeInsert/beforeUpdate` lo validan en la frontera CMS. Se añadieron pruebas de ausencia y formato inválido. Falta confirmar el campo físico en CMS y ejecutar Wix Local Editor. |
| D-02 / C-03 — `orderId` en movimientos de pedido | **IMPLEMENTADA EN WRITER PRINCIPAL** | `src/backend/events.js::wixEcom_onOrderPaymentStatusUpdated` pasa `orderId` y `transactionId` a `registrarEventoEconomico`; el flujo de recuperación fiscal también conserva `orderId`. Falta validar el esquema físico CMS y el CSV exportado. |
| D-03 / C-04 — intención `order_created` | **DECISIÓN DE DOMINIO: WIX ORDERS ES SSOT** | No se crea una segunda colección de intención de compra. El pedido nativo Wix Orders conserva la intención y el pedido; `wixEcom_onOrderCreated` registra `orderId`, estado de reserva y reparaciones en el evento idempotente de `ControlOperativo` tras completar la reserva de inventario. Debe verificarse la consulta/relectura de Wix Orders para recuperación y la persistencia del marcador de evento. |
| D-04 / C-06 — arqueos X append-only | **PENDIENTE DE COLECCIÓN Y CONTRATO** | No existe writer/colección de arqueo X. `CajaActual` no debe usarse para guardar snapshots históricos. Se requiere colección de actas de arqueo append-only y hook físico antes de implementar el writer. |
| D-05 / C-07 — actas de recuento de inventario | **PENDIENTE DE COLECCIÓN Y CONTRATO** | No existe writer/colección de acta de recuento. No se sobrescribirá stock ni `MovimientosInventario` para guardar el conteo observado. Se requiere colección append-only independiente y su hook físico. |
| D-06 / ADR-04 — facturas recibidas pagadas por banco | **DESTINO DEFINIDO; AUTOMATIZACIÓN BLOQUEADA POR PGC** | `LibroAsientosContablesDetalle` es el destino canónico. Existe `src/backend/accountingLedger.js::appendAccountingEntry`, con validación de partida doble, hash-chain, idempotencia y persistencia append-only; el mapeo automático sigue desactivado hasta aprobar el PGC. Se corrigió además un defecto: el writer ya no inventa `cashMovementId=sourceMovementId` en asientos no-caja; el vínculo solo se persiste cuando el caller lo aporta explícitamente y queda incluido en la huella. Se añadieron pruebas para ambos casos. No hay que crear `FacturasRecibidas` ni usar caja física. |

## 3. Contradicciones del plan que impiden ejecución literal

### 3.1 Enums de reserva

La decisión del responsable del sistema fija `CANCELED` como único valor canónico tanto en el contrato CMS de CitasF2 como en los mapeos internos. La traducción desde el estado nativo Wix conserva su contrato y mapea explícitamente a `CITAS_BOOKING_STATUS.CANCELED`. La rama auditada elimina el valor anterior de escritores, consumidores y pruebas activas. La consulta live del CMS encontró 34 filas históricas con ese estado; deben migrarse mediante un proceso backend controlado, con trazabilidad, sin actualización REST directa ni sustitución masiva.

### 3.2 DISPLAY_TOKEN

El plan B-04 propone añadir `DISPLAY_TOKEN` a `CONTROL_TYPE`. Ya está declarado en `src/backend/internalConfig.js`. No procede duplicar la constante. Sí queda pendiente verificar que los hooks y la documentación describen correctamente su naturaleza efímera y su política de borrado.

### 3.3 Destino de las intenciones de compra

Wix Orders es SSOT de la intención/pedido. `order_created` conserva el identificador y la reserva en el marcador idempotente de `ControlOperativo`; no se crea una colección duplicada ni se reutiliza CitasF2. La recuperación debe reconsultar Wix Orders, no confiar en un payload de webhook como única copia.

### 3.4 Facturas recibidas

No se crea una colección paralela `FacturasRecibidas`. `accountingLedger.appendAccountingEntry` ya ofrece el writer append-only equilibrado, pero no puede automatizarse sin aprobar plan de cuentas, reglas de contabilización y mapeo de tipos de documento. Documento/obligación/pago bancario deben distinguirse en el asiento y sus referencias; nunca se representa el pago bancario como salida de caja física.

### 3.5 Estado del dossier frente a código

El dossier indexado describe enums, destinos y writers que no coinciden plenamente con `main`. El plan no debe tratarse como especificación ejecutable hasta reconciliar la versión SSOT, el dossier y el commit real de código.

## 4. Acciones ya realizadas en esta rama

- Se inspeccionaron los writers y validadores de reservas, eCommerce, caja e inventario en `main`.
- Se contrastaron los criterios D-01 a D-06 y los ADR asociados con el estado actual del código.
- Se identificaron dos tareas ya cubiertas a nivel de writer (D-01 y D-02), una parcial por falta de validación de frontera (D-01), y las brechas abiertas D-03 a D-05.
- Se normalizó `CANCELED` en la rama: enums, mapeo Wix→CMS, saga de compensación, gestor de citas, filtros y pruebas afectadas.
- Se reforzó `assertCitasF2` para exigir `scheduleId` GUID en la frontera CMS y se añadieron pruebas de ausencia/formato.
- Se confirmó el writer `accountingLedger.appendAccountingEntry`; su mapeo automático está deliberadamente deshabilitado sin aprobación PGC.
- Se definió Wix Orders como SSOT de pedido/intención, sin crear una colección duplicada.
- No se hicieron escrituras CMS, migraciones de datos, movimientos fiscales, reservas, pagos, cambios de stock ni despliegues.

## 5. Ruta segura de ejecución

1. Completar verificación del esquema físico de `CitasF2.scheduleId` y de `MovimientosCaja.orderId` en Wix CMS.
2. Confirmar recuperación/relectura de Wix Orders y persistencia del marcador `ORDER_CREATED` en `ControlOperativo`.
3. Aprobar esquema y permisos CMS de actas de arqueo X y recuento de inventario; después implementar writers append-only con idempotencia y `traceId`.
4. Aprobar PGC/mapeos contables para habilitar el uso de `appendAccountingEntry` en facturas recibidas y pagos bancarios.
5. Ejecutar suite offline, Local Editor, pruebas E2E y concurrencia/idempotencia. No publicar hasta superar controles y revisar reversión; ledgers append-only no se revierten mediante borrado.

## 6. Criterios de cierre verificables

- Cada evento de origen tiene identificador nativo, `traceId`, clave idempotente y resultado persistido o error recuperable.
- Ningún webhook se marca procesado antes de completar su persistencia o dejar una recuperación durable.
- Ninguna proyección CMS se declara completa si falta un campo requerido por el contrato físico.
- Las operaciones contables/fiscales se escriben una sola vez en su ledger canónico y las rectificaciones son nuevos registros trazables.
- Los registros de arqueo y recuento son históricos append-only y no se almacenan como una simple actualización de un singleton.
- Pruebas offline, contratos SDK y E2E en Wix Local Editor quedan enlazados a commit y versión de esquema.

## 7. Estado de validación

- **Verificado en código:** rutas y funciones inspeccionadas en la rama de auditoría; la línea base `main` queda sin modificar.
- **Declarado por el dossier/plan:** prioridades, obligaciones de arquitectura y criterios normativos aportados.
- **Inferido:** impacto de la ausencia de writers a partir de la inspección estática; requiere confirmar consumidores y flujos activos.
- **Pendiente:** CI de la rama para los últimos cambios; migración backend de 34 estados históricos; un registro QA-only inválido en `CitasF2` (sin `scheduleId` y con `bookingId` no GUID); `scheduleId` sigue opcional en esquema físico CMS por ese registro; configuración real de hooks Wix, pruebas en Local Editor, aprobación PGC, colecciones de arqueo/recuento, scopes, conectores M365/Power Automate, validación normativa por asesoría y ejecución E2E.
- **No ejecutado:** escrituras CMS, migraciones, simulaciones transaccionales reales y despliegues.


## 8. Contratos canónicos aclarados por el responsable del sistema

- Estado CMS de cancelación: `CANCELED` (único valor; eliminar `CANCELLED`).
- Libro contable: `LibroAsientosContablesDetalle` (nombre exacto y canónico).
- Operaciones que no pasan por caja física: consolidación en `LibroAsientosContablesDetalle`; no generan movimientos en `MovimientosCaja` ni mutan `CajaActual`.
- `CajaActual`: singleton de estado/saldo actualizado en tiempo real por cada movimiento físico.
- `MovimientosCaja`: ledger detallado de cada movimiento físico, con tipo, detalle y acumulados.


## 9. Implementación en rama y estado de ejecución

- Rama: `audit/data-registration-gap-execution-2026-11-09` (PR #218).
- Cambios de código: normalización del estado `CANCELED`; validación de `scheduleId` GUID en `assertCitasF2`; pruebas de hooks y contrato SSOT actualizadas; corrección de `cashMovementId` opcional en asientos contables y cobertura de operaciones no-caja.
- CI #196 detectó fixtures de tests sin `scheduleId` (437/442 tests pasaron; 2 suites fallaron). Se corrigieron los fixtures afectados en commits posteriores; la nueva ejecución está pendiente de resultado.
- No se ha hecho merge, publicación Velo, escritura CMS ni modificación de registros existentes.


## 10. Verificación live de CMS (solo lectura)

- `CitasF2`: 55 registros; 20 `CONFIRMED`, 34 con el estado histórico de cancelación retirado y 1 registro `QA_ONLY_NOT_A_REAL_BOOKING`. Ese registro QA carece de `scheduleId` y su `bookingId` no es GUID; no se debe borrar ni alterar mediante Data API directa. Por ello, `scheduleId` permanece opcional en el esquema físico hasta reparar/aislar ese registro, aunque el writer y hook backend ya lo exigen para nuevas escrituras.
- `MovimientosCaja`: 0 registros en la consulta live. El esquema contiene `orderId` como TEXT opcional.
- `LibroAsientosContablesDetalle`: 0 registros en la consulta live. El esquema contiene `entryId`, `sourceMovementId`, `accountCode`, `debitAmount`, `creditAmount`, `recordHash`, `previousRecordHash` y `traceId` como campos obligatorios; `cashMovementId` es opcional.
- `ControlOperativo`: colección existente con `orderId`, `eventId`, `dedupeKey`, `traceId`, `status` y `payload`, apta para el marcador idempotente `ORDER_CREATED`.
- No se han escrito ni actualizado filas ni esquemas CMS.

### 10.1 Caja y eventos de pedido

- `CajaActual`: exactamente 1 fila (`_id=SINGLE_ITEM_ID`, `singletonKey=CAJA_PRINCIPAL`) con `cashAmount=300` y `operationDate=2026-11-05`. No se modificó. El CMS no devuelve un `MovimientosCaja` asociado: el ledger tiene 0 filas, por lo que el importe del singleton debe tratarse como estado técnico/preexistente y no como una venta ni como prueba de actividad real.
- `ControlOperativo`: 68 filas; en la proyección consultada no aparece ningún marcador cuyo `payload.eventType` sea `ORDER_CREATED`. Esto no demuestra por sí solo que no existan pedidos Wix; la recuperación de pedidos debe reconciliarse contra Wix Orders.
