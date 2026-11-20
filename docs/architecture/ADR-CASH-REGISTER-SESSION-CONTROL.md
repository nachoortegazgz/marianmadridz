# ADR — Sesión operativa de CajaActual y autorización de apertura/cierre

> **Revalidación 20/11/2026:** el snapshot CMS del 11/11 y las referencias a SIMULACION son históricos. El singleton live ahora está ABIERTA, con fechas incoherentes y sin marcadores QA. Véase la sección 13 y la [reconciliación live 20/11](../qa/2026-11-20-live-caja-schema-and-reconciliation.md). PR #466 corrigió `CajaActual_beforeUpdate` para recuperar el estado previo mediante `getItem()` con consistencia fuerte, sin depender de `context.original` no documentado por Wix. La propuesta sigue pendiente de aprobación de implementación; H-01 (transiciones, autorización, concurrencia y E2E) permanece abierto.

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

### 2.1 Snapshot histórico de esquema CMS — 2026-11-11 (superseded 2026-11-20)

La API oficial de Data Collections devuelve estos esquemas y permisos efectivos:

| Colección | Revisión | Permisos efectivos | Campos relevantes |
|---|---:|---|---|
| `CajaActual` | 48 | ADMIN en read/insert/update/remove | Ya existen `openedBy`, `closedBy`, `openedAt`, `closedAt`, `openingAmount`, `expectedCash`, `countedCash`, `difference`, `differenceReason`, `staffResourceId`, `traceId`. No es necesario añadir estos campos para la primera versión de apertura/cierre. |
| `MovimientosCaja` | 76 | ADMIN en read/insert/update/remove | Campos fiscales obligatorios incluyen `hash`, `amount`, `numSerieFactura`, `sequenceNumber`, `transactionId`, `previousRecordHash`, `recordTimestamp`, `schemaVersion`, `traceId`, `movementType`, `totalAmount`, `paymentMethod`, `channelType`, `operationDescription`, `staffResourceId`, `tipoFactura`, `fechaExpedicionFactura`, `tipoImpositivo`, `fiscalPeriod`. |
| `HistoricoCierresZ` | 36 | ADMIN en read/insert/update/remove | Campos obligatorios incluyen `closeDate`, `fiscalPeriod`, `totalTaxAmount`, `totalTaxBase`, `totalOnline`, `totalBizum`, `totalCard`, `totalCash`, `closedBy`, `recordDomain`, `operationDate`, `traceId`. No existen campos específicos de arqueo físico en esta colección. |
| `ControlOperativo` | 27 | ADMIN en read/insert/update/remove | Incluye `controlType`, `dedupeKey`, `traceId`, `status`, `version`, `payload`, `operationDate` y metadatos de reintento/rate limit. |

**Hallazgo de contrato P1 — Z:** el objeto `zRecord` construido en `_registerZClosing()` no incluye al menos los campos CMS obligatorios `closeDate`, `totalTaxAmount`, `totalTaxBase`, `closedBy` y `recordDomain`; usa `netTaxAmount` y `netTaxableAmount` en lugar de los dos nombres requeridos. El proyector `eventLog.js::_proyectarCierreZ()` tampoco incluye todos los campos obligatorios de la colección. Ambos caminos construyen el mismo ID determinista `Z_<fecha>` con payloads distintos: `_registerZClosing()` y `_proyectarCierreZ()`. Si ambos se ejecutan para el mismo día, existe riesgo de colisión/idempotencia ambigua; además, `_assertPeriodNotClosed()` trata la mera existencia del ID como periodo cerrado. La inspección estática confirma la discrepancia; el resultado real de inserción en runtime Wix no se ha ejecutado en esta fase. No declarar el cierre Z operativo hasta reconciliar los dos writers, su ownership del ID, los campos obligatorios y las pruebas runtime.

