# Revisión de diffs TPV y hardening neutral — 24/11/2026

## Baseline y alcance

- Repositorio: nachoortegazgz/marianmadridz.
- Base revisada: main en 7ffca8c4ceeea2af9be5bf0a697af15283ab214b.
- PR #600 ya está fusionada. El estado anterior de este documento en RELEASE-READINESS.md decía OPEN/DRAFT y queda corregido en esta intervención.
- Fuentes de propuesta revisadas: consolidación técnica de mejoras TPV compartida el 24/11/2026 y el prompt técnico de conciliación TPV PERSONAL compartido previamente.
- Alcance: revisión de contratos, módulos TPV, controlador, catálogo, repositorio, permisos, pruebas y documentación. Sin cambios en Wix CMS, datos históricos, pagos, pedidos, reservas ni publicación.

## Regla arquitectónica vinculante

Existe un único flujo operativo neutral. Los registros históricos sintéticos conservan sus metadatos y se consultan exclusivamente mediante compatibilidad histórica. No se crean nuevas ventas, pagos, devoluciones, movimientos o cierres sintéticos. Ningún marcador histórico puede cambiar reglas de negocio, permisos, estados o persistencia del flujo operativo.

No se han alterado, borrado, reescrito ni migrado registros TPV históricos.

## Resultado de la revisión de propuestas

| Módulo | Estado comprobado en main | Decisión |
|---|---|---|
| tpvVentas.web.js | validarVentaBorrador() valida el DTO. registrarVenta() sigue fail-closed por proveedor de pagos no configurado y no escribe en ledger. | No aplicar el diff que invoca confirmNativePayment, createNativeOrder, createInvoiceV1IfRequired o persistOperationalExtension: no son contratos acreditados ni APIs verificadas. |
| tpvDevoluciones.web.js | registrarDevolucion() es el WebMethod que consume el controlador y permanece fail-closed. | No implementar executeNativeRefund ni añadir alias por intuición. El reembolso depende del pedido/pago original y del proveedor. |
| tpvCatalogo.web.js | Usa Catalog V3, queryProducts y getProduct; obtiene precio actual de variante concreta y comprueba visibilidad y disponibilidad declarada. | Mantener Catalog V3 y los contratos itemId/varianteId. No sustituirlos por productId/variantId sin migrar consumidores. |
| Inventario | La disponibilidad leída desde la variante refleja el estado nativo de la ubicación predeterminada; no demuestra stock de una ubicación TPV concreta ni cantidad disponible. | No reintroducir catalogV3Adapter, proyecciones CMS ni inventario personalizado. El adaptador fue retirado en PR #238 por estar huérfano; el ADR de 10/11/2026 establece Wix Stores como única autoridad de stock. La ubicación física que debe usar el TPV no está acreditada en el contrato actual. |
| tpvPagos.web.js | Valida importes, cambio y conciliación matemática. No confirma movimiento de fondos. | No presentar validación matemática como cobro. La antigua Payments Transactions API está deprecada desde 30/09/2026; Wix indica que los pagos iniciados por servidor ya no están soportados. |
| tpvRepository.js | Ya contiene claves deterministas, fingerprint, recuperación de duplicados, locks, secuencia/hash y proyección. insertTpvEvent() falla cerrada porque el ledger operativo canónico no está configurado. | No crear TpvIdempotencias ni duplicar locks/auditoría. Mantener el guard hasta definir el ledger canónico. |
| Caja, movimientos y X/Z | Hay validaciones de sesión, locks, comprobaciones de operaciones pendientes y reconciliación. Los writers operativos siguen cerrados por configuración. | Conservar el código existente. No abrir escrituras para hacer pasar pruebas ni tratar la proyección de caja como confirmación de pago. |
| Invoices V1 / fiscal | No se ha acreditado integración de facturación TPV que devuelva identificadores y estados nativos. | No fabricar invoiceId, número, serie ni QR fiscal a partir de registros CMS. |
| Controlador y widget | El controlador consume los WebMethods propietarios y las capacidades de escritura permanecen falsas. | No mover reglas de negocio al frontend ni introducir flags de modo de entorno. |

## Contratos Wix relevantes comprobados

