# Endurecimiento de bulkPatchItems — 2026-11-11

## Objetivo

Limitar la escritura masiva condicional elevada a los tres contratos de dominio que usan actualmente `bulkPatchItems`, evitando que esta primitiva pueda parchear colecciones fiscales, financieras, de reservas o registros append-only.

## Evidencia de consumidores en main

Búsqueda completa de referencias de código: tres consumidores, todos en `ControlOperativo`.

- `security.js`: `RATE_LIMIT`; actualiza `payload`, `requestCount`, `version` y `expiresAt`, condicionado por `controlType + version`.
- `bookingCore.js`: `SLOT_LOCK`; actualiza `expiresAt`, `heartbeatAt`, `payload`, `version` y opcionalmente `serviceId`, condicionado por `controlType + version` o `controlType + expiresAt`.
- `citasManager.web.js`: `SYSTEM_FLAG`; actualiza `payload`, `version` y `traceId`, condicionado por `controlType + version`.

## Cambio

- Política centralizada en `internalConfig.js`.
- Nuevo validador puro `dataAccessPolicy.js`.
- `dataAccess.bulkPatchItems` valida colección, tipo de registro, campos, acciones y condición CAS antes de construir la operación elevada.
- `WEBHOOK_EVENT`, ledgers, colecciones de negocio y cualquier otro tipo quedan fuera de la política.

## Riesgos y límites

- No se alteran los tres contratos actuales; las pruebas de política los reproducen.
- Las primitivas generales `insertItem`, `updateItem`, `removeById`, `bulkInsert`, `bulkUpdate` y `bulkRemove` siguen siendo elevadas y requieren una auditoría de dominio separada. Este cambio cierra solo la superficie de `bulkPatchItems`; no se declara resuelto BUG-10 en su totalidad.
- No se han modificado datos Wix ni se ha desplegado código.

## Validación

- Suite nueva: cinco pruebas puras para contratos permitidos y denegaciones.
- CI del PR pendiente.
- Wix Preview no es necesario para probar el rechazo previo a invocar el SDK; runtime Wix sigue pendiente para los flujos operativos completos.