La consulta live del 11/11 confirmó entonces una fila `SIMULACION`. Ese estado ya no describe el singleton actual: la relectura del 20/11 devuelve `ABIERTA`, `snapshotSource=APERTURA_CAJA`, `traceId` vacío y fechas inconsistentes. No modificar el singleton; detalle en sección 13.


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

**Snapshot histórico 11/11:** el singleton estaba en `SIMULACION`. **Estado live 20/11:** `ABIERTA`, `snapshotSource=APERTURA_CAJA`, `traceId` vacío, `openedAt=2026-11-14T06:00:00Z`, `closedAt=2026-11-12T23:00:00Z`, `lastMovementAt=2026-11-12T23:00:00Z`, importes de apertura/efectivo/esperado/contado 300 EUR y difference 0. No hay movimientos ni cierres Z. No se considera sandbox ni sesión reconciliada; no se cierra, reabre, borra ni reescribe hasta aprobar el plan de conciliación/aislamiento.

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
- [x] Bloqueo del snapshot histórico SIMULACION identificado (11/11).\n- [x] Estado live revalidado el 20/11: ABIERTA, snapshotSource APERTURA_CAJA, traceId vacío, fechas incoherentes; no es sandbox TPV.
- [x] No se han modificado datos, permisos CMS ni ledgers.

### Hito 1 — Contrato de sesión y esquema (siguiente gate)
- [x] Consulta histórica 11/11: revisiones 48/76/36/27.\n- [x] Relectura live 20/11: CajaActual rev18/81 campos; MovimientosCaja rev109/113; HistoricoCierresZ rev44/66; ControlOperativo rev93/32; permisos ADMIN en las cuatro.
- [x] Confirmar esquema actual: openingCashAmount, openingCardAmount, openingBizumAmount, openingOtherAmount, bizumAmount, expectedCash, countedCash y difference; DTO alineado por PR #460/462.
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
- el singleton live no esté conciliado: estado ABIERTA con snapshotSource APERTURA_CAJA, traceId vacío, fechas openedAt/closedAt incoherentes y sin marcador TPV_QA_SANDBOX_INITIALIZED/TPV_QA_SYNTHETIC;
- la apertura pueda producirse implícitamente;
- no esté definido el saldo físico de arranque;
- el cierre manual y el cron puedan competir sin precedencia idempotente;
- se desconozca el contrato de aportaciones/retiradas;
- falten pruebas de concurrencia, autorización negativa o runtime QA.

## 10. Validación de esta fase

- **Verificado:** inspección estática de los archivos citados en `main` y consulta read-only previa del CMS live.
- **Documentado:** autorización explícita de Andrea y Alba para abrir/cerrar.
- **Inferido:** no se infiere autorización para cobros, devoluciones, pagos, ajustes ni acceso fiscal.
- **Verificado:** consulta read-only del esquema CMS live 20/11 (revisiones 18/109/44/93) y del singleton CajaActual; no hay movimientos ni cierres Z. Discrepancia de campos obligatorios Z sigue detectada por comparación estática.
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
3. `cashAmount` y `netAmount` conservan el efectivo físico; `cardAmount` y `otherAmount` acumulan tarjeta/Bizum según el contrato actual de esta proyección; el esquema live también declara `bizumAmount`, pero `cajas.web.js` no lo usa como bucket de esta proyección. Los reembolsos mantienen el signo del `accountingAmount` del movimiento fuente. Los pagos online/transferencias no incrementan la sesión física.
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


## 13. Addendum TEC-035 — recreación live de CajaActual y contrato con MovimientosCaja (2026-11-14)

**Estado Wix verificado tras la operación:**
- `CajaActual` no existía en el listado live previo; se ha creado como colección `NATIVE`, ID `CajaActual`, displayName `CAJA_ACTUAL`, revisión 1 y 36 campos de negocio + 4 campos de sistema.
- Permisos de colección: `insert/update/remove/read=ADMIN`.
- Un único elemento lógico `singletonKey=CAJA_PRINCIPAL`, ID físico Wix `04402566-25b1-4b93-8f93-5c3343c73249`, con estado `CERRADA`, `isOpen=false`, importes/contadores a cero, `sequenceCounters={}`, `operationDate=2026-11-14` y `traceId` UUID v4.
- No se ha creado una sesión abierta, no se ha inventado saldo inicial, no se han rellenado `openedAt/openedBy`.
- `MovimientosCaja` se mantiene intacta, revisión 78, 0 registros en el corte.
- Índice único `CajaActual_singletonKey_unique` creado y observado en estado `BUILDING`; falta comprobar transición a `ACTIVE`.

