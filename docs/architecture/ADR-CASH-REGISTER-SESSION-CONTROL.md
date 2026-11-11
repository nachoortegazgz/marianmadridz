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


## 11. Aclaración de negocio: efectivo físico frente a movimientos económicos (2026-11-11)

El propietario confirma que CajaActual debe reflejar exclusivamente el dinero que atraviesa físicamente el cajón del establecimiento. Por tanto:

- Efectivo cobrado presencialmente, devoluciones en efectivo, aportaciones físicas, retiradas, pagos en efectivo a proveedores y ajustes físicos justificados pueden afectar a CajaActual cuando exista un contrato backend explícito para cada operación.
- Tarjeta cobrada en el local, Bizum, pagos online, transferencias y gastos pagados desde banco no afectan al saldo físico de CajaActual.
- MovimientosCaja conserva su función de registro fiscal de operaciones. No se debe filtrar ni borrar una operación fiscal porque no afecte al efectivo físico.
- LibroAsientosContablesDetalle consolida los hechos económicos conforme a mapeos contables aprobados. Una operación en efectivo puede tener proyección física y asiento contable.

### Estado de implementación — PR #284

La PR #284 está abierta como draft y no se ha fusionado ni desplegado en Wix. Su cambio parcial hace que _updateCajaActual() proyecte únicamente movimientos con paymentMethod=EFECTIVO y channelType=PRESENCIAL; las operaciones no físicas no alteran saldo, contadores ni appliedMovementIds.

Esta primera restricción no equivale al contrato completo de sesión ni cubre todavía aportaciones, retiradas, pagos físicos a proveedores o ajustes con dirección explícita. MOVEMENT_TYPE no contiene actualmente APORTACION, RETIRO ni PAGO_PROVEEDOR; AJUSTE no define por sí solo si la operación es entrada o salida. No ampliar enums, CMS ni asientos PGC hasta definir el contrato fiscal/contable, validación, permisos, idempotencia y pruebas.

La apertura singleton en estado SIMULACION con 300 EUR es una proyección sintética de QA, no saldo inicial real conciliado. No debe habilitarse una sesión real ni modificarse ese registro sin procedimiento aprobado.

### Gate actualizado

Antes de implementar apertura/cierre y tipos adicionales:
1. Resolver el contrato de cierre fiscal Z frente a arqueo físico.
2. Definir los efectos IN/OUT/NONE y los tipos admitidos, sin aceptar la dirección desde frontend.
3. Definir la relación de cada operación con MovimientosCaja y LibroAsientosContablesDetalle.
4. Revisar todos los consumers, hooks, locks, cron y esquemas CMS.
5. Añadir pruebas de idempotencia, concurrencia, fallos parciales y permisos negativos.
6. Validar en entorno Wix QA aislado antes de activar cualquier writer.
