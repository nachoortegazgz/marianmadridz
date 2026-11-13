# ADR — Sesión operativa de CajaActual y autorización de apertura/cierre

- **Estado:** PROPUESTA TÉCNICA — pendiente de aprobación de implementación
- **Fecha:** 2026-11-11
- **Repositorio base:** `main` en `0acbca199966234e24d319a9b575bcc115762f1c`
- **Ámbito:** Capa 1 (Wix Velo + Wix CMS)
- **Prioridad:** P1 — caja, concurrencia e integridad de registros
- **Decisión de autorización del negocio:** Andrea STAFF y Alba STAFF pueden abrir y cerrar la caja. Esta autorización no les concede por sí misma permisos de ADMIN/GESTION ni autorización para registrar cobros, devoluciones, pagos o ajustes.

## 1. Objetivo

Definir el contrato seguro para convertir `CajaActual` en una proyección operativa gobernada por sesiones explícitas de apertura/cierre, sin alterar registros históricos, sin permitir que movimientos creen sesiones implícitamente y sin ampliar permisos fiscales fuera de lo autorizado.

## 2. Evidencia verificada en el código base

| Archivo | Evidencia | Consecuencia |
|---|---|---|
| `src/backend/security.js` | `isCajero()` solo acepta `ADMIN` o `GESTION`; la identidad se resuelve desde el miembro autenticado y el Contact ID, y luego desde el staff canónico. | Andrea y Alba (rolWebsite `ESTILISTA`) no pasan el guard actual. No debe ampliarse `requireCajero()` globalmente. |
| `src/backend/internalConfig.js` | `CASH_REGISTER_STATUS` solo contiene `ABIERTA` y `CERRADA`. Los IDs de Andrea y Alba están presentes en `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID`. | La autorización nueva debe ser una capacidad específica por identidad, no una elevación de rol global ni una autorización por email. |
| `src/backend/cajas.web.js` | `_updateCajaActual()` crea un singleton nuevo con estado `ABIERTA` si no existe. | Contradice la apertura manual. Debe eliminarse únicamente después de revisar todos los consumidores y definir el comportamiento de movimientos ONLINE. |
| `src/backend/cajas.web.js` | `registerManualTransaction` exige `requireCajero()`. | Los permisos de cobro siguen restringidos a ADMIN/GESTION. La autorización de abrir/cerrar no los modifica. |
| `src/backend/cajas.web.js` | `getCashierState` exige `requireCajero()`. | Debe admitir la lectura operativa a los operadores de sesión autorizados, sin exponer datos fiscales/administrativos adicionales. |
| `src/backend/cajas.web.js` | `_registerZClosing` usa el lock fiscal, crea `HistoricoCierresZ` y después actualiza `CajaActual` a `CERRADA`; no persiste `closedBy`. | La identidad del responsable debe obtenerse en backend y persistirse como parte del nuevo registro, no recibirse como autoridad desde el frontend. |
| `src/backend/cajas.web.js` | El registro Z contiene totales de cobros por método de pago, hashes, secuencias y `closedAt`, pero no contiene efectivo físico contado ni diferencia de arqueo. | El total de pagos en efectivo no equivale al efectivo físico existente al cierre. No puede usarse como saldo de apertura siguiente. |
| `src/backend/crons.js` | `verifyNightlyZClosing` ejecuta `registerZClosingInternal` como cierre nocturno de sistema. | El cierre manual y el cron deben compartir idempotencia y lock. Debe definirse precedencia: un Z manual ya persistido hace que el cron sea no-op idempotente; un cierre de sistema previo impide cierre manual posterior. |
| `src/backend/internalConfig.js` | `MOVEMENT_TYPE` no contiene `APORTACION` ni `RETIRO`. | La documentación de esos tipos no coincide con el enum operativo. No se deben emitir dichos movimientos hasta definir el contrato fiscal/contable y sus pruebas. |
| `src/pages/ZONA STAFF.mvf3f.js` | Los handlers de caja no están conectados a WebMethods; el flag `enableCashier` permanece deshabilitado. | La UI de Staff no debe habilitarse hasta que existan contratos backend, permisos y pruebas. |
| `src/pages/ZONA MARIAN.gn7mx.js` | El acceso a ZONA MARIAN exige `isMarianManager === true`. | No se debe rebajar este control. La operativa autorizada de caja debe integrarse en ZONA STAFF o una superficie separada con permisos mínimos. |
| `src/backend/data.js` | `CajaActual_beforeUpdate` no impone transiciones ni responsables; `HistoricoCierresZ_beforeUpdate` es append-only salvo recuperación de firma/verificación. | Las garantías deben residir en WebMethods/backend y en los contratos de persistencia; los hooks actuales no son una barrera de autorización suficiente. |

