# Auditoría live de ControlOperativo — 2026-11-20

## 1. Alcance y método

- Sitio QA: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Colección: `ControlOperativo`.
- Lecturas: Wix Data Collections API `GET /data/v2/collections/ControlOperativo` y Wix Data Items API `POST /data/v2/items/query`, `consistentRead=true`, paginación offset, límite 1000 y `returnTotalCount=true`.
- Resultado: HTTP 200 en ambas llamadas; 58/58 registros recuperados. No se realizaron escrituras, migraciones ni purgas.
- Esquema físico: revisión 93; 32 campos totales (28 de negocio y 4 de sistema).

Fuentes oficiales:
- [Get Data Collection](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection)
- [Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)

## 2. Esquema físico observado

Campos de negocio (key y tipo Wix):

| Campo | Tipo | Required CMS |
|---|---|---:|
| eventType | TEXT | No |
| controlType | TEXT | Sí |
| dedupeKey | TEXT | Sí |
| traceId | TEXT | Sí |
| status | TEXT | No |
| eventId | TEXT | No |
| expiresAt | DATETIME | No |
| bookingId | TEXT | No |
| resourceId | TEXT | No |
| serviceId | TEXT | No |
| dateYmd | TEXT | No |
| attempts | NUMBER | No |
| surface | TEXT | No |
| requesterKey | TEXT | No |
| requestCount | NUMBER | No |
| windowStart | DATETIME | No |
| payload | OBJECT | **Sí** |
| version | NUMBER | No |
| heartbeatAt | DATETIME | No |
| ownerToken | TEXT | No |
| transactionId | TEXT | No |
| orderId | TEXT | No |
| refundId | TEXT | No |
| kind | TEXT | No |
| processedAt | DATETIME | No |
| operationDescription | TEXT | No |
| lastError | TEXT | No |
| totalAmount | NUMBER | No |

Campos de sistema Wix: `_id`, `_createdDate`, `_updatedDate`, `_owner`.

**Corrección documental importante:** `ownerToken` sigue existiendo como campo físico TEXT en revisión 93. El código actual lo prohíbe en nuevas escrituras mediante `CONTROL_OPERATIVO_NON_CANONICAL_FIELDS`; eso no significa que Wix haya eliminado el campo. Se observaron seis claims históricos con ese campo. No eliminar el campo ni reescribir esos registros en esta intervención.

## 3. Distribución real por controlType

| controlType | Registros | Estados observados | Resultado de cobertura |
|---|---:|---|---|
| WEBHOOK_EVENT | 13 | COMPLETED: 13 | 7 completos según contrato actual; 6 históricos sin eventType y processedAt en raíz |
| WEBHOOK_CLAIM | 31 | COMPLETED: 31 | 25 canónicos completos; 6 históricos sin attempts/expiresAt y con ownerToken |
| COMPENSATION | 3 | PENDING_RECOVERY: 3 | Campos operativos observados completos; recuperación pendiente |
| DAYS_CACHE | 3 | Sin status raíz | Campos de caché presentes; estado/expiración viven en su contrato de caché |
| SLOT_LOCK | 3 | Sin status raíz | resourceId, serviceId, expiresAt, version, heartbeatAt y payload presentes; estado del lock en payload |
| IDEMPOTENCY | 2 | Sin status raíz | bookingId, serviceId, attempts, expiresAt y payload presentes; estado en payload |
| RATE_LIMIT | 3 | ACTIVE: 3 | requesterKey, surface, requestCount, version, windowStart, expiresAt y payload presentes |
| **Total** | **58** | | **7 tipos presentes de 15 tipos canónicos** |

Tipos canónicos sin registros en este corte: `ALERT`, `DISPLAY_TOKEN`, `DUAL_CACHE`, `DEDUPE_KEY`, `LEDGER_IDEMPOTENCY`, `SYSTEM_FLAG`, `TPV_QA_REFUND_LOCK`, `TPV_QA_SESSION_LOCK`. Ausencia de filas no demuestra que el contrato de sus productores haya sido probado.

## 4. Invariantes comunes y hallazgo corregido

