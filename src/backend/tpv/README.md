# TPV — backend, contratos y validación

**Estado de integración (2026-11-23):** código TPV integrado en main 956356db48ee9d0ba363023c14105474316f84dd. PR #541, PR #540 y PR #542 están merged. PR #537 se preservó en el historial de #541. **Release NO-GO:** falta Wix Preview/Runtime E2E y CI backend de main tiene un fallo contractual pendiente de corregir.

## Estado CI vigente

- Backend offline quality gates: FAIL, run 45105979742.
- Secret scanning: SUCCESS, run 45105979748.
- El único fallo localizado corresponde a una aserción de test obsoleta que esperaba cuatro medios de pago; el enum TPV_PAYMENT_METHOD define seis.
- PR #542 integró una primera corrección incompleta; PR #543 contiene la corrección completa. CI de PR #543 pasa en HEAD eee6d75e5cf843a38823e7fa4c908783db175208: 736/736 pruebas offline, npm audit 0, contratos SDK y ESLint SUCCESS; secret scanning SUCCESS. main conserva el fallo hasta integrar PR #543.

## Contrato TPV vigente

Las escrituras nuevas son sintéticas y versionadas. El ledger usa metadatos de origen sintético, siteId, schemaVersion/ledgerVersion, sessionId, fingerprint y huella/hash según el contrato de cada evento. La lectura legacy está acotada a rutas explícitas y no habilita nuevas escrituras legacy.

Métodos sintéticos canónicos:
- EFECTIVO
- TARJETA
- BIZUM
- BONO
- TARJETA_REGALO
- OTROS

La validación obtiene el enum desde internalConfig.js. La conciliación de sesión separa los seis importes y calcula efectivo esperado con el efectivo aplicado y los movimientos físicos. Las devoluciones conservan asignaciones por método original.

**Límite importante:** BONO y TARJETA_REGALO solo están soportados como medios sintéticos. No se ha acreditado consumo de saldo, integración transaccional Wix Gift Cards, reconocimiento de pasivo/consumo de bono ni conciliación con proveedor. No equivalen a una redención real.

## Límites de seguridad

- ALLOW_REAL_PAYMENTS permanece false.
- ALLOW_NATIVE_WRITES permanece false.
- La emisión fiscal y Veri*Factu permanecen deshabilitadas.
- La persistencia sintética no crea pedidos, recibos ni facturas nativas.
- Los ledgers son append-only; las correcciones son eventos rectificativos trazables.
- El frontend no es autoridad para identidad, permisos ni reglas de negocio.
- Los WebMethods resuelven actor y autorización en backend.
- No usar IDs de cliente/profesional suministrados por navegador como prueba de identidad o autorización.

## Estructura funcional

- tpvCaja.web.js: apertura/consulta de sesión.
- tpvVentas.web.js: validación y registro sintético de ventas/pagos.
- tpvMovimientos.web.js: entradas/salidas y lectura de movimientos.
- tpvDevoluciones.web.js: devoluciones sintéticas y asignaciones por medio.
- tpvCierres.web.js / tpvCierresCore.js: informes X/Z y conciliación.
- tpvRepository.js: acceso a ledger, idempotencia, locks y auditoría.
- tpvValidation.js: validación de venta y pagos.
- tpvOperatorContext.js / tpvContext.js: contexto autenticado.
- tpvPermisos.web.js: capacidades según rol backend.

## Aceptación pendiente

La matriz detallada y sus IDs de prueba están en [TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23](../../../docs/qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md). Requisitos principales:

1. Resolver el mapeo entre Staff sintético y resourceId Wix real.
2. Probar permisos por rol con identidades Wix distintas.
3. Probar apertura, venta, pagos mixtos, movimientos, devoluciones, X y Z en Preview.
4. Verificar idempotencia, retry, concurrencia y recuperación.
5. Conciliar CajaActual y ledger en CMS sin alterar históricos.
6. Probar aislamiento Sandbox/Online y denegación de efectos externos.
7. Verificar auditoría y exportaciones.
8. Obtener CI verde, diff revisado y sincronización Git-Wix antes de cualquier release.

No declarar TPV listo para producción ni ejecutar pagos/devoluciones reales durante QA.
