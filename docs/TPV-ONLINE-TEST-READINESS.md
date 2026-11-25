# TPV — preparación para pruebas online con flujo único

**Estado:** PREPARACIÓN · No se han ejecutado escrituras online en esta revisión.  
**Fecha de consolidación:** 2026-11-25 · **Sitio:** Marian Madrid · **Site ID:** 188bed94-177c-4bc9-a9f0-35080d874f3e  
**Autoridad:** [TPV-UNIFIED-FLOW.md](TPV-UNIFIED-FLOW.md) · [Hito TPV-01](TPV-MILESTONE-01-UNIFIED-CORE.md) · [STATE-NOW](STATE-NOW.md)

## 1. Decisiones del propietario

1. Desarrollo y producción utilizan exactamente el mismo código, contratos, validaciones, writer y formato físico de registros. No se crea un runtime TPV paralelo.
2. La naturaleza del registro se determina temporalmente en backend: recordTimestamp UTC anterior a productionActivationAt UTC = SYNTHETIC; igual o posterior = REAL.
3. recordTimestamp lo genera el servidor; el navegador no puede elegir ni timestamp ni marca.
4. recordNature es una marca persistida de trazabilidad, derivada y no editable desde frontend. No cambia cálculos, validaciones, numeración, hash, idempotencia, locks ni ruta de persistencia.
5. El propietario declara que los registros actuales son datos de desarrollo y que las colecciones TPV están configuradas Online. Esta configuración debe comprobarse antes de la primera escritura online.
6. Durante desarrollo se permite modificar/resetear los datos sintéticos para preparar y repetir escenarios. Antes del inicio de actividad real se ejecutará un reset controlado y documentado.
7. Después de productionActivationAt no se modifican ni eliminan registros reales; los ledgers reales son append-only y las correcciones se hacen con nuevos registros rectificativos.
8. No se realizarán cobros reales, reembolsos bancarios, comunicaciones AEAT/VeriFactu ni efectos externos durante las pruebas sintéticas.

## 2. Estado Wix verificado

Read-back directo de Site Context el 2026-11-25 a las 17:53 CET:

- Sitio: Draft; Velo habilitado; Wix Editor; Premium.
- Zona: Europe/Madrid; moneda: EUR; país: ES.
- Apps: Wix Bookings, Wix Forms & Payments, Wix Gift Cards, Wix Payments, Wix Invoices V1 y Wix Stores Catalog V3.
- Sincronización Git-Wix: no verificada.
- Preview/Runtime: no ejecutado en esta revisión.

El estado Draft/Published es un estado técnico de Wix y no determina el instante de activación de actividad real. La configuración Online de las colecciones es una declaración del propietario; el selector individual por colección no está expuesto en la lectura API consultada. Antes de escribir, confirmar en CMS el destino efectivo de MovimientosCaja, CajaActual, ControlOperativo, HistoricoCierresZ y MapaStaff.

## 3. Estado del código y gates actuales

- main contiene la preparación de venta autoritativa read-only y el contrato de preescritura V1.
- El controlador principal y el runtime heredado todavía requieren migración al API operativo único; no asumir que el bridge de una PR abierta ya está integrado en main o sincronizado con Wix.
- tpvRepository.insertTpvEvent() y el writer físico siguen cerrados por guard/configuración.
- El builder no completa aún todos los campos físicos/fiscales obligatorios de MovimientosCaja.
- No se ha acreditado configuración fiscal canónica del emisor, series y numeración.
- El contrato V1 admite un único medio físico por venta: EFECTIVO o TARJETA; no se considera confirmación de cobro bancario.
- El ledger MovimientosCaja es la fuente canónica; no crear TransaccionesTPV.
- No se ha ejecutado prueba de escritura en Wix Runtime ni de concurrencia/idempotencia online.

**Resultado actual:** preparación de venta read-only; saleReady=false, paymentVerified=false, persisted=false. Release comercial NO-GO.

## 4. Contrato temporal pendiente de implementación

Antes de activar persistencia sintética online, auditar esquema CMS, hooks y configuración para definir dónde se guardan los siguientes valores, reutilizando campos existentes cuando proceda:

| Valor | Regla |
|---|---|
| recordTimestamp | UTC generado en backend al aceptar la operación |
| productionActivationAt | UTC único, server-side, fijado en el corte formal de actividad real |
| recordNature | SYNTHETIC si recordTimestamp < productionActivationAt; REAL en caso contrario |
| operación/expedición/periodo fiscal | Fechas independientes; no determinan recordNature |

