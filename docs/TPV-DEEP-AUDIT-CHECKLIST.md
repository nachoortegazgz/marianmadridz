# Checklist de auditoría profunda — TPV, backend y reservas

**Fecha de revisión:** 2026-11-28  
**Fuente:** auditoría aportada en `bugstpv.md` (40 bloqueos TPV, auditoría de 29 módulos TPV, 33 módulos backend y 8 módulos de páginas/reservas).  
**Base revisada:** código de `main` y rama de trabajo al iniciar esta intervención. Los cambios de esta revisión se realizan en esta rama, no en producción.  
**Estado global:** correcciones puntuales implementadas; circuito comercial/pago/cierre y varios riesgos arquitectónicos siguen pendientes.  
**Regla de evidencia:** un cambio en Git no demuestra ejecución en Wix Runtime. No se declaran PASS de pruebas no ejecutadas.

## 1. Correcciones implementadas en esta rama

- [x] **TPV-AUD-01 — Exportación de auditoría crasheaba por referencia no importada.** `exportarAuditoriaTPV` llamaba a `requireCajero`, que no estaba importado. Se sustituye por `requireAdmin`, coherente con la sensibilidad de exportación y con la autorización administrativa de la exportación de movimientos.
- [x] **TPV-AUD-02 — Capacidades administrativas ocultas en la interfaz.** `obtenerPermisosTPV` devolvía `issueTicketZ: false` y `exportAudit: false` incluso para ADMIN. Ahora ambas capacidades se derivan de `staff.rolWebsite === "ADMIN"`. La autorización backend sigue siendo obligatoria.
- [x] **TPV-AUD-03 — Lectura de estado de caja sin normalización de errores.** `obtenerEstadoCaja` ahora captura fallos de identidad, contexto y lectura de caja y devuelve `normalizeTpvError(..., "TPV_SESSION_READ_FAILED")` con `traceId`.
- [x] **BK-AUD-01 — Idempotencia de pagos de reservas ignoraba el orderId canónico.** Los dos validadores de `citasManager.web.js` consultan ahora primero `cita[FIELD_ORDER_ID]` y conservan `meta.orderId` como compatibilidad histórica.
- [x] **BK-AUD-02 — Marcadores de webhooks de reembolso no coincidían con el eventType consultado.** Los marcadores de los dos handlers se escriben con el mismo eventType usado en `isEventProcessed`, incluyendo `traceId` y metadatos de orden/reembolso.
- [x] **FISC-AUD-01 — Regex de huso horario Madrid doblemente escapada.** Corregido el literal regex para reconocer correctamente los dígitos del offset GMT.

**Commits de código:**  
- `6369e118fe40ab6656efcd60ae40f02740a7ab75` — exportación de auditoría TPV.  
- `fe345db30e8ac0b9208073f99fc648d941aeadc5` — capacidades ADMIN.  
- `8aad43b686c7f16ed5bcf02d71bca9bce626f3ff` — errores de lectura de caja.  
- `a41c928f169a13d94ae0a67640c1ff4163221ad3` — idempotencia Bookings/orderId.  
- `074b9239552a0549f01811268806dedf8805d7f4` — idempotencia de eventos de reembolso.  
- `ca72fe697c32b1bcb0c5088807f2d0d96e815007` — regex de offset fiscal.

## 2. Checklist de los 40 bloqueos TPV

Leyenda: **CONSERVAR** = control correcto; **CORREGIDO** = cambio incluido en esta rama; **PENDIENTE** = requiere trabajo/prueba; **NO APLICAR** = el hallazgo no coincide con el código descrito o entra en conflicto con el contrato vigente.

