# Correlación de compensaciones con pedidos Wix — 2026-11-17

## Alcance

Revisión de solo lectura de los tres registros `ControlOperativo` con `controlType=COMPENSATION`, `kind=FISCAL_LEDGER` y `status=PENDING_RECOVERY`. Se consultaron Wix eCommerce Get Order, List Transactions For Single Order y Wix CMS CitasF2. No se modificaron registros ni se ejecutaron reintentos.

## Resultado

Los tres registros de compensación se corresponden con **dos pedidos Wix existentes**.

### Pedido A — servicio reembolsado

- Canal: `POS`.
- Creación: 2026-11-14.
- Una línea de servicio.
- Estado de pedido: `APPROVED`.
- Estado de pago: `FULLY_REFUNDED`.
- Transacción de pago: `REFUNDED`, importe 18,15 EUR.
- Wix registra una transacción de reembolso el 2026-11-16.
- Dos compensaciones distintas (webhook de pago y webhook de reembolso) apuntan al mismo pedido.
- La compensación del reembolso tiene `lastError=ORIGINAL_ORDER_LEDGER_MISSING` y `phase=WAIT_FOR_ORIGINAL_ORDER_LEDGER`.
- La compensación del webhook de pago sigue pendiente por política de writers deshabilitados.
- Existe una fila `CitasF2` asociada: `bookingStatus=CONFIRMED`, `paymentStatus=PENDING_LEDGER`, `totalAmount=0`.

### Pedido B — pedido mixto pagado

- Canal: `POS`.
- Creación: 2026-11-14.
- Tres líneas: dos productos físicos y un servicio.
- Estado de pedido: `APPROVED`.
- Estado de pago: `PAID`.
- Transacción de pago: `APPROVED`, importe 92,45 EUR, método `Cash`.
- Una compensación de pago está pendiente con `recoveryScope=UNSUPPORTED_ORDER_COMPOSITION` y `recoveryProcessor=MANUAL`.
- Existe una fila `CitasF2` asociada: `bookingStatus=CONFIRMED`, `paymentStatus=PENDING_LEDGER`, `totalAmount=0`.

### Impacto potencial en CajaActual

El pedido B está pagado por `Cash` (92,45 EUR) y fue creado después de la apertura de la sesión de caja actual. Sin embargo, el singleton live mantiene `cashAmount=300`, igual a `openingCashAmount=300`, `salesCount=0` y `MovimientosCaja=0`. Si el pedido representa una operación real, el cobro no está reflejado en el ledger ni en la proyección de caja. No se debe crear un movimiento para cuadrar el saldo sin confirmar antes el soporte del TPV/caja.

## Naturaleza QA vs. operación real

El propietario declara que el sitio es un entorno QA sin actividad comercial real y que los registros son sintéticos. Sin embargo, los pedidos:
- no presentan buyerNote ni customFields de prueba;
- usan el canal POS;
- contienen servicios/productos del catálogo real;
- tienen transacciones Wix de pago y reembolso registradas.

No se puede demostrar su sinteticidad solo con los datos disponibles. No se concluye que sean ventas reales; se clasifican como **operaciones potenciales no reconciliadas** hasta obtener confirmación documental del propietario/gestor.

## Riesgos

1. Marcar las compensaciones como completadas sin ledger fuente ocultaría la cadena de pago/reembolso.
2. Reintentar el evento de pago podría crear un movimiento fiscal duplicado si existiera una escritura parcial fuera de la colección consultada.
3. Reintentar el reembolso sin movimiento original podría producir una rectificación sin documento base.
4. El estado `CitasF2.PENDING_LEDGER` y `totalAmount=0` refleja una proyección incompleta, no una autorización para fabricar el importe.

## Decisiones y salvaguardas

- No se modificó `ControlOperativo`, `CitasF2`, `MovimientosCaja` ni ningún ledger.
- No se ejecutaron reintentos, reembolsos ni notificaciones.
- No se generaron movimientos/asientos ni se cerró la caja.
- Mantener `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false` y `ACCOUNTING_LEDGER_WRITES_ENABLED=false`.
- El propietario/gestor debe confirmar documentalmente si ambos pedidos POS y sus transacciones son fixtures de QA.
- Si no se puede acreditar su sinteticidad, tratar los hechos como operaciones potenciales y reconciliarlos con soporte transaccional y asesoría antes de cualquier registro rectificativo append-only.

## Estado

**P0 abierto.** Issue de seguimiento: [#416](https://github.com/nachoortegazgz/marianmadridz/issues/416). La cola de compensaciones y el singleton de caja no se consideran resueltos.