**Contrato de integración:**
1. Cada operación/ticket se persiste una sola vez en `MovimientosCaja`. `CajaActual` no replica el histórico ni sustituye el hash fiscal; contiene estado de sesión y acumulados operativos.
2. La inserción del movimiento y la proyección son fases distintas. La proyección debe ser idempotente por ID fuente; si falla tras insertar, devolver estado parcial y reconciliar desde el movimiento existente, nunca insertar un segundo ticket.
3. Efectivo actualiza `cashAmount` y `expectedCash` solo por delta físico validado. Tarjeta y Bizum actualizan `cardAmount`/`voucherAmount`, nunca el saldo físico. ONLINE/transferencias quedan fuera de la caja física.
4. El último movimiento se muestra leyendo su registro original: actor backend verificado, instante, tipo, descripción, importes y huellas únicamente cuando consten en la fuente. No confiar en actor/importe enviados por frontend.
5. `paymentMethod` es singular; no habilitar pagos mixtos sin contrato explícito de desglose, reconciliación de suma y pruebas de idempotencia. `lineItems` no tiene todavía esquema interno acreditado.
6. No abrir sesión automáticamente al recibir un movimiento. La apertura requiere WebMethod seguro, autorización backend, lock, saldo inicial contado/reconciliado y persistencia de `openedAt/openedBy`.
7. La lista de IDs `sequenceCounters.appliedMovementIds` puede crecer sin límite si se mantiene durante sesiones prolongadas. Recomendación: diseñar una clave de idempotencia durable por movimiento en `ControlOperativo` o un mecanismo equivalente con unicidad/retención controlada, manteniendo la reconstrucción desde `MovimientosCaja`. No retirar el comportamiento actual hasta migrar y probar concurrencia/replays.
8. Recomendación adicional: valorar `lastMovementId` como puntero escalar a la última fuente, no como copia de la operación. Solo introducirlo en una migración coordinada de CMS + backend + DTO + tests.

**Gates:** no se han habilitado writers, no se ha activado Veri*Factu, no se ha ejecutado venta, reserva, pago, cierre Z ni automatización. La colección creada no abre la caja por sí misma. El código backend ya espera el singleton `CAJA_PRINCIPAL`; el flujo de apertura continúa pendiente. No se ha validado runtime en Wix Local Editor ni E2E publicado.


## 9. Addendum — TPV sintético en desarrollo (2026-11-20)

`CajaActual` sigue siendo el singleton/proyección de sesión. Durante el test-run autorizado se identifica con `snapshotSource=TPV_QA_SYNTHETIC` y `cashRegisterStatus=SIMULACION`. `MovimientosCaja` sigue siendo append-only para movimientos reales; la única excepción de desarrollo son eventos `SIMULATED_TPV_*` marcados con `recordSource=TPV_QA_SYNTHETIC` y testRunId backend. Estos eventos no consumen secuencia/hash fiscal real, no invocan firmador/AEAT y quedan excluidos de la cadena y agregaciones fiscales. Las filas del test-run pueden editarse/eliminarse de forma selectiva; el resto permanece inmutable. Preview/Sandbox E2E pendiente.


## 13. Revalidación técnica live — 2026-11-20

### 13.1 Esquema y datos físicos actuales

