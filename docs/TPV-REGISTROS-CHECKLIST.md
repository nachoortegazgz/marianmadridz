# Checklist de cierre TPV y registros — Marian Madrid

> Fuente de migración: [bugstpv.md](../bugstpv.md), auditoría de 28-11-2026. Este documento es la lista viva de cierre. No se elimina ningún hallazgo hasta demostrar su resolución en código, CI y, cuando afecte a Wix/CMS/pagos/caja, Runtime Preview.
>
> **Regla de marcado:** `[x]` solo significa que el estado indicado está acreditado en el alcance señalado. Una corrección estática no equivale a Runtime PASS. Los elementos con proveedores no configurados permanecen pendientes y se documentan como tales; no se simulan como operaciones reales.

## Criterio de aceptación global

- [ ] Cero errores silenciosos: todo rechazo técnico devuelve código, mensaje accionable, traceId y estado recuperable.
- [ ] Cero doble escritura/cobro: idempotencia y conciliación probadas con reintentos, timeout y concurrencia.
- [ ] Venta → pago → ledger → Ticket X → Cierre Z → exportación: mismo contrato y mismos importes en todos los módulos.
- [ ] Cada operación fiscal se calcula en céntimos y con clasificación/IVA obtenidos de fuente autorizada.
- [ ] El TPV no declara cobrado un pago manual/offline hasta que el operador confirme la recepción física y la escritura nativa se haya leído de vuelta.
- [ ] Los permisos se validan en backend; UI solo refleja capabilities efectivas.
- [ ] Los eventos cerrados y auditoría son append-only; no se editan ni eliminan para corregir estados.
- [ ] Preview E2E ejecutado con evidencias de CMS, Wix Orders y caja; CI offline no sustituye Runtime.
- [ ] Go productivo condicionado a proveedor de tarjeta, devoluciones, facturación y cumplimiento fiscal efectivamente integrados y probados.
- [ ] Documentación legal revisada con fuentes BOE/AEAT vigentes; Veri*Factu permanece separado hasta integración y homologación aplicables.

## 0. Base ya incorporada — integración nativa Wix

Según el encabezado de actualización de `bugstpv.md`, los siguientes elementos se incorporaron en la rama nativa y constan como CI offline PASS en SHA `24a5d851a0725db8713cf426cdc41300e450f2ac`. La integración está incorporada en la línea principal, pero Runtime Preview sigue siendo un gate independiente.

- [x] Pedido nativo Wix Orders: creación, correlación por `channelInfo.externalOrderId`, lectura posterior y verificación de total/estado — **código + CI offline indicados en fuente**.
- [x] Venta TPV persistida antes del pedido Wix, con recuperación por clave idempotente — **código + CI offline indicados en fuente**.
- [x] Pago en efectivo vía `orderTransactions.addPayments` como pago offline; sin simular pasarela de tarjeta — **código + CI offline indicados en fuente**.
- [x] Ledger `TPV_PAYMENT`, auditoría independiente y read-back `SALE_READBACK` — **código + CI offline indicados en fuente**.
- [x] Stock gestionado por Wix Orders; sin inventario paralelo del TPV — **código + CI offline indicados en fuente**.
- [x] `CASHIER_STATE` read-only; singleton `CajaActual` inicializado en `SESSION_OPEN` — **código + CI offline indicados en fuente**.
- [x] Runner E2E no cierra sesiones preexistentes y ejecuta arqueo parcial, venta/pedido, Ticket X y Ticket Z — **código + CI offline indicados en fuente**.
- [ ] Ejecutar Wix Editor Preview real y verificar CMS/Orders por read-back.
- [ ] Ejecutar cobro efectivo completo en Runtime, confirmar efectivo físico y conciliar caja.
- [ ] Integrar terminal/proveedor de tarjeta; no habilitar tarjeta con `addPayments` offline.
- [ ] Implementar devoluciones/reembolsos nativos, cancelación de pedidos pagados y recibo/factura según alcance legal.
- [ ] Probar permisos con miembros/cajeros reales; Preview Admin no acredita roles productivos.

## 1. Matriz original de 40 bloqueos

