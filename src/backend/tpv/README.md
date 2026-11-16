# TPV QA — módulos Velo

Este directorio implementa el TPV en modo QA persistente y sintético para el sitio Marian Madrid en Wix Classic.

## Límites de seguridad

- Toda escritura de negocio de TPV se realiza exclusivamente en las colecciones `TPV_QA_*`.
- Las colecciones QA son append-only: el acceso central permite `insert`, pero no `update` ni `remove`.
- La idempotencia se aplica mediante índice CMS único `idempotencyKey`, lectura fuerte previa y reconciliación del resultado de inserción concurrente.
- Los reembolsos sintéticos se serializan por venta mediante compare-and-swap en `ControlOperativo`, tipo `TPV_QA_REFUND_LOCK`. Ventas, devoluciones, movimientos, arqueos y cierres comparten además `TPV_QA_SESSION_LOCK` para evitar carreras con Ticket Z. Los locks no son ledgers ni almacenan importes.
- No se llama a Wix Payments, checkout, Orders, refunds, Bookings writers, Gift Card writers, hardware, notificaciones ni emisión fiscal.
- No se escribe en `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ` ni `LibroAsientosContablesDetalle`.
- Ticket Z cierra solo la sesión QA y nunca cierra el periodo fiscal u operativo.

## Inventario

| Módulo | Responsabilidad |
|---|---|
| `tpvCaja.web.js` | Apertura diaria QA, lectura de sesión y arqueo parcial |
| `tpvVentas.web.js` | Validación y persistencia idempotente de venta sintética |
| `tpvMovimientos.web.js` | Entradas, salidas y retiradas sintéticas |
| `tpvCatalogo.web.js` | Lectura nativa de Bookings y Stores Catalog V3 |
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

Los módulos y el HTML Component están versionados en la rama `feat/tpv-classic-persistent-qa-2026-11-16` (PR #397 abierta, sin fusionar). CI verificado sobre el HEAD `36fcd9c9192b888e884ace3881dbd88f9cb6a574`: 74 suites / 667 pruebas offline, 0 fallos; ESLint, contratos Wix y secret scanning correctos. No se han sincronizado al Editor clásico ni publicado. La pasarela y las operaciones fiscales permanecen deshabilitadas.


## Integración nativa de cliente y reservas (QA)

- Búsqueda de contactos con `@wix/crm` (`contactsV5.searchContacts`), limitada a 10 resultados y solo para cajeros autenticados.
- Consulta de reservas del contacto con `@wix/bookings` (`extendedBookings.queryExtendedBookings`), por `contactDetails.contactId` y ventana móvil de ±365 días.
- Antes de persistir una venta QA, el backend vuelve a leer el contacto y verifica que la reserva seleccionada pertenece a ese contacto. Se guarda únicamente el identificador, nombre visible y snapshot mínimo de la reserva en el payload sintético.
- Consulta de saldo de Gift Cards con `@wix/ecom` (`giftVouchers.getGiftCard`) y permiso `ECOM.GIFT_CARD_READ`; el código se envía solo al método nativo, no se persiste ni se devuelve. Emisión, canje y reembolso siguen bloqueados.
- No se crean ni modifican reservas, pagos, pedidos, facturas, stock ni ledgers operativos.
