# Revisión del informe consolidado de errores — 2026-11-09

## Alcance y baseline

- Repositorio: `nachoortegazgz/marianmadridz`.
- Baseline de esta intervención: `main` en `8abe9bf6aee215fadd9f41beec671c16ae44fb93`.
- Informe revisado: `INFORME-CONSOLIDADO-ERRORES-Y-CORRECCIONES.md`, adjunto a la conversación.
- Rama de corrección: `fix/widget-and-fiscal-reconciliation-2026-11-09`.
- PR: [#233](https://github.com/nachoortegazgz/marianmadridz/pull/233).

El informe adjunto contiene dos datos desalineados con el repositorio inspeccionado: el HEAD que cita (`740bff3`) no es el baseline actual y la afirmación de que el HTML del administrador no está versionado es incorrecta. Los archivos `#htmlAdmin.txt` y `#htmlOnlyStaff.txt` están en la raíz del repositorio y se han leído directamente.

## Hallazgos verificados y correcciones preparadas

| ID del informe | Hallazgo reproducido | Corrección en PR #233 | Estado |
|---|---|---|---|
| P0-01 / FIX-03 | El bridge de ZONA MARIAN usaba la allowlist por defecto del protocolo, por lo que rechazaba las solicitudes personalizadas de caja, cierre Z, fiscal y documentos. | Allowlist explícita para las seis operaciones activas y los mensajes READY/CONTEXT/NAV. Las operaciones ocultas/no implementadas no se habilitan. | CORREGIDO EN CÓDIGO; CI pendiente de la última revisión |
| UI-01 | `getCashierState` devuelve `netAmount`, `totalOperations` y `operationDate`; ambos HTML leían `saldoTotal`, `totalOperaciones` y `diaKey`. | Los dos HTML consumen el DTO real. | CORREGIDO |
| UI-02 | `#htmlOnlyStaff.txt` tenía una expresión ternaria de fecha con paréntesis desbalanceados; su JavaScript inline no compilaba. | Corregidas las dos expresiones de fecha y añadido parseo de todos los scripts HTML al test de contrato. | CORREGIDO |
| UI-03 | El fallback de staff mostraba controles sin contexto; flags con valor ausente se interpretaban como habilitados. | Contexto de staff exige `isAuthorized === true`; flags de jornada/caja solo se activan con `=== true`; fallback oculta paneles. | CORREGIDO |
| UI-04 | El fallback del administrador activaba funciones aunque no hubiera llegado el contexto de Velo. | Fallback deshabilita caja, fiscal, documentos, IA, personal e inventario y muestra aviso. | CORREGIDO |
| SEC-HTML | Los tickets de ambos widgets y el resumen de horas de staff interpolaban datos dinámicos mediante `innerHTML`. | Renderizado con nodos y `textContent`. | CORREGIDO |
| P0-02 / FIX-01 | `events.js` enviaba reembolsos con importe negativo y `eventLog.js` volvía a invertir el signo, pudiendo persistir `accountingAmount` positivo. | Normalizador único: reembolso/devolución siempre negativo, venta conserva signo positivo. | CORREGIDO EN CÓDIGO |
| P1 / FIX-06 | La cancelación de reserva emitía una rectificativa `RECT-*` sin `refundId`, pero el guard la validaba como un reembolso eCommerce. | Rama específica y restrictiva: solo `RECTIFICATIVA`, transactionId `RECT-*` y `previousInvoiceId`. El guard eCommerce `REFUND-*` se conserva. | CORREGIDO EN CÓDIGO |
| FIX-05 | Algunos productores persistían `linkedBookingIds` como CSV, aunque el contrato canónico es array. | Escritores de pedido y caja guardan arrays; lectura de reservas mantiene compatibilidad con CSV histórico; normalizador de EventLog separa CSV heredado. | CORREGIDO EN CÓDIGO |
| P0-06 parcial | El agregador fiscal sumaba bases/cuotas sin aplicar `accountingSign` y no mapeaba `WIX_PAYMENTS`/ `TRANSFERENCIA` a cubos. | Aplica signo contable y separa buckets `online` y `transferencia`. | CORREGIDO EN AGREGADOR; no en CajaActual/Z |

## Pruebas añadidas o ampliadas

- Parseo de los scripts inline de `#htmlAdmin.txt` y `#htmlOnlyStaff.txt`.
- Contratos de allowlist y handshake READY/CONTEXT/NAV.
- Contratos de fallback fail-closed y DTO de caja.
- Pruebas de signo, normalización de referencias y elegibilidad de rectificativas.
- Pruebas del agregador para devoluciones, WIX Payments y transferencias.
- Flujo offline de caja que comprueba que `linkedBookingIds` se persiste como array y se puede consultar por bookingId.

La ejecución CI más reciente debe consultarse en el PR; una ejecución anterior de esta rama alcanzó 51 suites y 487 tests, pero falló una aserción de contrato sobre flags fail-closed. Esa aserción se corrigió después; no se declara verde hasta que el último commit complete CI.

## Pendientes que NO se han corregido

| ID | Riesgo | Motivo para no aplicar un cambio parcial |
|---|---|---|
| P0-03 | `TRANSFERENCIA` no se proyecta en `CajaActual` ni se suma en el cierre Z. | El esquema actual no tiene un campo de transferencia separado. No se debe mezclar silenciosamente con `WIX_PAYMENTS`/otros ni inventar un campo CMS. Requiere decisión de esquema y migración controlada. |
| P0-04 | `CajaActual` puede acumular más de un periodo y no existe reconciliador completo contra `MovimientosCaja`. | No se resetea una proyección a ciegas. Hace falta definir periodo (día o apertura/cierre), tratamiento de movimientos tardíos y reconciliación idempotente antes de modificar saldos. |
| P0-05 | Recuperaciones fiscales de importes negativos pueden fallar al reintentar; la cola no conserva toda la referencia rectificativa necesaria. | Corregir solo `Math.abs` no basta: hay que preservar `previousInvoiceId`, tipo y motivo de rectificación a través de cola, cron y writer, y probar recuperación completa e idempotencia. |
| FIX-04 | `registerManualTransaction` permite ausencia de `transactionId` y genera `TX_<sequence>`. | No se fuerza hasta revisar todos los consumidores y definir claves estables para cobros parciales, devoluciones y reintentos. El POS staff sigue deshabilitado. |
| Staff POS | El HTML contiene acciones CLOCK, TPV_TX, X_COUNT e INVENTORY_*, pero ZONA STAFF no tiene handlers backend para ellas. | Se mantienen bloqueadas en la allowlist y los flags permanecen deshabilitados. No se habilita una UI que no escribe de forma segura en sus ledgers. |
| Admin gestor | El HTML contiene acciones de envío mensual/trimestral y específicas, pero la creación de snapshot está pendiente y el payload de periodo no es un `documentId`. | Se mantiene `enableAccountantSend=false`; no se habilita el envío hasta completar snapshot/versionado/idempotencia. |
| Cierre Z | El handler de ZONA MARIAN no aporta `approverUser`; el backend lo exige cuando los ajustes superan el umbral. | El backend falla cerrado. No se deriva una identidad de aprobador del navegador. |

## Seguridad de datos y despliegue

- No se han escrito ni actualizado registros CMS, reservas, pagos, inventario, Gift Cards, movimientos de caja ni ledgers.
- No se han cambiado esquemas CMS ni automatizaciones nativas.
- No se han ejecutado WebMethods en Wix Local Editor ni E2E publicados.
- No se ha desplegado ni publicado el código.
- Los cambios se limitan a la rama del PR #233 y requieren revisión y CI verde antes de merge.

## Orden recomendado para continuar

1. Resolver P0-04 con ADR de periodo de caja y reconciliador verificable.
2. Resolver P0-05 con contrato completo de recuperación rectificativa.
3. Decidir el esquema canónico de `TRANSFERENCIA` para CajaActual y Z.
4. Definir claves estables obligatorias para TPV antes de activar `TPV_TX`.
5. Implementar y probar WebMethods de staff; solo después habilitar sus flags y allowlist.
6. Completar snapshots de gestor y E2E de descarga/envío antes de activar el envío.
