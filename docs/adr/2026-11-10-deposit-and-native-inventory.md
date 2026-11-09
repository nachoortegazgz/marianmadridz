# ADR — Política de fianzas y gestión nativa de inventario

- **Fecha:** 2026-11-10
- **Estado:** Aprobado como criterio funcional; implementación pendiente de diseño y QA
- **Ámbito:** reservas online y stock de Wix Stores

## Decisiones aprobadas

### Fianzas de reservas

- Exigir fianza únicamente cuando el precio del servicio sea **estrictamente superior a 100 EUR**.
- El importe será fijo: **15 EUR**.
- Para servicios de precio igual o inferior a 100 EUR no habrá fianza obligatoria.
- La fianza se descontará del importe final del servicio.
- El depósito forma parte del precio del servicio y el cliente paga solo el saldo pendiente en persona.
- Cancelación/reprogramación gratuita con al menos 24 horas; si cancela el negocio, devolución íntegra.
- No retener automáticamente el depósito por cancelación tardía o inasistencia hasta disponer de condiciones transparentes y revisión jurídica de proporcionalidad. No se presupone que una cláusula de no reembolso sea válida.
- La contabilización fiscal del depósito, su saldo y las devoluciones debe quedar definida con asesoría antes de activar cobros. No se habilitarán cobros reales durante QA.
- La configuración nativa de depósitos en Wix Bookings es la primera opción. Wix Help indica que el depósito se cobra online y el saldo en persona; advierte que la función no está disponible para todas las cuentas, que no se combina con aprobación manual y que el método manual puede evitar el depósito. Sin embargo, el esquema REST Services V2 actual describe `payment.options.deposit=true` con `online=true` y `inPerson=false`. Esta discrepancia debe resolverse antes de configurar servicios o desarrollar código. La consulta live muestra que actualmente no hay depósitos habilitados.

### Inventario

- Wix Stores Catalog V3 y sus funciones nativas serán la única autoridad operativa para cantidades, reservas, disponibilidad y efectos de stock derivados de checkout/reembolso.
- No se añadirá lógica personalizada para administrar, reservar, descontar, reponer o sincronizar cantidades de inventario. Los webhooks deben conservar su responsabilidad fiscal y de pedidos sin depender de esa capa de stock.
- No se duplicarán en CMS los saldos nativos ni se crearán movimientos personalizados que pretendan gobernar el stock.
- Los módulos personalizados de inventario que ya existan quedan **pendientes de auditoría de consumidores, contratos y dependencias**. No se eliminan en este ADR: cualquier retirada requiere búsqueda completa de referencias, análisis de efectos colaterales, pruebas y PR separado.
- La contabilidad/fiscalidad de ventas debe seguir registrando los hechos económicos que correspondan, sin convertir un ledger financiero en un segundo sistema de stock.

## Decisiones técnicas derivadas y criterios de implementación

1. **Depósitos:** preferir la configuración nativa de Wix Bookings por servicio; no implementar `createDepositPaymentOrder` ni un writer propio hasta demostrar que la API/UX nativa no cubre el umbral o el caso de precio variable. No combinar depósitos con aprobación manual. No ofrecer pago manual a clientes de servicios sujetos a depósito, porque Wix documenta que la ruta manual no cobra depósito.
2. **Umbral:** `price > 10000` en unidad monetaria menor (céntimos) si el backend llegara a validar el criterio; evitar comparaciones de punto flotante. La configuración nativa sigue siendo preferente y debe reconciliarse con el catálogo de servicios.
3. **Precio variable:** clasificar cada variante. Si un servicio contiene variantes a ambos lados del umbral y Wix solo permite un importe de depósito común para el servicio, separar variantes/servicios en la configuración nativa antes de considerar código custom.
4. **Cancelaciones:** 24 horas de preaviso como ventana gratuita. No activar retención automática tardía/no-show sin revisión jurídica; reembolso por cancelación del negocio íntegro. Reprogramación y refund deben ser idempotentes y reconciliar el pago nativo.
5. **Inventario:** retirar la capa custom por fases: primero quitar la dependencia de webhooks y UI, luego eliminar código no referenciado tras búsqueda completa y pruebas. No crear ni reparar `InventarioStockVenta`.
6. **Históricos:** `MovimientosInventario` se considera histórico append-only; no insertar nuevos movimientos personalizados, editar, borrar ni purgar filas existentes. Cualquier política de archivo requiere ADR separado.
7. **Pruebas:** cubrir precios 100.00/100.01, fijo/variable, depósito correcto, saldo restante, pago fallido, reintentos, cancelación a 24h exactas/antes/después, cancelación por negocio, refund y duplicación de webhooks. QA con datos sintéticos y sin cargos reales.

## Evidencia live de Wix (solo lectura, 2026-11-10)

- eCommerce Orders Settings: HTTP 200; `inventoryUpdateTrigger=ON_ORDER_PAID`; `createInvoice=false`. No se actualizó configuración.
- Bookings Services V2: 94 servicios; 70 `FIXED`, 24 `NO_FEE`, 0 `VARIED`; siete servicios visibles superan 100 EUR y cero servicios tienen depósito activo.
- Servicios elegibles (>100 EUR): Pack Corte + Mechas (115 EUR), Recogido Exclusivo Novias (150 EUR), Rescate Express para Cabello Dañado (125 EUR), Pack Transformación Total (185 EUR), Terapia de Alisado Espejo Premium (195 EUR), Pack Novia Completo (290 EUR) y Alisado Espejo Premium (195 EUR).

