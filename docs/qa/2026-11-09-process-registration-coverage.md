# Auditoría de cobertura de registro por proceso — 2026-11-09

**Proyecto:** Marian Madrid · marianmadrid.es  
**Rama:** `audit/data-registration-gap-execution-2026-11-09`  
**PR:** #218  
**Alcance:** trazabilidad de datos generados por procesos del sitio, desde el origen hasta la persistencia en Wix CMS y, cuando corresponde, su exportación documental.  
**Naturaleza:** auditoría estática + lecturas CMS ya realizadas; no es una prueba E2E ni certifica el comportamiento publicado.

## 1. Criterio de cobertura

Un proceso se considera cubierto solo si se puede demostrar:

1. Identificador nativo del evento/operación y `traceId`.
2. Writer backend responsable y contrato de validación.
3. Persistencia en la colección SSOT correspondiente.
4. Idempotencia/reintento y tratamiento durable del fallo.
5. Reconciliación con la fuente nativa Wix cuando el origen es una Wix App.
6. Exportación a Capa 3 únicamente cuando el dato tiene finalidad fiscal, contable, laboral o documental.
7. Prueba reproducible en entorno Wix, además de tests offline.

**No se debe persistir indiscriminadamente todo dato transitorio.** Disponibilidad consultada, cachés, carritos abandonados y rate limits no son registros de negocio. Deben persistirse los hechos y estados que el contrato de negocio exige; los controles técnicos se conservan según su política de auditoría. PII, datos de tarjeta y datos capilares/salud no se exportan a SharePoint.

## 2. Matriz de cobertura por proceso