1. Payments Transactions API: Wix publicó la deprecación de Create/Get/Capture/Void-or-Refund Transaction el 30/09/2026. La documentación de Create Transaction declara que los pagos iniciados por servidor ya no están soportados. No se usará esta API para construir un cobro TPV nuevo.
2. Order Transactions API: registra pagos y reembolsos asociados a pedidos, pero añadir o actualizar un registro no mueve dinero. No equivale a confirmar un cobro.
3. Order Billing API: Refund Payments puede ejecutar reembolsos automáticos a través de proveedores compatibles o registrar reembolsos externos ya ejecutados fuera de Wix. Requiere un pedido y pagos relacionados; no resuelve por sí solo la captura de tarjeta presencial.
4. Inventory Items V3: expone stock por variante y ubicación. El estado de inventario del producto refleja la ubicación predeterminada. Sin el identificador de la ubicación física del salón y sin prueba de Runtime no se puede declarar que una variante está disponible para venta presencial.

Referencias oficiales:
- https://dev.wix.com/docs/changelog/
- https://dev.wix.com/docs/api-reference/business-management/payments/wix-payments-provider/transactions/create-transaction
- https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-transactions/introduction
- https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-billing/refund-payments
- https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/inventory-items-v3/query-inventory-items
- https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/about-inventory-management

## Corrección de código aplicada en esta rama

### src/backend/tpv/tpvUtils.js

makeTpvPayload() ahora:
- rechaza payloads nulos, arrays o no-objeto;
- rechaza metadatos operativos históricos o controlados por el caller: isSynthetic, realPayment, realPayments, processingMode, reconciliationStatus, sandboxRunId, legacyRunId, sourceType, ledgerVersion, schemaVersion y recordSource;
- genera los metadatos canónicos exclusivamente desde TPV_RUNTIME_POLICY y TPV_LEDGER_SOURCE.

Esto no cambia ni clasifica registros históricos. Su lector de compatibilidad permanece separado.

### src/backend/tests/tpv.qa.persistence.policy.test.mjs

Añadidas pruebas de rechazo para cada campo prohibido y para payloads con forma inválida. Se mantienen las pruebas existentes de política neutral, ledger histórico y append-only.

### docs/RELEASE-READINESS.md

Corregido el estado obsoleto de PR #600: MERGED, con merge commit y evidencias CI asociadas al head de código. Se mantiene NO-GO porque no hay evidencia Runtime.

## Bloqueos que permanecen abiertos

- Proveedor/terminal presencial y contrato verificable de captura de fondos.
- Relación nativa pedido-pago-recibo y tratamiento de pagos mixtos en efectivo/terminal.
- Contrato de reembolso del mismo medio original y conciliación de reembolsos externos.
- Identificador Wix de la ubicación física que debe usar el TPV, si se requiere inventario por ubicación.
- Contrato fiscal/factura/Veri*Factu aprobado y probado.
- Configuración CMS canónica del ledger operativo y pruebas de concurrencia/idempotencia contra Wix Runtime.

## Validación y despliegue

- CI inicial del head c7476636d18fc4e7c541f2964bafeb6afbbcf664: Layer 1 falló por una aserción estática obsoleta que prohibía mencionar los nombres de metadatos ahora rechazados. Se corrigió la prueba; no se relajó la validación.
- CI final del head 7badb94cc0e5dd1566f2f14cc611a3b7f6de9c69:
  - Backend offline quality gates SUCCESS, run 45448196443.
  - Layer 1: 29 suites / 363 pruebas, 0 fallos.
  - Layer 2: 17 suites / 249 pruebas, 0 fallos.
  - Suite offline completa: 80 suites / 747 pruebas, 0 fallos.
  - SDK eCommerce Cart V2, Order Transactions y TPV Catalog SDK: PASS.
  - ESLint: PASS.
  - Secret scanning / Gitleaks full-history SUCCESS, run 45448196393.
- Pruebas locales: no ejecutadas desde este entorno; la ejecución acreditada es GitHub Actions.
- Wix Preview/Runtime, CMS real, cobros, reembolsos, facturas y E2E: no ejecutados.
- CMS LIVE y datos históricos: sin cambios.
- Despliegue: NO-GO. PR #601 permanece OPEN / DRAFT; no fusionada ni publicada.
