# Relevo técnico — TPV y estabilización — 2026-11-23

**Repositorio:** nachoortegazgz/marianmadridz  
**main:** 0ba7b684d6f4d6465718ae4317d10d8f422de2ff  
**PR #541:** integrada en main. **PR #540 y #542:** integradas. **PR #543:** integrada en main mediante 0ba7b684d6f4d6465718ae4317d10d8f422de2ff. **PR #537:** preservada en el historial de #541.
**PR #540:** integrada. **PR #542:** integrada y generó el HEAD actual 0ba7b684d6f4d6465718ae4317d10d8f422de2ff.  
**PR #537:** preservada en el historial de #541 mediante merge commit 1bd1e2d02a741cc4ebad883524f3652ed6aa905b.  
**Rama de estabilización:** chore/phase1-repository-stabilization-20261123.  
**Release:** **NO-GO**.

## Estado técnico

La integración TPV está en main, pero el sistema no está aceptado en Wix Runtime. No se ha demostrado la sincronización del SHA Git con Wix Editor ni se han ejecutado los flujos E2E en Preview.

El backend TPV mantiene escritura sintética con políticas que impiden pagos reales y escrituras nativas/fiscales. Los registros sintéticos no equivalen a pedidos, recibos o facturas nativas Wix.

## Contrato de pagos

El enum centralizado TPV_PAYMENT_METHOD contiene seis valores: EFECTIVO, TARJETA, BIZUM, BONO, TARJETA_REGALO y OTROS. El validador usa Object.values(TPV_PAYMENT_METHOD); ventas, devoluciones y resumen de sesión referencian el enum.

BONO y TARJETA_REGALO están aceptados como medios sintéticos y se reflejan por separado en el resumen. No se ha acreditado consumo de saldo Wix Gift Cards, pasivo contable, captura de valor ni integración con proveedor. No describirlos como canje real.

## Estado CI en main

- Backend offline quality gates: FAIL, run 45105979742.
- Secret scanning: SUCCESS, run 45105979748.
- El fallo inicial estaba en la prueba contractual TPV que esperaba una lista fija de cuatro métodos, obsoleta frente al enum centralizado de seis. La corrección inicial se integró por PR #542, pero el test continuó fallando por aserciones literales/escape incorrectas; PR #543 corrige el contrato completo.
- PR #543 pasó CI pre-merge: Layer 1 364/364, Layer 2 255/255, suite offline 736/736, npm audit 0, SDK contracts y ESLint SUCCESS; Secret scanning SUCCESS. Está integrada en main. Backend post-merge run 45107058637 en curso y secret scanning 45107058755 SUCCESS.

## Cambios de TPV ya integrados

- Selección de cliente sintético con validación backend.
- Identidad del actor obtenida desde miembro Wix autenticado; profesional seleccionado no debe confundirse con actor/autorización.
- Lectura legacy explícita y escrituras nuevas con metadatos sintéticos versionados.
- Idempotencia de operaciones, locks por sesión/venta y flujos de apertura, venta, movimientos, devoluciones y X/Z.
- Exportaciones con autorización backend y auditoría.
- Writers de pago real, escritura nativa y emisión fiscal deshabilitados.

## Gates Runtime pendientes

1. Mapear identidad Staff sintética con resourceId real de Wix Bookings y rechazar mismatch.
2. Verificar roles y permisos efectivos con cuentas de prueba.
3. Apertura → venta → pagos mixtos → movimientos → devolución → X → Z → cierre.
4. Concurrencia, retry, replay e idempotencia de sesión, venta, devolución y cierre.
5. Conciliación de CajaActual y ledger bajo CMS real.
6. Aislamiento Sandbox/Online y prueba negativa de efectos en Published.
7. Verificar historial, exportaciones, impresión y denegaciones auditadas.
8. No activar pagos nativos ni fiscalidad hasta completar sus gates y autorizaciones.

## Seguridad y límites

- No borrar ni sobrescribir ledgers append-only.
- No modificar CajaActual ni compensaciones por inferencia.
- No realizar pagos, reembolsos, facturas ni comunicaciones reales.
- No considerar un test offline como evidencia de runtime.
- No publicar ni desplegar hasta CI verde, E2E, diff revisado, rollback y autorización.

## Referencias

- [Aceptación TPV](TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md)
- [Backlog reconciliado](BACKLOG-RECONCILIATION-2026-11-23.md)
- [Auditoría Wix TPV](2026-11-23-tpv-wix-audit-validation.md)
- [README técnico TPV](../../src/backend/tpv/README.md)