| Proceso | Fuente de verdad | Persistencia / destino canónico | Estado observado | Brecha / acción necesaria |
|---|---|---|---|---|
| Reservas y reprogramaciones | Wix Bookings V2 | Wix Bookings + proyección `CitasF2`; `ControlOperativo` para eventos/locks | **PARCIAL / NO E2E** | La lectura anterior encontró 339 bookings nativos, 55 filas CitasF2, 54 IDs coincidentes, 285 bookings nativos sin proyección y 1 proyección no coincidente. Analizar por fecha, estado, origen y alcance del writer antes de declarar pérdida. La rama exige `scheduleId` GUID en el writer/hook; falta ejecutar Local Editor y validar el esquema físico. |
| Cancelación de reservas | Wix Bookings V2 | Estado CMS `CANCELED`; rectificación económica en ledger cuando exista hecho económico | **CÓDIGO NORMALIZADO; HISTÓRICO PENDIENTE** | Se normalizó `CANCELED` en la rama. Hay 34 filas históricas con el estado antiguo; migración solo mediante backend controlado, trazable e idempotente. No usar REST directo. |
| Reservas duales / compensaciones | Wix Bookings + saga propia | Dos filas CitasF2 + journal/controles de compensación en ControlOperativo | **PARCIAL** | Deben probarse fallos entre F1/F2, reintentos, cancelación compensatoria, replay y consistencia de ambos IDs en entorno Wix. CI offline no prueba estas llamadas reales. |
| Pedidos de tienda / checkout | Wix Orders | Wix Orders es SSOT; `ControlOperativo` guarda marcador idempotente `ORDER_CREATED`; ledgers solo para hechos económicos confirmados | **PENDIENTE DE RECONCILIACIÓN** | Hay 30 pedidos nativos observados (3 APPROVED/PAID, 25 APPROVED/NOT_PAID, 2 CANCELED/NOT_PAID). En 68 filas ControlOperativo no se encontró marcador `ORDER_CREATED`. La ausencia del marcador no prueba pérdida: reconsultar Wix Orders y verificar el webhook/recovery. No crear colección duplicada de intención. |
| Cobros, devoluciones y movimientos físicos de caja | Wix eCommerce / MONEI / WebMethod presencial | `MovimientosCaja` append-only + proyección singleton `CajaActual` | **NO CONCILIADO** | La última lectura encontró 0 MovimientosCaja y 1 CajaActual (`cashAmount=300`, fecha 2026-11-05). Tratar el singleton como estado técnico/preexistente, no como venta real. Reconciliar pedidos y pagos con transacciones confirmadas del proveedor antes de generar cualquier movimiento. Solo CAPTURED/settled debe producir cobro; AUTHORIZED no basta. |
| Estado de caja | Movimientos físicos confirmados | Un único registro `CajaActual`, actualizado en tiempo real | **MODELO DEFINIDO; E2E PENDIENTE** | Mantener un único singleton. Cada movimiento físico debe reflejarse en tiempo real y de forma idempotente. Corregir/validar que un fallo de lectura de MovimientosCaja no se convierta silenciosamente en totalOperations=0. |
| Arqueo X | Conteo físico manual | Nueva colección append-only de actas X (no CajaActual ni MovimientosCaja) | **NO IMPLEMENTADO** | Requiere aprobar esquema CMS, permisos, hook append-only, writer backend, traceId, clave idempotente, firma y pruebas. No se puede crear de forma segura sin contrato de colección aprobado. |
| Asientos contables no-caja (proveedores, banco) | Documento externo + reglas PGC aprobadas | `LibroAsientosContablesDetalle` append-only | **WRITER DISPONIBLE; AUTOMATIZACIÓN BLOQUEADA** | Se corrigió `cashMovementId` para que no se fabrique en asientos no-caja. El writer valida partida doble, hash-chain e idempotencia. No automatizar hasta aprobar cuentas PGC, criterios de reconocimiento y mapeos. No generar `MovimientosCaja` ni modificar `CajaActual`. |
| Cierre Z | Ledger `MovimientosCaja` | `HistoricoCierresZ` append-only | **NO VERIFICABLE CON LEDGER VACÍO** | No declarar cierre correcto si no hay movimientos reconciliados. Ejecutar cierre de prueba en entorno QA aislado, verificando totales por método, devoluciones, hash-chain, firma, duplicidad y alertas. |
| Inventario y ventas de producto | Wix Stores Catalog V3 / Wix Orders | Wix Inventory V3 SSOT + `InventarioStockVenta` proyección + `MovimientosInventario` append-only | **PARCIAL / SIN RECONCILIACIÓN E2E** | Lectura previa: 30 items V3 en una ubicación, 1 fila InventarioStockVenta y 1 MovimientosInventario. Falta reconciliar cantidades y eventos de pedidos/devoluciones, probar SDK/scopes en Local Editor y confirmar que el efecto nativo Wix no se duplica. |
| Actas de recuento de inventario | Conteo físico | Nueva colección append-only independiente | **NO IMPLEMENTADO** | Aprobar esquema y permisos CMS; implementar writer con traceId, idempotencia, responsable, cantidades observadas, diferencias y referencia al stock snapshot. Nunca sobrescribir el ledger ni usar MovimientosInventario como acta de conteo. |
| Fichajes y ajustes de jornada | WebMethod de personal | `RegistrosHorariosStaff` append-only | **PARCIAL** | Hay 2 filas observadas con traceId y recordedAt, sin firma en los registros existentes. El writer genera HMAC pero el validator no exige signature. Determinar si son históricos/QA y reforzar contrato solo tras analizar compatibilidad; ejecutar pruebas de firma, replay, ajustes y export. |
| Datos fiscales de terceros | Alta/actualización administrativa | `DatosFiscales` | **EXISTENCIA VERIFICADA; FLUJO NO E2E** | Existe 1 registro. Verificar alta, validación NIF/VAT, autorización, versionado/cambios y relación con asientos. No inferir datos ausentes. |
| Facturación nativa Wix | Wix Invoices (app instalada) | Mantener separado del ledger fiscal propio hasta confirmar contrato | **API NO DISPONIBLE EN LA CUENTA** | Settings GET respondió 200, pero query de invoices v4 respondió 428 INVOICES_API_UNAVAILABLE. No afirmar disponibilidad de Invoices V2 ni crear segundo motor. Mantener versión activa hasta habilitación documentada. |
| Exportación y custodia M365 | CMS SSOT → export backend → email/Resend → Outlook/Power Automate → SharePoint | SharePoint solo evidencia documental | **NO VERIFICADO EN EJECUCIÓN** | Dossier define 5 crons y 7 flujos PA, pero no hay evidencia de ejecución real, confirmación de archivo, idempotencia en destino ni conciliación de conteos. Verificar conectores, secretos, ejecuciones, errores y archivos con IDs/traceId. Capa 3 nunca escribe de vuelta en Capa 1. |
| Registros técnicos, webhooks y recuperación | Wix webhooks / crons | `ControlOperativo` + logs/audit según política | **PARCIAL** | Se observaron 68 filas; 67 con traceId, todas con dedupeKey. Hay 34 registros webhook con eventId/dedupeKey/traceId/payload.processedAt. Un registro DAYS_CACHE carece de traceId y el hook de inserción no invoca el validator. Revisar todos los tipos de control y la regla de procesado durable antes de marcar webhook como completado. |
| IA, formularios, Members y consentimientos | Wix Forms/Members + módulos personalizados | Colecciones específicas solo si están aprobadas y justificadas por finalidad | **FUERA DE LA VALIDACIÓN DE PERSISTENCIA** | El dossier de necesidades declara varios requisitos de IA, salud/consentimiento, formularios y perfil, pero esta auditoría no demuestra sus colecciones, permisos, retención ni funcionamiento publicado. No exportar PII/salud a Capa 3. Requiere auditoría de privacidad y pruebas separadas. |
| Tarjetas regalo / bonos | Wix Gift Cards o módulo propio, según implementación real | Ledger/saldo y eventos de emisión/canje aprobados | **NO VERIFICADO EN EL REPOSITORIO/CMS ACTUAL** | El documento de necesidades declara GiftCards, HMAC y QR, pero no se ha acreditado en esta ejecución una colección/writer activo ni su conciliación con pedidos y pagos. No asumir que existe por estar declarado. |

