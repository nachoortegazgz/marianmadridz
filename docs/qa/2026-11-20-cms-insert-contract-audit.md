# Auditoría de contratos de inserción CMS — 2026-11-20

## Alcance y método

- Sitio Wix: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Consulta de solo lectura a `GET /data/v2/collections/{collectionId}` para diez colecciones de negocio, más ControlOperativo auditada en revisión separada.
- Comparación de campos físicos `required` contra productores, validadores y hooks en `src/backend/`.
- No se insertaron, actualizaron ni eliminaron elementos CMS. No se ejecutaron escritores fiscales, contables, laborales ni de caja. El sitio sigue en Draft.
- Estado: **esquema live verificado; revisión de código realizada; CI de esta rama pendiente; runtime Wix no ejecutado**.

## Resultado por colección

| Colección | Revisión / campos | Campos físicos obligatorios | Productor y conclusión |
|---|---:|---|---|
| `CajaActual` | 18 / 81 | Ninguno | Singleton actualizado por proyecciones de caja; no se encontró un productor de inserción ordinaria en los módulos auditados. `assertCajaActualRecord` valida el tipo OBJECT de `sequenceCounters`. |
| `CitasF2` | 60 / 29 | `slotStart`, `slotEnd`, `totalAmount`, `bookingId`, `traceId`, `bookingType`, `bookingStatus`, `paymentStatus`, `serviceId`, `resourceId`, `dateYmd` | `bookingCore.js::_persistBooking` exige IDs, fechas, scheduleId y traceId; construye los once campos requeridos. `assertCitasF2Insert` verifica los once campos en dataAccess y hook antes de aceptar la inserción. Los consumidores de eventos/sagas pasan por ese escritor. |
| `ComplementosCatalogo` | 142 / 18 | `sku`, `taxIncluded`, `addonId` | No se localizó productor backend de altas. El hook validaba sku/addonId, pero aceptaba `taxIncluded` ausente pese a ser obligatorio. Corregido: ahora exige BOOLEAN, incluido `false` como valor válido. |
| `HistoricoCierresZ` | 44 / 66 | `closeDate`, `fiscalPeriod`, `totalTaxAmount`, `totalTaxBase`, `totalOnline`, `totalBizum`, `totalCard`, `totalCash`, `closedBy`, `recordDomain`, `operationDate`, `traceId` | Hallazgo P1: dos escritores tenían contratos incompletos y colisionaban en `Z_<fecha>`. Corregido el escritor canónico para construir los campos determinables y exigir `closedBy`/`recordDomain`; el proyector duplicado de EventLog deja de insertar y CIERRE_Z queda bloqueado en esa ruta. Pendiente decisión de dominio para `recordDomain`; no se inventa valor. |
| `PaquetesGestoria` | 8 / 17 | `invoiceData`, `periodType`, `fiscalYear`, `packageVersion`, `summaryData`, `packageStatus`, `snapshotHash`, `schemaVersion`, `source`, `traceId`, `createdAt` | `fiscalDocuments.web.js` construye los campos obligatorios. El hook ya validaba estructura/hash/periodo/estado, pero no exigía `createdAt`; corregido. |
| `LibroAsientosContablesDetalle` | 9 / 103 | Ninguno | `accountingLedger.js::appendAccountingEntry` genera asiento append-only con identidad, importes, desglose, hash y traceId; no hay obligatoriedad física declarada en el esquema live. |
| `MapaStaff` | 135 / 43 | Ninguno | Hooks discriminan STAFF/TERCERO/GESTORIA y validan identidad fiscal. La configuración SIF sigue bloqueada: campos requeridos por el escritor fiscal no existen en el esquema físico, y el fallback fue retirado en PR #447. |
| `MovimientosCaja` | 109 / 113 | `hash`, `amount`, `numSerieFactura`, `sequenceNumber`, `transactionId`, `previousRecordHash`, `recordTimestamp`, `schemaVersion`, `traceId`, `movementType`, `totalAmount`, `paymentMethod`, `channelType`, `operationDescription`, `staffResourceId`, `tipoFactura`, `fechaExpedicionFactura`, `tipoImpositivo`, `fiscalPeriod` | Los dos productores principales son `cajas.web.js` y `eventLog.js`. El hook no comprobaba de forma común todos los campos físicos requeridos. Corregido: validador común exige campos, tipos, fechas, hashes y enums canónicos; los registros TPV QA sintéticos conservan su excepción de enums, no de integridad estructural. EventLog deja de inventar `channelType=POS` y valida el contrato antes del insert. |
| `RegistrosHorariosStaff` | 2 / 47 | `resourceId`, `memberId`, `recordId`, `clockEventType`, `recordType`, `source`, `recordedAt`, `workDate`, `dayKey`, `monthKey`, `timeZone`, `recordHash`, `schemaVersion`, `traceId` | `horario.web.js` sella identidad, fechas, claves de periodo, hash, versión y traceId; `assertRegistrosHorariosStaff` exige los campos, DATETIME/DATE válidos, coherencia dayKey/monthKey y HMAC. Writer sigue deshabilitado por política. |
| `ServiciosCatalogo` | 203 / 44 | Ninguno | No se localizó productor de inserción backend; se consume como catálogo. |