- CajaActual: revisión 18, 81 campos, actualizada 17/11; openingCashAmount, openingCardAmount, openingBizumAmount, openingOtherAmount, bizumAmount, operationDateHour (DATETIME), cashAmount, cardAmount, otherAmount, expectedCash, countedCash, difference, sequenceCounters (OBJECT), snapshotSource, traceId y cashRegisterStatus.
- MovimientosCaja: revisión 109, 113 campos, 0 registros.
- HistoricoCierresZ: revisión 44, 66 campos, 0 registros.
- ControlOperativo: revisión 93, 32 campos, 58 registros; 3 compensaciones PENDING_RECOVERY, attempts=0.
- El singleton CajaActual está ABIERTA; openedAt 14/11, closedAt y lastMovementAt 12/11; openingCashAmount/cashAmount/expectedCash/countedCash=300 EUR; difference=0; snapshotSource=APERTURA_CAJA; traceId vacío; sequenceCounters se devuelve como texto JSON aunque el tipo físico es OBJECT.
- El sitio devuelve Draft. El singleton no tiene los marcadores QA exigidos por TPV QA y no debe usarse como sandbox.

### 13.2 Cambios de código ya integrados

- PR #460: DTO de caja lee openingCashAmount; comentario Bizum alineado con el esquema físico y la semántica actual de otherAmount.
- PR #462: elimina la escritura del campo raíz operationDate, ausente del esquema; el DTO de presentación deriva el daykey de openedAt en Europe/Madrid. operationDateHour sigue en el esquema, pero su semántica no está aprobada y no se usa como sustituto.
- Ambas PRs superaron CI offline: Layer 1 333/333, Layer 2 266/266, suite 688/688; SDK contracts, npm audit, ESLint y secret scanning SUCCESS. No se ejecutó Wix Runtime.

### 13.3 Contrato oficial de hooks y actualizaciones Wix

- Wix documenta que beforeUpdate recibe el item y un UpdateHookContext; el ejemplo oficial de contexto expone collectionName, userId y userRole. No documenta una propiedad context.original. El hook CajaActual_beforeUpdate no debe depender de context.original para recuperar el estado anterior; la comparación de transiciones requiere lectura server-side del item existente o un contrato DAL explícito.
- Wix Update Data Item reemplaza el payload completo; los campos omitidos se pierden. Patch Data Item modifica solo los campos declarados. El DAL actual usa update (replace), por lo que cada consumidor debe enviar el item completo y preservar campos no relacionados. Cualquier migración a patch requiere pruebas y revisión de hooks/contratos.
- Referencias oficiales: [Velo beforeUpdate hook](https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-update), [Update Data Item](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/update-data-item), [Patch Data Item](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/patch-data-item).

### 13.4 Estado de decisión

Esta revalidación no aprueba la implementación del ADR. Permanecen pendientes: transición formal ABIERTA/CERRADA, autorización específica de operador, apertura explícita, cierre Z con contrato CMS completo, precedencia manual/cron, aislamiento del singleton y pruebas de concurrencia/runtime. No se han modificado datos, permisos ni ledgers.


## 14. Revalidación del contrato beforeUpdate — 2026-11-20

La documentación oficial de Wix para [beforeUpdate](https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-update) documenta el contexto con `collectionName`, `userId` y `userRole`; no documenta `context.original`. La implementación anterior dependía de esa propiedad para reconstruir el estado previo de `CajaActual`.

PR #466 sustituye esa dependencia por una lectura backend del elemento persistido mediante `getItem(BUSINESS_COLLECTIONS.CAJA_ACTUAL, item._id, CONSISTENCY.STRONG)`. La actualización falla de forma cerrada si falta el ID o la lectura no devuelve el mismo elemento. Los tests offline cubren recuperación correcta, ausencia del elemento y el hecho de que `context.original` no es autoridad.

**Alcance limitado:** esta corrección no aprueba ni implementa la matriz de transiciones H-01, no resuelve concurrencia general entre todos los escritores y no autoriza la modificación del singleton LIVE actual. Se requiere completar el contrato de transición y validar hooks/identidad en Wix Sandbox antes de modificar el estado operativo.


