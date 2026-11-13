# Adaptaciones temporales para QA — Marian Madrid

**Fecha:** 2026-11-13  
**Sitio objetivo:** Marian Madrid Peluquería y Estética  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Baseline de código:** `31daf02167fe06a252451eadaa53278b8c137cd5`  
**Estado:** adaptación parcial; no declarar entorno QA completo.

## 1. Declaración del propietario

El propietario declara que los datos actualmente almacenados en el sitio objetivo son sintéticos, corresponden a pruebas y son eliminables. Esta declaración habilita el uso del sitio para QA, pero no convierte automáticamente en seguros los efectos externos de Wix ni anula las reglas de integridad del diseño.

## 2. Cambios Wix aplicados y verificados

Se utilizó Wix Data Permissions API v1. Para el rol `CMS_EDITOR` se habilitó CRUD (lectura, inserción, actualización y eliminación) en las colecciones nativas de negocio siguientes:

- `CajaActual`
- `ComplementosCatalogo`
- `DatosFiscales`
- `ServiciosCatalogo`

En estas cuatro colecciones, los permisos anteriores y el valor de restauración son:

| Colección | Antes | Adaptación QA | Restauración |
|---|---|---|---|
| `CajaActual` | PRIVILEGED / PRIVILEGED / PRIVILEGED / PRIVILEGED | CMS_EDITOR en las cuatro acciones | PRIVILEGED en las cuatro acciones |
| `ComplementosCatalogo` | CMS_EDITOR / PRIVILEGED / PRIVILEGED / PRIVILEGED | CMS_EDITOR en las cuatro acciones | CMS_EDITOR / PRIVILEGED / PRIVILEGED / PRIVILEGED |
| `DatosFiscales` | PRIVILEGED / PRIVILEGED / PRIVILEGED / PRIVILEGED | CMS_EDITOR en las cuatro acciones | PRIVILEGED en las cuatro acciones |
| `ServiciosCatalogo` | CMS_EDITOR / PRIVILEGED / PRIVILEGED / PRIVILEGED | CMS_EDITOR en las cuatro acciones | CMS_EDITOR / PRIVILEGED / PRIVILEGED / PRIVILEGED |

Orden de las acciones: lectura / inserción / actualización / eliminación.

Se hizo lectura posterior de los diez objetivos de permiso. Los otros seis (`CitasF2`, `ControlOperativo`, `InventarioStockVenta`, `MapaStaff`, `MovimientosInventario` y `RegistroIntegracion`) ya tenían CMS_EDITOR en las cuatro acciones y no necesitaron modificación.

### Colecciones no modificadas

Se excluyeron deliberadamente por los invariantes append-only:

- `HistoricoCierresZ`
- `LibroAsientosContablesDetalle`
- `MovimientosCaja`
- `PaquetesGestoria`
- `RegistrosHorariosStaff`

No se debe habilitar edición o borrado manual de estos ledgers. Los registros de QA se deben identificar y corregir mediante los mecanismos de prueba y rectificación definidos por el proyecto, sin reescribir históricos.

**Advertencia de permisos actual:** en la lectura Data Permissions v1 del 2026-11-13, `HistoricoCierresZ`, `PaquetesGestoria` y `RegistrosHorariosStaff` ya tenían CMS_EDITOR en las cuatro acciones. No se modificaron en esta intervención, pero eso significa que el permiso CMS por sí solo no impide que un colaborador CMS_EDITOR pueda editarlos o borrarlos. El principio append-only se mantiene en los contratos/backend, pero no está impuesto uniformemente por el ACL CMS. Antes de permitir edición CMS libre durante QA, se debe resolver esta brecha: restringir update/remove a PRIVILEGED o gestionar la limpieza mediante un procedimiento QA controlado. No se ha cambiado ese ACL porque requiere una decisión explícita sobre el alcance de limpieza de esos registros sintéticos.

### Límite de verificación