## 3. Hallazgos transversales que impiden declarar cobertura total

### 3.1 Persistencia y trazabilidad

- `CitasF2`: 55 filas; un registro QA-only está malformado (bookingId no GUID y sin scheduleId). No actualizar ni borrar por REST.
- `ControlOperativo`: 68 filas; 67 traceId, 68 dedupeKey. Un DAYS_CACHE sin traceId y hook sin llamada al validator.
- `RegistrosHorariosStaff`: 2 filas con traceId/recordedAt y sin signature; el writer genera HMAC, pero la validación no la exige.
- `MovimientosCaja`: 0 filas; `LibroAsientosContablesDetalle`: 0 filas; `HistoricoCierresZ`: 0 filas en la lectura anterior.
- `RegistroIntegracion`: colección existente, 0 filas; el código inspeccionado no acredita writer activo.

### 3.2 Reglas de dominio fijadas por el responsable

- Estado de cancelación CMS: `CANCELED` únicamente.
- Operaciones sin efectivo/caja física: `LibroAsientosContablesDetalle`.
- `CajaActual`: exactamente un singleton, proyección del estado de caja.
- `MovimientosCaja`: cada movimiento físico, detalle y acumulados; append-only.
- Wix Orders es SSOT de pedidos/intenciones; no crear duplicados en CitasF2.
- Wix CMS es SSOT transaccional; SharePoint es repositorio documental de evidencia.

### 3.3 Integridad y reconciliación

La existencia de una fila en una proyección no demuestra que el hecho de origen se haya registrado correctamente. Para cada dominio hay que comparar:
- Conteo y claves de la fuente nativa.
- Conteo y claves de la proyección CMS.
- Claves de idempotencia/evento.
- Resultado persistido y errores recuperables.
- Conteo y hash de exportación cuando exista traslado a Capa 3.

La ausencia de un marcador técnico no prueba por sí sola pérdida de negocio; debe reconciliarse con la fuente nativa. A la inversa, un estado/proyección CMS sin hecho nativo correspondiente requiere clasificación y trazabilidad.

## 4. CI y código de la rama

- Último commit comprobado: `8ce9a8c48c40b0be74944be1cf73ec7a489c7bf3`.
- GitHub Actions run #204: **success**.
- Job `Layer 1 and 2 QA, offline regression, SDK contract and lint`: **success**.
- Suite offline, contratos SDK, contrato Bookings Reader V2 y ESLint: **success**.
- Esto no ejecuta Wix Local Editor, webhooks reales, CMS hooks publicados, proveedores de pago, crons ni Power Automate.
- PR #218 permanece abierto y sin merge en el estado de esta auditoría.

## 5. Acciones bloqueadas por dependencias de plataforma o aprobación

1. **Migrar 34 estados históricos:** requiere un WebMethod backend de migración controlada y publicado; no hay invocador de WebMethods ni despliegue Velo disponible desde esta sesión. REST CMS no es una alternativa aceptable.
2. **Resolver el registro QA-only malformado:** requiere flujo backend controlado; no borrarlo ni corregirlo por REST.
3. **Arqueo X y actas de recuento:** requieren contrato físico CMS, permisos y hooks aprobados antes de crear writers.
4. **Asientos de proveedores/banco:** requiere aprobación del PGC y reglas de contabilización.
5. **Pedidos/pagos:** requiere reconciliación Wix Orders ↔ transacciones del proveedor ↔ ledgers antes de cualquier asiento. No crear movimientos ficticios.
6. **Inventario V3:** requiere validación de scopes, import runtime del SDK y E2E en Local Editor.
7. **Capa 3:** requiere comprobar los flujos reales de Power Automate y la confirmación de archivo en SharePoint.

## 6. Criterio para declarar el sistema cubierto

No se declarará “todos los datos quedan registrados” hasta disponer, para cada proceso incluido en alcance, de:
- matriz origen → writer → colección/campo → clave idempotente → traceId;
- validación de esquema físico CMS y hooks;
- pruebas de fallo antes/después de persistencia y replay;
- conciliación fuente nativa ↔ proyección;
- pruebas de concurrencia e idempotencia;
- ejecución E2E en Wix QA/Local Editor;
- evidencia de exportación y recepción para los procesos que correspondan;
- versión de código, esquema y resultados enlazados.

**Resultado de esta auditoría:** cobertura parcial. Se han cerrado brechas de código en la rama y CI offline está verde; quedan brechas de implementación, conciliación y validación real que impiden certificar cobertura total. No se han realizado escrituras CMS, migraciones, pagos, reservas, movimientos fiscales, cambios de stock ni despliegues.