### 2.1 Esquema CMS live — consulta de solo lectura (2026-11-11)

La API oficial de Data Collections devuelve estos esquemas y permisos efectivos:

| Colección | Revisión | Permisos efectivos | Campos relevantes |
|---|---:|---|---|
| `CajaActual` | 48 | ADMIN en read/insert/update/remove | Ya existen `openedBy`, `closedBy`, `openedAt`, `closedAt`, `openingAmount`, `expectedCash`, `countedCash`, `difference`, `differenceReason`, `staffResourceId`, `traceId`. No es necesario añadir estos campos para la primera versión de apertura/cierre. |
| `MovimientosCaja` | 76 | ADMIN en read/insert/update/remove | Campos fiscales obligatorios incluyen `hash`, `amount`, `numSerieFactura`, `sequenceNumber`, `transactionId`, `previousRecordHash`, `recordTimestamp`, `schemaVersion`, `traceId`, `movementType`, `totalAmount`, `paymentMethod`, `channelType`, `operationDescription`, `staffResourceId`, `tipoFactura`, `fechaExpedicionFactura`, `tipoImpositivo`, `fiscalPeriod`. |
| `HistoricoCierresZ` | 36 | ADMIN en read/insert/update/remove | Campos obligatorios incluyen `closeDate`, `fiscalPeriod`, `totalTaxAmount`, `totalTaxBase`, `totalOnline`, `totalBizum`, `totalCard`, `totalCash`, `closedBy`, `recordDomain`, `operationDate`, `traceId`. No existen campos específicos de arqueo físico en esta colección. |
| `ControlOperativo` | 27 | ADMIN en read/insert/update/remove | Incluye `controlType`, `dedupeKey`, `traceId`, `status`, `version`, `payload`, `operationDate` y metadatos de reintento/rate limit. |

**Hallazgo de contrato P1 — Z:** el objeto `zRecord` construido en `_registerZClosing()` no incluye al menos los campos CMS obligatorios `closeDate`, `totalTaxAmount`, `totalTaxBase`, `closedBy` y `recordDomain`; usa `netTaxAmount` y `netTaxableAmount` en lugar de los dos nombres requeridos. El proyector `eventLog.js::_proyectarCierreZ()` tampoco incluye todos los campos obligatorios de la colección. Ambos caminos construyen el mismo ID determinista `Z_<fecha>` con payloads distintos: `_registerZClosing()` y `_proyectarCierreZ()`. Si ambos se ejecutan para el mismo día, existe riesgo de colisión/idempotencia ambigua; además, `_assertPeriodNotClosed()` trata la mera existencia del ID como periodo cerrado. La inspección estática confirma la discrepancia; el resultado real de inserción en runtime Wix no se ha ejecutado en esta fase. No declarar el cierre Z operativo hasta reconciliar los dos writers, su ownership del ID, los campos obligatorios y las pruebas runtime.

La consulta live confirmó una fila en `CajaActual` con `cashRegisterStatus=SIMULACION`, `openingAmount=300`, `cashAmount=300`, `expectedCash=300`, `countedCash=0`, y ninguna fila en `HistoricoCierresZ`. La fila simulada permanece intacta.


## 3. Identidades autorizadas

La autorización de sesión de caja queda limitada a:

- Marian Madrid: conserva los permisos que ya derivan de `ADMIN` / `GESTION`.
- Andrea STAFF: `resourceId=07f7344f-e7e4-4c53-854b-47fd82ac8d40`.
- Alba STAFF: `resourceId=9b905bfd-1a09-485d-9273-a24a20dfe648`.

La identidad se resuelve en backend mediante el miembro autenticado y el Contact ID correlacionado con `MapaStaff`. El frontend no puede suministrar `resourceId`, `openedBy`, `closedBy` ni `staffName` como autoridad.