La Data Permissions API v1 confirmó la configuración CMS_EDITOR tras la escritura. Data Collections API v2 sigue mostrando ADMIN en el objeto de permisos. La efectividad final debe probarse con una identidad colaboradora que tenga rol CMS Editor. No se debe afirmar que la interfaz Content Manager quedó verificada hasta realizar esa prueba.

Las colecciones Wix App (Bookings, Stores, Members, etc.) no se modificaron: son administradas por sus respectivas aplicaciones y sus permisos/operaciones no se controlan mediante los permisos de colecciones personalizadas.

## 3. Estado del sitio y entorno

- El sitio objetivo sigue en estado Published; no se ha despublicado ni cambiado su dominio.
- Existe otro sitio Wix ya creado como borrador: `Marian Madrid QA - Aislado 2026-11`, Site ID `50b39f33-e753-4331-ab35-b2ed43dc97f7`. No es el destino de esta adaptación.
- El estado Published no equivale a aislamiento de pagos ni de todos los canales externos.
- Se ejecutó una reserva sintética controlada, descrita en la sección 4; se canceló inmediatamente y no generó cargo.
- No se crearon pedidos, pagos PSP, reembolsos ni movimientos fiscales/contables.
- No se enviaron emails, SMS ni WhatsApp; la reserva usó `qa.simple@example.test` y notificaciones al participante desactivadas.
- No se ha publicado código ni se ha ejecutado ningún cron.

## 4. Agenda / Bookings

Los registros de agenda pertenecen a Wix Bookings, no a las colecciones nativas personalizadas. No se puede habilitar su borrado mediante Data Permissions API.

Para reservas, la operación soportada de retirada es cancelar la reserva (estado `CANCELED`); para modificar la fecha se debe usar la operación de reprogramación. La cancelación de QA debe usar `participantNotification.notifyParticipants=false` y datos de contacto sintéticos. No se debe simular un borrado físico si Wix no ofrece esa operación.

La proyección propia `CitasF2` ya tiene CMS_EDITOR para CRUD. No se deben alterar las reservas nativas sin reconciliar su proyección por `bookingId`.

### Prueba runtime realizada el 2026-11-13

Se usó la API oficial Bookings Writer V2, sin omitir validación de disponibilidad ni confirmación de negocio:

| Campo | Resultado |
|---|---|
| Booking ID | `3effa046-5b9d-429b-9f9c-af2f3d6c9994` |
| Cliente | Nacho Pitt |
| Email sintético | `qa.simple@example.test` |
| Servicio | Retoque de Flequillo Express |
| Importe de catálogo | 10 EUR |
| Slot | 2026-11-17 09:45–10:00, Europe/Madrid |
| Recurso | Andrea Staff |
| Pago | `OFFLINE`, sin transacción PSP |
| Estado | `CREATED` → `CONFIRMED / NOT_PAID` → `CANCELED / NOT_PAID` |
| SMS y notificación al participante | Desactivados |

La cancelación devolvió `CANCELED`, revisión 3. No se solicitó reembolso ni se generó cargo. La consulta inmediata de `CitasF2` por `bookingId` devolvió cero filas. Por tanto, la prueba acredita el ciclo nativo de Bookings, pero **no** acredita la proyección automática CitasF2 ni el handler publicado. El GET final de reserva no devolvió un objeto utilizable; el estado final se apoya en la respuesta de cancelación. Debe investigarse la ausencia de proyección antes de declarar validado el flujo end-to-end.

La reserva fue cancelada inmediatamente, por lo que no debe quedar ocupando el slot. No borrar el registro nativo por CMS; conservar su estado CANCELED como evidencia QA.

## 5. Cliente sintético y gestoría

- Identidad sintética ya declarada en la documentación QA: **Nacho Pitt**.
- El registro actual de `DatosFiscales` contiene un tercero sintético identificado como gestoría y un email de pruebas ya presente en el registro. El valor exacto se mantiene en el CMS y no se replica aquí.
- `SDK_CONFIG.EMAIL.ACCOUNTANT_SEND_ENABLED` sigue en `false`.
- La allowlist Resend existente no sustituye el control de destinatarios de las automatizaciones nativas Wix.
- No se ha habilitado el despacho de emails ni se ha ejecutado ningún envío.
- El registro CMS de gestoría fue localizado en `DatosFiscales`, pero no se ha probado el envío a un sink controlado.
- Antes de enviar, el flujo debe demostrar snapshot persistido, hash verificado, destinatario exacto en allowlist, idempotencia del despacho y traza de resultado.