## 15. Revalidación H-01 sobre HEAD 19079bd6 — 2026-11-20

### Evidencia directa del código
En el HEAD `19079bd6b2cfde80b5758160b5ec060c0a49bd7b` se reexaminaron:
- `src/backend/dataAccessPolicy.js`: `assertUpdateAllowed(CAJA_ACTUAL, item)` solo exige `_id`; `assertSaveAllowed(CAJA_ACTUAL, item)` también solo exige `_id`.
- `src/backend/dataAccess.js`: `updateItem(collection, item)` valida la política y delega en `elevatedUpdate(collection, item)`, sin predicado de versión.
- `src/backend/cajas.web.js`: `_updateCajaActual` lee el singleton, calcula saldos y `sequenceCounters`, y después ejecuta `dalUpdate(CAJA_ACTUAL_COL, cashRegister)`. Los reintentos del bucle no constituyen compare-and-swap.
- `src/backend/tests/data.hooks.test.mjs`: los tests de CajaActual cubren lectura del estado anterior, ignorar `context.original` y fallo cerrado cuando no se recupera el registro. No prueban concurrencia de escritores.

### Consecuencia
La corrección PR #466 resuelve el origen del estado anterior del hook, pero no serializa writers. Una lectura fuerte seguida de un update completo sigue dejando una ventana de carrera. Dos productores pueden leer la misma versión y sobrescribir acumulados o metadatos del otro.

### Decisión
H-01 continúa abierto. No añadir una comparación read-then-write y denominarla CAS; tampoco cambiar `update` por `patch` sin revisar consumidores, hooks y semántica de reemplazo/patch del SDK. Antes de cambiar runtime se debe seleccionar y probar un mecanismo de exclusión/CAS soportado por Wix, inventariar todos los productores y fijar la matriz de transiciones y campos mutables.

### Criterios de aceptación obligatorios
1. Un único contrato backend para apertura, cierre, movimientos y proyección.
2. Autorización backend por capacidad/identidad; el frontend no decide rol, estado ni versión.
3. Cada mutación comprueba la transición permitida y preserva campos no relacionados.
4. Dos writers concurrentes con movimientos distintos producen ambos efectos una sola vez.
5. Reintento del mismo movimiento no duplica saldo ni operaciones.
6. Fallo entre ledger y proyección produce compensación trazable sin reintento ciego.
7. Wix Sandbox/Preview confirma comportamiento de hooks y permisos antes de cualquier cambio operativo.

### No-go y límites
No se ha ejecutado Wix Runtime ni una prueba de concurrencia real en esta intervención. No se han modificado registros CMS, singleton CajaActual, compensaciones, ledgers, permisos o secretos. Producción continúa bloqueada. La documentación oficial de `beforeUpdate` y de Wix Data hooks no promete atomicidad de lectura seguida de escritura; no debe inferirse.


## 16. Candidato de serialización descubierto en SDK Wix — 2026-11-20

La revalidación posterior de documentación oficial identifica una primitiva que merece un spike controlado antes de cerrar H-01:

- La dependencia del repositorio es `@wix/data@1.0.527`.
- El módulo DAL ya importa `items` desde `@wix/data` y eleva operaciones con `auth.elevate`.
- El SDK documenta `items.patch(collectionId, itemId)`, refinadores `setField`, `incrementField`, `appendToArray` y ejecución `.run({ condition })`.
- El filtro condicional se construye con `items.filter().eq(...)`. La operación solo aplica si el elemento satisface la condición.
- La documentación REST de Patch Data Item declara también `condition`; Patch admite modificaciones parciales y `INCREMENT_FIELD`.
- La documentación especifica una limitación: Patch solo está disponible para colecciones creadas por usuarios Wix; no para colecciones de aplicaciones Wix. Por tanto, hay que confirmar que `CajaActual` pertenece a la primera categoría antes de implementarlo.

