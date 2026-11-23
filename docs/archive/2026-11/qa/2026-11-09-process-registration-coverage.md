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
| Reservas y reprogramaciones | Wix Bookings V2 | Wix Bookings SSOT + proyección `CitasF2`; `ControlOperativo` para eventos/locks | **BRECHA CLASIFICADA; RECUPERACIÓN EN PR #220** | 339 reservas nativas; 55 filas CitasF2; 54 IDs coincidentes; 285 sin proyección. De las 285: 56 CONFIRMED creadas por WIX_USER (39 con recurso válido, 17 NO_SELECTION), 18 CREATED WIX_USER, 90 CANCELED WIX_USER, 97 CANCELED MEMBER y 24 CANCELED ANONYMOUS_VISITOR. De las 56 confirmadas, 1 está PAID y ligada a pedido eCommerce; 38 son no pagadas/exentas con recurso válido y se pueden proyectar con importe 0 + bandera de conciliación. 15 canceladas siguen PAID (2 con pedido eCommerce, 13 sin pedido asociado en la lectura); requieren revisión financiera. |
| Cancelación de reservas | Wix Bookings V2 | Estado CMS `CANCELED`; rectificación económica en ledger cuando exista hecho económico | **CÓDIGO NORMALIZADO; HISTÓRICO PENDIENTE** | Se normalizó `CANCELED` en la rama. Hay 34 filas históricas con el estado antiguo; migración solo mediante backend controlado, trazable e idempotente. No usar REST directo. |
| Reservas duales / compensaciones | Wix Bookings + saga propia | Dos filas CitasF2 + journal/controles de compensación en ControlOperativo | **PARCIAL** | Deben probarse fallos entre F1/F2, reintentos, cancelación compensatoria, replay y consistencia de ambos IDs en entorno Wix. CI offline no prueba estas llamadas reales. |
| Pedidos de tienda / checkout | Wix Orders | Wix Orders es SSOT; `ControlOperativo` guarda marcador idempotente `ORDER_CREATED`/`ORDER_CREATED_RECONCILED`; ledgers solo para hechos económicos confirmados | **BRECHA CONFIRMADA; RECUPERACIÓN EN PR #219** | Reconciliación read-only actual: 30 pedidos (28 APPROVED, 2 CANCELED; 3 PAID, 27 NOT_PAID), 68 filas ControlOperativo y 0 marcadores ORDER_CREATED localizados. 29 pedidos tienen exclusivamente líneas Wix Bookings; 1 pedido mixto contiene Stores + Bookings + una línea sin appId. El pedido mixto #10018 no tiene fila ControlOperativo ni movimiento MovimientosInventario por su orderId. PR #219 incorpora cron que registra solo Bookings-only y alerta los mixtos/productos, sin crear stock/caja/fiscal. No reconstruir movimientos del mixto hasta verificar la línea y el efecto nativo. |
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
| Exportación y custodia M365 | CMS SSOT → export backend → email/Resend → Outlook/Power Automate → SharePoint | SharePoint solo evidencia documental | **NO VERIFICADO EN EJECUCIÓN** | El dossier del repositorio incluye una auditoría fechada 2026-11-09 que confirma que Capa 3 no está implementada en runtime: falta exportService.js, faltan los cuatro crons y jobs de exportación, no se localiza envío runtime Resend y PA-01…PA-07/SharePoint no están auditados en el tenant. La arquitectura del dossier de flujos no acredita implantación. Capa 3 nunca escribe de vuelta en Capa 1. |
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


## 7. Hallazgos adicionales de inspección estática (rama de auditoría)

### 7.1 Trazabilidad de caché de disponibilidad

- `src/backend/reservas.web.js::_writeDaysCacheWindow` creaba filas `DAYS_CACHE` sin `traceId`.
- Se corrigió en la rama para propagar el `traceId` de `_getAvailableDaysInternal` al registro de caché.
- Se añadió una aserción en `src/backend/tests/reservas.web.test.mjs` para exigir que el registro cacheado contenga `traceId`.
- La caché es temporal (TTL de 5 minutos); no se considera un hecho de negocio ni se exporta a Capa 3.

### 7.2 Webhook ORDER_CREATED: fallo no durable acreditado

En `src/backend/events.js::wixEcom_onOrderCreated`, el código anterior solo relanzaba errores `INVENTORY_`; otros fallos devolvían `{ status: "OK" }`, lo que ocultaba el fallo de persistencia del marcador.

PR #219 cambia el handler para propagar todos los errores y añade reconciliación periódica independiente contra Wix Orders. La documentación oficial de Wix confirma entrega asíncrona al menos una vez e insta a implementar idempotencia, pero no se ha encontrado una garantía explícita de reintento automático ante una excepción de Velo. Por ello, la recuperación periódica no depende exclusivamente de ese comportamiento.