## Correcciones incluidas en esta rama

1. `validation.js`: `assertHistoricoCierresZ` valida los doce campos físicos requeridos, incluidos DATE válidos, números finitos y textos no vacíos.
2. `dataAccess.insertItem` aplica validación central antes de la escritura elevada para `ControlOperativo`, `CitasF2`, `RegistrosHorariosStaff`, `MapaStaff`, `CajaActual`, `MovimientosCaja` y `HistoricoCierresZ`; los hooks `data.js` mantienen una segunda barrera. El hook `HistoricoCierresZ_beforeInsert` exige el contrato completo; `MovimientosCaja_beforeInsert` exige todos los campos físicos; Complementos exige `taxIncluded`; PaquetesGestoria exige `createdAt`.
3. `cajas.web.js::_registerZClosing`: el objeto de cierre ahora incluye closeDate, fiscalPeriod, totales fiscales, closedBy y recordDomain; si no hay resourceId de responsable o recordDomain explícito, falla antes del lock/insert.
4. `eventLog.js`: elimina el segundo insert incompleto en HistoricoCierresZ; rechaza `eventType=CIERRE_Z` por esta vía; exige channelType canónico y valida el documento MovimientosCaja antes de insertar.
5. Pruebas offline ampliadas para campos obligatorios, tipos, fechas, enum de canal, fecha de paquete, taxIncluded y cierre Z.

## Bloqueos y límites

- `recordDomain` no tiene enum ni valor canónico documentado en el repositorio. El escritor Z no acepta un valor por defecto. Se requiere decisión de dominio antes de habilitar cierres. Los valores `CASH_REGISTER` usados en tests son fixtures sintéticos, no una aprobación del dominio de producción.
- El comando de interfaz Z_CLOSING y el cron actual no suministran `recordDomain` ni una identidad de sistema `closedBy`; ambos quedan bloqueados por el backend hasta resolver el contrato. No se debe cambiar la interfaz para aceptar un valor libre del usuario.
- Consulta Wix read-only adicional: `MovimientosCaja(eventType=CIERRE_Z)` devolvió 0 registros y `HistoricoCierresZ` devolvió 0 registros. La retirada del proyector duplicado no afecta cierres históricos existentes en el corte auditado.
- `closedBy` se deriva del resourceId del responsable autenticado; el cron interno debe aportar una identidad de sistema aprobada si se quiere permitir cierre sin cajero.
- `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`; ningún cambio de esta rama habilita escrituras.
- El hook Wix debe probarse en Sandbox con identidad y permisos reales; los tests offline no demuestran que Wix ejecute hooks en el runtime.
- No se certifica la integridad de los registros históricos ni la conformidad VERI*FACTU por esta auditoría de contratos.

## Relación con PRs

- PR #450: contrato ControlOperativo alineado con esquema live revisión 93; merge commit `11e6cefd838cfd8f18301ddff534e2edd8849743`.
- Esta rama: correcciones de contratos de las colecciones restantes; pendiente CI, revisión y PR.
