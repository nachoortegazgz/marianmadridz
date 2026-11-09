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
- La política de cancelación, devolución/retención, conciliación con el pago final y representación fiscal debe quedar definida en el contrato técnico antes de implementar o activar el cobro. No se habilitarán cobros reales durante QA.

### Inventario

- Wix Stores Catalog V3 y sus funciones nativas serán la única autoridad operativa para cantidades, reservas, disponibilidad y efectos de stock derivados de checkout/reembolso.
- No se añadirá lógica personalizada para administrar, reservar, descontar, reponer o sincronizar cantidades de inventario.
- No se duplicarán en CMS los saldos nativos ni se crearán movimientos personalizados que pretendan gobernar el stock.
- Los módulos personalizados de inventario que ya existan quedan **pendientes de auditoría de consumidores, contratos y dependencias**. No se eliminan en este ADR: cualquier retirada requiere búsqueda completa de referencias, análisis de efectos colaterales, pruebas y PR separado.
- La contabilidad/fiscalidad de ventas debe seguir registrando los hechos económicos que correspondan, sin convertir un ledger financiero en un segundo sistema de stock.

## Impacto sobre el estado actual

- RF-06 sustituye el criterio anterior (>30 EUR y 15 EUR/20%) y resuelve la contradicción con el criterio documental de 30% para >50 EUR.
- El flujo de fianzas no está implementado (`createDepositPaymentOrder` y `bookingsEngine.web.js` no existen según la auditoría disponible).
- El repositorio contiene adaptadores y proyecciones de inventario personalizados. Su estado no se considera automáticamente alineado con esta decisión; requieren revisión antes de cualquier retirada.
- Las auditorías anteriores que describen `InventarioStockVenta`, `MovimientosInventario` o el bloqueo por falta de maestros CMS quedan como evidencia histórica del código existente, no como autorización para ampliar esa arquitectura.

## Límites de ejecución

- Este ADR no autoriza cambios en Wix CMS, stock, productos, reservas, pagos ni configuración publicada.
- No autoriza desplegar, activar cobros ni enviar comunicaciones a clientes.
- Toda implementación futura debe probarse en QA con datos sintéticos y sin cargos reales.

## Auditoría inicial de consumidores del inventario personalizado

Lectura estática del `main` auditado el 2026-11-10:

- `src/backend/events.js` importa y llama a `reserveOrderInventoryInternal` en `wixEcom_onOrderCreated`, `releaseOrderInventoryInternal` en `wixEcom_onOrderCanceled`, `syncPaidOrderInventoryInternal` en el flujo de pago y `syncRestockedOrderInventoryInternal` en el webhook de reembolso.
- `src/backend/inventario.web.js` mantiene proyecciones CMS, reservas internas, colas de reparación y un WebMethod de ajuste manual que invoca `inventoryItemsV3.bulkIncrementInventoryItems` / `bulkDecrementInventoryItems`.
- `src/pages/ZONA MARIAN.gn7mx.js` expone el panel y acciones de candidatos, alta de maestros, movimientos, conciliación y reparaciones; `enableInventory` está activo en el contexto entregado al widget.
- `#htmlOnlyStaff.txt` lee `enableInventory` para mostrar la funcionalidad.
- La búsqueda del repositorio encuentra como consumidores directos de `backend/inventario.web.js` `events.js`, la página de administración y su suite offline. La búsqueda no sustituye una búsqueda local exhaustiva en todo el árbol ni revisión de referencias dinámicas.

**Riesgo de retirada:** `events.js` trata errores de reserva/liberación/proyección como fallos del webhook y puede lanzar excepciones/reintentos. Por tanto, eliminar imports o llamadas sin rediseñar esos handlers podría afectar la finalización de webhooks eCommerce aunque Wix gestione ya el stock nativo. El ajuste manual actual también escribe directamente en stock nativo y debe desaparecer de la UI personalizada si la operación se delega por completo en Wix.

**Plan obligatorio antes de retirar:** (1) inventariar todos los consumidores estáticos y dinámicos; (2) separar los efectos fiscales/contables de los efectos de stock; (3) eliminar las reservas/proyecciones CMS de los handlers sin alterar la idempotencia fiscal ni el procesamiento de pagos/reembolsos; (4) retirar el panel y sus WebMethods de inventario; (5) decidir por separado el destino de colecciones CMS históricas, sin borrar ni mutar `MovimientosInventario`; (6) ejecutar suites de pedidos, pagos, cancelaciones y reembolsos; (7) probar en Wix QA/Local Editor que Wix mantiene reservas y stock nativos; (8) preparar rollback y publicar solo con aprobación.
