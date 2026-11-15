# TPV — integración con Wix nativo

## Entrega inicial

- `#htmlTPV.txt`: documento HTML completo para pegar en un elemento Wix HTML Component con ID `#htmlTPV`.
- `src/public/tpvPageController.js`: controlador frontend Velo y puente validado con `public/widgetBridge.js`.
- `src/backend/tests/tpv-widget.contract.test.mjs`: contrato estático de seguridad del widget/controlador.
- Página Wix sugerida: crear una página privada llamada TPV, añadir un HTML Component con ID `htmlTPV` y configurar su contenido con el documento HTML.

## Responsabilidades de las apps

| Capacidad | Fuente de verdad | Papel de la TPV |
|---|---|---|
| Servicios, staff, disponibilidad y reservas | Wix Bookings | Consultar; las mutaciones se delegarán en Bookings tras E2E aislado |
| Productos, variantes, precios e inventario | Wix Stores Catalog V3 | Consultar; no crear catálogo duplicado |
| Carrito, checkout e impuestos eCommerce | Wix eCommerce | Crear checkout mediante APIs oficiales, nunca registrar un pago ficticio |
| Pedidos y transacciones | Wix Orders / Order Transactions | Conciliar por IDs nativos; no duplicar pedidos |
| Captura y reembolso | Proveedor conectado / Wix Payments / Order Billing | No disponible en esta entrega; pasarela QA desconectada |
| Tarjetas regalo | Wix Gift Cards | Consultar y canjear mediante ciclo nativo cuando se implemente |
| Facturación | Wix Invoices + módulo fiscal propio | Relacionar invoice/order/transaction; no emitir desde la interfaz |
| Caja y ledger interno | `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ` | Solo lectura de caja; writers permanecen fail-closed |

Wix eCommerce define catálogo, carrito, checkout, pagos, pedidos y notificaciones como componentes relacionados. Bookings y Stores conectan sus catálogos al checkout eCommerce mediante integraciones nativas. La TPV no debe crear una segunda fuente de verdad.

## Integración actual

`initializeTpvPage($w("#htmlTPV"))` crea el bridge. El único WebMethod expuesto por esta entrega es `getCashierState()`, que ejecuta `requireCajero()` en backend. La UI y la conciliación de líneas/medios son borradores locales del iframe y no se persisten.

Para conectar la página, crea un archivo de página Velo con el ID real asignado por Wix y añade:

```js
import { initializeTpvPage } from "public/tpvPageController";

$w.onReady(() => {
    initializeTpvPage($w("#htmlTPV"));
});
```

No se incluye un `src/pages/TPV.<id>.js` inventado: el sufijo lo asigna Wix al crear la página.

## Gaps antes de habilitar operaciones

1. Resolver aislamiento de las siete automatizaciones preinstaladas activas y demostrar que las pruebas no producen comunicaciones ni efectos externos.
2. Verificar sincronización del código del repositorio con Wix Editor Classic.
3. Implementar lectores SDK de Wix Stores Catalog V3 y Wix Bookings usando las versiones instaladas y contratos oficiales; no consultar CMS espejo como sustituto.
4. Definir el flujo TPV de venta presencial: determinar si se crea un Wix Order manual o un checkout, cómo se representa el medio de pago presencial y cómo se reconcilia la transacción sin cobrar online.
5. Alinear métodos de pago reales con el contrato del writer: `PAYMENT_METHOD` vigente no admite `TARJETAS`, `OTROS` ni `OTROS_PENDIENTE`.
6. Corregir contrato de líneas/impuestos, cierre Z, apertura/arqueo y proyecciones de caja.
7. Diseñar idempotencia y vínculo entre `orderId`, `transactionId`, `paymentId`, `invoiceId` y `movementId`.
8. Mantener `LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false` y `STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false` hasta pruebas y aprobación explícita.

## Estado

La entrega es un frontend funcional como borrador local y consulta de caja autenticada. No es una TPV transaccional certificada. No crea ventas, reservas, pedidos, pagos, facturas, gift cards ni registros CMS.