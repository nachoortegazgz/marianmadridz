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

### Límite de verificación

La Data Permissions API v1 confirmó la configuración CMS_EDITOR tras la escritura. Data Collections API v2 sigue mostrando ADMIN en el objeto de permisos. La efectividad final debe probarse con una identidad colaboradora que tenga rol CMS Editor. No se debe afirmar que la interfaz Content Manager quedó verificada hasta realizar esa prueba.

Las colecciones Wix App (Bookings, Stores, Members, etc.) no se modificaron: son administradas por sus respectivas aplicaciones y sus permisos/operaciones no se controlan mediante los permisos de colecciones personalizadas.

## 3. Estado del sitio y entorno

- El sitio objetivo sigue en estado Published; no se ha despublicado ni cambiado su dominio.
- Existe otro sitio Wix ya creado como borrador: `Marian Madrid QA - Aislado 2026-11`, Site ID `50b39f33-e753-4331-ab35-b2ed43dc97f7`. No es el destino de esta adaptación.
- El estado Published no equivale a aislamiento de notificaciones ni de pagos.
- No se han creado reservas, pedidos, pagos, reembolsos, contactos, miembros ni movimientos en esta intervención.
- No se han enviado emails, SMS o WhatsApp.
- No se ha publicado código ni se ha ejecutado ningún cron.

## 4. Agenda / Bookings

Los registros de agenda pertenecen a Wix Bookings, no a las colecciones nativas personalizadas. No se puede habilitar su borrado mediante Data Permissions API.

Para reservas, la operación soportada de retirada es cancelar la reserva (estado `CANCELED`); para modificar la fecha se debe usar la operación de reprogramación. La cancelación de QA debe usar `participantNotification.notifyParticipants=false` y datos de contacto sintéticos. No se debe simular un borrado físico si Wix no ofrece esa operación.

La proyección propia `CitasF2` ya tiene CMS_EDITOR para CRUD. No se deben alterar las reservas nativas sin reconciliar su proyección por `bookingId`.

## 5. Cliente sintético y gestoría

- Identidad sintética ya declarada en la documentación QA: **Nacho Pitt**.
- El registro actual de `DatosFiscales` contiene un tercero sintético identificado como gestoría y un email de pruebas ya presente en el registro. El valor exacto se mantiene en el CMS y no se replica aquí.
- `SDK_CONFIG.EMAIL.ACCOUNTANT_SEND_ENABLED` sigue en `false`.
- La allowlist Resend existente no sustituye el control de destinatarios de las automatizaciones nativas Wix.
- No se ha habilitado el despacho de emails ni se ha ejecutado ningún envío.
- Antes de enviar, el flujo debe demostrar snapshot persistido, hash verificado, destinatario exacto en allowlist, idempotencia del despacho y traza de resultado.

## 6. Pagos simulados

No existe evidencia de un sandbox PSP configurado en este sitio. La prueba nativa de pedido de Wix no está disponible para Wix Bookings; Wix documenta que el test order es para Wix Stores / Wix Restaurants. La modalidad de pago manual/offline evita un cargo, pero no simula una transacción de pasarela.

La simulación de éxito, rechazo, pendiente y reintento de PSP debe implementarse como adaptador mock de backend QA, sin llamar a Wix Payments ni crear transacciones reales. El simulador debe:
- estar habilitado únicamente para el Site ID QA autorizado;
- generar IDs y trazas marcados como sintéticos;
- no emitir recibos fiscales, facturas ni remisiones AEAT;
- no insertar en ledgers fiscales/contables ni cambiar stock;
- no permitir que el frontend establezca por sí mismo un estado `PAID`;
- probar webhooks mediante fixtures firmados/mocks, sin simular una firma real del proveedor;
- tener un flag independiente y fail-closed por defecto.

Hasta que ese adaptador y sus pruebas estén integrados, usar únicamente mocks offline o pagos manuales sin marcar como transacción PSP.

## 7. Automatizaciones y canales externos

Lectura live del 2026-11-13:
- 157 automatizaciones listadas.
- 28 aparecen ACTIVE.
- Nueve flujos de email se han documentado previamente como bloqueados por `readonly` y/o `disableStatusChange`.
- El inventario anterior identifica flujos con destinatario dinámico del contacto y notificaciones internas.
- No se ha cambiado ningún estado de automatización en esta intervención.

Antes de crear reservas o miembros de prueba:
1. Reconsultar los 157 flujos y sus acciones/destinatarios actuales.
2. Desactivar únicamente las automatizaciones mutables que puedan contactar destinatarios no QA, preservando la configuración.
3. Aislar los flujos no desactivables: no disparar sus triggers hasta demostrar que el destinatario es el cliente sintético o el buzón QA controlado.
4. Para la comunicación con gestoría, usar exclusivamente el flujo backend con destinatario allowlisted; no reutilizar una automatización Wix que envíe al contacto que dispara el evento.
5. Probar primero el transporte con un sink o inbox controlado y registrar traceId, plantilla, destinatario y resultado.

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
| Agenda Bookings edit/cancel en runtime | Pendiente |
| Cliente sintético creado | Pendiente |
| Simulador PSP backend | Pendiente de implementación |
| Comunicación a gestoría | Bloqueada por flag; no enviada |
| Aislamiento de automatizaciones | Pendiente |
| E2E completo en navegador | Pendiente |
| Restauración preproducción | Documentada, no ejecutada |

**Criterio:** este documento registra una adaptación parcial de permisos Wix y las tareas de aislamiento pendientes. No certifica el sitio como entorno QA completo ni autoriza un despliegue real.
