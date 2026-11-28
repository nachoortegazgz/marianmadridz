# TPV — flujos de éxito en Runtime y pruebas

**Fecha de consolidación:** 2026-11-28  
**Estado de ejecución:** auditoría CMS y de código completada; aceptación Wix Runtime E2E pendiente.  
**Sitio:** Marian Madrid · Wix Editor clásico + Velo · Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Estado Wix conocido:** Draft / no publicado.  
**Referencia de código:** rama `main` inspeccionada antes de esta actualización; este documento no afirma que el código esté instalado en Wix.

## 1. Regla única de operación

El TPV ejecuta el mismo código, contratos, validaciones, permisos, writers e idempotencia en desarrollo, pruebas y producción. No existen ramas funcionales por entorno ni un comportamiento alternativo para registros de prueba.

La única selección de un caso de prueba es la propia operación funcional: cliente de prueba acordado y fecha/periodo de prueba. No se deben añadir marcadores, flags, colecciones paralelas, prefijos de negocio ni filtros que hagan que el backend trate de forma distinta una venta o movimiento por ser una prueba.

Los registros previos a 2027 son de prueba por la directriz del proyecto y se eliminarán en el reinicio previo a la puesta en marcha. Ese reinicio es una tarea de preparación de datos, no una rama del runtime. No borrar históricos durante una batería ni modificar registros existentes para hacerlos pasar por pruebas.

No se ejecutan cobros bancarios, pagos externos, reembolsos, remesas fiscales ni comunicaciones reales durante la batería. Una venta pendiente no debe presentarse como cobrada. La selección de un medio de pago no equivale a confirmación del proveedor.

## 2. Estado actual verificado — 28-11-2026

### CMS

Última lectura de las colecciones del TPV:

| Colección | Registros observados | Lectura |
|---|---:|---|
| `CajaActual` | 1 | Proyección antigua; estado ABIERTA, sin `conceptOperations.tpvRuntime` canónico. No reutilizar como sesión nueva. |
| `MovimientosCaja` | 5 | Registros históricos; no acreditan una nueva batería del TPV actual. |
| `TransaccionesTPV` | 0 | No se observó ninguna intención comercial del TPV actual. |
| `ControlOperativo` | 90 | Auditoría/controles previos, incluidas evidencias QA anteriores. |
| `HistoricoCierresZ` | 1 | Cierre histórico; no equivale a un cierre de la sesión actual. |

Estos recuentos son una fotografía de la consulta, no una garantía de que permanezcan iguales.

### Código inspeccionado

- `abrirSesionCaja`: WebMethod de apertura; exige administrador, valida fondo inicial, sesión esperada y usa lock de sesión e idempotencia.
- `registrarVenta`: obtiene contexto de cajero autorizado, valida sesión, UUID idempotente y líneas de catálogo; revalida catálogo/precios en backend; crea intención comercial `PENDING_PAYMENT` en `TransaccionesTPV` y añade auditoría.
- `registrarMovimientoCaja`: valida operador, sesión, tipo ENTRADA/SALIDA/RETIRADA, efectivo, importe, motivo y clave idempotente; escribe movimiento y auditoría.
- `registrarArqueoParcial`: en el código inspeccionado exige administrador; calcula diferencia contra el resumen y exige motivo cuando hay descuadre.
- `generarTicketX`: exige administrador, sesión abierta y lock; compone resumen con ventas y movimientos de la sesión y registra el documento de control en la capa de auditoría.

La inspección de código no demuestra ejecución ni persistencia en Wix Runtime.

### Evidencia anterior de auditoría

Se había probado la persistencia CMS REST de registros de evidencia en `ControlOperativo` con lectura posterior y búsqueda por clave de deduplicación. Esa prueba acreditó el contrato REST de la colección, no la ejecución de los WebMethods Velo, ni el algoritmo de idempotencia del TPV.

## 3. Flujo de éxito — sesión de caja

**Precondiciones**
- Identidad Wix autenticada con rol administrador para la apertura actual.
- Caja singleton antigua revisada; no reutilizar la proyección ABIERTA como si fuese una sesión nueva.
- Fondo inicial numérico, no negativo y expresado en EUR.
- `expectedSessionId` obtenido del método de previsualización/contrato vigente, coincidente con la sesión del día.
- No existe cierre Z de esa sesión.

**Ejecución**
1. Consultar el estado de caja y obtener el `expectedSessionId`.
2. Invocar `abrirSesionCaja({ openingCash, expectedSessionId })`.
3. Esperar respuesta `SUCCESS`; conservar `sessionId`, `traceId` y datos de resultado.
4. Consultar de nuevo la sesión por los métodos de lectura del backend.
5. Leer CMS y correlacionar sesión, movimiento de apertura, proyección `CajaActual` y evento de auditoría.
6. Repetir exactamente la solicitud con la misma identidad idempotente, cuando el contrato lo permita: debe devolver el mismo resultado/replay sin duplicar registros.