| Nº | Hallazgo | Decisión / estado |
|---:|---|---|
| 1 | Modo consulta global / `operationalWritesAvailable` | [x] **CONSERVAR** el control backend. [ ] **PENDIENTE** mejorar el mensaje de UI para explicar permiso/sesión/capacidad ausente. |
| 2 | Texto “Cobros deshabilitados” frente a métodos visibles | [ ] **PENDIENTE** alinear copy y capacidades; no activar un cobro real por corregir texto. |
| 3 | Ventas sin pagos rechazadas por contrato V1 | [ ] **PENDIENTE** resolver el contrato de venta pendiente frente a venta cobrada. La auditoría contiene descripciones incompatibles entre sí; no cambiar el contrato sin verificar todos los consumidores. |
| 4 | `TPV_PENDING_SALE_PAYMENTS_NOT_ALLOWED` | [ ] **PENDIENTE DE VERIFICACIÓN**; la propia auditoría indica que el código actual no contiene ese error. No añadirlo por copia de la tabla. |
| 5 | `medioPago` omitido en `registrarVenta` | [ ] **PENDIENTE DE VERIFICACIÓN**; la auditoría afirma que el controller sí transmite `medioPago` y `pagos`. No eliminar campos sin contrato consolidado. |
| 6 | Devoluciones sin proveedor | [x] **CONSERVAR BLOQUEO** explícito. [ ] Pendiente integración y validación del proveedor de reembolsos. |
| 7 | Botón de devolución bloqueado también en UI | [x] **CONSERVAR** mientras backend/proveedor no estén habilitados. [ ] Retirar el bloqueo visual redundante solo cuando exista flujo backend probado. |
| 8 | Tarifa personalizada | [ ] **PENDIENTE** definir autorización, catálogo/precio y cálculo fiscal en backend antes de habilitar. |
| 9 | Bizum | [x] **CONSERVAR BLOQUEO** hasta confirmar proveedor, liquidación y conciliación. |
| 10 | Bonos | [x] **CONSERVAR BLOQUEO** hasta consultar y validar saldo/consumo nativo. |
| 11 | Tarjeta regalo | [x] **CONSERVAR BLOQUEO** hasta integración nativa y consulta de saldo. |
| 12 | Otros medios | [x] **CONSERVAR RECHAZO** del contrato no soportado. |
| 13 | Pago dividido | [x] **CONSERVAR RESTRICCIÓN V1** hasta soportar persistencia, conciliación e idempotencia de cada tramo. |
| 14 | Cambio limitado al efectivo | [x] **CONSERVAR**; el cambio no se devuelve contra una tarjeta. |
| 15 | Ticket vacío | [x] **CONSERVAR** validación UI y backend. |
| 16 | Operación sin sesión abierta | [x] **CONSERVAR** validación backend. |
| 17 | Apertura sin previsualización | [x] **CONSERVAR** requisito de previsualización. |
| 18 | Apertura duplicada | [x] **CONSERVAR** locks e idempotencia de sesión. |
| 19 | Previsualización obsoleta | [x] **CONSERVAR** validación contra sesión esperada. |
| 20 | Cierre Z con ventas pendientes | [x] **CONSERVAR** el control. [ ] **PENDIENTE P1** implementar/validar confirmación real del pago antes de poder cerrar ventas cobradas; nunca cambiar PENDING a CONFIRMED por selección UI. |
| 21 | Cierre con devoluciones pendientes | [x] **CONSERVAR**. |
| 22 | Diferencia de arqueo sin motivo | [x] **CONSERVAR** exigencia de motivo. |
| 23 | Producto sin variante válida | [x] **CONSERVAR** validación de variante. |
| 24 | Servicio sin precio fijo verificable | [x] **CONSERVAR** hasta contrato explícito de tarifa variable. |
| 25 | Línea sin clasificación fiscal | [x] **CONSERVAR**; consumir la configuración fiscal nativa Wix y no inventar clasificación. |
| 26 | Cálculo fiscal incompleto | [x] **CONSERVAR** rechazo fail-closed. |
| 27 | Moneda distinta de EUR | [x] **CONSERVAR** validación de moneda. |
| 28 | Descuentos bloqueados | [x] **CONSERVAR BLOQUEO** hasta definir permisos, reglas y recálculo fiscal backend. |
| 29 | Clave idempotente obsoleta tras editar carrito | [ ] **PENDIENTE P1** revisar `keyedAction` y cambios de `state.items`; preservar clave si resultado incierto y permitir nueva identidad solo tras resolver/reconciliar la operación anterior. |
| 30 | Clave idempotente inválida | [x] **CONSERVAR** rechazo. |
| 31 | Exportación truncada | [x] **CONSERVAR** aborto explícito de exportación incompleta. |
| 32 | Origen padre no permitido/no disponible | [x] **CONSERVAR** allowlist; mantener configuración de dominios sincronizada. |
| 33 | Mensajes de otra ventana | [x] **CONSERVAR** validación de `event.source`. [ ] Añadir diagnóstico observable sin aceptar mensajes inválidos. |
| 34 | Respuestas de otro origen | [x] **CONSERVAR** validación de `event.origin`. [ ] Añadir diagnóstico observable sin degradar seguridad. |
| 35 | Protocolo MM_READY/MM_CONTEXT | [x] **CONSERVAR** componente, versión y nonce; no sustituir por otro protocolo. |
| 36 | Catálogo sin precio verificable | [x] **CONSERVAR** rechazo. |
| 37 | `traceId` en catálogo | [x] **YA CORREGIDO EN CÓDIGO SEGÚN AUDITORÍA**; no duplicar parche. [ ] Mantener pruebas de regresión de servicios, productos, variantes, personal y clientes. |
| 38 | Exportación de auditoría / persistencia de auditoría de venta | [x] **CORREGIDO** crash por `requireCajero` no definido: ahora usa `requireAdmin`. [ ] **PENDIENTE** comprobar el tratamiento UI de `auditPersisted === false` y la recuperación del evento de auditoría. |
| 39 | Permisos | [x] **CORREGIDO** `issueTicketZ` y `exportAudit` se exponen a ADMIN; [x] autorización backend sigue siendo obligatoria. |
| 40 | Contexto Wix no autorizado en `onContextReady` | [x] **CONSERVAR** rechazo de arranque cuando falla configuración, handshake o permiso. |

