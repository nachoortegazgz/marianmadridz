# Anexo de poda de campos CMS — QA — 2026-11-06

## Alcance y criterio

- Entorno: Marian Madrid QA, sitio `4c2889a4-0e2f-4012-b376-bd191024c0f7`.
- Producción: no consultada ni modificada.
- Fuente de esquema: Wix Data Collections API, lectura consistente del inventario de colecciones.
- Inventario: 40 colecciones en total; 15 `NATIVE`. Las colecciones `WIX_APP` quedan fuera de la poda de campos propios.
- Criterio: mantener campos con consumidor activo o que sostengan reservas, personal, cumplimiento laboral, contabilidad, fiscalidad, inventario, trazabilidad operativa o relaciones CMS. Eliminar campos sin consumidor activo y sin función en esos circuitos.
- No se ha ejecutado Preview, Publish ni despliegue.

## Campos eliminados y verificación

| Colección | Campo eliminado | Motivo |
|---|---|---|
| `CitasF2` | `noShowReason` | Sin lector/escritor activo localizado; no sostiene los circuitos protegidos. |
| `CitasF2` | `noShowAt` | Sin lector/escritor activo localizado; no sostiene los circuitos protegidos. |
| `CitasF2` | `changeLog` | Sin lector/escritor activo localizado; no sostiene los circuitos protegidos. |
| `ComplementosCatalogo` | `traceId` | Sin consumidor específico del catálogo de complementos; no aporta trazabilidad operativa usada por los flujos. |
| `ControlOperativo` | `nextRetryAt` | Sin consumidor/escritor activo localizado en el código actual. |
| `ControlOperativo` | `retryAfter` | Es un dato de respuesta del rate limiter, no un dato persistido en CMS. |

Resultado de las seis operaciones: HTTP 200 en cada borrado. Lectura posterior de esquema con `consistentRead=true` confirmó la ausencia de los seis campos.

| Colección | Revisión observada tras la poda |
|---|---:|
| `CitasF2` | 4 |
| `ComplementosCatalogo` | 2 |
| `ControlOperativo` | 7 |

**Advertencia Wix:** la operación Delete Data Collection Field elimina también todos los valores de ese campo en todos los ítems de la colección. La eliminación es destructiva para esos valores.

## Campos deliberadamente conservados

- `CitasF2.invoicingDate`, `thirdPartyId`, `cashMovementId` y `fiscalData`: vínculo fiscal/tercero/caja; no se eliminan.
- `ComplementosCatalogo.ServiciosCatalogo_name` y `ServiciosCatalogo.name`: relación nativa `MULTI_REFERENCE`; se conserva íntegra.
- `ControlOperativo.expiresAt`, `attempts`, `processedAt`, `pairToken`, `transactionId`, `orderId`, `refundId`, `kind`, `maxAttempts`, `lastError`, `totalAmount`, `operationDescription`, `surface`, `requesterKey`, `requestCount`, `windowStart`, `version`, `heartbeatAt`: mantienen consumidores activos en idempotencia, compensaciones, alertas, rate limiting e inventario.
- `processedAt` se conserva expresamente: el flujo de conciliación de inventario lo escribe al resolver alertas.
- `retryAfter` sigue existiendo como propiedad calculada/devuelta por el rate limiter en runtime; solo se elimina su columna CMS.
- `ControlOperativo.attempt` y `leaseExpiresAt` no estaban presentes en el esquema QA leído. Los campos canónicos físicos son `attempts` y `expiresAt`. No se elimina la normalización de compatibilidad de `leaseExpiresAt` hasta completar la migración/verificación de datos históricos.
- Se conservan los campos necesarios para reservas, catálogo de servicios, identidad/roles de staff, registro horario laboral y colecciones de simulación/integración QA. Aunque no sean campos contables, fiscales o de inventario, sostienen funciones actuales del negocio, cumplimiento laboral o pruebas reproducibles.

## Estado y límites

- Se eliminaron 6 campos físicos en QA.
- No se borraron registros ni colecciones.
- No se modificó código de runtime.
- No se tocó producción.
- No se declara prueba E2E, checkout ni funcionamiento publicado.
- La poda no se extiende a colecciones Wix gestionadas por aplicaciones ni a campos que no se hayan contrastado con consumidores y relaciones.

## Fuentes oficiales

- [Delete Data Collection Field](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/delete-data-collection-field)
- [Get Data Collection](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection)