La nueva capacidad se denominará conceptualmente `cashRegisterSessionOperator` y solo permitirá:
- Consultar el estado operativo mínimo necesario para abrir/cerrar.
- Abrir la sesión física.
- Cerrar la sesión física / solicitar el cierre Z según el contrato final aprobado.

No habilita `registerManualTransaction`, `registerBookingPayment`, lecturas fiscales, exportaciones, conciliación ni administración de otros módulos. Esas operaciones conservan sus guards actuales.

## 4. Modelo de autoridad y datos

- `MovimientosCaja`: ledger append-only. Nunca se actualiza ni elimina. Cada movimiento físico válido se persiste una sola vez y la proyección se deriva de él.
- `CajaActual`: singleton mutable de estado/proyección. No es ledger ni fuente de evidencia histórica.
- `HistoricoCierresZ`: evidencia append-only del cierre fiscal diario. No se reescribe para rectificar saldos operativos.
- `ControlOperativo`: mecanismo auxiliar de idempotencia/locks; no sustituye los registros de negocio.

La dirección de escritura para cobros presenciales permanece: writer autorizado → `MovimientosCaja` → proyector idempotente → `CajaActual`. La escritura en la proyección no debe preceder al ledger.

Los movimientos ONLINE no deben abrir ni incrementar la caja física. Se excluyen de la proyección física, aunque continúen formando parte del cierre fiscal diario.

## 5. Reglas de sesión que deben implementarse

1. No existe apertura implícita. Si falta el singleton, el estado efectivo es `CERRADA`; ningún movimiento lo crea ni lo abre.
2. Solo una sesión física puede estar abierta. La apertura debe usar lock persistente/condición de revisión y revalidar estado dentro del lock.
3. Una apertura requiere miembro autenticado, identidad staff resuelta, permiso específico, fecha/hora de backend y trazabilidad.
4. El efectivo inicial debe proceder de un cierre operativo previo reconciliado, no de `totalCash` fiscal. El saldo de 300 EUR actualmente marcado `SIMULACION` no es una fuente válida.
5. Si no existe un cierre previo fiable, la apertura queda bloqueada hasta un procedimiento inicial de puesta en marcha autorizado y documentado. No se reutiliza ni se corrige el singleton de simulación por inferencia.
6. Cada movimiento físico que afecte al efectivo requiere tipo, importe, motivo, responsable autenticado, fecha/hora backend, `traceId` e idempotency key estable.
7. Una sesión cerrada no admite movimientos presenciales. El backend revalida el estado después de adquirir el lock compartido con los writers fiscales.
8. El cierre Z manual persiste el responsable autenticado y la hora de backend en el propio registro inmutable. Un segundo cierre del mismo día debe devolver resultado idempotente o `Z_ALREADY_CLOSED`, nunca crear un segundo cierre.
9. El cron nocturno y el cierre manual usan el mismo contrato de cierre y lock. No se debe permitir que el cron reabra o sobrescriba una sesión.
10. La reconciliación reconstruye una proyección nueva/actualizada solo a partir de movimientos canónicos válidos, sin alterar el ledger ni mezclar movimientos `SMOKE_TEST`, `SIMULATED_*` o secuencias no positivas.

## 6. Contratos pendientes antes de escribir código

### 6.1 Cierre fiscal frente a cierre físico

El actual `HistoricoCierresZ` es un cierre fiscal de movimientos y no contiene el recuento físico del cajón. `CajaActual` sí dispone ya de `openingAmount`, `expectedCash`, `countedCash`, `difference` y `differenceReason`; esos campos son una proyección mutable, no evidencia histórica. Hay dos alternativas para persistir la evidencia del cierre físico:

- **Preferida para el diseño actual:** añadir campos de arqueo y responsable solo a futuros registros Z, manteniendo inmutables los registros existentes y definiendo con precisión qué campos entran en `closingHash` y en la firma.
- Separar sesión/cierre físico en un registro append-only específico y mantener `HistoricoCierresZ` como cierre fiscal. Esta alternativa requiere justificar una nueva colección y su relación idempotente con el Z diario.

No implementar ninguna de las dos sin revisar el esquema CMS live, el canonical hash payload, los consumers de `HistoricoCierresZ` y la política de recuperación de firmas.

