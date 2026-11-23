# Auditoría de contratos de inserción CMS — 2026-11-20

## Alcance y método

- Sitio Wix: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Consultas read-only de esquemas físicos y comparación con productores, validadores y hooks bajo `src/backend/`.
- No se insertaron, actualizaron ni eliminaron elementos CMS como parte de esta auditoría.
- No se ejecutaron escritores fiscales, contables, laborales ni de caja.
- Esta auditoría de código/esquema no certifica ejecución Wix Runtime.

## Resultado por colección

| Colección | Campos físicos obligatorios | Conclusión |
|---|---|---|
| `CajaActual` | Ninguno | Singleton y proyecciones protegidas por contrato de dominio; validar en Sandbox. |
| `CitasF2` | `slotStart`, `slotEnd`, `totalAmount`, `bookingId`, `traceId`, `bookingType`, `bookingStatus`, `paymentStatus`, `serviceId`, `resourceId`, `dateYmd` | El escritor canónico y las barreras de inserción exigen los once campos. E2E Wix pendiente. |
| `ComplementosCatalogo` | `sku`, `taxIncluded`, `addonId` | El hook exige ahora también `taxIncluded` BOOLEAN; `false` es válido. |
| `HistoricoCierresZ` | `closeDate`, `fiscalPeriod`, `totalTaxAmount`, `totalTaxBase`, `totalOnline`, `totalBizum`, `totalCard`, `totalCash`, `closedBy`, `recordDomain`, `operationDate`, `traceId` | El contrato se valida antes de insertar. `recordDomain` carece de valor canónico aprobado; las rutas que no pueden suministrarlo permanecen bloqueadas. |
| `PaquetesGestoria` | `invoiceData`, `periodType`, `fiscalYear`, `packageVersion`, `summaryData`, `packageStatus`, `snapshotHash`, `schemaVersion`, `source`, `traceId`, `createdAt` | El hook exige estructura, hash, periodo, estado y `createdAt`. El flujo de envío/snapshot exacto sigue pendiente (#223). |
| `LibroAsientosContablesDetalle` | Ninguno | PR #452 añade validación de dominio central y hook beforeInsert. CI verde; Wix Sandbox pendiente. |
| `MapaStaff` | Ninguno | Tipos STAFF/TERCERO/GESTORIA protegidos. La configuración SIF no está completa ni existe singleton CONFIG_SISTEMA verificado. |
| `MovimientosCaja` | `hash`, `amount`, `numSerieFactura`, `sequenceNumber`, `transactionId`, `previousRecordHash`, `recordTimestamp`, `schemaVersion`, `traceId`, `movementType`, `totalAmount`, `paymentMethod`, `channelType`, `operationDescription`, `staffResourceId`, `tipoFactura`, `fechaExpedicionFactura`, `tipoImpositivo`, `fiscalPeriod` | Validación común reforzada. Las filas sintéticas TPV mantienen excepción de enums, no de integridad estructural. Runtime pendiente. |
| `RegistrosHorariosStaff` | `resourceId`, `memberId`, `recordId`, `clockEventType`, `recordType`, `source`, `recordedAt`, `workDate`, `dayKey`, `monthKey`, `timeZone`, `recordHash`, `schemaVersion`, `traceId` | Contrato de campos, fechas, claves de periodo y HMAC reforzado. Writer continúa deshabilitado por política. |
| `ServiciosCatalogo` | Ninguno | Consumido como catálogo; no se localizó productor de inserción backend en el alcance auditado. |
| `ControlOperativo` | `controlType`, `dedupeKey`, `traceId`, `payload` | PR #450 integrada: allowlist de columnas físicas, payload OBJECT requerido y contratos específicos por controlType. Históricos terminales se conservan; no se normalizan mediante mutaciones. |

## Correcciones integradas

### PR #450 — ControlOperativo
Merge commit: `11e6cefd838cfd8f18301ddff534e2edd8849743`.

- Exige `payload` como objeto no nulo.
- Rechaza campos raíz no declarados en el esquema físico.
- Alinea DISPLAY_TOKEN, LEDGER_IDEMPOTENCY, COMPENSATION, SLOT_LOCK, SYSTEM_FLAG y ALERT con columnas físicas/payload.
- Conserva registros históricos terminales sin migraciones destructivas.

### PR #451 — contratos de inserción CMS
Merge commit: `bdbdb2467294c781bfc090cd8429d7c060413d15`.

- Refuerza validadores centrales y hooks para las colecciones auditadas.
- Corrige contratos de ComplementosCatalogo, PaquetesGestoria, HistoricoCierresZ y MovimientosCaja.
- Retira la ruta duplicada de inserción CIERRE_Z en EventLog.
- Bloquea rutas Z que carecen de `recordDomain`/identidad aprobados en vez de inventar valores.
- CI de PR: Layer 1 333/333, Layer 2 266/266, suite offline 687/687; SDK, npm audit, ESLint y secret scanning SUCCESS.

### PR #452 — ledger contable append-only
Merge commit: `5cfbecd6849c56d162f0d20a11b620eb2bea0c54`.

- Añade `assertAccountingLedgerRecord`, validación previa en `dataAccess.insertItem` y hook `LibroAsientosContablesDetalle_beforeInsert`.
- CI workflow #44667244690 completado SUCCESS sobre head `940a6cf9fadb85ed414963eff2cfd1b28c82ed67`.
- Informe detallado: [accounting-ledger-insert-guard](./2026-11-20-accounting-ledger-insert-guard.md).

## Bloqueos y límites

- `recordDomain` no tiene enum/valor canónico aprobado. No aceptar valor libre desde navegador ni activar cierre Z/cron hasta decidir el contrato.
- El cron requiere identidad de sistema aprobada si debe cerrar sin cajero.
- `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`; no se habilitan escritores.
- La configuración SIF sigue incompleta; PR #447 eliminó el fallback inseguro, pero no acredita conformidad VERI*FACTU.
- Las pruebas offline no demuestran que Wix ejecute hooks en runtime ni que los permisos reales sean correctos.
- No se certifica la integridad de los registros históricos ni la conformidad fiscal por esta auditoría.

## Próximos pasos

1. Completar E2E Sandbox de hooks y productores por colección.
2. Verificar permisos con identidad CMS_EDITOR y backend autorizado (#261).
3. Resolver `recordDomain`/identidad de cierre Z antes de reactivar esa ruta.
4. Completar snapshot persistido y versionado de Gestoría (#223).
5. Auditar escritores, bypasses y consumidores restantes antes de habilitar cualquier writer.
