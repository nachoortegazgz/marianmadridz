# Limpieza de deuda técnica — claims de webhooks

**Fecha:** 2026-11-14  
**Sitio:** banco de pruebas aislado actual, sin actividad real  
**Rama:** `refactor/remove-proven-legacy-webhook-claim`  
**Alcance:** exclusivamente recuperación de `WEBHOOK_CLAIM` y cobertura de pruebas.

## Hallazgo verificado

`src/backend/webhookEventClaims.js` mantenía dos rutas de lectura legacy:
- `payload.leaseExpiresAt` como alternativa a `expiresAt`.
- `payload.attempt` como alternativa a `attempts`.

El esquema físico canónico de `ControlOperativo` declara `expiresAt` (DATETIME) y `attempts` (NUMBER). El validador `assertControlOperativo` ya exige ambos campos válidos para `WEBHOOK_CLAIM`. El inventario CMS del sitio actual registra cero elementos en `ControlOperativo`; por tanto, no hay filas activas que requieran conversión durante la recuperación. La compatibilidad duplicaba contratos y permitía que datos no canónicos eludieran el esquema vigente.

## Cambio mínimo

- La recuperación consulta exclusivamente `existing.expiresAt` y `existing.attempts`.
- Se eliminan los fallbacks a propiedades anidadas y la limpieza posterior de esos alias.
- Se conserva el payload como objeto, sin mutarlo.
- La prueba legacy se sustituye por una regresión que demuestra que las propiedades anidadas no son aceptadas como sustituto de los campos canónicos.
- La suite `webhookEventClaims.test.mjs` se incorpora explícitamente al gate `test:layer2`; ya formaba parte de `npm test` por autodetección del runner general.

## Garantías preservadas

- Identidad determinista `[eventType,eventId]`.
- Inserción única y CAS.
- Fencing por `traceId + version`.
- Lease y contador en campos top-level.
- Rechazo de estados/contadores inválidos.
- Liberación retryable ante error y protección frente a propietarios antiguos.

## Validación y límites

- Evidencia estática: diff limitado a módulo, prueba, runner de Capa 2 y README de backend.
- Pendiente en esta rama: CI completa, ESLint, contratos SDK y secret scanning.
- No se han modificado colecciones, registros CMS, configuración Wix ni despliegues.
- La eliminación se limita al fallback de claims; no altera el tratamiento de `WEBHOOK_EVENT` ni otros controles operativos.

## Reversión

Revertir el commit de esta intervención si una prueba válida demuestra que el sitio actual contiene claims históricos que dependan de los alias retirados. La lectura CMS actual observada fue cero registros; no se ejecutó ninguna migración de datos.
