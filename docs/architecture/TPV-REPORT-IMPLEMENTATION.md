# TPV — desarrollo e integración basada en el informe funcional de Wix

## 1. Fuente funcional y sitio objetivo

Fuente funcional primaria: informe Wix aportado por el usuario, `Texto pegado.txt`. Esta implementación conserva sus áreas operativas: ventas mixtas y multilínea, descuentos, impuestos declarados, profesionales/clientes, pagos divididos, anticipos, tickets suspendidos, devoluciones, gift cards, caja, arqueos, pagos electrónicos, ticket X y ticket Z.

Sitio Wix seleccionado:
- Nombre: Marian Madrid Peluquería y Estética.
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Dominio: `https://www.marianmadrid.es/`.
- Estado: publicado, Premium.
- Editor: Editor clásico; Velo habilitado; Codegen no elegible.
- Moneda: EUR; zona horaria: Europe/Madrid.
- Página TPV: ID `yl5th`, ruta publicada `/blank`.
- Apps instaladas: Wix Bookings, Wix Stores Catalog V3, Wix Gift Cards y Wix Invoices V1.
- El segundo sitio no forma parte del alcance.

## 2. Archivos sincronizados en la rama GitHub

Rama: `feat/tpv-web-modules-report-2026-11-15`.
PR: `#396` (draft; no fusionada ni desplegada).

| Archivo | Responsabilidad / estado |
|---|---|
| `src/pages/TPV.yl5th.js` | Page code de la página existente; inicializa el HTML Component. |
| `src/public/tpvPageController.js` | Puente versionado HTML ↔ Velo y despacho de WebMethods permitidos. |
| `#htmlTPV.txt` | Interfaz TPV con venta, catálogo, reservas, devoluciones, caja, arqueo por denominación, X/Z, pagos, gift cards, tickets/facturas y auditoría. |
| `src/backend/tpv/tpvValidation.js` | Validación pura de importes en céntimos, líneas, descuentos, impuestos declarados y pagos divididos. |
| `src/backend/tpv/tpvVentas.web.js` | Validación backend de borrador; escritores de venta y devolución bloqueados. |
| `src/backend/tpv/tpvCaja.web.js` | Lectura autenticada de caja; escritores bloqueados. |
| `src/backend/tpv/tpvCatalogo.web.js` | Lectores Wix Bookings y Wix Stores Catalog V3, incluidos precios y variantes. |
| `src/backend/tpv/tpvGiftCards.web.js` | Consulta autenticada y solo lectura del saldo/estado de Gift Cards. |
| `src/backend/tpv/tpvReportes.web.js` | Resumen de caja y vista parcial X; cierre Z bloqueado. |
| `src/backend/tests/tpv.web-modules.contract.test.mjs` | Contratos, validación económica y límites de escritura. |
| `src/backend/tests/tpv-widget.contract.test.mjs` | Protocolo, UI, controles bloqueados y sintaxis del iframe. |

La antigua ruta `src/public/tpv/tpv-page.js` se eliminó en una entrega anterior porque importaba un módulo inexistente y no tenía consumidores.

## 3. Funcionalidad entregada en modo QA

### Venta y catálogo
- Selección de profesional desde Wix Bookings.
- Identificación manual opcional del cliente o venta anónima.
- Lectura de servicios, profesionales, productos y variantes nativos.
- Borrador multilínea de servicios/productos y concepto manual de QA.
- Cantidades, descuentos e impuestos declarados por línea.
- Subtotal, descuentos, impuestos y total en EUR.
- Medios divididos: efectivo, tarjeta, Bizum y otros.
- Cambio de efectivo y validación de importe aplicado.
- Validación backend sin persistencia.
- Suspensión y recuperación de tickets dentro de la sesión del navegador.
- Registro de venta QA sintética en memoria, solo tras validación completa y cuadre. No crea venta real ni ticket fiscal.