## Impacto sobre el estado actual

- RF-06 sustituye el criterio anterior (>30 EUR y 15 EUR/20%) y resuelve la contradicción con el criterio documental de 30% para >50 EUR.
- El flujo de fianzas no está implementado (`createDepositPaymentOrder` y `bookingsEngine.web.js` no existen según la auditoría disponible).
- En el baseline anterior existían adaptadores y proyecciones custom; la rama `refactor/native-wix-inventory-only-2026-11-10` los elimina, junto con sus WebMethods y UI, después de desacoplar los webhooks. Pendiente CI y QA Wix.
- Las auditorías anteriores que describen `InventarioStockVenta`, `MovimientosInventario` o el bloqueo por falta de maestros CMS quedan como evidencia histórica del código existente, no como autorización para ampliar esa arquitectura.

## Fuentes de autoridad y referencias

- Wix Services V2 API schema: `payment.options.deposit` requiere online y actualmente declara `inPerson=false` cuando está activo; `fixed.deposit` / `varied.deposit` forman parte del objeto de servicio.

- Wix Bookings — depósitos y pagos: https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/about-service-payments
- Wix Help — depósitos y saldo presencial: https://support.wix.com/es/article/wix-bookings-seleccionar-c%C3%B3mo-cobrar-los-servicios-de-reservas
- Wix Help — limitación de depósitos porcentuales (solo importes fijos): https://support.wix.com/es/article/solicitud-de-wix-bookings-dep%C3%B3sitos-basados-en-porcentajes
- Wix Stores — compra y deducción automática de inventario: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/online-store-product-purchase-flow
- Wix Stores — modelo nativo de inventario: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/about-inventory-management
- BOE, TRLGDCU arts. 62 y 82: https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555
- Código Civil arts. 1152–1155 y 1255: https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763
- Referencias comerciales comparables (no normativas): https://adaraessenceestetica.com/wp-content/uploads/2025/06/Carta-NUEVA-CAST.pdf ; https://www.beassence.es/politicas

## Estado de implementación en PR #239

- `inventario.web.js`, su suite de writer, `INVENTORY_CONFIG`, `validateInventoryOrderLine`, acciones admin y panel staff eliminados y fusionados mediante PR #238.
- Webhooks eCommerce y cron desacoplados de stock CMS; se mantiene ledger fiscal, idempotencia y hooks append-only históricos.
- CI run 42721311048: 50 suites/488 tests, SDK eCommerce Cart V2 y Bookings Reader V2 y ESLint en verde para commit `94974c254644594e76fc717278098a2968073028`.
- PR #240 corrige el valor semántico del marcador de autoridad de catálogo (`WIX_STORES_NATIVE` → `WIX_CATALOG_OWNER`); CI pendiente.
- QA Wix runtime de venta/cancelación/reembolso pendiente; no desplegar hasta completarlo.
- Informe: `docs/qa/2026-11-10-native-inventory-retirement.md`.

## Límites de ejecución

- Este ADR no autoriza cambios en Wix CMS, stock, productos, reservas, pagos ni configuración publicada.
- No autoriza desplegar, activar cobros ni enviar comunicaciones a clientes.
- Toda implementación futura debe probarse en QA con datos sintéticos y sin cargos reales.

## Auditoría inicial de consumidores del inventario personalizado

Lectura estática del `main` auditado el 2026-11-10:

- `src/backend/events.js` importa y llama a `reserveOrderInventoryInternal` en `wixEcom_onOrderCreated`, `releaseOrderInventoryInternal` en `wixEcom_onOrderCanceled`, `syncPaidOrderInventoryInternal` en el flujo de pago y `syncRestockedOrderInventoryInternal` en el webhook de reembolso.
- En el baseline previo, `src/backend/inventario.web.js` mantenía proyecciones CMS, reservas y ajustes manuales. Se ha eliminado en la rama de refactorización.
- `src/pages/ZONA MARIAN.gn7mx.js` expone el panel y acciones de candidatos, alta de maestros, movimientos, conciliación y reparaciones; `enableInventory` está activo en el contexto entregado al widget.
- `#htmlOnlyStaff.txt` lee `enableInventory` para mostrar la funcionalidad.
- La búsqueda inicial encontró como consumidores directos `events.js`, la página de administración y la suite offline. Se han retirado esos imports/llamadas y la suite específica. La búsqueda final de referencias y CI deben confirmar cero consumidores.

**Riesgo de retirada:** `events.js` trata errores de reserva/liberación/proyección como fallos del webhook y puede lanzar excepciones/reintentos. Por tanto, eliminar imports o llamadas sin rediseñar esos handlers podría afectar la finalización de webhooks eCommerce aunque Wix gestione ya el stock nativo. El ajuste manual actual también escribe directamente en stock nativo y debe desaparecer de la UI personalizada si la operación se delega por completo en Wix.

**Plan de validación de la retirada:** (1) búsqueda final de consumidores estáticos/dinámicos; (2) ejecutar suites de pedidos, pagos, cancelaciones, reembolsos y cron; (3) confirmar que no se escriben `InventarioStockVenta`/`MovimientosInventario`; (4) Wix QA/Local Editor: verificar venta, cancelación y devolución/restock nativos; (5) confirmar que el ledger fiscal sigue registrando ventas y rectificaciones; (6) revisar diff, CI y rollback antes de merge/publicación. Las colecciones históricas no se borran ni mutan.
