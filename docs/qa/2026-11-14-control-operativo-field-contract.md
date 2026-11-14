> **Nota de vigencia — 2026-11-14:** este documento conserva el resultado de CI del SHA ad15d311fec06aa3f54afe6c5f1f0f923aef9f45. No valida el HEAD actual de fix/current-site-cms-contract-alignment. PR #370 está dirty y no tiene checks asociados al HEAD actual; rebase y CI pendientes. El sitio objeto de trabajo es el banco de pruebas aislado 50b39f33-e753-4331-ab35-b2ed43dc97f7, sin actividad real.

# Contrato condicional de ControlOperativo — revisión del CSV sintético

- Fecha: 2026-11-14
- Fuente de datos: CSV sintético aportado por el propietario en la conversación.
- Código de contraste: rama `main` en el momento de crear esta corrección.
- Alcance: revisión de celdas vacías por `controlType` y corrección del contrato de `WEBHOOK_CLAIM`.
- Límite: el CSV no acredita por sí solo el esquema live actual de Wix ni permite inferir que todas las filas existan en producción.

## 1. Resultado del análisis

El CSV contiene 23 filas sintéticas:

| controlType | Filas | Lectura |
|---|---:|---|
| `IDEMPOTENCY` | 2 | Estado transaccional en `payload`; campos de reserva se completan durante la saga. |
| `RATE_LIMIT` | 3 | Estado GCRA persistido en campos top-level y `payload.tat`. |
| `DAYS_CACHE` | 3 | Caché por servicio, ubicación, conjunto de recursos, complementos y mes. |
| `WEBHOOK_CLAIM` | 6 | Reclamación con propietario, versión, estado, lease y contador de intentos. |
| `WEBHOOK_EVENT` | 6 | Marcador de auditoría/deduplicación; `processedAt` forma parte de `payload`. |
| `SLOT_LOCK` | 3 | Bloqueo temporal por recurso/servicio; las filas del ejemplo están liberadas. |

Los campos de una colección polimórfica no son obligatorios para todos los tipos. No se deben rellenar celdas vacías con valores ficticios ni imponer un esquema plano común a todos los registros.

## 2. Celdas vacías que son correctas según el proceso

- `IDEMPOTENCY.status`: el estado de la transacción se conserva en `payload.status` y el lector `_readTransaction()` consulta primero ese valor. `resourceId` forma parte del resultado de la reserva en `payload.result`; no es una columna de control requerida. `operationDate` no participa en este contrato.
- `DAYS_CACHE.resourceId`: la clave incluye el hash del conjunto de recursos, no un único recurso. La ubicación se conserva en `payload.locationId`; el valor vacío top-level evita representar falsamente una consulta multi-recurso como una consulta de recurso único. `dateYmd` contiene el mes `YYYY-MM`, mientras el payload conserva `yearMonth`, `fromLocal` y `toLocal`.
- `RATE_LIMIT.retryAfter`: es un dato de respuesta del WebMethod; no forma parte del estado persistido. El estado GCRA se conserva en `payload.tat`, con `requestCount`, `windowStart`, `version` y `expiresAt`.
- `WEBHOOK_EVENT.processedAt`: el CSV solo lo muestra dentro de `payload`, pero el esquema tiene un campo `DATETIME` superior y el writer conoce el instante. Se completa también en el campo superior para consulta directa.
- `SLOT_LOCK.slotStart/slotEnd`: las claves deterministas codifican inicio y fin en minutos epoch. El writer los persiste ahora como `DATETIME`. Las tres filas del CSV muestran `payload.lockStatus=RELEASED` y `expiresAt=1970-01-01T00:00:00Z`, que es el sentinel de expiración usado al liberar el lock, no una caducidad activa.

## 3. Discrepancias reales y correcciones de writer

### WEBHOOK_CLAIM

En el CSV, `attempts` y `expiresAt` superiores aparecen vacíos, aunque el proceso necesita el contador de intentos y el lease. El código ya se había corregido para persistirlos en los campos canónicos.

La revisión del esquema raíz revela además que `ownerToken` no pertenece a los 42 campos CMS. El fencing debe usar `traceId`, que sí es canónico y obligatorio. El código ya no escribe ni compara `ownerToken`; lo rechaza en nuevas escrituras. La compatibilidad con filas antiguas conserva únicamente el fallback de `payload.attempt` y `payload.leaseExpiresAt`, y normaliza los datos en la siguiente transición.

### WEBHOOK_EVENT

El CSV deja vacío el campo superior `eventType`, aunque `payload.eventType` existe. El diccionario CMS describe expresamente `eventType` como duplicado superior para consultas indexadas. Los dos writers identificados (`events.js` y `crons.js`) ahora persisten `eventType` y `processedAt` también en campos superiores, conservando las copias del payload. El hook valida ambos valores.

### SLOT_LOCK de reserva

