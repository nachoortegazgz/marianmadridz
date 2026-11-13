# ESTADO VIGENTE CONSOLIDADO — 2026-11-13 20:51 CET

**Repositorio:** [nachoortegazgz/marianmadridz](https://github.com/nachoortegazgz/marianmadridz)  
**Baseline funcional integrado por PR #330:** 3df4b4cf174d80dfd22406bbd758b2eddd7aaa44  
**Estado posterior:** se añadieron commits exclusivamente documentales a main; consultar GitHub para el HEAD documental actual.  
**Sitio Wix:** https://www.marianmadrid.es/ · Site ID 188bed94-177c-4bc9-a9f0-35080d874f3e  
**Estado Wix leído en esta revisión:** Published · Wix Editor · Velo enabled · Europe/Madrid · EUR  
**Estado de despliegue Velo:** no se ha acreditado que el código de main esté publicado en el sitio. El merge GitHub no equivale a Wix Publish.

> Este addendum prevalece sobre los estados históricos anteriores de este documento. Es una consolidación documental basada en el HEAD de GitHub, las auditorías QA del 13-11 y una lectura CMS live realizada a las 20:51 CET. No se han ejecutado mutaciones CMS ni cambios de código Wix durante esta consolidación.

## 1. Resumen ejecutivo y estado Git

- PR #330 está **MERGED** en main. El merge funcional registrado es 3df4b4cf174d80dfd22406bbd758b2eddd7aaa44. Después se añadieron commits exclusivamente documentales; el HEAD documental vivo se consulta directamente en GitHub.
- PR #331 está **CLOSED / NOT MERGED**. Su rama qa/2026-11-13-citasf2-keyfields permanece en GitHub; no debe fusionarse ni aplicarse sin comparar con lo ya integrado por PR #330.
- PR #330 integra los simuladores offline PSP y sink de email QA, cambios de handlers/contratos y la alineación del modelo CitasF2 descrita en su cuerpo de PR y auditoría.
- Resultados registrados para PR #330: Layer 1, 23 suites / 294 PASS; Layer 2, 18 suites / 243 PASS; regresión completa, 68 suites / 621 PASS; contratos Wix Bookings Reader V2, eCommerce Cart V2 y Order Transactions PASS; ESLint PASS; Gitleaks full-history PASS. Referencias registradas: workflows 43488515192 y 43488515254. La asociación exacta de esos runs al SHA de código que se integró debe confirmarse en GitHub Actions antes de afirmar que el HEAD actual de main tiene CI verde.
- La última lectura de estado de Wix confirma Published. No hay evidencia de sincronización/publicación del HEAD actual de main en Wix Runtime.

## 2. Inventario CMS live

Lectura live de Data Collections API del 13-11-2026 20:51 CET: **44 colecciones: 15 NATIVE y 29 WIX_APP**. No se han modificado colecciones Wix App.

### 2.1 Colecciones NATIVE

| Colección | Registros en último corte disponible | Clasificación / estado |
|---|---:|---|
| CajaActual | 1 | Singleton SIMULACION; no representa caja real |
| CitasF2 | 1 | Proyección de reserva; discrepancia P1 con Bookings |
| ComplementosCatalogo | 36 | Catálogo maestro |
| ControlOperativo | 0 | Sin filas en el corte auditado |
| DatosFiscales | 1 | Tercero placeholder; falta CONFIG_SISTEMA |
| HistoricoCierresZ | 0 | Ledger append-only; sin cierres |
| InventarioStockVenta | 1 | Legacy; no es SSOT de stock |
| LibroAsientosContablesDetalle | 0 | Ledger append-only; writer deshabilitado |
| MapaStaff | 3 | Tres mapeos activos |
| MovimientosCaja | 0 | Ledger append-only; writer fiscal fail-closed |
| MovimientosInventario | 1 | Legacy; conservar histórico, sin nuevas escrituras |
| PaquetesGestoria | 0 | Registro documental append-only; sin paquetes |
| RegistroIntegracion | 0 | Colección adicional fuera de BUSINESS_COLLECTIONS; sin consumidor/writer activo demostrado |
| RegistrosHorariosStaff | 2 | Filas sintéticas QA sin HMAC; writer deshabilitado |
| ServiciosCatalogo | 95 | 94 servicios + 1 plan |

**Nota sobre recuentos:** los recuentos de las colecciones distintas de CitasF2 corresponden al corte de auditoría CMS del 13-11 anterior a la proyección de la reserva sintética. CitasF2 se releyó de nuevo a las 20:51 y devuelve un item. El recuento cero previo de CitasF2 queda superado por esta lectura posterior. La discrepancia anterior de ControlOperativo, MovimientosCaja y LibroAsientosContablesDetalle entre cortes sigue abierta; no inferir borrado ni restaurar datos sin reconciliar procedencia e identidad de colección.

### 2.2 Colecciones WIX_APP — 29, solo lectura

- Bookings: Bookings/Schedule, Bookings/Services, Bookings/Staff.
- Blog: Blog/Categories, Blog/Posts, Blog/Tags.
- CampaignManager: CampaignManager/campaigns, CampaignManager/userConfig.
- Forms: Forms/subscribers03.
- Locations: Locations/Locations.
- Marketing: Marketing/Coupons.
- Members: Members/Badges, Members/FullData, Members/PrivateMembersData, Members/PublicData.
- StoreCatalog: StoreCatalog/Brands, StoreCatalog/Categories, StoreCatalog/Info sections, StoreCatalog/Inventory, StoreCatalog/Product options & modifiers, StoreCatalog/Products, StoreCatalog/Ribbons, StoreCatalog/Variants.
- Stores: Stores/Collections, Stores/InventoryItems, Stores/Orders, Stores/Products, Stores/Variants.
- eCommerce: eCommerce/Orders.

Las colecciones WIX_APP son propiedad de sus aplicaciones. No crear, eliminar ni modificar sus campos desde esta intervención. Wix Stores está en Catalog V3; Wix Invoices continúa en V1.

### 2.3 Permisos CMS personalizados — último estado documentado

La lectura posterior de Data Permissions API v1 del 13-11 documentó:
- 10 colecciones con CRUD para CMS_EDITOR: CajaActual, CitasF2, ComplementosCatalogo, ControlOperativo, DatosFiscales, InventarioStockVenta, MapaStaff, MovimientosInventario, ServiciosCatalogo y RegistroIntegracion.
- 3 colecciones con lectura CMS_EDITOR y escritura/eliminación PRIVILEGED: HistoricoCierresZ, PaquetesGestoria y RegistrosHorariosStaff.
- 2 colecciones completamente PRIVILEGED: LibroAsientosContablesDetalle y MovimientosCaja.
- La efectividad con una identidad colaboradora CMS_EDITOR sigue pendiente. Data Collections API v2 mostrando ADMIN no sustituye esa prueba de permisos efectivos.

Los ledgers append-only siguen protegidos. No habilitar CRUD efectivo de escritura sobre HistoricoCierresZ, PaquetesGestoria, RegistrosHorariosStaff, LibroAsientosContablesDetalle o MovimientosCaja.

## 3. CitasF2 — esquema live y contrato canónico

Lectura live de Data Collections API y Query Data Items, 13-11-2026 20:51 CET:
- Collection ID: CitasF2; display name: CITAS_F2; tipo NATIVE.
- Revisión actual: 42; campos físicos: 31; items: 1 de 1.
- La auditoría de migración documenta revisión 33 → 41; la lectura actual devuelve revisión 42. No se infiere qué operación incrementó la revisión sin historial adicional.
- Campos físicos actuales (31): _createdDate, _id, _owner, _updatedDate, bookingId, bookingStatus, bookingType, cancellationReason, cashMovementId, catalogId, contactDetails, dateYmd, fiscalData, invoicingDate, meta, orderId, pairToken, paymentStatus, privacyNoticeAcceptedAt, privacyNoticePurpose, privacyNoticeVersion, resourceId, revision, scheduleId, serviceId, slotEnd, slotStart, thirdPartyId, timeZone, totalAmount y traceId.
- Campos eliminados tras búsqueda de consumidores y comprobación de ausencia de valores: noShowReason, noShowAt, sourceEventId y canceledAt.
- orderId TEXT existe como campo raíz canónico. cashMovementId y timeZone también están definidos en raíz.
- El contrato canónico raíz para referencias/estado incluye bookingId, bookingStatus, paymentStatus, orderId, cashMovementId, serviceId, resourceId, scheduleId, slotStart, slotEnd, timeZone y traceId.
- Los escritores integrados en PR #330 persisten referencias/estados en raíz y evitan duplicar bookingStatus, paymentStatus, orderId y cashMovementId dentro de meta. Los lectores conservan fallback root-first a meta para registros históricos.
- El item histórico actual no contiene timeZone, orderId ni cashMovementId en raíz porque se creó antes de los writers actualizados y no hubo un pago/pedido asociado. No rellenar esos valores por inferencia.
- meta conserva datos de evento/contexto como source, eventId, nativeBookingStatus, contactId, resourceIdSource y otros metadatos. La lectura actual no muestra copias meta.bookingStatus, meta.paymentStatus, meta.orderId ni meta.cashMovementId.

### Incidencia P1 de sincronización no resuelta

El único item CitasF2 tiene bookingId 3effa046-5b9d-429b-9f9c-af2f3d6c9994, bookingStatus CONFIRMED y paymentStatus NOT_PAID. La reserva nativa Bookings Reader V2 para ese mismo bookingId permanece CANCELED / NOT_PAID. La proyección conserva meta.nativeBookingStatus=CONFIRMED y un eventId de confirmación. La lectura actual confirma que la divergencia continúa.

No modificar manualmente bookingStatus en CitasF2, no borrar el booking nativo y no ejecutar backfill/reconciliación manual para ocultar el defecto. Debe determinarse si el handler de cancelación no se ejecutó, no está publicado o falló al persistir; el origen exacto no está demostrado.

### Contratos que requieren cierre

- La frontera de alta valida GUID para bookingId, serviceId, resourceId y scheduleId; las actualizaciones históricas pueden omitir serviceId/resourceId cuando faltan en registros antiguos.
- slot.scheduleId y resource.eventsScheduleId fueron observados como GUID distintos en la reserva de prueba. El código mantiene prioridad para slot.scheduleId y fallback a eventsScheduleId. Verificar el contrato de origen con payload real y cerrar ADR/prueba antes de normalizar históricos.
- El contacto CRM sintético existe, pero la proyección conserva meta.contactId=null; no se ha validado la vinculación Booking–CRM.

## 4. Estado operativo de QA y límites

- El sitio principal continúa Published; no es un entorno QA aislado por el mero hecho de usar datos sintéticos.
- Se desactivaron y verificaron 18 automatizaciones mutables. Otras 10 siguen ACTIVE por readonly/disableStatusChange; no disparar sus triggers durante QA. La prueba Test Automation puede ejecutar acciones reales incluso si una automatización está INACTIVE.
- No se han enviado emails/SMS/WhatsApp. El despacho real a gestoría continúa bloqueado por ACCOUNTANT_SEND_ENABLED=false.
- El doble PSP y el sink de gestoría son fixtures en memoria bajo tests; no se conectan a runtime, red, CMS, webhooks ni proveedores reales.
- Writers fiscales, contables y laborales siguen fail-closed. No se han habilitado cobros, reembolsos, ledgers, fichajes ni exportaciones reales.
- SharePoint / Power Automate Capa 3 no están acreditados como flujo operativo live.
- No existe certificación E2E completa en navegador/runtime.
- No se ha publicado código Wix como parte de PR #330.

## 5. Checklist de tareas pendientes

### P0 — Integridad fiscal, contable y laboral
- [ ] Mantener FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false, ACCOUNTING_LEDGER_WRITES_ENABLED=false y STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false hasta aprobación y pruebas runtime.
- [ ] Resolver la configuración fiscal de emisor: DatosFiscales carece de CONFIG_SISTEMA; no usar el tercero placeholder como emisor.
- [ ] Reconciliar los recuentos discrepantes de ControlOperativo, MovimientosCaja y LibroAsientosContablesDetalle entre los cortes 12-11 y 13-11. No recrear ni restaurar filas por inferencia.
- [ ] Resolver tratamiento fiscal de anticipos/fianzas, series, rectificaciones, SIF/Veri*Factu y aprobación del asesor antes de activar cobros o remisión.
- [ ] Mantener inmutabilidad append-only; corregir solo mediante nuevos registros rectificativos trazables.

### P1 — Reservas, Bookings y CitasF2
- [ ] Verificar qué SHA de Velo está realmente publicado y compararlo con el baseline funcional integrado 3df4b4cf174d80dfd22406bbd758b2eddd7aaa44; el HEAD documental vivo de main se consulta en GitHub.
- [ ] Revisar delivery, suscripción, export names, logs runtime y ejecución del handler wixBookingsV2_onBookingCanceled; determinar la causa de CANCELED nativo frente a CONFIRMED en CitasF2.
- [ ] Revisar el cron reconcileMissingConfirmedBookingProjections y sus trazas sin invocarlo manualmente ni generar escrituras durante el diagnóstico.
- [ ] Diseñar reconciliación idempotente con precondiciones, evidencia, estrategia de no duplicidad y rollback antes de reparar cualquier proyección.
- [ ] Resolver contrato slot.scheduleId frente a eventsScheduleId y cubrirlo con fixtures de payload oficial.
- [ ] Decidir si el vínculo Booking–CRM debe resolverse en el flujo de creación; no completar contactId por inferencia.
- [ ] Ejecutar E2E de reservas simples/duales, cancelación, reprogramación, concurrencia y compensación solo en sitio aislado o con autorización y plan de reversión.

### P1 — Permisos y entorno QA
- [ ] Probar permisos efectivos con una identidad colaboradora CMS_EDITOR.
- [ ] Mantener excluidos los 10 triggers de automatizaciones que siguen ACTIVE y revisar su aislamiento soportado por Wix.
- [ ] Definir procedimiento controlado para restaurar las 18 automatizaciones desactivadas, verificando destinatarios y configuración antes de activarlas.
- [ ] Confirmar que el sitio QA aislado 50b39f33-e753-4331-ab35-b2ed43dc97f7 tiene datos/configuración y canales realmente separados antes de usarlo para E2E.
- [ ] No ejecutar Test Automation ni crear miembros, guardar tarjetas, cobros, tareas de agente, voicemail o triggers de umbral CMS.

### P2 — Capa 3 e integraciones
- [ ] Auditar tenant M365, licencias, DLP, identidades, permisos SharePoint y disponibilidad de Power Automate.
- [ ] Aprobar ADR de transporte, minimización, retención e idempotencia antes de conectar Wix → Power Automate → SharePoint.
- [ ] Verificar snapshot persistido, hash, destinatario allowlisted e idempotencia antes de habilitar email real a gestoría.
- [ ] Mantener ACCOUNTANT_SEND_ENABLED=false hasta aprobación y pruebas de sink/integración.

### P3 — Repositorio, CI y toolchain
- [ ] Confirmar en GitHub Actions el SHA exacto cubierto por los runs 43488515192 y 43488515254 y comprobar CI del HEAD actual de main.
- [ ] Revisar el diff integrado de PR #330 y confirmar que no quedan cambios equivalentes pendientes en la rama/PR #331 cerrada.
- [ ] No fusionar ni cherry-pickear qa/2026-11-13-citasf2-keyfields sin comparar su diff contra main.
- [ ] Verificar entorno Node soportado por Wix CLI for Sites y reconciliar lockfile con el gestor oficial antes de sincronizar.
- [ ] Mantener tests offline, contratos SDK y lint como gates; no presentarlos como prueba Wix Runtime.

### P4 — Cierre documental
- [ ] Tras resolver cada bloqueo, actualizar este documento y el informe QA asociado con fecha, SHA, evidencia y resultado.
- [ ] Mantener DOSSIER TÉCNICO y DOSSIER FLUJOS como diseño/contratos; no interpretar requisitos declarados como funcionalidad probada.
- [ ] No eliminar campos, colecciones, ramas ni históricos sin búsqueda de consumidores, comprobación de datos, revisión de contratos y estrategia de reversión.

## 6. Restricciones de esta consolidación

Esta actualización solo modifica documentación del repositorio. No se ha modificado Wix CMS, código de runtime, automatizaciones, pagos, ledgers, reservas ni datos CRM. No se ha publicado ni desplegado nada. Cualquier tarea de la checklist requiere autorización específica y validación proporcional al riesgo.

## 7. Documentos de evidencia

- [Auditoría de colecciones CMS](docs/qa/2026-11-13-custom-cms-registration-audit.md).
- [Auditoría y migración CitasF2](docs/qa/2026-11-13-citasf2-keyfields.md).
- [Adaptaciones temporales de QA](docs/qa/2026-11-13-site-qa-environment.md).
- [Registro de decisiones](docs/DECISION-LOG.md).
- [Directrices de desarrollo](DIRECTRICES_DESARROLLO_CODIGO.txt).

---

## Addendum prioritario — referencia QA y estado Wix live (2026-11-11)

La referencia consultiva vigente es [docs/qa/2026-11-11-qa-master-reference.md](docs/qa/2026-11-11-qa-master-reference.md). Esta revisión live de Wix devuelve el sitio como **Published**, no Draft. Este dato prevalece sobre estados anteriores de este documento. El sitio no se considera QA aislado; no ejecutar E2E que genere reservas, pagos, contactos o comunicaciones hasta disponer de un sitio QA separado o autorización expresa con aislamiento demostrado.

PR #294 está MERGED en main mediante `3aed055c9622da71505f5f9927b35f6516e6b906`. PR #295 está MERGED en main mediante `b799412a1722b2dfacd1b21a198ebcb68fc03af2`; PR #296 permanece abierta en Draft con las correcciones de reauditoría posteriores, aún no integradas. Los estados de PR, CI y Wix descritos en el resto de este documento son históricos cuando no coincidan con la referencia maestra. No interpretar CI offline como validación Wix Runtime.

Reauditoría live posterior a la consulta Published: 149 automatizaciones no archivadas (27 ACTIVE, 122 INACTIVE); nueve automatizaciones email activas con diez acciones (ocho dirigidas al contacto del trigger y dos al propietario); cuatro automatizaciones WhatsApp y ocho SMS inactivas; dos notificaciones internas de Bookings activas. No se ejecutaron triggers ni se enviaron mensajes. El email nativo sigue sin estar aislado.

---

# Marian Madrid — Estado actual y guía operativa del proyecto

**Fecha de corte:** 2026-11-11  
**Repositorio:** [nachoortegazgz/marianmadridz](https://github.com/nachoortegazgz/marianmadridz)  
**Sitio:** [www.marianmadrid.es](https://www.marianmadrid.es/)  
**Ámbito:** guía de continuidad técnica, decisiones vigentes, estado de validación y plan de trabajo. No es una certificación de que el sitio publicado coincida con el repositorio.

> **Regla de lectura:** distinguir siempre (1) declarado por negocio, (2) verificado en código/repositorio, (3) verificado mediante lectura live, (4) probado en CI offline, (5) probado en Wix runtime/E2E y (6) publicado. Ningún nivel implica automáticamente el siguiente.

## 1. Resumen ejecutivo

El proyecto utiliza Wix Editor con Velo y Wix Apps nativas. El repositorio GitHub contiene backend, frontend, pruebas y documentación. La prioridad es preservar la integridad del sistema existente, reducir riesgos y completar validaciones reales antes de activar funciones sensibles.

**Estado global:** el código dispone de una base amplia de pruebas offline, pero no existe evidencia suficiente para declarar operativos todos los flujos críticos en Wix runtime ni para afirmar que el HEAD actual de GitHub está publicado. La publicación exacta del código Velo no se puede vincular de forma fiable a un SHA con la evidencia disponible.

### Situación de cambios recientes

- PR #280 y #281: integradas según el historial de trabajo; incorporan proyección de creación de reserva y protección de carrera para preservar el estado CONFIRMED frente a eventos BOOKING_CREATED tardíos. CI final: 53 suites / 530 tests, 0 fallos.
- PR #284: **mergeada en GitHub**. Primera corrección de la proyección de caja física; CI final verde (53 suites / 530 tests). No representa la solución completa de todos los tipos de efectivo ni acredita despliegue Wix.
- PR #286: **abierta como draft**, rama `audit/p0-p1-hardening`. Además del hardening fail-closed fiscal/contable, incorpora conciliación de reembolsos con eventos Velo estables, lectura de transacciones SDK, guard de moneda EUR, siete pruebas unitarias y escenario offline parcial→total con IVA, replay y concurrencia. CI offline SUCCESS en el HEAD de código `48b509f` (56 suites / 543 tests / 0 fallos; run `43034820298`); contratos SDK Wix, Bookings Reader V2 y ESLint correctos. Gitleaks full-history SUCCESS (run `43034820526`). Los commits posteriores son documentales. No fusionada ni desplegada.

## 2. Arquitectura y fuentes de verdad

| Dominio | Autoridad / SSOT | Límite de responsabilidad |
|---|---|---|
| Identidad y miembros | Wix Members + correlación backend MapaStaff | No confiar en IDs/nombres enviados por frontend |
| Servicios, complementos y staff elegible | ServiciosCatalogo (declarado por el propietario) | Sincronización hacia Wix Bookings pendiente de verificación técnica |
| Reservas, horarios y disponibilidad | Wix Bookings | CMS propio puede mantener proyecciones de dominio, no sustituir la reserva nativa |
| Catálogo y stock | Wix Stores Catalog V3 | No reintroducir inventario custom paralelo |
| Caja fiscal / registro de operaciones | MovimientosCaja, según contrato existente | Registro fiscal de operaciones, no equivale a efectivo físico disponible |
| Efectivo físico | CajaActual | Proyección mutable solo de entradas/salidas reales del cajón |
| Contabilidad | LibroAsientosContablesDetalle | Consolidación económica; mapeos automáticos PGC requieren aprobación |
| Jornada | Backend Velo + ledger laboral append-only | No sustituir fichajes por eventos de calendario Bookings |
| Documentación | SharePoint (objetivo Capa 3) | Repositorio de evidencia; nunca gobierna ni modifica Capa 1 |

**Invariantes:** ledgers fiscales, contables y laborales append-only; rectificaciones mediante nuevos registros trazables. Wix CMS es la fuente transaccional propia cuando aplica. Frontend sin lógica de negocio. Autorización en backend. Secretos fuera del frontend. Webhooks y procesos asíncronos idempotentes. Las colecciones legacy prohibidas no se reutilizan.

## 3. Decisiones de negocio/técnicas vigentes

### 3.1 Caja física: tres capas diferentes

La regla confirmada por el propietario el 2026-11-11 es que CajaActual solo refleja dinero físico que entra o sale del cajón del establecimiento:

- **Afecta a CajaActual:** cobro presencial en efectivo, devolución en efectivo, aportación física de cambio, retirada física, pago en efectivo a proveedor local y ajuste físico justificado.
- **No afecta a CajaActual:** tarjeta (aunque se cobre en el local), Bizum, pago online, transferencia, gasto pagado desde banco u otros medios que no mueven billetes/monedas del cajón.
- **MovimientosCaja:** mantiene su rol actual de registro fiscal de operaciones. No se deben borrar o excluir movimientos no monetarios por el hecho de que no afecten al cajón.
- **LibroAsientosContablesDetalle:** consolida las operaciones económicas conforme a reglas contables aprobadas. Una operación física puede tener proyección de caja y asiento contable.

La PR #284 solo aplica por ahora el filtro EFECTIVO + PRESENCIAL. Todavía no existe un contrato completo IN/OUT/NONE ni soporte de APORTACION, RETIRO, PAGO_PROVEEDOR o dirección de AJUSTE. No asumir que todos los casos de la lista anterior están implementados.

La apertura live en estado SIMULACION con 300 EUR atribuida a Marian es una proyección sintética de QA, no un evento real ni un saldo conciliado. No abrir ni cerrar caja real, ni reescribir o borrar la fila por inferencia.

### 3.2 ServiciosCatalogo y Wix Bookings

El propietario ha definido ServiciosCatalogo como SSOT de configuración que se sincroniza con Wix Bookings:
- name está vinculado a Complementos catálogo y representa complementos ofrecidos por el servicio.
- staffMembers identifica qué staff es elegible para prestar ese servicio.
- La elegibilidad de staff no equivale a disponibilidad temporal: Bookings combina horario de trabajo, bloqueos/eventos y reservas existentes.

Este contrato está **declarado**, no auditado todavía en código/esquema/sincronización. No editar Bookings directamente ni implementar sincronización hasta inspeccionar esquemas live, referencias/IDs, consumidores, triggers y contratos oficiales. La sincronización debe ser idempotente; retirar un staff de un servicio no elimina el perfil del staff, su horario general ni reservas históricas.

### 3.3 Reservas: integridad de proyecciones

PR #280/#281 añaden el handler wixBookings_onBookingCreated y protegen una carrera en la que un evento de creación tardío podía degradar una proyección ya confirmada. La lógica está cubierta por CI offline, pero el runtime Wix sigue sin certificación.

Una reserva sintética autorizada creada el 2026-11-11 quedó CONFIRMED en Wix Bookings, pero no apareció en CitasF2 ni generó marcador WEBHOOK_EVENT tras dos lecturas. La causa está sin determinar (código publicado divergente, evento no entregado o fallo de handler/persistencia). Se conserva la reserva y su anotación QA. **No cancelar, backfill, reparar ni crear otra reserva de prueba** hasta resolver la causa y definir un procedimiento seguro.

### 3.4 Fiscalidad, caja Z y datos fiscales

- El contrato puro AEAT/hash no equivale a certificación Veri*Factu ni habilita remisión.
- No inventar series, mapeos PGC, facturas, rectificaciones o registros fiscales.
- Se ha detectado discrepancia entre el esquema CMS de DatosFiscales (campo active) y los contratos/validadores de código. Resolver con evidencia de esquema y consumidores antes de cambiarlo.
- La colección DatosFiscales tiene permisos PRIVILEGED verificados por lectura posterior a escritura de permisos.
- El cierre Z y los ledgers requieren reconciliación de contratos/esquemas y pruebas runtime antes de activación.

## 4. Estado por dominio

| Dominio | Estado a fecha de corte | Próximo gate |
|---|---|---|
| CI backend offline | 53 suites / 530 tests verdes en el checkpoint documentado | Repetir sobre el HEAD final de cada PR antes de merge |
| Reservas Bookings ↔ CitasF2 | Código de eventos y tests; incidente live de proyección sin causa | Diagnóstico del evento/handler y prueba aislada; no más escrituras hasta entonces |
| ServiciosCatalogo → Bookings | Contrato de negocio declarado | Auditoría de esquema, IDs, consumidores, trigger, idempotencia y reconciliación |
| Caja física | PR #284 abierta; filtro parcial EFECTIVO/PRESENCIAL | Revisar/merge autorizado, después completar tipos IN/OUT y contratos fiscales/contables |
| Caja sesión/apertura/cierre | ADR en propuesta; SIMULACION bloquea operación | Contrato de sesión, cierre físico vs fiscal, permisos, locks y Z |
| Fichajes | Lectores read-only con validación de integridad; writers bloqueados | Idempotencia, locks persistentes, transiciones, concurrencia y runtime QA |
| Stock | Wix Stores Catalog V3 como autoridad; inventario custom retirado en el trabajo previo | Regresión runtime nativa de pedidos/cancelaciones/devoluciones; no reintroducir ledger stock paralelo |
| Veri*Factu | No apto para remisión | Completar SIF, series, XML/XSD, transporte, respuesta, rectificación y revisión legal |
| Wix Invoices | V1 activa; API V2 no disponible en el último test documentado | Seguir rollout oficial; no forzar adapter/paquete no habilitado |
| Paquetes gestoría | Snapshot trimestral implementado en código/PR previa; envío deshabilitado | Verificar CMS/runtime, formato, hash, permisos y aceptación del asesor |
| M365 / SharePoint / Power Automate | Diseño Capa 3; implantación no demostrada | Auditar tenant/licencias/DLP/permisos y aprobar ADR de transporte |
| Toolchain | Node mínimo Wix CLI for Sites documentado como >=24.22.1; entorno anterior observado con Node 22.16.0 | Preparar entorno Node soportado; manifiesto Wix generado por CLI; resolver ESLint/peer dependencies sin forzar |

## 5. Bloqueos y riesgos principales

1. **P0 fiscal:** no activar Veri*Factu ni anticipos/depositos hasta cerrar tratamiento fiscal, factura, series, rectificación y validación legal.
2. **P1 reservas:** reserva nativa sin proyección CitasF2; no crear más pruebas ni backfill hasta diagnosticar.
3. **P1 caja:** PR #284 parcial; la caja live sigue en SIMULACION; contratos de apertura/cierre, aportaciones/retiradas/proveedor/ajustes y Z incompletos.
4. **P1 catálogo:** SSOT ServiciosCatalogo declarado, pero no se ha demostrado el mecanismo de sincronización con Bookings.
5. **P1 runtime:** CI offline no sustituye Wix Local Editor, Preview ni E2E publicado. No se dispone de navegador runtime de este entorno.
6. **P2 Capa 3:** no hay evidencia de flujo real Wix → M365 → SharePoint.
7. **P2 toolchain:** Node del entorno observado no alcanza el mínimo del Wix CLI for Sites; no ejecutar CLI de Sites hasta disponer de Node compatible.

## 6. Plan de acción priorizado

### P0 — Integridad fiscal y datos

- Mantener desactivada la remisión Veri*Factu y cualquier activación de anticipos que requiera facturación/IVA no resuelta.
- Reconciliar contratos DatosFiscales, MovimientosCaja, HistoricoCierresZ y LibroAsientosContablesDetalle contra esquemas CMS live y consumidores.
- No recalcular ni sobrescribir históricos; rectificar mediante nuevos registros trazables.

### P1 — Reservas y Bookings

- Obtener evidencia del evento real: revisar configuración del handler Velo, logs runtime disponibles, publicación y suscripción efectiva.
- Comparar el código de events.js, booking/bookingCore.js, booking/bookingSaga.js, citasManager.web.js, reservas.web.js y crons.js con la versión efectivamente publicada, sin asumir que coinciden.
- Determinar si falló entrega, handler o persistencia; añadir observabilidad sin duplicar eventos.
- Diseñar reconciliación idempotente y compensación antes de cualquier backfill.
- Auditar ServiciosCatalogo, Complementos catálogo, staffMembers, IDs nativos y mecanismo de sincronización; probar adiciones, retirada de staff, duplicados y eventos tardíos en entorno aislado.

### P1 — Caja física y sesión

- PR #284 está mergeada en GitHub; su merge no acredita despliegue en Wix. Mantener pendiente la validación de los casos IN/OUT/NONE y no activar operaciones reales sin autorización y pruebas runtime.
- Completar contrato de clasificación backend IN/OUT/NONE, enums, validación, CMS, tratamiento fiscal/contable y pruebas para aportación, retirada, proveedor y ajuste.
- Resolver sesión de caja: apertura sin creación implícita, permisos específicos, locks, idempotencia, responsable autenticado y precedencia entre cierre manual y cron.
- Separar cierre fiscal Z de arqueo físico y definir evidencia append-only para ambos.
- No tocar el singleton SIMULACION ni los registros QA/ledgers históricos.

### P1 — Jornada y fiabilidad runtime

- Mantener writers de fichaje bloqueados hasta implementar lock persistente, idempotencia, transiciones válidas y concurrencia.
- Ejecutar pruebas negativas de permisos, replay, fallos parciales y recuperación en Wix QA aislado.
- No activar flags de frontend antes de los guards backend y E2E correspondientes.

### P2 — Capa 3 y mantenimiento

- Auditar tenant M365, SharePoint, Power Automate, licencias, DLP, identidades y permisos.
- Aprobar ADR de transporte y contrato de exportación/minimización antes de implementar jobs.
- Resolver toolchain Wix CLI/Node/ESLint sin editar artefactos generados manualmente.
- Retirar deuda solo con búsqueda de consumidores, contratos externos, tests y revisión de diff; no hacer limpieza cosmética.

## 7. Flujo obligatorio de cambio

1. Confirmar baseline, rama y SHA.
2. Identificar módulo, consumidores, contratos y esquema CMS.
3. Consultar documentación oficial vigente de Wix/integración.
4. Definir aceptación y pruebas proporcionales al riesgo.
5. Implementar el cambio mínimo en rama separada.
6. Ejecutar pruebas y registrar comandos/resultados exactos.
7. Revisar diff, permisos, idempotencia, concurrencia y rollback.
8. Abrir PR; no fusionar ni desplegar sin autorización.
9. Validar Wix Local Editor/Preview/E2E con entorno y datos aislados.
10. Publicar solo con aprobación explícita y verificación posterior.

## 8. Límites del entorno y validación

- No hay checkout local del repositorio ni Wix CLI operativo en el entorno anterior observado; no hay navegador/Computer Use para E2E visual.
- Node observado anteriormente: v22.16.0; Wix CLI for Sites requiere >=24.22.1.
- No se ha confirmado staging/clone aislado.
- No es posible verificar desde aquí el SHA exacto de Velo publicado.
- Las consultas live descritas son lecturas o cambios administrativos concretos documentados; no implican validación funcional completa.
- No se han autorizado mutaciones fiscales, pagos reales, comunicaciones a clientes, backfills ni despliegues como parte de esta actualización documental.

## 9. Documentación canónica y jerarquía

1. [README](README.md): punto de entrada e índice.
2. [Directrices de desarrollo](DIRECTRICES_DESARROLLO_CODIGO.txt): reglas obligatorias de ingeniería y QA.
3. [Dossier técnico consolidado](DOSSIER%20TÉCNICO%20CONSOLIDADO.md): contratos y arquitectura técnica detallada.
4. [Dossier flujos Capa 1 → Capa 3](DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md): arquitectura documental y límites de Capa 3.
5. [Estado detallado del proyecto](docs/PROJECT-STATUS.md): auditorías y evidencia histórica por dominio.
6. [Registro de decisiones](docs/DECISION-LOG.md): decisiones de negocio y arquitectura.
7. [ADR de sesión de caja](docs/architecture/ADR-CASH-REGISTER-SESSION-CONTROL.md): diseño y bloqueos de apertura/cierre.

Si dos documentos discrepan, no borrar la historia: registrar qué afirmación queda superada, por qué, desde qué fecha y con qué evidencia. La configuración live y contratos oficiales prevalecen sobre hipótesis documentales.

---

**Estado de esta guía:** consolidación documental. No declara el sitio listo para producción, no certifica fiscalidad y no acredita publicación de los últimos commits.


## Addendum de estado — PR #286 y notificaciones Wix (2026-11-11)

Este addendum prevalece sobre el resumen histórico anterior de PR #286 y sobre cualquier referencia a que la auditoría de automatizaciones fue exclusivamente read-only.

- PR #286: rama `audit/p0-p1-hardening`; HEAD previo a este addendum documental: `d30e03473fe2bfe39b93a881ef4b765fcd72691d`. CI de código: 57 suites / 548 tests / 0 fallos (run `43038637356`); Gitleaks SUCCESS (run `43038637350`). No hay revisiones humanas registradas. Los commits documentales posteriores no cambian código, pero disparan nuevos workflows de PR.
- Se pausaron y verificaron 67 automatizaciones Wix activas: 66 email y una WhatsApp. Las cuatro automatizaciones WhatsApp están inactivas.
- Nueve automatizaciones de email continúan activas porque Wix las marca readonly y/o disableStatusChange. No se ha podido demostrar aislamiento total de la mensajería nativa.
- No se envió ningún mensaje. El móvil sintético `el móvil sintético facilitado por el propietario (dato no versionado)` no se configuró; la acción Wix `whatsapp-send-message` no dispone de procedimiento público soportado para reconfigurar el destinatario por API.
- La allowlist de `emailRecipientPolicy.js` solo cubre el despacho backend Resend; no gobierna automatizaciones nativas Wix.
- El PR permanece draft y sin merge. Siguen pendientes revisión humana, QA runtime/E2E en entorno aislado para pagos/reembolsos y resolución de los nueve flujos email activos. No desplegar: los writers fiscales/contables quedan fail-closed por defecto.

Evidencia: [auditoría de aislamiento de notificaciones](docs/audits/2026-11-11-wix-automation-recipient-isolation.md) y [auditoría P0/P1](docs/audits/2026-11-11-p0-p1-hardening.md).


## Cierre de integración PR #286 — 2026-11-11

PR #286 se fusionó en `main` mediante squash el 2026-11-11 a las 15:00:16 UTC. Merge commit: `0d8f6efc581bc6a3d892702ba1c32af73e829888`. Esta actualización prevalece sobre los addenda previos que describían el PR como draft/abierto.

- CI del HEAD previo al merge: 57 suites / 548 tests / 0 fallos; contratos SDK Wix, Order Transactions, Bookings Reader V2, ESLint y Gitleaks SUCCESS.
- El merge no es despliegue. No se ha publicado código Wix ni se han mutado CMS, caja, ledgers, pedidos o pagos.
- Writers fiscales y contables permanecen fail-closed por defecto; revisar impacto operativo antes de cualquier publicación.
- 67 automatizaciones Wix se pausaron y verificaron (66 email y una WhatsApp); cuatro WhatsApp están inactivas. Nueve automatizaciones email siguen activas por restricciones Wix readonly/disableStatusChange.
- No se ha enviado ningún mensaje. El móvil sintético el móvil sintético facilitado por el propietario (dato no versionado) no se ha configurado.
- Pendiente antes de despliegue: runtime/E2E aislado para eventos de pago/reembolso, resolución de los nueve flujos nativos de email y ruta WhatsApp oficialmente soportada.

Evidencia: [PR #286](https://github.com/nachoortegazgz/marianmadridz/pull/286), [merge commit](https://github.com/nachoortegazgz/marianmadridz/commit/0d8f6efc581bc6a3d892702ba1c32af73e829888), [auditoría de automatizaciones](docs/audits/2026-11-11-wix-automation-recipient-isolation.md).