### 6.2 Aportaciones y retiradas

El dossier enumera `APORTACION` y `RETIRO`, pero el enum actual `MOVEMENT_TYPE` no los admite. Antes de añadirlos hay que verificar:
- Si son movimientos fiscales, movimientos internos de caja o ambos.
- Si generan factura/registro fiscal o solo afectan al efectivo físico.
- Su tratamiento en `eventLog.js`, cierre Z, agregador fiscal y contabilidad.
- Cómo se evita duplicar un mismo hecho en ledger fiscal y en registro operativo.

No deben registrarse como venta ni como ajuste genérico por conveniencia.

### 6.3 Saldo de arranque y registros existentes

La fila live de `CajaActual` se encuentra en `SIMULACION` y contiene 300 EUR. Está bloqueada por código y no se considera saldo operativo. No se cambia a `ABIERTA` ni `CERRADA`, no se borra y no se reescribe hasta definir una retirada/aislamiento trazable. Tampoco se reconstruye un saldo inicial a partir de los movimientos fiscales sin conciliación. El esquema ya contiene los campos de efectivo inicial/esperado/contado/diferencia; no se añaden campos duplicados a `CajaActual`.

### 6.4 Terminal e IP

- Se puede registrar un identificador de terminal opaco y una etiqueta/tipo de dispositivo como metadatos no autoritativos.
- User-Agent y datos aportados por frontend son manipulables; nunca acreditan identidad.
- No se persistirá una IP enviada por frontend. No se ha acreditado que el WebMethod Velo disponga de una IP cliente fiable.
- Si una fuente server-side fiable se confirma mediante documentación y prueba, se revisará finalidad, base jurídica, acceso y retención. Se preferirá un HMAC de IP con secreto y rotación frente a IP en claro, recordando que sigue siendo dato pseudonimizado sujeto a RGPD.

## 7. Módulos y consumidores a revisar durante la implementación

- `src/backend/cajas.web.js`: guards, apertura, cierre, writer manual, proyector, `getCashierState`, idempotencia.
- `src/backend/security.js`: resolución staff y guard de capacidad mínima.
- `src/backend/internalConfig.js`: constantes de autorización y enums canónicos, sin duplicar identidad innecesariamente.
- `src/backend/validation.js`: validación centralizada de payloads/estados.
- `src/backend/data.js`: hooks y protección de transiciones; no sustituye autorización backend.
- `src/backend/fiscalLedgerLock.js`, `dataAccess.js`, `eventLog.js`, `events.js`, `crons.js`: locks, writers y cron. Debe resolverse la colisión potencial de `Z_<fecha>` entre `_registerZClosing()` y `_proyectarCierreZ()`.
- `src/pages/ZONA STAFF.mvf3f.js` y widget HTML asociado: contrato de UI y allowlist.
- Tests de seguridad, proyección, escritores, Z y contrato HTML/widget.
- Esquemas CMS live de `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ` y `ControlOperativo`.

## 8. Plan de implementación por hitos

### Hito 0 — Decisión de negocio y auditoría de impacto (este ADR)
- [x] Andrea y Alba autorizadas para apertura/cierre, sin elevar su rol global.
- [x] Identidades de recurso contrastadas con `MapaStaff`.
- [x] Código de seguridad, writer, proyector, cierre Z, cron, hooks y superficies frontend inspeccionados.
- [x] Bloqueos de estado SIMULACION y ausencia de campos de arqueo identificados.
- [x] No se han modificado datos, permisos CMS ni ledgers.

### Hito 1 — Contrato de sesión y esquema (siguiente gate)
- [x] Consultar esquemas live de `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ` y `ControlOperativo` (revisiones 48/76/36/27); permisos ADMIN en las cuatro colecciones.
- [x] Confirmar que `CajaActual` ya contiene campos de apertura/cierre y arqueo físico.
- [x] Detectar discrepancia entre campos CMS obligatorios de `HistoricoCierresZ` y los dos writers actuales; runtime insert pendiente.
- [ ] Completar el inventario de todos los consumidores del cierre/hash y probar ambos writers en entorno aislado.
- [ ] Decidir si cierre físico se incorpora a `HistoricoCierresZ` o se separa.
- [ ] Definir contrato de responsable, fecha/hora, terminal e idempotency key; reutilizar campos físicos existentes de `CajaActual`.
- [ ] Definir tratamiento de días sin movimientos y precedencia entre cierre manual y cron.
- [ ] Definir tratamiento de `SIMULACION` mediante aislamiento/retirada trazable.
- [ ] Aprobar el contrato de `APORTACION`/`RETIRO` y su tratamiento fiscal/contable.