No aceptar recordTimestamp, productionActivationAt ni recordNature desde el navegador. No derivar la marca del estado Published/Draft ni de un parámetro de entorno. No añadir colección nueva. La ubicación física final del campo recordNature y del corte queda PENDIENTE de auditoría del esquema actual.

Los registros sintéticos deben completar el mismo contrato físico que los reales, incluidos emisor de prueba, serie/número de prueba, fechas, base, tipo impositivo, cuota, total, staffResourceId, transactionId idempotente, secuencia, hash y previous hash. Los valores ficticios deben estar claramente identificados y nunca confundirse con identidad fiscal real. No remitirlos a AEAT ni utilizarlos para cobros reales.

## 5. Secuencia de pruebas online

No comenzar hasta que el controlador consuma el API único y el writer haya completado todos los campos requeridos. Ejecutar por lotes pequeños y comprobar persistencia después de cada etapa.

1. **Preflight read-only:** confirmar siteId, estado Wix, versión desplegada, Git-Wix sync, permisos, destino Online/Sandbox por colección, configuración de moneda/zona y ausencia de actividad real declarada.
2. **Contrato común:** verificar que frontend solo envía IDs, cantidades, método y contexto mínimo; backend resuelve catálogo, staff, importes, impuestos, fecha y marca.
3. **Caja:** apertura, sesión única, CAS, replay idempotente y rechazo de apertura concurrente.
4. **Venta sintética:** catálogo de servicio/producto habilitado, cálculo Wix, base/IVA/total, un medio EFECTIVO o TARJETA como dato de prueba, transactionId, sequenceNumber, hash y previousRecordHash.
5. **Movimientos:** entradas/salidas, arqueo, saldo y proyección CajaActual, verificando consistencia con MovimientosCaja.
6. **Devolución sintética:** relación obligatoria con venta original, importe acumulado no superior al original, motivo, idempotencia y asiento rectificativo trazable; no invocar proveedor bancario.
7. **Cierres:** cierre X/Z, conciliación de efectivo/tarjeta, totales por profesional y verificación de que los cierres enlazan con la sesión correcta.
8. **Fallos y recuperación:** doble envío, misma clave con payload distinto, timeout después de insert, error de proyección, lock expirado y reintento; demostrar que no hay duplicados ni pérdida de trazabilidad.
9. **Seguridad:** usuario no autorizado, staffResourceId ajeno, payload alterado, importes/tasas del cliente manipulados y llamada directa a WebMethod.
10. **Reset de desarrollo:** inventariar y exportar evidencia, confirmar naturaleza sintética de cada registro, limpiar datos y proyecciones de prueba, reinicializar secuencias/cadenas y comprobar estado inicial antes de la activación real.

## 6. Condiciones para empezar la primera escritura

- [ ] Controlador y HTML Component usan el API único operativo y se verifica el origen real del iframe.
- [ ] No queda ningún consumidor operativo del runtime separado; tests históricos migrados o aislados.
- [ ] Esquema físico de MovimientosCaja y hooks contrastados campo a campo.
- [ ] Configuración de emisor sintético y serie de prueba completa, válida para pruebas y claramente no real.
- [ ] Clasificación temporal backend implementada, persistida e inmutable.
- [ ] Writer completo con idempotencia durable, lock CAS, secuencia y hash-chain.
- [ ] Capacidad de cobro real y remisión AEAT permanecen desactivadas durante QA.
- [ ] Destino efectivo Online/Sandbox verificado para cada colección que se escribirá.
- [ ] CI offline y pruebas de contrato pasan en el SHA exacto.
- [ ] Plan de reset y exportación de evidencia probado en datos sintéticos.

## 7. Criterio de cierre

Una prueba se considera PASS solo con evidencia del registro persistido y su lectura posterior, el hash recalculado, la secuencia, la relación de devolución, la idempotencia y las proyecciones. Los logs del navegador o una respuesta WebMethod sin read-back CMS no acreditan persistencia.

La aceptación online no equivale a autorización de actividad comercial. Antes de productionActivationAt se exporta la evidencia, se verifica que todo el conjunto es sintético y se resetea. Tras el corte, cualquier modificación o eliminación de registros reales queda prohibida.

**Estado final de esta revisión:** preparado documentalmente para ejecutar el plan, pero NO preparado aún para la primera escritura online porque el writer, el contrato fiscal y el puente operativo único siguen pendientes de implementación y validación.