En los 58 registros consultados:
- `controlType`, `dedupeKey`, `traceId` y `payload` estaban presentes.
- Los 58 `payload` eran objetos, no arrays ni escalares.
- No se detectaron valores no parseables en los campos DATETIME auditados.
- No se observaron campos legacy `attempt`, `leaseExpiresAt`, `payloadJson`, `retryAfter`, `nextRetryAt`, `createdAt` ni `updatedAt`.
- `ownerToken` aparece en seis claims históricos; permanece en el esquema físico aunque está vetado en nuevas escrituras.

**Defecto de validación corregido en esta rama:** el esquema Wix declara `payload` como OBJECT obligatorio, pero `assertControlOperativo()` no lo exigía y los fixtures base de SLOT_LOCK podían pasar sin `payload`. Se añade validación backend común que exige un objeto no nulo y prueba negativa para undefined, null, array y primitivos.

## 5. Evaluación por tipo

### WEBHOOK_EVENT
Contrato de escritura vigente: `eventId`, `eventType`, `processedAt`, `payload`, `dedupeKey`, `traceId`, `controlType`. Se mantienen append-only.
Seis filas antiguas tienen `eventType`/ `processedAt` dentro de payload pero no en raíz. Son evidencia histórica; no corregirlas mediante update.

### WEBHOOK_CLAIM
Contrato vigente: `eventId`, `eventType`, `status`, `version >= 1`, `attempts >= 1`, `expiresAt`, `payload`, `dedupeKey`, `traceId`. `traceId` es el fencing token canónico.
Seis filas históricas COMPLETED mantienen `ownerToken` y `payload.attempt`/`payload.leaseExpiresAt`, sin `attempts`/`expiresAt` en raíz. No son claims activos según estado observado. No modificar; documentar como legacy terminal.

### COMPENSATION
Las tres filas están en `PENDING_RECOVERY`, `attempts=0`, con `kind`, `orderId`, `transactionId`, `totalAmount`, `operationDescription`, `lastError` y payload estructurado. Esto es un control de recuperación abierto, no un control completado. No incrementar attempts ni reintentar ni rectificar el contenido sin una resolución transaccional autorizada. Ver issue #416.

### DAYS_CACHE
Las tres filas incluyen `serviceId`, `dateYmd`, `expiresAt`, `payload`, `traceId`, `dedupeKey`. `resourceId` puede ser cadena vacía en el contrato actual porque la disponibilidad puede consultarse sin recurso seleccionado. No exigir status raíz ni resourceId GUID genérico.

### SLOT_LOCK
Las tres filas incluyen `resourceId`, `serviceId`, `expiresAt`, `version`, `heartbeatAt`, `payload`. El estado y token de lock se conservan en payload; no duplicar automáticamente en status raíz. Revisar la liberación mediante el estado de payload y expiración.

### IDEMPOTENCY
Las dos filas incluyen `bookingId`, `serviceId`, `attempts`, `expiresAt`, `payload`, `traceId`, `dedupeKey`. El resultado/estado terminal se guarda dentro de payload. No exigir status raíz sin cambiar conjuntamente lectores y escritores.

### RATE_LIMIT
Las tres filas incluyen los campos GCRA persistidos: `requesterKey`, `surface`, `requestCount`, `windowStart`, `expiresAt`, `version`, `payload`, `status`. El estado de almacenamiento está presente.

## 6. Cambios de código incluidos en la rama

- `src/backend/validation.js`: `assertControlOperativo` exige `payload` objeto no nulo, coherente con el campo físico obligatorio de Wix.
- `src/backend/tests/controlOperativo.hooks.test.mjs`: fixtures base incluyen payload; añade pruebas negativas de payload ausente, null, array y primitivo y prueba positiva de objeto.

No se añaden requisitos globales a `status`, `expiresAt`, `resourceId` ni otros campos que son condicionales por tipo. Hacerlos obligatorios indiscriminadamente rompería contratos válidos de cachés, claims históricos o locks.

## 7. Riesgos y tareas pendientes