### Hito 2 — Backend transaccional
- [ ] Guard de capacidad específico para sesión de caja.
- [ ] Apertura manual con lock, idempotencia y responsable backend.
- [ ] Cierre manual/Z con responsable backend y persistencia append-only.
- [ ] Proyector sin apertura implícita y con separación PRESENCIAL/ONLINE.
- [ ] Movimientos de efectivo con motivo y contrato fiscal/contable aprobado.
- [ ] Reconciliador determinista y seguro.

### Hito 3 — Interfaz Staff
- [ ] Enrutar solo estado/apertura/cierre autorizados.
- [ ] No habilitar TPV/cobros ni ajustes hasta autorizar y validar esos casos por separado.
- [ ] Mostrar errores de estado, concurrencia e idempotencia sin falsos éxitos.

### Hito 4 — QA y liberación
- [ ] Unitarias, integración, permisos negativos y regresión.
- [ ] Concurrencia entre dos dispositivos, doble apertura, doble cierre y replay.
- [ ] Fallo entre persistencia ledger y proyección.
- [ ] Verificación de no mutación de registros históricos.
- [ ] Runtime QA Wix con identidades autorizadas y datos aislados.
- [ ] Revisión de diff, CI verde, rollback y autorización explícita de publicación.

## 9. Criterios de no-go

No habilitar la caja ni desplegar mientras:
- el singleton live siga en estado `SIMULACION` sin retirada/aislamiento controlado;
- la apertura pueda producirse implícitamente;
- no esté definido el saldo físico de arranque;
- el cierre manual y el cron puedan competir sin precedencia idempotente;
- se desconozca el contrato de aportaciones/retiradas;
- falten pruebas de concurrencia, autorización negativa o runtime QA.

## 10. Validación de esta fase

- **Verificado:** inspección estática de los archivos citados en `main` y consulta read-only previa del CMS live.
- **Documentado:** autorización explícita de Andrea y Alba para abrir/cerrar.
- **Inferido:** no se infiere autorización para cobros, devoluciones, pagos, ajustes ni acceso fiscal.
- **Verificado:** consulta read-only del esquema CMS live (revisiones 48/76/36/27) y de la fila actual de `CajaActual` / ausencia de filas Z; discrepancia de campos obligatorios Z detectada por comparación estática.
- **Pendiente:** CI de este PR documental; prueba runtime del insert Z; inventario completo de consumidores/hash; contrato de sesión, decisión cierre físico/fiscal, retirada de `SIMULACION`, runtime QA y despliegue.
- **Cambios en CMS:** ninguno.
- **Cambios en Wix publicado:** ninguno.
- **Ledgers históricos:** ninguno alterado.


## 10. Decisión de negocio confirmada — sesión operativa y efectivo físico (2026-11-13)

La decisión anterior del 2026-11-11 se mantiene únicamente para el **saldo físico** del cajón. Su interpretación como exclusión absoluta de tarjeta y Bizum de toda `CajaActual` queda supersedida por TEC-032 de `docs/DECISION-LOG.md`.

### 10.1 Responsabilidad de cada colección

- `MovimientosCaja` conserva cada ticket/movimiento original y es la fuente histórica/fiscal append-only. No se actualiza ni elimina; las rectificaciones se registran mediante nuevos movimientos enlazados.
- `CajaActual` es un singleton mutable de proyección de la sesión. Muestra estado de apertura/cierre, responsables y marcas temporales; resumen de la última operación; acumulados de sesión por medio de pago; saldo físico esperado/contado y diferencias de arqueo.
- `LibroAsientosContablesDetalle` consolida los hechos económicos según reglas aprobadas. La proyección no crea asientos ni inventa mapeos PGC.

### 10.2 Qué se proyecta