- [ ] **TPV-1 — Modo consulta global (`operationalWritesAvailable`)** (Seguridad / Integridad).
- [ ] **TPV-2 — Cobros deshabilitados (`data-method disabled`)** (Fricción temporal (V1)).
- [ ] **TPV-3 — Ventas sin pagos (`SALE_REGISTER`)** (Desalineado / Bug).
- [x] **TPV-4 — `TPV_PENDING_SALE_PAYMENTS_NOT_ALLOWED`** (Desalineado (Obsoleto)). No aplica según contraste del documento fuente: el supuesto bloqueo no existe en el código auditado; mantener prueba de no regresión.
- [x] **TPV-5 — `medioPago` omitido en `registrarVenta()`** (Desalineado (Obsoleto)). No aplica según contraste del documento fuente: el supuesto bloqueo no existe en el código auditado; mantener prueba de no regresión.
- [ ] **TPV-6 — Devoluciones bloqueadas (`case "REFUND"`)** (Fricción temporal (V1)).
- [ ] **TPV-7 — Botón `#refund` bloqueado** (Fricción temporal (V1)).
- [ ] **TPV-8 — Tarifa personalizada (`#tabPersonalizada`)** (Fricción temporal (V1)).
- [ ] **TPV-9 — Bizum bloqueado** (Fricción temporal (V1)).
- [ ] **TPV-10 — Bono bloqueado** (Fricción temporal (V1)).
- [ ] **TPV-11 — Tarjeta regalo bloqueada** (Fricción temporal (V1)).
- [ ] **TPV-12 — Otros medios bloqueados** (Fricción temporal (V1)).
- [ ] **TPV-13 — Pago dividido bloqueado (`payments.length >= 1`)** (Fricción temporal (V1)).
- [ ] **TPV-14 — Cambio limitado al efectivo** (Seguridad / Integridad).
- [ ] **TPV-15 — Ticket vacío bloqueado** (Integridad).
- [ ] **TPV-16 — Registro sin sesión bloqueado** (Seguridad / Integridad).
- [ ] **TPV-17 — Apertura sin previsualización** (Integridad).
- [ ] **TPV-18 — Apertura duplicada (`abrirSesionCaja`)** (Seguridad / Integridad).
- [ ] **TPV-19 — Apertura con previsualización obsoleta** (Integridad).
- [ ] **TPV-20 — Cierre con ventas pendientes** (Normativa / Integridad).
- [ ] **TPV-21 — Cierre con devoluciones pendientes** (Normativa / Integridad).
- [ ] **TPV-22 — Cierre con diferencias no justificadas** (Normativa / Integridad).
- [ ] **TPV-23 — Producto sin variante válida** (Integridad).
- [ ] **TPV-24 — Servicio sin precio fijo** (Integridad).
- [ ] **TPV-25 — Línea sin clasificación fiscal** (Normativa (Fiscal)).
- [ ] **TPV-26 — Cálculo fiscal incompleto** (Normativa (Fiscal)).
- [ ] **TPV-27 — Moneda distinta de EUR** (Normativa / Integridad).
- [ ] **TPV-28 — Descuentos bloqueados** (Fricción temporal (V1)).
- [ ] **TPV-29 — Reintento tras timeout (`TPV_TIMEOUT`)** (Integridad (Idempotencia)).
- [ ] **TPV-30 — Operación con clave inválida** (Seguridad / Integridad).
- [ ] **TPV-31 — Exportación truncada** (Integridad / Normativa).
- [ ] **TPV-32 — Comunicación sin origen (`PARENT_ORIGIN_UNAVAILABLE`)** (Seguridad).
- [ ] **TPV-33 — Mensajes de otra ventana (`event.source`)** (Seguridad).
- [ ] **TPV-34 — Respuestas de otro origen (`event.origin`)** (Seguridad).
- [ ] **TPV-35 — Protocolo incompatible (`MM_READY`/`MM_CONTEXT`)** (Integridad).
- [ ] **TPV-36 — Catálogo sin precio** (Integridad).
- [x] **TPV-37 — Error de catálogo por `traceId`** (Desalineado (Corregido)). Corregido en la auditoría estática de origen; falta prueba runtime/Preview.
- [ ] **TPV-38 — Auditoría sin trazabilidad** (Normativa / Bug).
- [ ] **TPV-39 — Operación sin permiso** (Seguridad).
- [ ] **TPV-40 — Contexto Wix no autorizado (`onContextReady`)** (Seguridad).

