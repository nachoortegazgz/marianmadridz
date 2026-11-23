# ADR-004 — Pasarela de pagos: Wix Payments

- **Estado:** Aceptada por decisión del propietario del sitio.
- **Fecha:** 2026-11-09.
- **Ámbito:** Checkout online, cobros vinculados a reservas, conciliación de pedidos, reembolsos y documentación de Capa 3.
- **Sitio:** Marian Madrid (`188bed94-177c-4bc9-a9f0-35080d874f3e`).

## Contexto

La documentación histórica contenía referencias contradictorias a un proveedor de pago externo. El código actual ya utiliza `PAYMENT_METHOD.WIX_PAYMENTS` como categoría canónica de cobro online en el ledger y en los flujos de caja/conciliación.

## Decisión

1. **Wix Payments es el proveedor de pagos online del sitio.** El checkout y la gestión de órdenes se integran mediante Wix eCommerce y las aplicaciones nativas de Wix.
2. La confirmación de un pago online procede del evento/estado nativo de Wix eCommerce; no se considera pagado por una redirección de navegador ni por una respuesta del frontend.
3. El backend valida el pedido y el conjunto de reservas antes de registrar el cobro en `MovimientosCaja`. El registro fiscal es append-only y cualquier rectificación se incorpora como un nuevo movimiento trazable.
4. `paymentMethod` es la clasificación de pago del ledger. No debe confundirse con el proveedor ni inventarse un nuevo campo de persistencia sin comprobar el esquema CMS.
5. Los datos PAN/CVV no se guardan en CMS, logs ni frontend propio.
6. Los métodos de pago disponibles se limitan a los que Wix Payments muestre habilitados para España y para esta cuenta. No se presume disponibilidad de Bizum en el checkout.
7. No se atribuye a Wix Payments reporte automático a AEAT ni exportación automatizada de extractos. Los informes/payouts y su traslado a Capa 3 se validarán por separado.
8. Los cobros presenciales registrados manualmente permanecen diferenciados de los pagos online procesados por Wix Payments.

## Evidencia y estado de verificación

- **Verificado en código:** `PAYMENT_METHOD.WIX_PAYMENTS` existe en `src/backend/internalConfig.js` y `src/public/mmUtils.js`; se usa en `src/backend/cajas.web.js`, `src/backend/events.js` y `src/backend/citasManager.web.js`.
- **Verificado en el contexto del sitio:** está instalada la aplicación Wix Forms & Payments; el sitio usa moneda EUR y país ES.
- **Declarado por el propietario:** Wix Payments es la pasarela elegida para el sitio.
- **Pendiente:** comprobar en el panel de pagos que la cuenta Wix Payments está activada/verificada, qué métodos concretos están habilitados y cómo se exportan los informes de transacciones y payouts.
- **Pendiente:** resolver mediante ADR/decisión de negocio la política de fianzas (umbral, importe y descuento en el ticket final). No implementar ni simular una política fiscal/monetaria no aprobada.

## Consecuencias

- Los dossiers y necesidades web deben describir Wix Payments como único proveedor de pago online.
- Las referencias a métodos concretos, Bizum, tarifas, payouts, reportes y exportaciones deben mantenerse condicionadas a la configuración real y a evidencia oficial.
- La prueba E2E debe simular los eventos de Wix eCommerce con mocks deterministas en entorno offline o ejecutarse en un sitio Wix QA aislado. No se realizarán cargos reales ni escrituras de prueba en CMS productivo.

## Fuentes oficiales Wix

- [About Wix Payments](https://support.wix.com/en/article/about-wix-payments)
- [Accepting Payments: An Overview](https://support.wix.com/en/article/accepting-payments-an-overview)
- [Wix eCommerce — Architecture & Data Flow](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/architecture-data-flow)
- [Wix eCommerce — Refund Payments](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-billing/refund-payments)