### Caja e informes
- Lectura autenticada del estado actual de caja.
- Vista previa local de movimientos de efectivo y arqueo, incluido recuento por denominación.
- Snapshot parcial de Ticket X, claramente identificado como parcial.
- Resumen sintético X/Z de las ventas QA creadas en la sesión.
- Cierre Z real deshabilitado.

### Tickets, facturación, devoluciones, pagos y reservas
- Secciones de ticket impreso/digital, duplicado, ticket regalo, factura simplificada/completa y abono/rectificativa. Emisión bloqueada hasta integrar Wix Invoices V1 y aprobar numeración/datos fiscales.
- Preparación de solicitud local de devolución con referencia, importe, medio y motivo.
- Secciones de reserva, pago y conciliación con sus responsabilidades nativas.
- No se crean reservas, órdenes, pagos, autorizaciones, reembolsos ni liquidaciones.

### Gift Cards
- Consulta nativa de saldo/estado con `giftVouchers.getGiftCard` desde `@wix/ecom`.
- El código se envía solo al WebMethod, se borra del input y no se registra ni se devuelve en claro.
- Emisión, canje, anulación y reembolso permanecen deshabilitados.

## 4. Contratos SDK verificados

### Wix Stores Catalog V3
- El sitio seleccionado confirma Wix Stores Catalog V3 instalado.
- Dependencia fijada en `@wix/stores@1.0.997`; `package.json` y `package-lock.json` están sincronizados, con las 34 dependencias transitivas requeridas.
- Se llama primero a `catalogVersioning.getCatalogVersion()`; los valores oficiales son `V1_CATALOG`, `V3_CATALOG` y `STORES_NOT_INSTALLED`.
- `productsV3.queryProducts` recupera productos visibles para POS con `CURRENCY`, `MIN_PRICE_VARIANT` y `PLAIN_DESCRIPTION`; usa `pagingMetadata.cursors.next` para paginar en bloques de hasta 100.
- `productsV3.getProduct` recupera las variantes con `VARIANT_OPTION_CHOICE_NAMES` y `CURRENCY`.
- El lector falla cerrado si la versión no es V3. El sitio seleccionado fue inspeccionado como V3; el resultado runtime todavía debe probarse en Preview.
- Scope documentado para Query/Get Product: `WIX_STORES.PRODUCT_READ`. No se solicitan los scopes de productos no visibles ni datos comerciales.

### Wix Gift Cards
- El sitio confirma Wix Gift Cards instalado.
- `@wix/ecom` ya estaba fijado en `1.0.2539`.
- `giftVouchers.getGiftCard(code)` se utiliza solo para lectura.
- Scope documentado: `ECOM.GIFT_CARD_READ`. Debe verificarse su disponibilidad efectiva en el contexto de ejecución del sitio.
- La consulta está conectada al HTML Component; emisión, canje y reembolso siguen bloqueados.

### Wix Bookings
- Servicios y profesionales se consultan mediante los módulos SDK ya usados por el proyecto.
- Los precios variables no se convierten en precios de venta fijos.
- La asignación final de staff/slot continúa perteneciendo a Wix Bookings.

## 5. Validación económica

Los importes se normalizan en unidades menores (céntimos). El impuesto no se infiere.

En pagos en efectivo, `importe` representa el efectivo recibido y `importeCambio` el cambio entregado. La cantidad aplicada a la venta es `importe - importeCambio`. El total de pagos divididos se reconcilia usando el importe aplicado, no el efectivo bruto recibido. El cambio solo se admite en efectivo.

La validación devuelve `isSynthetic: true`, `persisted: false` y `realPayment: false`. El cierre de borrador QA no constituye cobro.

## 6. Modelo de datos del informe y límites

El informe propone separar las entidades operativas:
- `TPV_Ventas`
- `TPV_VentaLineas`
- `TPV_Pagos`
- `TPV_Reembolsos`
- `TPV_MovimientosCaja`
- `TPV_SesionesCaja`
- `TPV_TicketX`
- `TPV_TicketZ`
- `TPV_Auditoria`