**Criterio PASS**
- Una única sesión activa.
- Fondo de apertura y saldo inicial coherentes.
- Movimiento de apertura persistido una sola vez.
- Proyección de caja refleja la sesión abierta.
- Auditoría correlacionada por sesión y `traceId`.
- Ningún registro previo alterado.

## 4. Flujo de éxito — venta pendiente

**Precondiciones**
- Sesión abierta obtenida en el flujo anterior.
- Miembro autorizado como operador/cajero; no basta con estar autenticado como miembro.
- Producto/servicio y variante existentes en catálogo, con precio e impuestos resolubles en backend.
- Clave idempotente UUID v4 nueva.
- Datos del cliente de prueba acordado, sin inventar datos de contacto.

**Ejecución**
1. Seleccionar una línea válida de producto o servicio y cantidad entera positiva.
2. Invocar `registrarVenta` con `sessionId`, `idempotencyKey` y `lineas`. No declarar pago confirmado si no existe confirmación del proveedor.
3. Verificar respuesta y estado `PENDING_PAYMENT`.
4. Leer `TransaccionesTPV` por el identificador de transacción y verificar líneas, totales, impuestos, moneda, operador, sesión, huella de solicitud y selección de pago no confirmada.
5. Verificar evento de auditoría correlacionado.
6. Repetir con la misma clave y payload: debe devolver replay sin crear otra intención.
7. Reutilizar la misma clave con payload diferente: debe devolver conflicto y no sobrescribir la intención.

**Criterio PASS**
- Una intención comercial persistida, no un cobro.
- Importes recalculados en backend y coherentes con catálogo.
- `transactionId`/clave idempotente estable y sin duplicados.
- Estado de pago no confirmado hasta evidencia de proveedor.
- Auditoría presente o error parcial explícito con recuperación.

## 5. Flujo de éxito — movimientos y arqueo

**Movimiento de caja**
1. Con sesión abierta, invocar `registrarMovimientoCaja` con tipo permitido, efectivo, importe positivo, motivo de al menos tres caracteres, sesión activa y clave idempotente.
2. Verificar `SUCCESS`, identificador del movimiento y `traceId`.
3. Leer `MovimientosCaja`; comprobar tipo, importe en unidades menores, medio efectivo, sesión, operador, motivo, estado y metadatos de correlación.
4. Verificar la proyección de caja y el resumen de sesión.
5. Repetir idéntica solicitud: no debe duplicar el movimiento.

**Arqueo parcial**
1. Invocar `registrarArqueoParcial` con sesión activa, efectivo contado y clave idempotente.
2. Si la diferencia es distinta de cero, aportar motivo.
3. Verificar importe esperado, contado y diferencia; comprobar evento append-only y auditoría.
4. No corregir el saldo mediante edición directa de `CajaActual`; usar el movimiento correctivo autorizado.

**Criterio PASS**
- Ledger y proyección coherentes.
- No se alteran movimientos anteriores.
- Replay idempotente y concurrencia serializada.
- Diferencias justificadas y trazables.

## 6. Flujo de éxito — Ticket X y cierre

**Ticket X**
1. Requiere sesión abierta y rol autorizado por el WebMethod.
2. Invocar `generarTicketX({ sessionId })`.
3. Verificar totales calculados desde las ventas y movimientos de la sesión.
4. Comprobar registro del documento de control en `ControlOperativo`, con identificador, sesión, actor, fecha, resumen, versión y `traceId`.
5. Verificar que Ticket X no cierra la caja ni modifica los ledgers.

**Cierre Z**
- Se prueba después de completar la batería de ventas/movimientos.
- No ejecutar mientras se esté validando la sesión activa o se necesite seguir probando.
- Comprobar precondiciones, arqueo final, totales, diferencia, persistencia histórica e idempotencia.
- Una vez cerrado, la sesión no vuelve a aceptar operaciones. No simular un cierre mediante actualización directa CMS.

La generación de un registro Ticket X no acredita por sí sola la descarga, impresión física o PDF. Esos artefactos requieren una comprobación separada del mecanismo real de salida.

## 7. Matriz de pruebas reproducibles