El código genera `dedupeKey` con minutos epoch de inicio y fin, pero no persistía esos instantes en `slotStart` y `slotEnd`. El writer ahora los deriva de la misma clave determinista y los guarda como `Date`. No se exige ese rango para los SLOT_LOCK fiscales/contables, que no representan una cita.

### IDEMPOTENCY

El writer usa `pairToken` como `_id` pero no lo escribía explícitamente en el campo superior `pairToken`. Ahora persiste ambos valores con la misma identidad.

### Campos que permanecen intencionadamente vacíos

- `DAYS_CACHE.resourceId`: el registro representa un conjunto/hash de recursos; la ubicación y el rango están en `payload`. No se inventa un recurso único.
- `IDEMPOTENCY.resourceId`: el resultado se conserva en `payload.result`; en operaciones duales un único recurso superior sería ambiguo.
- `SLOT_LOCK.slotStart/slotEnd`: N/A para locks fiscales/contables; se completan para locks de reserva.
- `operationDate` y campos no relacionados con el tipo de control: no forman parte del contrato de los seis tipos presentes en el CSV.
- `retryAfter` y `nextRetryAt`: no existen en el esquema CMS y no se persisten.

## 4. Campos retirados o no persistibles

No reintroducir por rellenado automático:

- `ownerToken`, `retryAfter`, `nextRetryAt`: no pertenecen a los 42 campos del esquema raíz y se rechazan en nuevas escrituras.
- `attempt`: alias singular retirado; usar `attempts`.
- `leaseExpiresAt`: alias retirado; usar `expiresAt`.
- `processedAt` ya no se deja solo en payload para WEBHOOK_EVENT: también se escribe como DATETIME superior.

El CSV contiene encabezados adicionales, pero no demuestra que esas columnas existan en el esquema CMS. El contrato de código se alinea con el inventario raíz; el readback del esquema live de Wix sigue siendo una validación externa pendiente.

## 5. Archivos modificados

- `src/backend/webhookEventClaims.js`: lease y contador pasan a campos canónicos top-level; fencing por `traceId`; lectura transitoria compatible con filas legacy.
- `src/backend/README.md`: actualizar el contrato documental de fencing de `ownerToken` a `traceId`.
- `src/backend/booking/bookingCore.js`: persiste `pairToken`, `slotStart` y `slotEnd` en controles de transacción/bloqueo.
- `src/backend/events.js` y `src/backend/crons.js`: persisten `eventType` y `processedAt` superiores en `WEBHOOK_EVENT`, incluidos los marcadores de reconciliación de pedidos.
- `src/backend/internalConfig.js`: política CAS de `WEBHOOK_CLAIM` permite `attempts` y `expiresAt`.
- `src/backend/validation.js`: validación específica de `WEBHOOK_CLAIM` y `WEBHOOK_EVENT`.
- `src/backend/tests/webhookEventClaims.test.mjs`: pruebas de persistencia canónica y recuperación de formato legacy.
- `src/backend/tests/controlOperativo.hooks.test.mjs`: pruebas del contrato del hook CMS.
- `src/backend/tests/dataAccess.bulkPatch.policy.test.mjs`: prueba de autorización CAS de los campos top-level canónicos.
- `src/backend/tests/booking.core.concurrency.test.mjs`: pruebas de rango del slot y `pairToken`.
- `src/backend/tests/events.native-booking-sync.test.mjs`: pruebas de `eventType` y `processedAt` superiores.
- `src/backend/tests/crons.jobsConfigParity.test.mjs`: prueba de los campos superiores en marcadores de reconciliación.

## 6. Validación

**CI: PASS**

En el HEAD `ad15d311fec06aa3f54afe6c5f1f0f923aef9f45`:

- Layer 1: 23 suites, 296 pruebas PASS.
- Layer 2: 18 suites, 245 pruebas PASS.
- Regresión offline completa: 69 suites, 632 pruebas PASS, 0 FAIL.
- Contratos SDK Wix (Data, eCommerce Transactions y Bookings Reader V2): PASS.
- ESLint: PASS.
- Gitleaks / Secret scanning: PASS.

Pruebas focalizadas incluidas: claims webhook (8), hooks ControlOperativo (8), concurrencia booking/slot (42), reconciliación de pedidos (29) y sincronización de eventos nativos (24).

**Pendiente fuera de CI:** no se ha ejecutado Wix Local Editor, en aquella ejecución no se había leído el esquema live de Wix; la lectura vigente se documenta en docs/audits/2026-11-14-current-site-cms-normalization.md ni se ha hecho E2E contra el sitio aislado actual. No se ha escrito en CMS live ni publicado en Wix. El resultado acredita regresión offline y contratos SDK, no runtime Wix.

No modificar filas reales para completar columnas vacías: las filas históricas no se backfillean en esta intervención. Las pruebas live deben usar registros sintéticos identificados y el banco de pruebas aislado.