- Los cobros `PRESENCIAL` en `EFECTIVO`, `TARJETA` y `BIZUM` forman parte de la actividad y acumulados de la sesión.
- Solo un movimiento cuyo efecto físico esté explícitamente definido, validado y autorizado modifica `cashAmount`, `expectedCash` y el neto físico. Un cobro con tarjeta o Bizum nunca incrementa el efectivo del cajón.
- Los movimientos `ONLINE`, transferencias y pagos desde banco permanecen en sus registros fiscales/contables; no se incorporan a la sesión física por inferencia.
- El proyector debe ser idempotente, derivar la dirección física en backend y no aceptar del frontend ni el actor ni una decisión de efecto físico como autoridad.

### 10.3 Resumen de última operación y referencias

El resumen de última operación debe incluir, cuando conste en el movimiento fuente: actor autenticado resuelto por `security.getMyStaffContext()` (o mecanismo canónico vigente), instante exacto de backend, tipo y descripción, conceptos/unidades validados, importe, desglose de medios de pago, identificadores de movimientos fuente, `hash`, `previousRecordHash`, `sequenceNumber`, `recordTimestamp`, `digitalSignature` y `traceId`. El resumen es una vista derivada; el ticket original permanece en `MovimientosCaja`.

`CajaActual` debe conservar referencias a los `_id` de los movimientos originales asociados a la última operación. Los acumulados de sesión se actualizan de forma idempotente desde esos movimientos, sin duplicar tickets ni convertir la proyección en un segundo ledger. La sesión debe poder mostrar, al menos, importes y número de tickets/cobros en efectivo, tarjeta y Bizum. Los campos físicos existentes deben reutilizarse solo después de verificar su semántica y consumidores; los campos nuevos requieren esquema CMS aprobado.

### 10.4 Límites y bloqueos pendientes

- `paymentMethod` en `MovimientosCaja` es actualmente singular. No asumir que `lineItems` representa un desglose de pago. Los pagos mixtos quedan bloqueados hasta definir un contrato canónico que reconcilie importes y referencias sin duplicar el hecho fiscal.
- `lineItems` existe como `OBJECT`, pero su estructura interna y validación de unidades no están acreditadas. No mostrar conceptos/unidades como dato validado hasta definir y probar el contrato.
- `MOVEMENT_TYPE` no contiene necesariamente `APORTACION`, `RETIRO` ni `PAGO_PROVEEDOR`; verificar enum vigente antes de cualquier implementación. `AJUSTE` no determina por sí solo dirección física.
- La apertura/cierre manual, el responsable de cierre, el saldo inicial reconciliado, el cron Z y la retirada/aislamiento del singleton `SIMULACION` siguen sujetos a los gates anteriores. No se altera el histórico para rellenar datos ausentes.
- No se crean campos CMS en esta actualización documental ni se habilitan escritores.

### 10.5 Criterios de aceptación de la proyección objetivo

1. Cada ticket/movimiento original se inserta una sola vez en `MovimientosCaja`; `CajaActual` guarda solo resumen, acumulados y referencias a los IDs fuente.
2. Un cobro presencial en tarjeta o Bizum incrementa sus acumulados de sesión, pero no modifica el efectivo físico.
3. Un cobro en efectivo presencial incrementa el acumulado de efectivo y el saldo físico únicamente por su delta físico validado.
4. La última operación muestra actor backend, instante exacto, importes, conceptos validados y huellas/trazas del movimiento fuente; los datos ausentes permanecen ausentes.
5. Reintentos/replays no duplican acumulados ni referencias; la proyección se puede reconstruir desde el ledger sin mutarlo.
6. La suma del desglose de pago coincide con el importe de la operación; cualquier diferencia o contrato mixto no soportado falla de forma cerrada.
7. El ledger fiscal mantiene todos los registros que le corresponden, independientemente de qué campos se proyecten en la sesión.

## 11. Addendum de decisión — TEC-032 (2026-11-13)

El propietario acepta la recomendación de conservar cada ticket en `MovimientosCaja` y mantener en `CajaActual` el resumen de la última operación, los acumulados de la sesión y las referencias a los movimientos fuente. Este addendum prevalece sobre cualquier frase anterior de este ADR que excluya por completo tarjeta/Bizum de `CajaActual`; la exclusión se aplica únicamente al saldo físico del cajón.

