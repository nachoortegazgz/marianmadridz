# TPV QA — módulos Velo

> **Brecha de integración UI (2026-11-19):** `#htmlTPV.txt` no está alineado con este backend. Es una maqueta con catálogo/precios hardcodeados y cobros en memoria; no implementa `postMessage` ni el protocolo `MM_READY/MM_CONTEXT`. No instalar ni considerar operativa hasta cerrar la integración y superar `tpv-widget.contract.test.mjs` y `tpv-ui.qa-source.test.mjs`.

> **Backend canónico:** todos los módulos TPV Velo residen exclusivamente en `src/backend/tpv/`. No reintroducir archivos `src/backend/tpv*.web.js` en la raíz: eran stubs legacy sin consumidores activos.

Este directorio implementa el TPV en modo QA persistente y sintético para el sitio Marian Madrid en Wix Classic.

## Límites de seguridad

- Toda escritura de negocio de TPV se realiza exclusivamente en las colecciones `TPV_QA_*`.
- Las colecciones QA son append-only: el acceso central permite `insert`, pero no `update` ni `remove`.
- La idempotencia se aplica mediante índice CMS único `idempotencyKey`, lectura fuerte previa y reconciliación del resultado de inserción concurrente.
- Los reembolsos sintéticos se serializan por venta mediante compare-and-swap en `ControlOperativo`, tipo `TPV_QA_REFUND_LOCK`. Ventas, devoluciones, movimientos, arqueos y cierres comparten además `TPV_QA_SESSION_LOCK` para evitar carreras con Ticket Z. Los locks no son ledgers ni almacenan importes.
- No se consultan contactos, miembros, reservas, staff real ni saldos de Gift Cards. No se llama a Wix Payments, checkout, Orders, refunds, Bookings writers, Gift Card writers, hardware, notificaciones ni emisión fiscal.
- No se escribe en `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ` ni `LibroAsientosContablesDetalle`.
- Ticket Z cierra solo la sesión QA y nunca cierra el periodo fiscal u operativo.

## Inventario

| Módulo | Responsabilidad |
|---|---|
| `tpvCaja.web.js` | Apertura diaria QA, lectura de sesión y arqueo parcial |
| `tpvVentas.web.js` | Validación y persistencia idempotente de venta sintética |
| `tpvMovimientos.web.js` | Entradas, salidas y retiradas sintéticas |
| `tpvCatalogo.web.js` | Lectura nativa de servicios Bookings y Stores Catalog V3; cliente y profesionales solo desde fixtures sintéticas |
| `tpvPagos.web.js` | Validación de medios mixtos sin pasarela |
| `tpvDevoluciones.web.js` | Reembolso sintético parcial/total, con autorización ADMIN y lock por venta |
| `tpvCierres.web.js` | Resumen, Ticket X y cierre de sesión QA Ticket Z |
| `tpvAuditoria.web.js` | Consulta de auditoría persistida |
| `tpvPermisos.web.js` | Capacidades QA derivadas del rol backend |
| `tpvUtils.web.js` | Configuración y validaciones auxiliares expuestas |
| `tpvUtils.js` | Validación pura, minor units, claves y payload sintético |
| `tpvQaRepository.js` | Acceso central a colecciones QA, idempotencia, lectura fuerte y locks CAS de sesión/venta |
| `tpvCierresCore.js` | Agregación reproducible de ventas, pagos, devoluciones y efectivo |

## Flujo de venta

1. El miembro con rol cajero solicita la sesión QA abierta.
2. La interfaz prepara y valida el borrador en backend.
3. `registrarVentaQA` exige una sesión abierta y pago completamente cuadrado.
4. Inserta evento `PREPARADA`, líneas, pagos y evento `CONFIRMADA_SINTETICA`.
5. Cada evento utiliza una clave idempotente derivada de la clave cliente; un reintento continúa los pasos pendientes sin duplicar los existentes.
6. Se registra auditoría. No se inicia una autorización, captura, orden ni movimiento fiscal.

La persistencia multi-colección no es una transacción ACID. El orden preparado → líneas/pagos → confirmada permite detectar y reanudar una escritura parcial; los consumidores de informes solo consideran ventas confirmadas.

## Flujo de reembolso

- ADMIN obligatorio.
- Venta original debe estar confirmada y pertenecer a la sesión QA abierta.
- Los importes por medio no pueden superar el importe original no reembolsado.
- Un lock distribuido por sesión y otro por venta serializan solicitudes concurrentes y bloquean cambios durante Ticket Z.
- Cabecera, pagos negativos, movimiento de efectivo y auditoría se insertan como eventos sintéticos idempotentes.
- Nunca se llama a un proveedor externo.

## Sesión y cierres

- Una sesión por día local de Europe/Madrid, con clave idempotente determinista.
- Los arqueos parciales se registran como eventos; no mutan la sesión.
- Ticket X persiste una instantánea no destructiva.
- Ticket Z usa una clave determinista por sesión, comprueba el efectivo esperado y registra diferencia/motivo. La existencia del Ticket Z marca la sesión como cerrada.

## Pruebas

- `tpv.web-modules.contract.test.mjs`
- `tpv-widget.contract.test.mjs`
- `tpv-ui.qa-source.test.mjs`
- `tpv.qa.persistence.policy.test.mjs`

Ejecutar `npm test`, `npm run test:layer1` y `npm run lint` antes de sincronizar con Wix Classic. No declarar validación runtime hasta ejecutar Preview con los roles ADMIN, GESTION, ESTILISTA y miembro sin rol.

## Estado de integración

PR #397, PR #398 y PR #399 están integradas en `main`. PR #399 aplica el aislamiento sintético y pasó 74 suites / 670 pruebas offline, 0 fallos. El repositorio está configurado para Wix Git Integration: `wix.config.json` contiene el Site ID exacto y `package.json` expone `wix dev`/`wix`. El merge a `main` debe sincronizar el Editor, pendiente de read-back. No se ha ejecutado Preview ni Publish; la versión pública no está validada.


## Fixtures sintéticas de cliente y profesionales (QA)

- El único cliente de prueba es `Nacho Pitt` (`nacho.pitt@example.test`), definido en `TPV_QA_FIXTURES`; no se consulta CRM ni se persisten datos de clientes reales.
- Los profesionales proceden de fixtures sintéticas; no se consulta Bookings Staff ni se persisten IDs reales de recursos.
- La consulta y vinculación de reservas reales está deshabilitada; la venta rechaza cualquier `bookingId`.
- La consulta de saldo de Gift Cards reales está deshabilitada; no se envía ni persiste ningún código. Emisión, canje y reembolso siguen bloqueados.
- Los eventos de auditoría usan el actor sintético `QA_ACTOR`; la identidad real solo se usa para autorización backend y no se persiste.
