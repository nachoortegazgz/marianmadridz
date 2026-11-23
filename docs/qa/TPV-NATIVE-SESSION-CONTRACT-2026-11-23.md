# TPV — contrato de sesión y conciliación con Wix nativo

**Fecha:** 2026-11-23  
**PR:** #569  
**Estado:** implementación propuesta en rama; pendiente CI y Wix Preview/Runtime.  
**Entorno:** código sintético interno; sin pagos, devoluciones nativas, fiscalidad, notificaciones ni hardware.

## Objetivo

Separar la sesión operativa de caja de la simulación, el estado de pago y el estado de integración. La identidad del operador procede del contexto Wix autenticado en backend; el widget no puede establecer ni sobrescribir actor/operator IDs.

## Contrato de sesión

| Estado | Significado | Operaciones |
|---|---|---|
| ABIERTA | Existe una sesión abierta y no existe Ticket Z de cierre | Operaciones permitidas solo con el sessionId exacto |
| CERRADA | Existe Ticket Z cerrado para la sesión | Escrituras rechazadas con TPV_SESSION_CLOSED |
| SIN_SESION | No existe sesión proyectada | Apertura permitida; operaciones rechazadas |

El backend devuelve `operationalStatus`, `sessionId`, `operatorId`, `actorId`, `now` ISO-8601 y `timeZone=Europe/Madrid`. Cuando no existe sesión, el operador autenticado se informa por separado y `operatorId` de sesión permanece null.

## Estados independientes

- `operationalStatus`: ABIERTA / CERRADA / SIN_SESION.
- `integrationStatus`: NO_ENVIADO mientras no haya confirmación de integración Wix nativa.
- `simulationStatus`: SYNTHETIC para el flujo de QA.
- `paymentStatus`: SIMULATED_ONLY para ventas/devoluciones sintéticas; NOT_APPLICABLE para caja, arqueos y cierres.
- `realPayment=false`, `gatewayCalled=false` y flags de runtime permanecen desactivados.

No utilizar `isSynthetic`, `realPayment` o `integrationStatus` para inferir si la caja está abierta.

## Identidad

- `getMyStaffContext()` y `resolveTpvContext()` son la fuente backend de identidad autenticada.
- La apertura persiste operador/actor en el evento de sesión.
- La proyección de CajaActual conserva la identidad del opener.
- La lectura separa identidad del opener de la identidad autenticada del usuario que consulta.
- Los campos `operatorId` o `actorId` enviados por el navegador no son aceptados como autoridad.

## Aislamiento de sesión

Se exige `sessionId` en:
- venta sintética;
- devolución sintética;
- entrada/salida/retirada de efectivo;
- arqueo parcial;
- resumen;
- Ticket X y Ticket Z;
- consulta y exportación de movimientos;
- consulta y exportación de auditoría.

Las lecturas filtran por igualdad exacta de `sessionId`. Los registros históricos cerrados se muestran como CERRADA, no como ABIERTA. La idempotencia conserva su fingerprint y su clave por sesión.

## Hora local

El backend emite `now` como ISO UTC y `timeZone=Europe/Madrid`. El widget formatea la hora mediante `Intl.DateTimeFormat` con la zona recibida; no modifica ni elimina la marca ISO almacenada.

## Pruebas de contrato incorporadas

- Identidad autenticada backend y ausencia de autoridad de identidad del widget.
- Estados ABIERTA/CERRADA/SIN_SESION.
- sessionId obligatorio y rechazo de sesión cerrada.
- Consultas de movimientos y auditoría acotadas a sesión.
- Estados separados de operación, integración, simulación y pago.
- Zona horaria Europe/Madrid en la interfaz.
- Ausencia de la etiqueta engañosa SIMULATED_SUCCESS.

## Pruebas pendientes

- [ ] CI: npm ci, lint, suite completa, layer1 y layer2.
- [ ] Usuario no autenticado: rechazo real en Wix Preview.
- [ ] Usuario autenticado sin sesión: SIN_SESION.
- [ ] Apertura sintética: operador, actor, hora y sessionId persistidos.
- [ ] Venta en efectivo sintética: ledger vinculado a la sesión.
- [ ] Tarjeta sintética: no invoca Wix Payments ni gateway.
- [ ] Devolución sintética: movimiento negativo/allocations vinculados a la misma sesión.
- [ ] Arqueo parcial: no genera Ticket Z ni cierra sesión.
- [ ] Ticket Z: estado CERRADA.
- [ ] Operaciones posteriores a Z: TPV_SESSION_CLOSED.
- [ ] Consultas históricas: no mezclan sesiones.
- [ ] Repetición idempotente: no duplica escrituras.
- [ ] Notificaciones, pagos nativos, devoluciones nativas, emisión fiscal y hardware siguen desactivados.
- [ ] Verificar sincronización Git SHA ↔ Wix Draft.

## Restricciones

No se ejecutaron mutaciones CMS en esta intervención. No se ha sincronizado ni publicado Wix. No se han alterado ledgers históricos. Los pedidos POS #10032 y #10033 se consideran operaciones sintéticas según confirmación del titular; no se reescriben sus registros históricos. La integración con Wix Payments/Stores/Invoices continúa deshabilitada.