## 3. Bugs críticos/altos de módulos TPV

- [ ] **B1 — Respuesta PENDING interpretada como rechazo por el widget.** Pendiente inspeccionar contrato de `call()`, `keyedAction()` y `SALE_REGISTER`; distinguir respuesta de venta pendiente persistida de timeout/resultado desconocido. No limpiar una clave cuando la operación pueda haberse persistido sin antes consultar su resultado.
- [ ] **B2 — Todas las ventas quedan PENDING_PAYMENT y bloquean Cierre Z.** Pendiente implementar confirmación real y persistida del proveedor, conciliación y transición canónica. No simular CONFIRMED.
- [x] **B3 — ReferenceError de exportación de auditoría.** Corregido en esta rama usando `requireAdmin`.
- [ ] **B4 — Estados CONFIRMED/CONFIRMADA divergentes.** Pendiente definir enum canónico en `internalConfig.js`, adaptadores de lectura histórica y consumidores; añadir pruebas de exportación/proyección.
- [ ] **B5 — Bloqueo incondicional de venta de productos por inventario.** Pendiente integrar consulta/reserva/consumo nativo de Wix Stores Inventory. No retirar el bloqueo hasta garantizar disponibilidad y concurrencia.
- [ ] **B6 — Cliente seleccionado descartado al registrar venta.** Pendiente propagar el identificador de cliente por HTML → controller → WebMethod y revalidarlo en backend mediante directorio nativo.
- [x] **B7 — Capacidades ADMIN Ticket Z y exportación auditoría deshabilitadas.** Corregido en esta rama; no sustituye autorización backend.
- [ ] **B8 — Cierre de sesión y Cierre Z con escrituras distintas.** Pendiente diseñar un único flujo idempotente que coordine ledger, documento Z y proyección de caja; definir recuperación de escritura parcial antes de modificar.
- [ ] **B9 — Resumen de sesión consulta VENTA_LINEAS sin filtro de sesión.** Pendiente comprobar colección permitida y sustituir full scan por líneas derivadas de transacciones de la sesión, si el contrato actual lo confirma.
- [x] **B10 — `obtenerEstadoCaja` sin try/catch normalizado.** Corregido en esta rama.
- [ ] **B11 — Doble clic en confirmación Cierre Z.** Pendiente añadir estado busy y bloqueo de interacción en UI; backend conserva lock/idempotencia como defensa primaria.

## 4. Bugs del backend general

- [ ] **B-BK-01 (Crítico) — Colisión TPV_LEDGER/fiscal en MovimientosCaja y CajaActual.** Pendiente P0. Requiere mapa completo de escritores/lectores, contrato físico de campos, secuencias/hash, proyecciones y consumidores fiscales. No separar colecciones ni filtrar registros a ciegas: primero decidir contrato SSOT y compatibilidad histórica. No reinicializar contadores ni sobrescribir CAJA_PRINCIPAL.
- [ ] **B-BK-02 (Crítico) — registerZClosing y verifyNightlyZClosing.** Pendiente P1. Corregir el origen de `recordDomain` con constante canónica/identidad de sistema autorizada; si el cron no puede cerrar legal y técnicamente, debe verificar y alertar, no fabricar identidad de cajero.
- [x] **B-BK-03 (Alto) — orderId raíz ignorado en idempotencia de pagos Bookings.** Corregido en ambos validadores de `citasManager.web.js`.
- [x] **B-BK-04 (Alto) — eventType inconsistente al marcar reembolsos.** Corregido: cada handler consulta y persiste el mismo eventType, con traceId y metadata.
- [ ] **B-BK-05 (Alto) — crons limitados a los primeros 50 registros.** Pendiente P1. Implementar paginación/orden determinista o consulta por estado indexado; asegurar que el ciclo termina dentro de límites de ejecución y no omite incidencias.
- [x] **B-BK-06 (Medio) — regex doblemente escapada en fiscalHashPayload.js.** Corregido en esta rama.