## 6. Pagos simulados

No existe evidencia de un sandbox PSP configurado en este sitio. La prueba nativa de pedido de Wix no está disponible para Wix Bookings; Wix documenta que el test order es para Wix Stores / Wix Restaurants. La modalidad de pago manual/offline evita un cargo, pero no simula una transacción de pasarela.

Se ha añadido `src/backend/tests/fixtures/qaPaymentGateway.mock.mjs` y su suite `src/backend/tests/qa.payment-gateway.mock.test.mjs`. Es un doble PSP en memoria, exclusivamente bajo `src/backend/tests/`, sin cliente HTTP, secretos, Wix SDK, CMS, webhooks, ledgers ni stock. Simula:
- autorización APPROVED → AUTHORIZED;
- PENDING, DECLINED y TIMEOUT;
- captura condicionada a autorización;
- reembolsos parciales y totales limitados al importe capturado;
- idempotencia y rechazo de reutilización conflictiva de claves;
- validación de importe, precisión, moneda EUR, entorno QA, flag habilitado y coincidencia del identificador de sitio.

El simulador **no está conectado al runtime del sitio ni a la UI** y no produce un estado Wix `PAID`. Es una herramienta de pruebas offline; no es un sandbox PSP ni una transacción de prueba de Wix Payments. La suite se ha añadido al gate Layer 1 y al manifest QA. Su resultado queda pendiente de CI.

No se ha habilitado ningún flag de pagos en el backend productivo. Los pagos fiscales y contables siguen fail-closed. Para probar el flujo de webhook y ledger, se mantienen las suites offline existentes con payloads Wix oficiales simulados; no se ejecutan contra CMS live.

## 7. Automatizaciones y canales externos

Lectura live y cambios del 2026-11-13:
- 157 automatizaciones listadas.
- Antes del cambio, 28 estaban ACTIVE.
- Se desactivaron 18 automatizaciones que permitían cambio de estado; cada una se releyó y quedó `INACTIVE`.
- Tras los cambios, 10 siguen `ACTIVE`; todas tienen `disableStatusChange=true` o `readonly=true` (en una concurren ambos).
- Los triggers de reserva que podían desactivarse quedaron INACTIVE, incluidos reserva creada, confirmación, cancelación y reprogramación.
- No se ejecutó Test Automation, ya que esa operación ejecuta sus acciones reales.

#### Automatizaciones desactivadas: restauración

Todas las siguientes tenían estado original `ACTIVE` y deben restaurarse a ACTIVE únicamente en el procedimiento de vuelta a producción, después de revisar destinatarios y configuración. Wix creó overrides y cambió el ID de ocho automatizaciones preinstaladas; usar el ID actual, no el anterior.

