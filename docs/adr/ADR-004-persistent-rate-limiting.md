# ADR-004 — Rate limiting persistente en ControlOperativo

- **Estado:** IMPLEMENTADO EN RAMA; pendiente de validación en runtime Wix antes de producción.
- **Fecha:** 2026-10-31
- **Ámbito:** backend Velo, reservas, disponibilidad, caja y agregación fiscal.
- **Fuente normativa aplicada:** BIBLIA SSOT v10.0 entregada y versionada en este repositorio.
- **Sitio de producción:** solo auditado en lectura; no se han escrito contadores ni cambiado CMS.

## 1. Decisión documental

La SSOT v10.0 exige persistencia del rate limiter en `ControlOperativo` con `controlType = "RATE_LIMIT"`. El código contenía comentarios que atribuían su retirada a una SSOT v13.0 (2026-10-19), pero no existe un documento v13.0 versionado en el repositorio ni entre las fuentes normativas aportadas para este trabajo.

Por tanto, y aplicando la única SSOT aprobada disponible, se restaura `CONTROL_TYPE.RATE_LIMIT`. No se ha cambiado el esquema CMS: `controlType` es TEXT y el inventario de producción ya contiene los campos necesarios.

## 2. Políticas

| Surface | Máximo de ráfaga | Ventana de recarga |
|---|---:|---:|
| `public-booking` | 5 | 10 s |
| `reservas` | 20 | 5 s |
| `availability` | 12 | 5 s |
| Otras superficies internas | 20 | 5 s |

Se aplica GCRA (Generic Cell Rate Algorithm): permite la ráfaga indicada y repone capacidad a razón de `windowMs / maxRequests`. Los tiempos internos se guardan como microsegundos enteros para evitar errores de redondeo.

## 3. Persistencia y concurrencia

Cada combinación de superficie, clave de solicitante y política tiene un único registro determinista en `ControlOperativo`:

- `_id`: hash SHA-256 de superficie, clave y política; no contiene PII.
- `controlType`: `RATE_LIMIT`.
- `surface`, `requesterKey`: superficie y hash del solicitante.
- `requestCount`: contador de solicitudes admitidas.
- `payload.algorithm`: `GCRA_V1`.
- `payload.tat`: theoretical arrival time, en microsegundos.
- `version`: versión de compare-and-set.
- `expiresAt`: expiración del registro tras inactividad.
- `traceId`, `dedupeKey`, `status`, `windowStart`: trazabilidad y estado.

El alta inicial usa `items.insert`; la colisión de ID se trata como concurrencia esperada. Cada admisión lee el registro con consistencia fuerte y ejecuta `items.bulkPatch` con:

1. condición `version == versionLeída`;
2. actualización de `payload.tat`;
3. `INCREMENT_FIELD` atómico de `requestCount` y `version`;
4. renovación de `expiresAt`.

Solo se admite la petición si la respuesta incluye el ID en `updatedItemIds`. Si otro escritor gana la condición, se vuelve a leer y reintentar (máximo 12 intentos). Contención agotada o error de persistencia: **fail-closed**, sin volver a un contador local.

Los WebMethods que consumen el limiter ahora esperan su resultado asíncrono en `reservas.web.js`, `citasManager.web.js`, `cajas.web.js` y `fiscalAggregator.web.js`.

## 4. Retención segura

El job `cleanExpiredRateLimits` se ejecuta cada 5 minutos. Consulta registros RATE_LIMIT expirados y usa `items.bulkRemove` con un segundo filtro servidor (`controlType = RATE_LIMIT` y `expiresAt < now`). Así, un registro renovado entre la consulta y el borrado no coincide con la condición de eliminación.

No se purgan otros subtipos de `ControlOperativo`; `WEBHOOK_EVENT` mantiene su protección append-only.

## 5. Estado de CMS

Auditoría de solo lectura realizada el 2026-10-31 sobre el sitio `188bed94-177c-4bc9-a9f0-35080d874f3e`:

- `ControlOperativo` existe como colección de usuario (`collectionType = NATIVE`), revisión 15.
- Están presentes `controlType`, `dedupeKey`, `traceId`, `status`, `expiresAt`, `surface`, `requesterKey`, `requestCount`, `windowStart`, `retryAfter`, `payload` y `version`.
- Los tipos de datos necesarios son compatibles: contadores/version NUMBER, expiraciones DATETIME, claves TEXT y payload OBJECT.
- Permisos de colección: CMS_EDITOR; las escrituras se ejecutan desde backend elevado.
- No se requiere índice único compuesto: la unicidad operativa se obtiene con el `_id` determinista del contador.

No se ha insertado ningún registro RATE_LIMIT en producción durante esta auditoría.

## 6. Limitaciones y pruebas pendientes

1. **Runtime Wix:** la suite offline simula la condición y el incremento atómico; aún falta una prueba de concurrencia real contra Wix Data en un entorno QA. La documentación oficial confirma incrementos atómicos en Bulk Patch y soporte de `condition.filter`, pero el mock no sustituye esa validación real.
2. **Identidad anónima:** `reservas.web.js` no dispone actualmente de una IP verificable dentro de estos WebMethods; las peticiones anónimas usan una clave común `anon:noip`. Esto puede hacer que visitantes distintos compartan el límite. `processDualBooking` usa miembro/email/anon; el email recibido del cliente no es una identidad fuerte. No se debe presentar este componente como protección anti-bot por IP.
3. **Manifiesto Velo:** `src/velo.dependencies.json` sigue pendiente de generación por Wix CLI. El workflow requiere el secreto GitHub `WIX_CLI_API_KEY`, que el conector no puede crear ni leer.
4. **ESLint:** `@wix/cli/no-invalid-backend-import` permanece temporalmente desactivada hasta que el manifiesto exista.
5. **Producción:** no fusionar ni publicar hasta ejecutar pruebas simples/duales, concurrencia, checkout, cancelación y compensación en Wix QA.

## 7. Fuentes oficiales Wix

- [Bulk Patch Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-patch-data-items?apiView=SDK) — incrementos atómicos, condición y resultado.
- [Bulk Remove Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-remove-data-items?apiView=SDK) — borrado condicionado y resultado.
- [Patch Data Item](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/patch-data-item?apiView=SDK).
- [Wix Data error codes](https://dev.wix.com/docs/rest/business-solutions/cms/wix-data-error-codes).

## 8. Criterios de aceptación restantes

- [x] Límites diferenciados por superficie y nombre canónico `public-booking`.
- [x] Estado persistente en `ControlOperativo` según SSOT v10.0.
- [x] Compare-and-set por `version` con Bulk Patch y fail-closed.
- [x] Limpieza con filtro de borrado repetido en servidor.
- [x] Pruebas offline de políticas, refill, aislamiento y concurrencia simulada.
- [ ] Concurrencia real multi-instancia en Wix QA.
- [ ] Resolver una clave de identidad anónima que no sea global ni controlada libremente por el cliente.
- [ ] Manifiesto Velo, ESLint completo y pruebas de runtime Wix.

