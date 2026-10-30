# ADR-004 — Rate limiting persistente en ControlOperativo

- **Estado:** INVESTIGACIÓN ABIERTA — bloqueante; no aprobado para producción.
- **Fecha:** 2026-10-30
- **Ámbito:** backend Velo, superficies públicas de reservas y disponibilidad.
- **Fuentes documentales del proyecto:** BIBLIA SSOT v10.0, CMS KEYFIELDS.md revisión 15, ANEXO BIBLIA POR WIX y código de la rama auditada.
- **Fuentes técnicas externas:** documentación oficial Wix Data SDK, Patch Data Item.

## Contexto verificado

La BIBLIA SSOT v10.0 exige persistir el rate limiting en `ControlOperativo`, con `controlType = "RATE_LIMIT"`. Define estos límites:

| Surface | Máximo | Ventana |
|---|---:|---:|
| `public-booking` | 5 | 10 segundos |
| `reservas` | 20 | 5 segundos |
| `availability` | 12 | 5 segundos |

El esquema CMS observado de `ControlOperativo` (revisión 15) contiene `controlType`, `dedupeKey`, `traceId`, `status`, `expiresAt`, `surface`, `requesterKey`, `requestCount`, `windowStart`, `retryAfter`, `payload`, `version` y `processedAt`. No consta índice único para `dedupeKey`.

## Hallazgo de auditoría

La implementación de PR #19 usa un `Map` en memoria. La rama `main` también conserva conteo local y registra bloqueos prolongados en `RateLimitBlocks`, no el 100% del conteo en `ControlOperativo`.

Existe una divergencia documental que impide declarar sin reservas que v10.0 sea la última autoridad: `internalConfig.js` de PR #19 atribuye la retirada de `CONTROL_TYPE.RATE_LIMIT` a una SSOT v13.0 (2026-10-19), pero esa versión no está entre los documentos canónicos entregados para esta auditoría. Los documentos entregados incluyen la BIBLIA v10.0 y anexos, no una aprobación formal de v13.0 ni una matriz de precedencia. Por tanto, la decisión de restaurar o mantener retirado `RATE_LIMIT` debe reconciliarse documentalmente antes de cambiar el contrato CMS.

## Investigación de Wix Data — actualización 2026-10-30

La primera inspección no detectó una operación atómica porque la capa `backend/dataAccess.js` no expone Patch Data Item. La documentación oficial vigente sí confirma una primitiva relevante:

- SDK: `import { items } from "@wix/data"`.
- Firma: `items.patch(dataCollectionId, itemId, fieldModifications, options)`.
- Acción `INCREMENT_FIELD`: Wix documenta que el incremento se realiza atómicamente en el servidor y evita lost updates entre escritores concurrentes.
- `options.condition.filter`: permite aplicar el patch sólo si el elemento satisface un filtro.
- El campo `traceId` existe en el esquema CMS y podría recibir un token único de intento en la misma operación que incrementa `requestCount`.

Referencia oficial: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/patch-data-item?apiView=SDK

Esto corrige el hallazgo preliminar: **Wix Data sí dispone de incremento atómico**. No demuestra todavía, por sí solo, que el patrón completo de admisión sea seguro. La documentación consultada describe el incremento como atómico, pero no declara expresamente la semántica de serialización de `condition.filter` bajo concurrencia ni el resultado exacto de una condición que no coincide.

### Diseño candidato a validar

1. Ventana fija por `surface + requesterKey + windowStart`, con un identificador determinista del registro dentro de `ControlOperativo`.
2. Primer intento: insertar el registro con `requestCount = 1` y `traceId` único. El ID determinista evita crear dos contadores independientes para la misma clave/ventana; los duplicados deben resolverse mediante patch.
3. Intentos siguientes: `items.patch` con `INCREMENT_FIELD` sobre `requestCount`, `SET_FIELD` sobre `traceId` y `condition.filter` que limite el incremento a `requestCount < maxRequests`.
4. Permitir la petición sólo si la respuesta del patch demuestra que se aplicó el incremento de ese intento (por ejemplo, devolviendo su `traceId`). Si no se puede distinguir con certeza un patch aplicado de una condición no satisfecha, no se acepta este diseño.
5. Ejecutar pruebas de concurrencia reales en Wix QA, con múltiples instancias y ráfagas simultáneas, además de reinicio de contenedor, expiración de ventana y fallo CMS.

El paso 4 es una condición crítica: no debe inferirse que un patch fue aplicado simplemente porque la llamada no lanzó una excepción. Debe verificarse el contrato de respuesta de la condición y probarse en el runtime real.

## Decisiones pendientes

1. Obtener y aprobar la SSOT v13.0 o una decisión formal que determine si v10.0 sigue siendo vinculante para rate limiting.
2. Confirmar que el hook de `ControlOperativo` admite `RATE_LIMIT` y los campos propuestos; el enum actual de PR #19 no lo admite.
3. Implementar el adaptador `items.patch` en la capa central `dataAccess.js`, sin dispersar acceso CMS.
4. Probar el resultado de `condition.filter` cuando no se cumple y su comportamiento bajo concurrencia.
5. Confirmar si los límites v10.0 siguen vigentes y si son por ventana fija o deslizante; v10.0 define los máximos y ventanas, pero el algoritmo debe quedar explícito.
6. No introducir una colección alternativa ni un almacén externo antes de completar estas verificaciones.

## Criterios de aceptación

1. Precedencia documental resuelta y aprobada.
2. Todo intento requerido persiste en `ControlOperativo` con el tipo y los campos canónicos aprobados, sin PII innecesaria.
3. Clave normalizada y aislada por superficie.
4. Límites y ventanas exactos de la SSOT vigente.
5. Pruebas concurrentes en Wix QA demuestran que no se excede el máximo entre instancias.
6. Estado conservado tras reinicio de instancia.
7. Fallos CMS no degradan silenciosamente a un límite local presentado como global.
8. Limpieza de registros expirados sin borrar controles activos.
9. Manifiesto Wix generado por Wix CLI y regla ESLint de imports backend reactivada.

## Impacto sobre PR #19

PR #19 permanece bloqueada para merge y despliegue hasta resolver la precedencia documental, validar el patrón atómico en Wix QA y completar los controles de integración. El CI offline no acredita estas garantías.