| ID | Prueba | Resultado esperado |
|---|---|---|
| TPV-RT-01 | Abrir sesión con datos válidos | SUCCESS; sesión, apertura, proyección y auditoría coherentes |
| TPV-RT-02 | Repetir apertura con misma clave | Replay; cero duplicados |
| TPV-RT-03 | Abrir con sesión esperada obsoleta | Error estable; cero escrituras parciales |
| TPV-RT-04 | Miembro sin rol operador intenta venta | Rechazo de autorización; cero intención |
| TPV-RT-05 | Operador registra venta válida | Una intención PENDING_PAYMENT |
| TPV-RT-06 | Replay de venta idéntica | Misma transacción; cero duplicados |
| TPV-RT-07 | Misma clave con payload distinto | Conflicto idempotente; sin sobrescritura |
| TPV-RT-08 | Catálogo/precio no verificable | Error accionable; no crear intención |
| TPV-RT-09 | Entrada de efectivo válida | Movimiento + auditoría + proyección |
| TPV-RT-10 | Salida/retirada con motivo | Movimiento + autorización + auditoría |
| TPV-RT-11 | Movimiento con clave repetida | Replay; cero duplicados |
| TPV-RT-12 | Arqueo sin diferencia | Arqueo persistido; diferencia cero |
| TPV-RT-13 | Arqueo con diferencia sin motivo | Rechazo; cero escritura |
| TPV-RT-14 | Arqueo con diferencia y motivo | Registro trazable con diferencia |
| TPV-RT-15 | Ticket X | Documento de control; caja sigue abierta |
| TPV-RT-16 | Dos peticiones concurrentes | Una única operación ganadora o respuesta determinista |
| TPV-RT-17 | Timeout después de insert | Read-back y recuperación sin duplicar |
| TPV-RT-18 | Cierre Z válido | Histórico inmutable y sesión cerrada |
| TPV-RT-19 | Operación tras cierre | Rechazo estable; sin mutación |
| TPV-RT-20 | Read-back final | 100 % de registros esperados correlacionados |

## 8. Evidencia por ejecución

Guardar, sin secretos ni payloads personales completos:
- SHA exacto de código inspeccionado y fingerprint del código cargado en Wix.
- Site ID, UI version, URL/entorno Wix concreto, fecha/hora Europe/Madrid.
- Identidad/rol efectivo y WebMethod invocado.
- Clave idempotente, `transactionId`, `sessionId`, `traceId` y IDs CMS.
- Respuesta normalizada, resultado esperado/obtenido y read-back de cada colección.
- Estado de la proyección `CajaActual`, ledger `MovimientosCaja`, intención `TransaccionesTPV`, auditoría `ControlOperativo` e histórico si aplica.
- Efectos externos: cero pagos, cobros, reembolsos, remesas y notificaciones reales.

## 9. Niveles de aceptación — no confundir

- **ESTÁTICO:** código y contratos inspeccionados.
- **UNITARIO:** pruebas aisladas ejecutadas.
- **INTEGRACIÓN:** módulos y writers conectados en runner de pruebas.
- **CMS REST:** lectura/escritura REST directa acreditada; no equivale a WebMethod.
- **WIX PREVIEW:** código ejecutado en Preview con las limitaciones propias del Editor.
- **WIX RUNTIME E2E:** WebMethods reales invocados desde la UI/entorno Wix y persistencia leída de vuelta.
- **PRODUCCIÓN:** versión publicada y operación verificada; requiere autorización expresa.

No declarar PASS de un nivel por evidencia de otro nivel.

## 10. Pendientes concretos de esta auditoría

1. Acreditar vínculo Git Integration del Editor clásico con este repositorio y fingerprint/commit instalado.
2. Resolver la proyección heredada de `CajaActual` mediante el flujo canónico, sin reutilizarla ni editar CMS a mano.
3. Ejecutar TPV-RT-01…20 en Wix Local Editor/Preview según viabilidad real del sitio y limitaciones de cada método.
4. Probar roles de cajero/estilista: `registrarVenta` usa `getMyCajeroContext`; apertura, arqueo y Ticket X inspeccionados exigen administrador. Verificar la matriz de permisos en runtime.
5. Aclarar una divergencia de implementación: `registrarVenta` persiste `sourceType` desde `TPV_RUNTIME_POLICY`. La instrucción vigente del propietario prohíbe clasificar operaciones/datos por origen real/prueba; revisar consumidores y CMS antes de retirar el campo o cambiar contrato.
6. Verificar el documento Ticket X de extremo a extremo (registro, vista/descarga/impresión). No asumir PDF ni impresión por la mera existencia del evento.

**Resultado de esta consolidación:** documentación de éxito y batería reproducible actualizadas; no se ha ejecutado ningún WebMethod Velo en Runtime ni se han creado ventas/movimientos nuevos en el CMS durante esta auditoría.