| Automatización | ID anterior | ID actual | Estado QA |
|---|---|---|---|
| Notify me when someone books one of my services | `0c84478b-1061-4117-a91c-2f83cbfe184c` | `099ed557-695e-4259-ae83-5bc2ffb4fcf9` | INACTIVE |
| Subscription update notification email | `5d2e88a2-b43b-4bb2-88a3-207be31b7976` | `ae4eaf8e-77ec-48e8-85ba-fb17be73838a` | INACTIVE |
| Get notified when AI Custom Agent needs approval | `6d7b0965-98e5-4a91-8664-ccb816f9d792` | `bb789213-eb8d-45a8-b860-d0d64a0fa555` | INACTIVE |
| Generate receipt for invoice payment | `b01ea2ec-c83c-4490-b1b0-66a1a266363b` | `56acdcc1-4920-489e-9ed7-34f0389755af` | INACTIVE |
| Give points to new site members | `b265bbb8-e9ad-43e4-b63a-8a8db837f76d` | `d38df0c8-0a32-4c30-8cae-90641f93af90` | INACTIVE |
| Notify me when I need to review a booking request | `bbd81479-88d1-490b-9742-8cc3552bbfba` | `5c45fe90-d8c5-4a7a-82e0-dd53245449b3` | INACTIVE |
| New visitor on site | `cde6d9b7-0840-45be-904e-db1be8b5aa7d` | `0d3b88c4-66cb-4087-b569-22c70079dc60` | INACTIVE |
| AI needs you to reply notification | `d0f32812-9aef-4728-b6d9-e2a867e2828b` | `ea4886d7-ded7-4071-8a79-43a3c5fe3f7c` | INACTIVE |
| Email Marketing Campaigns Creation (coupon) | — | `7adb3c8d-7c93-41f0-849b-023372d8ebee` | INACTIVE |
| Email Marketing Campaigns Creation (portfolio) | — | `7b7f6c6e-d5f0-4ce3-939a-f3ca6c17b9b3` | INACTIVE |
| Crear un recibo cuando se agrega un pago al pedido | — | `891ae623-0125-470f-884c-f3b39f65ce57` | INACTIVE |
| Email Marketing Campaigns Creation (event) | — | `90f70026-272c-40c9-91b3-6e1f56e755c7` | INACTIVE |
| FAQ Optimization | — | `ac4220e2-acaa-4c86-a6ec-bd6be2f3885f` | INACTIVE |
| Social Media Post Creation (coupon) | — | `ba852e35-69d9-4cb9-82e9-7099899e82b5` | INACTIVE |
| Keywords Research | — | `c2cab155-3ab1-4b23-9207-1539df58d00b` | INACTIVE |
| Blog Post Optimization | — | `c8c76911-aba0-4fa4-8f76-7495daba9c2e` | INACTIVE |
| Site Main Pages Optimization | — | `dd9e3497-0a6c-45e9-9a95-184b6771a133` | INACTIVE |
| Social Media Post Creation (discount) | — | `ff65bb16-809c-4063-8ac7-407217df3290` | INACTIVE |

#### Automatizaciones que permanecen activas y bloqueadas por Wix

No se pueden desactivar mediante la API por `readonly` o `disableStatusChange`. No disparar sus triggers durante QA:

| Automatización | ID | Trigger |
|---|---|---|
| Notify customer when you save their card details | `0fd88c94-2045-4657-858b-59213757b948` | card_saved |
| Notify owner on a new voicemail | `15795b10-74b6-45e6-94f2-085b61dd7fa4` | new_voicemail |
| Notify clients when their saved card was charged | `23274141-65ce-4a6c-8993-d6ba0a42fa7a` | saved_card_charged |
| Send an email to proceed with a task | `2759512d-223f-4e4f-beb5-5c34de98991c` | custom_agent_notification |
| Aria Assistant send wix notification | `4c9c0ba3-1e14-49ff-8643-6db7d04f6a01` | assistant_need_to_send_a_notification |
| Send email confirmation to site members | `73fb819b-e337-44fa-98de-6c6030b97209` | member_email_confirmation_required |
| Send subscription confirmation email | `9bfadabf-a4c6-4bf9-8e46-8561ff2fc9c6` | subscription_confirmation_request |
| Aria Assistant send an email | `d8c5ba95-49a9-46fe-9aa7-1f7d7962a439` | assistant_need_to_send_an_email |
| cms items limit warning email | `e5473136-1e31-44ca-af8d-dc24e4b78d6b` | cms_items_limit_approaching |
| Send site members a reset password email | `f5d070ab-4cda-408a-acbd-d7331793ee8e` | member_reset_password |

Las automatizaciones activas bloqueadas no tienen trigger de reserva normal, excepto cobro de tarjeta guardada. No guardar tarjetas, no cobrar tarjetas y no crear miembros, suscripciones, tareas de agente, voicemail ni escenarios de umbral CMS durante QA. La desactivación de flujos mutables no garantiza detener ejecuciones ya iniciadas; no hay evidencia de ejecuciones pendientes en esta intervención.

