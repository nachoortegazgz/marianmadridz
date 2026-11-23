# Verificación Wix CMS — keyfields y esquema físico

**Fecha de lectura:** 2026-11-23  
**Sitio:** Marian Madrid · `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Fuente:** Wix Data Collections API, GET de colecciones con `consistentRead=true`.  
**Resultado:** HTTP 200; 42 colecciones devueltas; las 11 colecciones objetivo existen y son `NATIVE`.  
**Alcance:** lectura de esquema, sin consultar ni modificar registros, colecciones o campos.

## 1. Criterio probatorio

La respuesta Wix contiene la definición física de cada colección: `key`, `type`, `required`, `systemField` y metadatos de referencias. Los recuentos excluyen los campos con `systemField=true`. El conjunto de keyfields facilitado por el propietario es una selección funcional, no el esquema completo. La presencia de un campo no acredita unicidad; la omisión de un campo en la selección no demuestra su ausencia en CMS.

## 2. Inventario verificado

| Colección (ID) | Display name | Revisión | Campos funcionales | updatedDate |
|---|---|---:|---:|---|
| `CajaActual` | `CAJA_ACTUAL` | 18 | 77 | 2026-11-17T00:14:04.825Z |
| `CitasF2` | `CITAS_F2` | 60 | 25 | 2026-11-19T23:40:34.687Z |
| `ComplementosCatalogo` | `COMPLEMENTOS_CATALOGO` | 142 | 14 | 2026-11-17T00:25:26.138Z |
| `ControlOperativo` | `CONTROL_OPERATIVO` | 93 | 28 | 2026-11-19T23:27:27.022Z |
| `HistoricoCierresZ` | `HISTORICO_CIERRES_Z` | 44 | 62 | 2026-11-17T00:13:52.660Z |
| `LibroAsientosContablesDetalle` | `LIBRO_ASIENTOS_CONTABLES_DETALLE` | 9 | 99 | 2026-11-17T00:14:01.453Z |
| `MapaStaff` | `MAPA_STAFF` | 135 | 39 | 2026-11-17T00:13:47.508Z |
| `MovimientosCaja` | `MOVIMIENTOS_CAJA` | 109 | 109 | 2026-11-17T00:13:59.272Z |
| `PaquetesGestoria` | `PAQUETES_GESTORIA` | 8 | 13 | 2026-11-19T23:56:08.272Z |
| `RegistrosHorariosStaff` | `REGISTROS_HORARIOS_STAFF` | 2 | 43 | 2026-11-17T00:14:10.062Z |
| `ServiciosCatalogo` | `SERVICIOS_CATALOGO` | 203 | 40 | 2026-11-17T00:25:23.327Z |

## 3. Diferencias relevantes frente al keyfields anterior

1. **MapaStaff.contactId:** no existe en el esquema físico actual. Confirmado tras inspeccionar los 39 campos funcionales. Los campos de identidad presentes incluyen `resourceId`, `memberId` y `staffMemberId`. Revisar consumidores de `contactId` antes de cambiar código.
2. **ControlOperativo.ownerToken y eventType:** ambos existen como campos TEXT. No son campos ausentes. También están `attempts`, `controlType`, `dedupeKey`, `payload`, `version`, `transactionId`, `orderId`, `refundId` y `processedAt`.
3. **CitasF2.cashMovementId:** existe como TEXT opcional, aunque no figuraba en la selección anterior.
4. **CajaActual:** coexisten `transactionId`, `paymentId`, `checkoutId`, `orderId` y `paymentReference`, todos TEXT. También están `cashMovementId`, `lastOperationId` y los campos de estado/ticket. La coexistencia no prueba equivalencia semántica.
5. **MovimientosCaja:** no hay campo funcional `movementId`. `transactionId` existe como TEXT obligatorio. Esto no demuestra unicidad ni garantiza idempotencia.
6. **ServiciosCatalogo:** `title` es TEXT; `name` es MULTI_REFERENCE hacia `ComplementosCatalogo`. No son dos campos de texto duplicados. `staffMembers` es MULTI_REFERENCE hacia `MapaStaff`; `bookingsStaff` es OBJECT.
7. **ComplementosCatalogo.ServiciosCatalogo_name:** es MULTI_REFERENCE hacia `ServiciosCatalogo`, con `referencingFieldKey=name`. Preservar la relación hasta auditar consumidores.
8. **PaquetesGestoria.packageVersion:** tipo NUMBER; `fiscalYear` NUMBER, `createdAt` DATETIME, `snapshotHash` y `schemaVersion` TEXT.
9. **RegistrosHorariosStaff:** los campos funcionales de identidad, evento, fecha, hash, schema y trace están presentes; entre los obligatorios figuran `resourceId`, `memberId`, `recordId`, `clockEventType`, `recordType`, `source`, `recordedAt`, `workDate`, `dayKey`, `monthKey`, `timeZone`, `recordHash`, `schemaVersion` y `traceId`.

## 4. Campos obligatorios adicionales confirmados

- `CitasF2`: `slotStart`, `totalAmount`, `slotEnd`, `bookingId`, `traceId`, `bookingType`, `bookingStatus`, `paymentStatus`, `serviceId`, `resourceId`, `dateYmd`.
- `ControlOperativo`: `controlType`, `dedupeKey`, `traceId`, `payload`.
- `MovimientosCaja`: `hash`, `amount`, `numSerieFactura`, `sequenceNumber`, `transactionId`, `previousRecordHash`, `recordTimestamp`, `schemaVersion`, `traceId`, `movementType`, `totalAmount`, `paymentMethod`, `channelType`, `operationDescription`, `staffResourceId`, `tipoFactura`, `fechaExpedicionFactura`, `tipoImpositivo`, `fiscalPeriod`.
- `PaquetesGestoria`: `invoiceData`, `periodType`, `fiscalYear`, `packageVersion`, `summaryData`, `packageStatus`, `snapshotHash`, `schemaVersion`, `source`, `traceId`, `createdAt`.
- `RegistrosHorariosStaff`: `resourceId`, `memberId`, `recordId`, `clockEventType`, `recordType`, `source`, `recordedAt`, `workDate`, `dayKey`, `monthKey`, `timeZone`, `recordHash`, `schemaVersion`, `traceId`.

## 5. Contrato TPV neutral

El contrato lógico propuesto (`siteId`, `operationId`, `idempotencyKey`, `sessionId`, `actorId`, `operatorId`, `sourceType`, `schemaVersion`, `recordType`, `status`, `reconciliationStatus`, `amount`, `paymentMethod`, `createdAt`, `traceId`) no es un contrato físico común acreditado por Wix. No crear estos campos en bloque. Mapear cada atributo a su colección propietaria, writer y consumidor; distinguir dato nativo, proyección y dato derivable.

## 6. Acciones pendientes antes de cambiar código o CMS

- [ ] Buscar todos los consumidores de `MapaStaff.contactId` en src, tests, runners, hooks, WebMethods, crons y webhooks.
- [ ] Trazar productores/consumidores y semántica de `transactionId`, `paymentId`, `checkoutId`, `orderId` y `paymentReference` en `CajaActual`.
- [ ] Verificar generación, unicidad y uso idempotente de `MovimientosCaja.transactionId`.
- [ ] Auditar consumidores de `ownerToken` y `eventType` en `ControlOperativo`.
- [ ] Auditar referencias `ServiciosCatalogo.name` y `ComplementosCatalogo.ServiciosCatalogo_name`.
- [ ] Reconciliar tipos y obligatoriedad con DTOs, validadores, fixtures y pruebas.

## 7. Límites de la verificación

**Verificado:** existencia, IDs, display names, tipo NATIVE, revisión, updatedDate, campos, tipos Wix, flags required y referencias devueltas por Wix.

**No verificado:** valores de registros, unicidad real, índices, permisos efectivos, escritores, consumidores de código, Runtime y comportamiento end-to-end.

No se ejecutaron escrituras ni migraciones. Los ledgers fiscales, contables y laborales declarados append-only permanecen inmutables; las rectificaciones se realizan mediante nuevos registros trazables. Estado de release: **NO-GO**.

## 8. Documentación oficial

- [CMS Schema Management](https://dev.wix.com/docs/api-reference/business-solutions/cms/skills/cms-schema-management)
- [List Data Collections](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/list-data-collections)
- [Get Data Collection](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection)
