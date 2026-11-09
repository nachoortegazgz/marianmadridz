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
