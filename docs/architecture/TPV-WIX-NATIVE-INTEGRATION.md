# TPV — integración con Wix nativo

## Alcance y página actual

La TPV personalizada corresponde a la página estática Wix:
- ID: `yl5th`
- Título: `TPV`
- Ruta: `/blank`
- Page code: `src/pages/TPV.yl5th.js`
- HTML Component: `#htmlTPV`

La lectura oficial de páginas estáticas devolvió `published: false`; el contexto del sitio también devuelve `Status: Draft`. No se afirma que el código de esta rama esté en el runtime de Wix Classic.

## Arquitectura y fuentes de verdad

| Capacidad | Fuente de verdad | Papel de la TPV en la fase QA |
|---|---|---|
| Servicios, profesionales y reservas | Wix Bookings | Lectura de catálogo y consulta de reservas por contacto; no crea, modifica ni cancela reservas |
| Productos y variantes | Wix Stores Catalog V3 | Lectura de catálogo; no actualiza stock ni crea pedidos |
| Clientes | Wix CRM Contacts V5 | Búsqueda y lectura de contacto; persiste en venta QA solo el ID y nombre visible |
| Pagos, pedidos y transacciones | Wix eCommerce / proveedor | Simulación QA; sin checkout, autorización, captura, pedido ni reembolso real |
| Tarjetas regalo | Wix Gift Cards / eCommerce Gift Vouchers | Consulta de saldo nativa, solo lectura; emisión, canje y reembolso bloqueados |
| Facturación | Wix Invoices V1 + módulo fiscal | Sin emisión fiscal; factura/abono/rectificativa bloqueados |
| Caja y ledgers | `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ`, ledgers fiscal/contable | No hay escritores TPV operativos; QA escribe solo en `TPV_QA_*` |

Wix Bookings y Stores permanecen como SSOT de sus dominios. El CMS propio solo conserva el estado transaccional QA de la TPV; no replica catálogo, reservas, tarjetas regalo ni pagos.

## Integración implementada en la rama

- `src/pages/TPV.yl5th.js` inicializa `public/tpvPageController.js`.
- El controlador despacha WebMethods de `src/backend/tpv/*.web.js`.
- `tpvNativeReaders.js` usa Contacts V5 y Bookings Reader V2; verifica contacto y pertenencia de la reserva antes de registrar el vínculo en una venta QA.
- `tpvGiftCards.web.js` consulta el saldo nativo con `giftVouchers.getGiftCard`; el código no se almacena, devuelve ni registra.
- `tpvQaRepository.js` concentra las escrituras sintéticas, idempotencia y locks CAS.
- Las lecturas remotas de Contacts/Bookings se realizan antes de adquirir el lock CAS de sesión.
- La interfaz conserva borradores y tickets suspendidos solo en la sesión del navegador.

## Limpieza de la implementación legacy

Se retiraron los siguientes archivos, demostrados sin consumidores activos:
- `src/pages/tpv.js`
- `src/pages/tpvCaja.web.js`
- `src/backend/tpvCaja.web.js`
- `src/backend/tpvVentas.web.js`
- `src/public/tpv/tpv-page.js`

La página estática actual es `TPV` con ID `yl5th` y ruta `/blank`. La búsqueda de imports en `src/` mostró que los módulos legacy solo eran consumidos por los dos archivos legacy eliminados. Los antiguos escritores insertaban directamente en `MovimientosCaja` y actualizaban `CajaActual` sin el control centralizado actual; no deben reintroducirse.

## Bloqueos previos a la activación real

1. Resolver la discrepancia CMS: `CajaActual` y `MovimientosCaja` tienen actualmente insert `SITE_MEMBER`; `ControlOperativo` permite read `ANYONE`. Auditar consumidores y permisos de items antes de cambiar permisos.
2. Integrar el flujo de pedido/pago presencial con contratos Wix eCommerce y proveedor aprobados.
3. Integrar inventario y devoluciones nativas de Stores.
4. Implementar operaciones nativas de Gift Cards.
5. Definir la emisión de tickets/facturas/abonos con Wix Invoices V1 y cumplimiento fiscal.
6. Validar caja, conciliación bancaria, cierres y permisos de roles en Wix Preview.
7. Mantener bloqueadas las escrituras fiscales y operativas hasta autorización explícita.

## Estado

La rama contiene una TPV QA persistente con lectura de catálogos nativos y vínculo cliente/reserva. No es todavía una TPV de producción: cobros, reembolsos reales, stock, reservas mutables, facturas, hardware y ledgers operativos siguen deshabilitados.

No se ha sincronizado ni publicado esta rama en Wix Classic. Studio Two queda fuera de alcance.