## 5. Páginas y motor de reservas

- [ ] **B-PG-01 (Crítico) — zonamarian.js llama acciones de cierre/documentos deshabilitadas.** Pendiente. Verificar los contratos actuales de `registerZClosing`, `previewManagerPackage` y los endpoints de documentos; no reconectar endpoints que devuelven PACKAGE_STORAGE_REMOVED. Deshabilitar/ocultar acciones no soportadas con mensaje explícito hasta disponer de flujo válido.
- [ ] **B-PG-02 (Medio) — activeBookingMessageId bloquea reintento tras AUTH_REQUIRED.** Pendiente. Liberar la identidad de petición solo cuando se confirme que no se inició la saga; no abrir una ventana de duplicidad para resultados inciertos.
- [ ] **B-PG-03 (Bajo/Medio) — fallback de selector $w sin comprobar postMessage.** Pendiente. Comprobar capacidad real `typeof widget?.postMessage === "function"` antes de usar fallback.
- [ ] **B-BK-07 (Optimización) — posible doble liberación de locks en bookingSaga.** Pendiente de confirmación por prueba/flujo completo. La liberación es best-effort e idempotente según el código descrito; optimizar solo tras demostrar llamadas duplicadas y asegurar que no se pierde compensación.
- [ ] **B-BK-08 (Documentación) — comentario obsoleto en bookingCore._resolveWriteLocation.** Pendiente de corrección documental simple tras confirmar el fragmento exacto en la rama objetivo.
- [ ] **Autenticación de compra de plan en servicio-2.js.** Pendiente alinear sesión y manejo de AUTH_REQUIRED con calendario-2.js.
- [ ] **Timeout de disponibilidad en calendario-2.js.** Pendiente medir el contrato real de WebMethod y el timeout del consumidor; no adoptar 20 s solo por recomendación si puede provocar cancelaciones prematuras de operaciones válidas.
- [x] **Motor bookingUtils / dualRescheduleJournal / dualRescheduleReconciliation.** La auditoría no identifica bug funcional; conservar sin refactor preventivo.

## 6. Brechas funcionales profesionales

- [ ] Confirmación de pagos en efectivo y tarjeta mediante flujo autorizado; efectivo solo se considera confirmado cuando el backend registra el cobro y sus movimientos correlacionados. Tarjeta requiere confirmación del proveedor/terminal/webhook.
- [ ] Pedidos Wix eCommerce asociados a venta presencial, evitando un segundo ledger comercial/contable.
- [ ] Reservas de cliente en TPV: reemplazar respuesta fija vacía por consulta Bookings V2 filtrada por identidad autorizada y vinculación de bookingId.
- [ ] Inventario: consultar disponibilidad y aplicar movimiento nativo con idempotencia; definir compensación ante fallo parcial.
- [ ] Descuentos/tarifa personalizada: matriz de permisos, reglas y recálculo fiscal backend.
- [ ] Recibo/factura simplificada: contrato de numeración, serie, datos fiscales, integración Wix y salida imprimible; no afirmar emisión por crear un documento interno.
- [ ] Devoluciones: flujo total/parcial contra operación confirmada, reembolso proveedor/efectivo, rectificación append-only y reposición nativa de stock.
- [ ] Paginación completa de servicios Bookings; evitar asumir que una sola página de 100 contiene todo el catálogo.
- [ ] Impresión térmica de 80 mm y verificación real de impresora/cajón; no confundir registro de Ticket X/Z con impresión.
- [ ] Exportaciones: filtrar por sesión y paginar con cursor; conservar protección CSV y error explícito ante truncado.

## 7. Arquitectura y simplificación — decisiones