Para restaurar el estado original, reconsultar por ID actual y activar solo las 18 de la tabla de restauración, una a una, preservando su configuración y verificando read-back. No activar las 10 bloqueadas por API ni alterar sus locks.

#### Política de comunicaciones QA

1. No ejecutar triggers de las diez automatizaciones bloqueadas.
2. Mantener el despacho Resend a gestoría deshabilitado.
3. Usar exclusivamente fixtures offline o sink controlado para email.
4. No usar el trigger de Test Automation: ejecuta acciones reales incluso si la automatización está INACTIVE.
5. La comunicación con gestoría solo se podrá probar después de tener un sink/inbox QA controlado, no con el destinatario dinámico de Wix.

## 8. Restauración antes del despliegue real

Antes de cualquier despliegue real:
- [ ] Restaurar los permisos de las cuatro colecciones según la tabla de la sección 2.
- [ ] Comprobar que las demás colecciones conservan sus permisos canónicos.
- [ ] Retirar el adaptador de pagos simulados del build de producción o mantenerlo deshabilitado por defecto y bloqueado por Site ID.
- [ ] Restaurar `ACCOUNTANT_SEND_ENABLED=false` hasta que el proceso real esté aprobado.
- [ ] Eliminar datos sintéticos mutables mediante un procedimiento de limpieza QA con allowlist de IDs y verificación previa.
- [ ] No borrar ni sobrescribir ledgers append-only; los datos de prueba en esas colecciones deben mantenerse aislados o tratarse conforme al procedimiento rectificativo aprobado.
- [ ] Restaurar automatizaciones y destinatarios aprobados para producción; no activar flujos readonly por vías no soportadas.
- [ ] Revisar configuración de pagos y confirmar que el proveedor real solo se activa tras aprobación.
- [ ] Ejecutar regresión completa y smoke tests después del despliegue autorizado.

## 9. Estado de validación

| Elemento | Estado |
|---|---|
| Permisos CMS v1 en 10 colecciones objetivo | Verificado por lectura posterior |
| Efectividad real con identidad CMS_EDITOR | Pendiente |
| Permisos de colecciones Wix App | No modificados |
| Bookings Writer V2 create/confirm/cancel con cliente sintético | Verificado por respuestas API; reserva cancelada |
| Proyección automática CitasF2 para el booking de prueba | No verificada; query devolvió 0 filas |
| Cliente sintético como contacto CRM persistido | Pendiente de comprobar |
| Simulador PSP offline en memoria | Implementado en tests; 6/6 PASS local y CI |
| Simulador PSP accesible desde runtime/UI | No implementado (intencional: no existe sandbox PSP acreditado) |
| Pago OFFLINE Bookings sin cargo | Verificado en prueba runtime; no es pago PSP |
| Comunicación a gestoría | Bloqueada por flag; no enviada |
| 18 automatizaciones modificables | INACTIVE, verificado por read-back |
| 10 automatizaciones bloqueadas | ACTIVE; triggers excluidos de QA |
| Efectividad real con identidad CMS_EDITOR | Pendiente |
| E2E completo en navegador | Pendiente |
| Restauración preproducción | Documentada, no ejecutada |

**Criterio:** el sitio dispone de aislamiento parcial de automatizaciones, permisos CMS ajustados y una prueba nativa de Bookings cancelada. El simulador PSP es offline; su suite aislada local ejecutó 6/6 pruebas PASS. En CI del PR #330:
- Layer 1: 23 suites, 294 PASS, 0 FAIL.
- Layer 2: 17 suites, 239 PASS, 0 FAIL.
- Regresión completa: 67 suites, 617 PASS, 0 FAIL.
- Contratos SDK Wix Bookings Reader V2, eCommerce Cart V2 y Order Transactions: PASS.
- ESLint: PASS.
- Gitleaks full-history: PASS.
Ejecuciones: backend quality gates `43487412879`; secret scanning `43487413018`. La ausencia de proyección CitasF2, los diez flujos Wix bloqueados y la falta de un sink de gestoría impiden certificar el sitio como entorno QA completo. No autoriza un despliegue real.