### 7.3 Capa 3: corrección del estado

La auditoría del repositorio `docs/audits/2026-11-09-capa3-implementation-state.md` fija el estado de implantación: arquitectura documentada, ejecución operativa no demostrada. No existen los cuatro crons de exportación ni jobs correspondientes; `verifyNightlyZClosing` verifica el cierre, pero no genera/envía CSV; Resend no aparece en runtime; tenant M365, PA-01…PA-07 y SharePoint no están auditados. Además, existe una contradicción entre el patrón Resend descrito en el dossier y la directriz que prohíbe añadir proveedor externo sin aprobación. Requiere ADR antes de implementar transporte.

### 7.4 Validación del webhook

La documentación oficial de Wix consultada indica que los Velo backend event handlers para Wix Studio/Wix Editor se ejecutan en el sitio publicado. Por ello, la suite offline no acredita la ejecución real de esos handlers; la aceptación requiere un entorno Wix publicado de QA con eventos sintéticos, sin transacciones reales.


## 8. Actualización tras ampliar la auditoría (2026-11-09)

- Último commit de código verificado: `c5378dcb869201566a4f3f0d6c248e2aaaef4cf3`.
- CI #210: **success**; 47 suites, 444 tests, 0 fallos.
- SDK contract, Bookings Reader V2 contract y ESLint: **success**.
- `src/backend/reservas.web.js::_writeDaysCacheWindow`: ahora añade `traceId` al registro temporal `DAYS_CACHE`; prueba `RES-DAYS-01` verifica el campo.
- `src/backend/cajas.web.js::getCashierState`: eliminados los `.catch()` que convertían fallos de lectura/conteo del ledger en cero operaciones o en el contador de la proyección. El método devuelve ERROR si no puede leer el ledger. `site.flows.offline.test.mjs` cubre el fallo de lectura forzado.
- La normalización `CANCELED`, la validación `scheduleId` y la corrección contable `cashMovementId` siguen incluidas en la rama.
- El fallo de `wixEcom_onOrderCreated` descrito en §7.2 se corrige en PR #219: el handler ya no devuelve OK tras un error de persistencia; propaga el error y existe un cron independiente de reconciliación. No se afirma que la excepción por sí sola garantice reintento automático.
- No se ha hecho merge ni despliegue. No se han escrito datos ni esquemas CMS, ni se han ejecutado pagos, reservas, movimientos fiscales o cambios de stock.


## 9. Reconciliación nativa de pedidos y corrección de recuperación (2026-11-09)

### Evidencia Wix de solo lectura

La consulta oficial `POST /ecom/v1/orders/search` devolvió 30 pedidos en una página:
- Estado de pedido: 28 APPROVED y 2 CANCELED.
- Estado de pago: 3 PAID y 27 NOT_PAID.
- Canales: 25 WEB, 3 POS y 2 BACKOFFICE_MERCHANT.
- 32 líneas Wix Bookings, 1 línea Wix Stores y 1 línea sin `catalogReference.appId`.
- 29 pedidos tienen exclusivamente líneas Bookings; el pedido restante (n.º 10018) combina Bookings, Stores y una línea sin appId.

La consulta de `ControlOperativo` devolvió 68 filas, pero ninguna con `payload.eventType=ORDER_CREATED`. Para el pedido mixto n.º 10018 (ID `70176e1b-6378-4eb9-90fe-fdebf692963f`) las consultas read-only por `orderId` devolvieron cero filas en `ControlOperativo` y cero movimientos en `MovimientosInventario`. Esto no prueba pérdida financiera ni stock incorrecto; sí deja pendiente verificar el efecto nativo de inventario y la línea concreta antes de reconstruir.

### Implementación en PR #219

- `wixEcom_onOrderCreated` ahora propaga todos los errores de persistencia/procesamiento en lugar de devolver `OK` en fallos no clasificados como INVENTORY. La idempotencia existente permanece.
- `reconcileUnmarkedOrderCreatedEvents` busca Wix Orders con paginación; consulta explícitamente PENDING y REJECTED porque Search Orders no los incluye en la búsqueda predeterminada.
- Solo escribe un registro append-only `WEBHOOK_EVENT` de tipo `ORDER_CREATED_RECONCILED` si todas las líneas pertenecen a Wix Bookings, ya que no se requiere proyección de inventario Stores.
- Pedidos con línea Stores, mezcla de catálogos, appId ausente o líneas vacías quedan sin marcador y reciben alerta deduplicada `ORDER_CREATED_RECONCILIATION_REQUIRED`.
- El cron no genera movimientos de caja, asientos, pagos, reservas ni movimientos de inventario.
- El webhook reconoce los marcadores de reconciliación para evitar reprocesar pedidos Booking-only si llega un evento tardío.
- Límite oficial de Search Orders: PENDING y REJECTED requieren filtros explícitos (incluidos); INITIALIZED nunca aparece en Search Orders. Esos pedidos solo pueden procesarse desde su evento original o con Get Order si ya se conoce su ID. La reconciliación periódica no certifica cobertura de INITIALIZED.
- Ejecución programada: cada 30 minutos, timeout 180 s, reintentos/alertas de fallo configurados.