Estado de este addendum: decisión de negocio aprobada; implementación pendiente. No se ha modificado el CMS, el código de producción ni los registros históricos.

## 12. Progreso de implementación TEC-032 — 2026-11-13

La rama `fix/caja-actual-last-operation-projection` incorpora una primera alineación ejecutable de backend y superficie ZONA MARIAN:

1. El escritor manual requiere `channelType` explícito, salvo la inferencia controlada `ONLINE` para `VENTA_ONLINE`/`WIX_PAYMENTS`. Para `PRESENCIAL`, el actor se obtiene con `getMyStaffContext()`; el `resourceId` recibido del navegador no se usa como identidad ni para rate limiting.
2. El proyector acepta `EFECTIVO`, `TARJETA` y `BIZUM` solo en `PRESENCIAL` y con sesión existente `ABIERTA` y `openedAt` válido. No crea ni reabre `CajaActual`. Si la sesión no existe/no está abierta/es simulada, la proyección queda pendiente y genera una compensación para reconciliación.
3. `cashAmount` y `netAmount` conservan el efectivo físico; `cardAmount` y `voucherAmount` acumulan tarjeta y Bizum respectivamente. Los reembolsos mantienen el signo del `accountingAmount` del movimiento fuente. Los pagos online/transferencias no incrementan la sesión física.
4. `getCashierState()` devuelve un resumen de sesión calculado desde `MovimientosCaja` en el intervalo `openedAt`–`closedAt`, con número e importe neto por medio, más `lastOperation` y `sourceMovementIds`. El actor visible se resuelve desde `staffResourceId` mediante Bookings Staff API. Huellas y timestamps se leen del movimiento original; no se generan valores retrospectivos.
5. El cierre Z manual guarda `closedBy` en `CajaActual` desde la identidad backend. El panel `#htmlAdmin.txt` representa efectivo físico, acumulados de efectivo/tarjeta/Bizum, responsables/horas de sesión y huellas de la última operación.

### 12.1 Límites aún abiertos

- El esquema CMS no contiene un campo dedicado para `lastMovementId` ni un objeto `lastOperation`. Por ahora la referencia/detalle se reconstruye en lectura; no se afirma que estén persistidos en `CajaActual`. Los acumulados por método existen en los campos actuales, pero los contadores por método se derivan del ledger.
- No se ha implementado apertura de sesión. `openedBy/openedAt` deben establecerse mediante un WebMethod con permiso específico, lock, idempotencia y saldo inicial reconciliado; no se usa la fila `SIMULACION`.
- `lineItems` no tiene contrato interno validado y no se expone como conceptos/unidades verificados. `paymentMethod` sigue siendo singular; pagos mixtos no admitidos.
- No se han cambiado permisos CMS ni esquema CMS. Los escritores fiscales/contables siguen deshabilitados. No se ejecutó Wix Local Editor ni E2E runtime.

Esta fase no habilita caja real ni despliegue. Los cambios requieren CI y revisión antes de considerar el código integrable.

**Aclaración de persistencia y precisión:** los IDs de los movimientos proyectados se conservan en `CajaActual.sequenceCounters.appliedMovementIds` como conjunto de deduplicación/referencias; no se ha añadido una columna `lastMovementId`. `staffResourceId`, `traceId` y `lastMovementAt` se actualizan con la última operación. El DTO `lastOperation` completa hash, firma, secuencia y referencias leyendo el movimiento fuente. El proyector exige `recordTimestamp` válido y no sustituye una marca temporal ausente por la hora de ejecución. `salesCount` solo aumenta para `MOVEMENT_TYPE.VENTA`; el número por medio se obtiene del ledger.

Los nuevos movimientos manuales `PRESENCIAL` marcan `recordSource=MANUAL_PRESENCIAL_AUTHENTICATED`, valor asignado exclusivamente por backend. `getCashierState()` solo presenta nombre de operador como `VERIFIED_BACKEND` para ese origen. Registros históricos o de origen distinto se muestran como autoría no verificada; no se infiere identidad fiable a partir de un `staffResourceId` legado.

En cierres Z ejecutados por un miembro autorizado, `CajaActual.closedBy` conserva su `resourceId` autenticado. En cierres internos programados, el valor es `SYSTEM`; no se atribuye el cierre a un operador humano inexistente.