## 2. Bugs críticos de ciclo de venta y caja

- [x] **B1 — B1. `registrarVenta` devuelve `PENDING`, lo que rompe `#htmlTPV.txt` y atasca la clave idempotente**. Definir resultado explícito de venta pendiente vs cobrada; la UI debe reconciliar PENDING sin perder carrito ni clave. PENDING sin error de transporte; la UI conserva el resultado y vacía el ticket solo tras persistencia. Timeout con carrito modificado obliga a SALE_READBACK antes de generar otra clave. Código + CI offline PASS (PR #718); Runtime pendiente.
- [x] **B2 — B2. Toda venta registrada bloquea permanentemente el Cierre Z**. Permitir Cierre Z solo cuando todas las ventas estén en estado terminal y conciliado; habilitar transición de pago real/offline con evidencia. El Cierre Z separa ventas pendientes no cobradas y cierra la caja física solo tras conciliar los cobros; el resumen conserva el pendiente. Código + CI offline PASS (PR #718); Runtime pendiente.
- [x] **B3 — B3. `ReferenceError` en `exportarAuditoriaTPV` (crash garantizado en runtime)**. Importar/usar la función de autorización correcta y ejecutar exportAudit en Runtime. `exportarAuditoriaTPV` usa `requireAdmin`; `exportAudit` se habilita solo para ADMIN. Código + CI offline PASS (PR #718); Runtime pendiente.
- [x] **B4 — B4. Inconsistencia de estados `"CONFIRMED"` vs `"CONFIRMADA"` en ventas**. Unificar enum de estados de venta en repositorio, proyección, exportación y auditoría. Lectores y exportación aceptan el estado canónico `CONFIRMADA` y el legado `CONFIRMED`; el writer persiste importes fiscales en céntimos. Código + CI offline PASS (PR #718); Runtime pendiente.
- [x] **B5 — B5. `registrarVenta` bloquea cualquier venta que incluya productos**. Permitir productos si variante, stock/política y pedido Wix están confirmados; no bloquear por bandera fija. Catálogo Stores valida variante/precio y Wix Orders gestiona la línea/stock; no existe bloqueo global de PRODUCTO. Código + CI offline PASS (PR #718); Runtime pendiente.
- [x] **B6 — B6. El cliente seleccionado en el TPV se descarta al guardar la venta**. Propagar customerIdentityId por widget, controller y registrarVenta; revalidar contacto en servidor. `contactId` llega al WebMethod, se valida con `resolveTpvContact`, entra en el fingerprint y se asocia al pedido Wix; no se duplica PII en el ledger TPV. Código + CI offline PASS (PR #718); Runtime pendiente.
- [x] **B7 — B7. `obtenerPermisosTPV` deshabilita funciones que el backend ya implementa**. Derivar capabilities de rol/permisos reales y habilitar solo endpoints operativos existentes. `issueTicketZ` y `exportAudit` están habilitados para ADMIN. Devolución e impresión siguen deshabilitadas porque proveedor/hardware no están integrados. Código + CI offline PASS (PR #718); Runtime pendiente.
- [x] **B8 — B8. Dos flujos incompatibles para cerrar la caja (`SESSION_CLOSE` vs `TICKET_Z`)**. Consolidar SESSION_CLOSE y TICKET_Z en una única transacción de cierre idempotente. Retirado el endpoint duplicado `cerrarSesionCaja`, el mensaje `SESSION_CLOSE` y la capability `closeSession`; Ticket Z es el único cierre físico y crea movimiento CIERRE + proyección CajaActual. Código en esta rama; CI pendiente.
- [x] **B9 — B9. `buildTpvSessionSummary` consulta `VENTA_LINEAS` de forma insegura**. Filtrar líneas por sesión/venta y verificar totales de cierre. El resumen toma `lineas` del snapshot `TransaccionesTPV`, valida `totalMinor` y filtra pagos por `sessionId` raíz/payload; no escanea una colección histórica de líneas. Código + CI offline PASS (PR #718); Runtime pendiente.
- [x] **B10 — B10. `obtenerEstadoCaja` carece de `try/catch`**. Normalizar errores de lectura de caja y devolver error accionable. `obtenerEstadoCaja` ya encapsula lectura de proyección y resumen en try/catch y devuelve error estructurado con traceId. Código + CI offline PASS (PR #718); Runtime pendiente.
- [x] **B11 — B11. Doble clic posible en el modal de Cierre Z**. Bloquear doble envío en UI y backend con idempotencia. El modal usa `modalSubmitting`; el backend sigue protegido por clave idempotente y read-back. Código + CI offline PASS (PR #718); Runtime pendiente.

## 3. Backend transversal y procesos

- [ ] **B-BK-01 — B-BK-01 (Crítico) — Colisión de cadenas y esquemas entre `backend/tpv/*` y el núcleo fiscal**. Unificar físicamente contratos/colecciones o aislar ledger TPV del ledger fiscal; demostrar integridad de ambas cadenas.
- [ ] **B-BK-02 — B-BK-02 (Crítico) — `registerZClosing` y `verifyNightlyZClosing` siempre fallan**. Corregir contrato de cierre público y decidir si cron verifica o cierra con identidad de sistema autorizada.
- [ ] **B-BK-03 — B-BK-03 (Alto) — `citasManager.web.js` rompe la idempotencia y recuperación parcial de pagos**. Resolver orderId raíz y meta de forma consistente en recuperación de pagos.
- [ ] **B-BK-04 — B-BK-04 (Alto) — `events.js` desincroniza `eventType` al marcar reembolsos como procesados**. Usar el mismo eventType en claim, consulta y marca de evento procesado.
- [ ] **B-BK-05 — B-BK-05 (Alto) — 3 crons de `crons.js` quedan ciegos tras 50 registros históricos**. Paginar y filtrar pendientes en servidor; no depender de primeros 50 registros históricos.
- [ ] **B-BK-06 — B-BK-06 (Medio) — Bug de regex doblemente escapada en `fiscalHashPayload.js`**. Corregir regex de zona horaria y añadir test de offsets Madrid invierno/verano.
- [ ] **B-BK-07 — B-BK-07 (Bajo — Optimización de cuota CMS) — Doble liberación de *locks* en `bookingSaga.js`**. Liberar locks una sola vez y probar compensación/finally.
- [ ] **B-BK-08 — B-BK-08 (Documentación / Mantenimiento) — Comentario obsoleto contradictorio en `bookingCore.js`**. Actualizar comentario para reflejar el contrato real de BookedSlot.

## 4. Páginas Velo y puente con el TPV

- [ ] **B-PG-01 — B-PG-01 (Crítico) — `pages/zonamarian.js` llama a endpoints de backend rotos o retirados**. Reemplazar acciones retiradas por Capa 3 y resolver Z; comprobar que no queda llamada a endpoints eliminados.
- [ ] **B-PG-02 — B-PG-02 (Medio) — `pages/calendario-2.js`: `activeBookingMessageId` bloquea reintentos legítimos tras cancelar login**. Liberar el identificador de solicitud tras cancelación de login para permitir reintento legítimo.
- [ ] **B-PG-03 — B-PG-03 (Bajo/Medio) — `pages/zonamarian.js`: fallback inseguro de selector `$w(...)`**. Comprobar postMessage antes de usar selector alternativo del widget.

## 5. Simplificación y retirada de deuda técnica

- [ ] Una sola fuente de verdad para catálogo, variantes, precios y clasificación fiscal; eliminar duplicados que no aporten reglas de negocio.
- [ ] Una sola máquina de estados de venta/pago; retirar flags derivados incompatibles o documentar su necesidad.
- [ ] Una única cadena/contrato de ledger para caja y fiscalidad; no compartir colecciones con esquemas incompatibles.
- [ ] Una sola vía de cierre de sesión/Z, idempotente y transaccional.
- [ ] Retirar endpoints, módulos y pruebas de contratos ya eliminados; buscar referencias huérfanas en todo el repo.
- [ ] Retirar medios de pago no implementados de la UI o integrarlos realmente; nunca presentarlos como disponibles.
- [ ] Eliminar inventario, pagos, clientes o facturas paralelos si Wix nativo ya es el sistema propietario.
- [ ] Mantener solo logs/auditoría con finalidad diferenciada; evitar duplicar eventos sin valor probatorio u operativo.
- [ ] Reducir el handshake al mínimo seguro: origen permitido, source, nonce, versión y correlación; no eliminar controles de frontera.
- [ ] Sustituir bloqueos genéricos de UI por capabilities del backend y mensajes accionables.

## 6. Capa externa y conciliación de registros

- [ ] Outbox `RegistroIntegracion` append-only: hash SHA-256, idempotencia, payload sin PII y transiciones mediante nuevos eventos.
- [ ] Configurar credenciales M365 exclusivamente en Wix Secrets Manager; nunca en código, CMS abierto ni chat.
- [ ] Conceder `Sites.Selected` al sitio SharePoint concreto; mínimo privilegio.
- [ ] Implementar carga con nombre determinista, conflicto explícito y read-back de metadatos/contenido.
- [ ] Verificar checksum del artefacto tras descarga/lectura de SharePoint.
- [ ] Registrar `PREPARED`, `PENDING`, `DELIVERED`, `VERIFIED` o error mediante eventos append-only.
- [ ] Conciliar cada paquete con cierre Z, movimientos fuente, periodo, checksum y estado de entrega.
- [ ] No declarar entrega ni verificación hasta read-back real de SharePoint.
- [ ] Mantener manifiestos de prueba pre-2027 clasificados como sintéticos; no asignar NIF emisor ficticio.
- [ ] Configurar singleton fiscal del emisor antes de operaciones productivas de 2027+.

## 7. Puertas de calidad y cierre 100 %

- [ ] Capa 0: suites offline completas en el HEAD exacto que se propone integrar; registrar SHA, suites, tests y resultado.
- [ ] Capa 1: análisis estático, lint, import graph y búsqueda de referencias a endpoints retirados.
- [ ] Capa 2: contratos UI ↔ controller ↔ WebMethods ↔ DAL ↔ CMS.
- [ ] Capa 3: Runtime Preview E2E con usuario Admin y cajero; apertura, venta, pago, reintento, devolución, X, Z y exportación.
- [ ] Capa 4: conciliación de registros, SharePoint upload/read-back y recuperación tras timeout.
- [ ] Pruebas de concurrencia: doble clic, doble cajero, reintento de la misma clave, mismo ID con payload distinto y timeout tras escritura.
- [ ] Pruebas negativas: sin sesión, sin permiso, producto/variante inválidos, IVA no resuelto, origen no permitido y proveedor ausente.
- [ ] Confirmar que no se han modificado registros CMS históricos durante las pruebas.
- [ ] Revisión normativa de caja, facturación, conservación y Veri*Factu con fuentes oficiales vigentes.
- [ ] Cierre final firmado: todos los ítems aplicables en [x], excepciones documentadas como no aplicables y evidencia Runtime adjunta. No declarar 100 % por CI offline solamente.

## 8. Registro de evidencias

| Fecha | SHA | Capa | Evidencia | Resultado |
|---|---|---|---|---|
| 2026-11-28 | `266a6f54fc298658fb1748add064422c0e62d9fb` | CI offline TPV | 97 suites / 865 tests; Layer 1: 32 suites / 412; Layer 2: 16 suites / 263; ESLint PASS | PASS en PR #718; Runtime pendiente |
| 2026-11-28 | — | Wix Preview | No ejecutado según estado conocido | PENDIENTE |
| 2026-11-28 | — | SharePoint read-back | No ejecutado; configuración M365 pendiente | PENDIENTE |

**Fuente detallada:** [bugstpv.md](../bugstpv.md). Si un hallazgo resulta obsoleto tras la auditoría del HEAD, no se borra: se marca como `No aplica` con commit y prueba que lo demuestran.
