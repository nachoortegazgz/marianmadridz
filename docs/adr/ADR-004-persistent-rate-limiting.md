# ADR-004 — Rate limiting persistente en ControlOperativo

- **Estado:** PROPUESTO — bloqueante; no aprobado para producción.
- **Fecha:** 2026-10-30
- **Ámbito:** backend Velo, superficies públicas de reservas y disponibilidad.
- **Autoridad documental consultada:** BIBLIA SSOT v10.0, capítulos 14.3 y 20.1; ANEXO BIBLIA POR WIX, apartados 12 y 14; CMS KEYFIELDS.md, sección ControlOperativo.

## Contexto verificado

La SSOT v10.0 exige que el rate limiting de las superficies públicas persista en `ControlOperativo`, con `controlType = "RATE_LIMIT"`. Define estos límites:

| Surface | Máximo | Ventana |
|---|---:|---:|
| `public-booking` | 5 | 10 segundos |
| `reservas` | 20 | 5 segundos |
| `availability` | 12 | 5 segundos |

El esquema CMS observado de `ControlOperativo` (revisión 15) contiene los campos necesarios para representar el control: `controlType`, `dedupeKey`, `traceId`, `status`, `expiresAt`, `surface`, `requesterKey`, `requestCount`, `windowStart`, `retryAfter`, `payload`, `version` y `processedAt`. Los índices observados son por `controlType + expiresAt`, `controlType + nextRetryAt` y `controlType + status`; no consta un índice compuesto por `surface + requesterKey + windowStart`, ni unicidad sobre `dedupeKey`.

## Hallazgo de auditoría

La implementación en la rama de PR #19 usa exclusivamente un `Map` en memoria para contar solicitudes. La rama `main` tampoco satisface la SSOT: conserva conteo local y registra bloqueos prolongados en una colección separada `RateLimitBlocks`, no el 100% del conteo en `ControlOperativo`.

La constante `CONTROL_TYPE.RATE_LIMIT` está ausente en la rama del PR y el comentario de `internalConfig.js` atribuye su retirada a una SSOT v13.0. Esa versión no forma parte de los documentos canónicos aportados para esta auditoría. No se debe tratar esa referencia de código como una actualización documental aprobada.

## Decisión requerida

La dirección documental vigente para esta entrega es la SSOT v10.0: el conteo debe persistir en `ControlOperativo` bajo `RATE_LIMIT`, y los límites deben configurarse por superficie según la tabla anterior.

No se aprueba todavía una implementación basada en el patrón ingenuo consulta-contador + inserción/actualización: Wix Data no ofrece en el contrato de acceso inspeccionado una operación compare-and-swap o incremento atómico. Dos peticiones concurrentes pueden leer el mismo contador y exceder el máximo. El esquema CMS tampoco declara índice único que permita convertir `dedupeKey` en un cerrojo atómico. La persistencia por sí sola no demuestra aplicación estricta del límite.

Antes de implementar, debe seleccionarse y probarse un mecanismo de admisión concurrente seguro compatible con el runtime Wix. Si no existe una primitiva atómica verificable en la plataforma, se deberá documentar explícitamente el nivel de garantía alcanzable o aprobar un almacén externo con operación atómica. No se debe afirmar protección estricta si el mecanismo sólo es best-effort.

## Criterios de aceptación

1. Todo intento de las tres superficies queda registrado en `ControlOperativo` con `controlType = "RATE_LIMIT"`, sin almacenar PII innecesaria.
2. La clave de solicitante está normalizada y no permite colisiones triviales entre superficies.
3. Los límites y ventanas coinciden exactamente con la SSOT v10.0.
4. El resultado se mantiene tras reinicio de instancia y entre instancias.
5. Pruebas concurrentes demuestran que el máximo no se excede; una prueba secuencial no es suficiente.
6. Fallos de CMS no degradan silenciosamente a un límite local presentado como global.
7. Se verifica la limpieza de registros expirados sin borrar controles activos.
8. Se reactivan las reglas ESLint de imports Wix una vez generado el manifiesto oficial por Wix CLI.

## Impacto sobre el PR #19

PR #19 permanece bloqueado para merge y despliegue hasta resolver este ADR, implementar el mecanismo elegido y superar las pruebas de concurrencia. El CI offline existente no acredita la garantía de concurrencia del runtime Wix.