### Pruebas y estado

- PR #219: `fix/order-created-reconciliation-recovery`.
- CI #213: 47 suites, 447 tests, 0 fallos; SDK contracts, Bookings Reader V2 contract y ESLint correctos.
- La prueba offline cubre paginación, reconciliación Booking-only, alerta de pedidos mixtos, replay idempotente y ausencia de escrituras en ledgers de caja/inventario.
- No se ha escrito ningún dato en CMS live, no se ha ejecutado el cron en el sitio, no se ha publicado código Velo.
- Sigue pendiente la validación de scopes/import runtime y la ejecución del cron en Wix QA publicado. El pedido mixto requiere revisión específica antes de cualquier efecto de inventario.


## 10. Reconciliación de proyecciones Bookings (2026-11-09)

### Evidencia nativa Wix (solo lectura)

La consulta V2 de Bookings, paginada y sin extraer datos de contacto, confirma:
- 339 reservas nativas; 55 filas CitasF2; 54 coincidencias por bookingId; 285 sin proyección.
- Las 285 faltantes se desglosan por estado/creador:
  - 56 CONFIRMED / WIX_USER.
  - 18 CREATED / WIX_USER.
  - 90 CANCELED / WIX_USER.
  - 97 CANCELED / MEMBER.
  - 24 CANCELED / ANONYMOUS_VISITOR.
- Entre las 56 CONFIRMED: 39 tienen serviceId, scheduleId, resourceId y fechas válidas; 17 tienen `resourceSelections=NO_SELECTION` y no permiten asignar profesional de forma segura.
- De las 39 con recurso válido: 38 son NOT_PAID/UNDEFINED/EXEMPT y una es PAID. Las 56 no exponen importe exacto; el writer canónico proyecta `totalAmount=0` y `meta.amountReconciliationRequired=true` cuando no existe importe verificable.
- La única confirmada PAID sin proyección está asociada a un pedido eCommerce PAID. No se crea asiento ni movimiento de caja.
- Hay 15 reservas CANCELED con paymentStatus PAID: 2 tienen pedido eCommerce asociado (ambos PAID) y 13 no exponen pedido eCommerce asociado en Reader V2. No se ha inferido que proceda un reembolso; se requiere conciliación de pago, política y ledger.
- Las 121 reservas CANCELED creadas por MEMBER/ANONYMOUS_VISITOR están ya registradas en Wix Bookings SSOT; no se reactivan ni se convierten en reservas activas.

### Implementación en PR #220

- `_syncNativeBookingToCitas` acepta tanto `BookedResource.id` como `BookedResource._id`, manteniendo el contrato de SDK/REST.
- Nuevo writer interno `reconcileConfirmedNativeBookingProjectionInternal`: solo permite reservas nativas CONFIRMED y excluye estados PAID/PARTIALLY_PAID/REFUNDED sin prueba de ledger.
- Nuevo cron `reconcileMissingConfirmedBookingProjections`:
  - Lee Bookings Reader V2 con paginación correcta (el cursor se envía sin repetir el filtro inicial).
  - Proyecta únicamente reservas CONFIRMED no pagadas con datos de servicio, schedule y recurso completos.
  - Crea marcador `BOOKING_CONFIRMED_RECONCILED` append-only e idempotente.
  - Genera alertas deduplicadas para recurso no asignado, pagos no conciliados y reservas CANCELED/PAID sin proyección.
  - No crea movimientos de caja, asientos, pagos, reservas ni movimientos de inventario.
- Los handlers de Booking Confirmed/Rescheduled/Canceled y Order Payment/Refund/Canceled ya no devuelven objetos `RETRY_REQUIRED` o `OK` tras errores de persistencia: propagan la excepción. Los caminos de rechazo de integridad no reintentables permanecen explícitos.
- El cron se programa cada 30 minutos, desplazado 15 minutos respecto al reconciliador de pedidos.

### Validación pendiente

- PR #220: CI pendiente.
- No se ha ejecutado ningún cron en el sitio ni se han escrito filas CitasF2/ControlOperativo live.
- No se han creado movimientos fiscales, caja ni inventario.
- La publicación Velo y la prueba E2E en Wix QA siguen pendientes por ausencia de herramienta de despliegue/invocación desde esta sesión.