- [x] Mantener Wix Catalog/Bookings/eCommerce/Payments como fuente nativa de catálogo, disponibilidad, pedidos y estados de pago cuando aplique.
- [x] Mantener el backend TPV como adaptador/orquestador y la caja física/sesiones/arqueos como lógica propia no cubierta por Wix.
- [x] Mantener autorización en backend; las capabilities solo gobiernan presentación.
- [x] Mantener aritmética monetaria en unidades menores y cálculo fiscal nativo Wix; el TPV puede validar y presentar la cotización, pero no sustituir configuración fiscal Wix.
- [x] Mantener append-only para eventos económicos/fiscales y rectificar con nuevos registros.
- [x] No tratar `traceId`, logs técnicos, auditoría comercial y ledger como si fueran el mismo dato.
- [ ] **B-BK-01:** resolver colisión de contratos de MovimientosCaja/CajaActual antes de habilitar convivencia operativa de ambos subsistemas.
- [ ] Retirar duplicidades de precio/clasificación fiscal solo tras rastrear todos los consumidores; mantener adaptadores de lectura necesarios.
- [ ] Reducir capacidades duplicadas únicamente si no elimina una validación backend independiente.
- [ ] No introducir una colección/ledger fiscal paralelo para el TPV.
- [x] No introducir bifurcaciones de negocio por entorno ni marcadores que cambien el comportamiento real/prueba.
- [x] No registrar pagos simulados como confirmados ni habilitar pasarelas/reembolsos reales para pruebas.
- [x] Mantener Veri*Factu como NO OPERATIVO hasta integración, validación normativa y homologación aplicables.

## 8. Validación pendiente

- [ ] Ejecutar análisis estático/lint sobre el HEAD final de esta rama.
- [ ] Ejecutar suites unitarias relevantes: TPV, eventos, pagos Bookings, fiscalHashPayload y bookingSaga.
- [ ] Añadir regresiones para los seis cambios de código implementados.
- [ ] Ejecutar CI completo y conservar run IDs/HEAD exacto.
- [ ] Verificar exportación auditoría con ADMIN y rechazo con rol no autorizado.
- [ ] Verificar `obtenerEstadoCaja` en éxito y fallos normalizados.
- [ ] Verificar repetición de confirmPayment con orderId raíz y recuperación parcial dual.
- [ ] Reentregar dos veces el mismo webhook de reembolso y verificar un único marker por eventType.
- [ ] Probar offset Madrid en horario de invierno y verano.
- [ ] Ejecutar batería TPV-RT-01…20 de [flujos Runtime](TPV-RUNTIME-AND-TEST-FLOWS.md) en Wix Runtime con miembros de prueba autorizados.
- [ ] Verificar read-back CMS correlacionado por sessionId, transactionId, traceId y claves idempotentes.
- [ ] No publicar el sitio ni ejecutar cobros externos durante esta validación.

## 9. Estado y criterios de cierre

**Implementado en código de esta rama:** 6 correcciones puntuales y pruebas de regresión añadidas/actualizadas.  
**Implementado en documentación:** este checklist y actualización del índice/estado.  
**CI observado:** el run `46162312738` sobre SHA `1ba6b5a14b4d3b6d016cad02d0afd845ec99070b` terminó FAILURE en Layer 1: 397 tests PASS y 1 FAIL. El único fallo fue una aserción obsoleta que exigía `issueTicketZ: false`; la política de permisos ya se había corregido para ADMIN. Secret scanning `46162312766` terminó SUCCESS.  
**Corrección de test:** actualizada la aserción en `tpv-widget.contract.test.mjs` y añadida `tpv-deep-audit-regressions.test.mjs`. El HEAD final de rama es `7fd897d798f0fb2a5ed16ccc2d7e3cc2302ab957`; no consta todavía una nueva ejecución CI asociada a ese HEAD, por lo que la suite final sigue PENDIENTE.  
**Comparación con main:** rama `docs/tpv-runtime-success-flows-2026-11-28` = 17 commits ahead / 4 behind; estado divergido. PR #709 sigue en borrador y no debe fusionarse hasta reconciliar esos 4 commits de main y obtener CI PASS sobre el HEAD resultante.  
**Wix Runtime / E2E:** PENDIENTE.  
**Producción:** NO-GO; el sitio sigue sin publicar según el último estado verificado.

Una incidencia solo pasa a **VALIDADA** cuando existe prueba reproducible en el nivel que le corresponde. Una corrección en Git queda **IMPLEMENTADA**, no VALIDADA, hasta ejecutar las pruebas pertinentes.
