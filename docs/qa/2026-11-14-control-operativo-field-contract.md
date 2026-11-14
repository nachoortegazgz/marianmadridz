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
- `WEBHOOK_EVENT.processedAt`: el instante de procesamiento se guarda en `payload.processedAt`; no se requiere una segunda copia top-level.
- `SLOT_LOCK.slotStart/slotEnd`: el escritor actual coordina el bloqueo mediante su clave determinista, `resourceId`, `serviceId`, `expiresAt` y metadata de `payload`; esos campos no son leídos por el flujo actual. Las tres filas del CSV muestran `payload.lockStatus=RELEASED` y `expiresAt=1970-01-01T00:00:00Z`, que es el sentinel de expiración usado al liberar el lock, no una caducidad activa.

## 3. Discrepancia real: WEBHOOK_CLAIM

En las seis filas `WEBHOOK_CLAIM`:

- `expiresAt` top-level está vacío, aunque el lease es necesario para decidir si otra entrega debe esperar o recuperar el claim.
- `attempts` top-level está vacío, aunque el proceso cuenta reintentos.
- El código anterior guardaba ambos datos dentro de `payload` como `leaseExpiresAt` y `attempt`.

Esto no estaba alineado con el contrato físico disponible: `expiresAt` y `attempts` son campos canónicos de la colección; `leaseExpiresAt` y `attempt` no deben seguir siendo aliases persistidos.

### Corrección implementada en esta rama

1. El alta inicial escribe `expiresAt` y `attempts=1` top-level.
2. La recuperación de un claim vencido lee primero `expiresAt` y, solo para compatibilidad con registros anteriores, acepta temporalmente `payload.leaseExpiresAt`.
3. El contador se recupera desde `attempts`; como fallback de migración lee `payload.attempt`. Después lo escribe en `attempts` top-level.
4. La recuperación elimina `attempt` y `leaseExpiresAt` del payload reescrito.
5. Las transiciones de finalización y fallo actualizan `expiresAt` top-level con el instante terminal.
6. La política CAS permite modificar únicamente `attempts` y `expiresAt` adicionales, manteniendo las condiciones de fencing `controlType + status + ownerToken + version`.
7. `assertControlOperativo()` exige para `WEBHOOK_CLAIM`: `eventId`, `eventType`, estado válido, `ownerToken`, `version >= 1`, `attempts >= 1` y `expiresAt` válido.

## 4. Campos retirados o no persistibles

No reintroducir por rellenado automático:

- `retryAfter`: valor calculado de respuesta, no estado CMS.
- `nextRetryAt`: sin consumidor/escritor activo acreditado en la auditoría de código.
- `processedAt` top-level: no es necesario; los eventos lo guardan dentro de `payload`.
- `attempt` top-level: alias singular retirado; usar `attempts`.
- `leaseExpiresAt` top-level o dentro del payload: alias retirado; usar `expiresAt`.

El CSV contiene esos encabezados. Eso no demuestra que las columnas sigan existiendo en el esquema live: la comprobación del esquema debe hacerse contra Wix CMS, no contra los encabezados de una exportación.

## 5. Archivos modificados

- `src/backend/webhookEventClaims.js`: lease y contador pasan a campos canónicos top-level; lectura transitoria compatible con filas legacy.
- `src/backend/internalConfig.js`: política CAS de `WEBHOOK_CLAIM` permite `attempts` y `expiresAt`.
- `src/backend/validation.js`: validación específica de los campos obligatorios del claim.
- `src/backend/tests/webhookEventClaims.test.mjs`: pruebas de persistencia canónica y recuperación de formato legacy.
- `src/backend/tests/controlOperativo.hooks.test.mjs`: pruebas del contrato del hook CMS.
- `src/backend/tests/dataAccess.bulkPatch.policy.test.mjs`: prueba de autorización CAS de los nuevos campos top-level.

## 6. Validación pendiente

La corrección está en una rama Git y requiere CI completo. No se ha ejecutado Wix Local Editor, no se ha escrito en CMS live y no se ha publicado en Wix. Antes de darla por terminada deben pasar:

- Suite de claims webhook: alta, concurrencia, expiración, recuperación, fencing, fallo/reintento y finalización.
- Hooks CMS: rechazo de claims incompletos.
- Política CAS: aceptación de `attempts` y `expiresAt` solo bajo el fencing vigente.
- Suite backend completa y revisión del diff.
- Prueba sintética controlada en QA Wix y readback de los campos top-level.

No modificar filas reales para completar columnas vacías: los registros legacy se normalizan en el siguiente ciclo de recuperación autorizado, y la prueba live debe usar datos sintéticos identificados.