Referencias:
- [SDK items.patch](https://dev.wix.com/docs/sdk/data-items-sdk/data/items/patch)
- [SDK incrementField](https://dev.wix.com/docs/sdk/data-items-sdk/data/items/wix-data-patch/increment-field)
- [REST Patch Data Item](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/patch-data-item)
- [REST Bulk Patch Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-patch-data-items)

### Diseño candidato (no implementado ni validado)
1. Utilizar `sequenceCounters.seqGlobal` como versión monotónica, siempre que el esquema y los datos de Sandbox confirmen que `sequenceCounters` es OBJECT y `seqGlobal` es numérico.
2. Leer el singleton y preparar modificaciones parciales: incrementos atómicos de saldos/contadores, append del identificador de movimiento y set de los metadatos de última operación.
3. Ejecutar `items.patch(...).run({ condition: items.filter().eq("sequenceCounters.seqGlobal", expectedVersion) })`; para TPV QA añadir también las condiciones de `snapshotSource` y `traceId` exactos.
4. Si la condición no coincide, releer y recalcular desde el estado nuevo; no reutilizar el delta ni el snapshot antiguo. Si la respuesta no permite distinguir de forma inequívoca conflicto de condición y fallo incierto, detener y reconciliar.
5. Mantener idempotencia: antes de proyectar comprobar el ID aplicado y usar `appendToArray` condicionado por la versión; una repetición debe devolver ya aplicado sin incrementar.
6. Migrar también apertura, cierre Z, proyección QA y cualquier otro productor de CajaActual al mismo contrato. No dejar escritores con `update/save` completo en paralelo.
7. Confirmar el comportamiento de `beforeUpdate` cuando el cambio llega como patch (forma del item que recibe el hook, normalización y preservación de campos); no suprimir hooks como workaround.
8. Probar en Wix Sandbox dos writers simultáneos, mismo movimiento repetido, movimientos diferentes, conflicto de versión, timeout con resultado incierto y reentrega. Verificar que no se pierden incrementos ni se duplica el movimiento.

### Bloqueos antes de implementación
- Confirmar tipo/propiedad de la colección `CajaActual` (user-created vs Wix app collection).
- Confirmar que `items.patch` y `items.filter` están disponibles y sus tipos exactos en `@wix/data@1.0.527` instalado.
- Confirmar condición sobre el campo anidado `sequenceCounters.seqGlobal` y el resultado devuelto cuando no coincide.
- Confirmar que el hook de CajaActual recibe un item compatible con su contrato durante Patch.
- Verificar que todos los escritores están migrados en una única PR coordinada.

**Decisión actual:** este es el candidato preferente para el spike H-01, pero no se declara CAS probado ni se cambia el writer hasta superar los bloqueos anteriores. La documentación confirma condición y patch atómico de campos; la garantía efectiva para este singleton depende de la elegibilidad de la colección, el filtro, el hook y el runtime real.


## 13. Revalidación del contrato Wix bulkPatch y elegibilidad de CajaActual — 2026-11-20

> Esta sección supersede los bloqueos de elegibilidad de colección recogidos en la sección 12: la consulta live posterior confirmó `collectionType=NATIVE`. No supersede los bloqueos de hook, semántica de condición, concurrencia runtime ni migración de escritores.

### Evidencia CMS directa
- Consulta read-only a `GET /data/v2/collections/CajaActual` en el sitio Marian Madrid: `collectionType=NATIVE`, `id=CajaActual`, `revision=18`.
- La enumeración oficial Wix define `NATIVE` como colección creada por el usuario y `WIX_APP` como colección creada por una app Wix. Por tanto, CajaActual sí cumple el requisito de tipo de colección para usar Patch/Bulk Patch; este bloqueo anterior queda resuelto.
- El esquema devuelve `sequenceCounters: OBJECT`, además de `singletonKey`, `snapshotSource`, `traceId` y los campos de proyección. No se ha leído ni modificado el contenido del singleton en esta consulta.

### Contrato SDK confirmado y alcance real
- La documentación SDK de `@wix/data` confirma `items.bulkPatch(dataCollectionId, itemIds, fieldModifications, options)`, acciones `SET_FIELD`, `INCREMENT_FIELD`, `APPEND_TO_ARRAY`, `REMOVE_FIELD` y `REMOVE_FROM_ARRAY`, y `options.condition.filter`.
- Wix documenta que los incrementos se aplican atómicamente en servidor y que la condición filtra qué elementos reciben las modificaciones. La operación dispara el evento `Data Item Updated` por cada elemento patchado.
- El repositorio ya contiene `bulkPatchItems()` y una allowlist restrictiva `DATA_ACCESS_BULK_PATCH_POLICY`, actualmente limitada a tipos concretos de `ControlOperativo`. No existe aún una política autorizada para `CajaActual`; no se debe ampliar la allowlist de forma genérica.
- El método REST/SDK permite `suppressHooks` en opciones de backend, pero la documentación consultada de `CajaActual_beforeUpdate` solo especifica que el hook se dispara antes de una operación `update()`. No queda demostrado en la documentación consultada que el flujo Bulk Patch invoque el hook con un payload compatible. Esto requiere prueba controlada en Sandbox antes de depender del hook como barrera de validación.

### Inventario ampliado de escritores que deben coordinarse
1. `src/backend/cajas.web.js::_updateCajaActual`: `dalUpdate(CAJA_ACTUAL_COL, cashRegister)` para proyectar movimientos.
2. `src/backend/cajas.web.js` cierre Z: `dalSave(CAJA_ACTUAL_COL, cashRegister)` para actualizar estado de sesión.
3. `src/backend/fiscalLedgerLock.js`: asignación de secuencias global/anual y liberación/compensación de secuencia mediante `dalUpdate(CASH_COL, ...)`.
4. `src/backend/tpv/tpvQaRepository.js::_writeCajaProjection`: `updateItem(CAJA_ACTUAL, next)` para proyección QA.
5. `src/backend/tpv/tpvQaRepository.js` alta/cambio de sesión QA: `updateItem(CAJA_ACTUAL, updated)`.

La migración debe cubrir todos estos escritores en una sola intervención coordinada. Mantener un solo writer con reemplazo completo anularía la garantía de concurrencia del resto.

### Decisión técnica actualizada
- El candidato principal pasa a ser `items.bulkPatch()` con condición explícita sobre el estado/versionado leído y modificaciones parciales atómicas. No se recomienda basar el control en retries sobre `updateItem()` ni en una lectura fuerte aislada.
- No se aprueba todavía la implementación: faltan confirmar con prueba Sandbox (a) semántica de condición no coincidente y resultados por elemento, (b) soporte del filtro para los campos elegidos, (c) ejecución/forma de hooks, (d) preservación de los invariantes del objeto OBJECT `sequenceCounters`, y (e) reintentos seguros ante timeout incierto.
- La prueba debe cubrir dos movimientos concurrentes distintos, repetición del mismo movimiento, colisión de secuencia fiscal, rollback de reserva solo bajo lock, fallo/timeout tras commit y relectura fuerte de reconciliación. No usar registros operativos existentes como fixture de prueba.

### Estado de la intervención
- Verificado: tipo de colección NATIVE y esquema OBJECT mediante API Wix read-only.
- Verificado documentalmente: SDK Bulk Patch, condición, modificaciones atómicas y evento Data Item Updated.
- Verificado en código: bulkPatch DAL existente para ControlOperativo; writers CajaActual aún usan update/save completos.
- Pendiente: hook bajo Bulk Patch, respuesta de condición fallida, concurrencia runtime y migración coordinada.
- No se realizaron escrituras CMS, cambios de permisos, cambios runtime ni publicación. Producción permanece NO-GO.

### Referencias oficiales Wix
- [Get Data Collection](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection)
- [Bulk Patch Data Items — SDK](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-patch-data-items?apiView=SDK)
- [Bulk Patch Data Items — REST](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-patch-data-items)
- [Velo beforeUpdate hook](https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-update)
