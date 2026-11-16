# TPV — integración con Wix nativo

## Alcance y página actual

- Sitio: Marian Madrid Peluquería y Estética.
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Editor: Wix Classic Editor (Wix devuelve `Editor`); Velo habilitado.
- Estado del sitio: `Published`, confirmado por GetSiteContext y por `published: true` en List Static Pages (2026-11-16).
- Página estática TPV: ID `yl5th`, título `TPV`, ruta `/blank`.
- Page code versionado: `src/pages/TPV.yl5th.js`.
- HTML Component versionado: `#htmlTPV`.
- Moneda EUR; zona horaria Europe/Madrid.
- Studio Two queda fuera de alcance.

La publicación del sitio y la presencia de la página en la estructura Wix no demuestran que los archivos actuales de GitHub estén sincronizados con el runtime del Editor clásico. No se ha afirmado ni ejecutado esa sincronización.

## Arquitectura y fuentes de verdad

| Capacidad | Fuente de verdad | Papel de la TPV en QA |
|---|---|---|
| Servicios | Wix Bookings | Lectura de catálogo; sin escritores de reservas |
| Productos y variantes | Wix Stores Catalog V3 | Lectura de catálogo; sin cambios de stock ni pedidos |
| Clientes | Fixture sintética central en `TPV_QA_FIXTURES` | Solo cliente de prueba `Nacho Pitt` / `nacho.pitt@example.test`; no consulta CRM |
| Profesionales | Fixture sintética central en `TPV_QA_FIXTURES` | Solo identificadores y nombres sintéticos; no consulta staff real |
| Reservas | Wix Bookings | Consulta y vinculación deshabilitadas en QA |
| Pagos, pedidos y transacciones | Wix eCommerce / proveedor | Simulación sintética; sin checkout, autorización, captura, pedido ni reembolso real |
| Tarjetas regalo | Wix Gift Cards | Consulta de saldo real, emisión, canje y reembolso deshabilitados en QA |
| Facturación | Wix Invoices V1 + módulo fiscal | Sin emisión fiscal; factura/abono/rectificativa bloqueados |
| Caja y ledgers | `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ`, ledgers fiscal/contable | Sin escritores TPV operativos; persistencia QA solo en `TPV_QA_*` |

Wix Bookings y Stores permanecen como SSOT de los catálogos que se leen. El CMS propio conserva exclusivamente el estado transaccional sintético de TPV. No se copian contactos, miembros, reservas, tarjetas regalo, pedidos ni pagos reales.

## Integración versionada

- `src/pages/TPV.yl5th.js` inicializa `public/tpvPageController.js`.
- El controlador despacha WebMethods de `src/backend/tpv/*.web.js`.
- `tpvCatalogo.web.js` consulta servicios Bookings y productos/variantes Stores V3. Profesionales y cliente proceden de fixtures sintéticas.
- `tpvVentas.web.js` rechaza IDs de clientes/profesionales ajenos a las fixtures y rechaza cualquier `bookingId`; no consulta CRM ni Bookings Reader.
- `tpvGiftCards.web.js` responde `TPV_GIFT_CARDS_DISABLED_IN_QA`; no consulta `giftVouchers.getGiftCard` ni recibe códigos de tarjeta.
- Los eventos de auditoría usan el actor sintético `QA_ACTOR`; la identidad real se utiliza únicamente en la comprobación de autorización backend y no se persiste en los registros TPV.
- `tpvQaRepository.js` concentra escrituras QA, idempotencia y locks CAS.
- `#htmlTPV.txt` deshabilita visualmente la consulta de saldo real y etiqueta clientes/profesionales como sintéticos.

## Política de seguridad

- Todos los WebMethods exigen miembro autenticado y validación de rol en backend.
- Reembolsos sintéticos y Ticket Z requieren ADMIN.
- La interfaz no es una barrera de seguridad: cada WebMethod vuelve a comprobar permisos.
- No se llama a Payments, checkout, Orders, refunds, Bookings writers, Gift Card writers, hardware, notificaciones ni emisión fiscal.
- No se escribe en `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ` ni `LibroAsientosContablesDetalle`.
- Las escrituras QA se limitan a las nueve colecciones `TPV_QA_*` y siguen las claves idempotentes y los controles de concurrencia definidos por el repositorio.
- El identificador de auditoría persistido es `QA_ACTOR`, nunca el ID real del miembro.

## Limpieza legacy

Se retiraron tras comprobar consumidores:
- `src/pages/tpv.js`
- `src/pages/tpvCaja.web.js`
- `src/backend/tpvCaja.web.js`
- `src/backend/tpvVentas.web.js`
- `src/public/tpv/tpv-page.js`

No reintroducir los escritores legacy: insertaban en `MovimientosCaja` y actualizaban `CajaActual` fuera del control centralizado actual.

## Bloqueos antes de activar operaciones reales

1. Releer permisos CMS e item permissions de `CajaActual`, `MovimientosCaja` y `ControlOperativo`; la última auditoría histórica encontró permisos más amplios de los esperados.
2. Resolver y verificar las automatizaciones Wix preinstaladas ACTIVE que pueden enviar notificaciones; Runtime/E2E permanece bloqueado mientras no se acredite aislamiento.
3. Diseñar y aprobar contratos de pago presencial, pedidos, inventario y devoluciones nativas.
4. Definir la emisión fiscal con Wix Invoices V1 y cumplimiento fiscal español.
5. Probar en Preview con ADMIN, GESTION, ESTILISTA, miembro sin rol y visitante.
6. Confirmar en Wix Dashboard que no hay proveedor de pagos conectado antes de cualquier prueba que pueda producir efectos financieros.
7. Sincronizar el código con el Editor clásico mediante el procedimiento soportado por Wix, revisar diff y conservar reversión.

## Estado de despliegue

PR #397 y PR #398 figuran fusionadas en GitHub. El CI posterior a la integración en `main` terminó correctamente (670 pruebas offline, 0 fallos; SDK contracts, ESLint y secret scanning correctos). La rama de hardening sintético actualiza las fronteras de datos y está pendiente de CI/revisión.

No se ha sincronizado el page code, HTML Component ni módulos backend con Wix Classic. La página TPV aparece en un sitio publicado, pero el runtime de TPV no se considera actualizado ni validado hasta comparar y probar el código en el Editor/Preview.

La CLI oficial Origami de exportación/importación de sitio está documentada para Studio Two, no para el Editor clásico. No se ha encontrado un endpoint REST oficial soportado para subir page code Velo de Classic. Por tanto, no se ha intentado desplegar código por un mecanismo no soportado.