Estas colecciones no se han creado ni se escriben desde esta entrega. Antes de provisionarlas hay que cerrar los esquemas, índices, permisos, claves idempotentes, secuencias, concurrencia y retención.

**No se reutiliza `MovimientosCaja) como ledger operativo TPV.** En el proyecto y el sitio, `MovimientosCaja` tiene semántica de ledger fiscal canónico, con secuencia, hash, hash anterior y datos fiscales. El informe propone `TPV_MovimientosCaja` como entidad operativa separada; cualquier cambio exige contrato/ADR aprobado.

## 7. Bloqueos de seguridad y esquema en Wix live

1. `CajaActual` y `MovimientosCaja` devolvieron permiso de lectura `ANYONE`. `CajaActual` contiene importes operativos y datos de apertura/cierre. `MovimientosCaja` devolvió cero registros en la consulta revisada, pero su esquema admite NIF, direcciones, payload fiscal, hashes y firmas. Esto es un bloqueo P0: no activar escritores ni introducir nuevos datos fiscales hasta cerrar lectura pública y probar permisos por rol.
2. El esquema live de `CajaActual` incluye `cashRegisterStatus`, `cashAmount`, `cardAmount`, `bizumAmount`, `otherAmount`, `expectedCash`, `countedCash`, `sequenceCounters` y `ticketTotal), entre otros. No se confirmó `netAmount), aunque el backend actual conserva esa referencia y devuelve fallback cero. Debe reconciliarse antes de usar totales.
3. `bizumAmount` y `openingBizumAmount` sí existen en el esquema live. El método de caja actual deriva Bizum desde `sessionPayments.BIZUM.amount`; debe comprobarse que ambos campos representen el mismo periodo antes de usarlos como saldo definitivo.
4. `Permissions.SiteMember` no equivale a rol cajero. Los WebMethods usan `requireCajero()`; la lectura pública directa de CMS es un vector independiente y debe cerrarse.
5. La lectura Gift Cards y Stores requiere comprobar los scopes documentados y el acceso real en Preview.

## 8. Estado de sincronización

**Sincronizado:** archivos fuente y pruebas en la rama GitHub y PR #396.

**No sincronizado en Wix Editor:** el sitio es Editor clásico y Codegen no es elegible. La conexión Wix disponible permite inspeccionar contexto y APIs, pero no editar el contenido del HTML Component ni guardar el page code del Editor. La API de inventario confirma página/ID/ruta, no el árbol de componentes ni el código publicado.

Por tanto, no se afirma que `#htmlTPV` esté actualizado en el Editor. La aplicación del page code y del contenido HTML sigue siendo una operación de Editor pendiente. No se ha publicado ni desplegado esta rama en el sitio.

## 9. Validación y siguiente gate

Las pruebas offline verifican contratos y sintaxis, pero no sustituyen Preview/runtime.

Antes de activar escrituras o publicar:
1. Aplicar `src/pages/TPV.yl5th.js` y el contenido de `#htmlTPV.txt` en la página Wix `yl5th`; confirmar que el componente real se llama `#htmlTPV`.
2. Probar el handshake HTML ↔ Velo con cajero autorizado y miembro no autorizado.
3. Probar Bookings, Stores Catalog V3 y Gift Cards en runtime; verificar scopes.
4. Cerrar lectura pública de `CajaActual` y `MovimientosCaja`, probando anónimo, miembro ordinario y cajero.
5. Aprobar contratos de las nueve entidades TPV separadas y su relación con el ledger fiscal.
6. Diseñar idempotencia, concurrencia, secuencias, compensaciones y autorizaciones.
7. Habilitar por separado ventas, pagos, reembolsos, caja, X/Z y facturas, con pruebas de integración, reversión y autorización expresa.