1. **Legacy terminal WEBHOOK_EVENT (6):** conservar inmutable; solo consumidores de consulta deben tolerar ausencia de columnas indexadas en esos eventos antiguos.
2. **Legacy terminal WEBHOOK_CLAIM (6):** conservar sin mutar. Verificar que ningún proceso de recuperación intente reactivar claims COMPLETED incompletas.
3. **COMPENSATION (3):** P0 abierto; correlación económica y conciliación antes de cualquier reintento. Issue #416.
4. **Cobertura de tipos no observados:** añadir pruebas de contrato para ALERT, DISPLAY_TOKEN, DUAL_CACHE, DEDUPE_KEY, LEDGER_IDEMPOTENCY, SYSTEM_FLAG y los dos locks TPV. No se consideran probados solo por ausencia de registros.
5. **Runtime Wix:** la auditoría de lectura CMS confirma datos y esquema, pero no prueba que los hooks Velo se ejecuten igual en producción/Preview ni que los CAS tengan semántica concurrente correcta.
6. **Permisos:** comprobar con identidad colaborador, no solo propietario/admin.
7. **Diccionario CMS:** revisar la entrada histórica de ControlOperativo para reflejar revisión 93 y distinguir campo físico de campo no canónico de escritura.

## 8. Criterio de cierre

La rama solo podrá integrarse cuando CI supere pruebas de validación. La colección live no se ha modificado. La validación runtime, los legacy terminales y las tres compensaciones permanecen abiertos. No habilitar escritores fiscales/contables ni publicar como consecuencia de esta auditoría.


## 9. Seguimiento de CI y auditoría de productores — 20/11/2026

La primera ejecución de CI tras exigir `payload` detectó tres fallos en `reservas.web.test.mjs`. La traza reproducible mostraba que `reservas.web.js::_generateDisplayToken()` insertaba `DISPLAY_TOKEN` sin `payload` y escribía `maxAttempts` en raíz, aunque ese campo no existe en el esquema físico de revisión 93.

Correcciones aplicadas en esta rama:
- `DISPLAY_TOKEN`: `payload.maxAttempts` pasa a ser el almacenamiento canónico; el consumidor lee ese valor y usa el límite configurado como fallback para credenciales antiguas. Se valida `bookingId`, `attempts >= 0`, `expiresAt` y `payload.maxAttempts >= 1`.
- `LEDGER_IDEMPOTENCY`: la reserva creada desde `cajas.web.js` ahora incluye `payload` objeto, con fecha de reserva y transactionId. El transactionId continúa en su campo físico raíz.
- `COMPENSATION` de `bookingSaga.js`: se sustituye el campo raíz no declarado `compensationKind` por el campo físico `kind`; `revision` permanece dentro de `payload`.
- `IDEMPOTENCY` de `bookingCore.js`: se elimina `pairToken` raíz no declarado; el identificador estable ya es `_id` y la deduplicación queda en `dedupeKey`.
- `SYSTEM_FLAG`: los diarios de reprogramación dual y las marcas de inconsistencia conservan `pairToken` dentro de `payload`, no como campo raíz no declarado.
- `SLOT_LOCK` de reservas: `slotStart` y `slotEnd` se conservan dentro de `payload`; no son columnas físicas en revisión 93. Los locks fiscales/contables no requieren rango de cita.
- `assertCanonicalControlFields` aplica ahora una allowlist de las 28 columnas de negocio y los metadatos de sistema Wix; rechaza nuevos campos raíz no declarados. La normalización de fechas del hook se limita a las columnas DATETIME físicas.
- `SYSTEM_FLAG` de cancelación dual: los metadatos de clasificación pasan a `eventType` (campo físico) y `severity/message` dentro de `payload`.
- `ALERT`: el tipo de alerta se expone mediante `eventType` (campo físico); los metadatos no físicos `alertType`, `severity`, `message` y `operationDate` dejan de escribirse en raíz. Los crons consultan por `eventType`.

Se han actualizado pruebas de tokenización, hooks, reconciliación y alertas. Estas modificaciones son de código y pruebas; no se han escrito datos Wix ni se han migrado registros históricos.

**Pendiente de validar:** la nueva revisión de CI debe demostrar que los productores y consumidores actualizados mantienen los contratos; después se requiere revisión del diff y una prueba runtime controlada en Sandbox. La auditoría de código ha detectado que el diccionario CMS histórico y algunos contratos anteriores describían campos raíz que ya no figuran en revisión 93. No se deben recrear esos campos en Wix sin una decisión explícita de modelo; la alineación actual se hace con el esquema físico observado.
