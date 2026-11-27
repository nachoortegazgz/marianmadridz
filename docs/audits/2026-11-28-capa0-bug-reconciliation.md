# Auditoría Capa 0 — 28-11-2026

Estado de esta revisión: cambios propuestos en rama; pendientes de CI. No se ha ejecutado Wix Runtime ni se han modificado datos CMS.

## Resultado de la conciliación

| Hallazgo recibido | Resultado en main | Acción |
|---|---|---|
| BUG-001 DATOS_FISCALES duplicado | No reproducido. La clave no existe en BUSINESS_COLLECTIONS; hay pruebas que exigen su ausencia. | Sin cambio. |
| BUG-002 PAYMENT_METHOD.OTRO | Confirmado como divergencia del espejo frontend. El contrato backend de MovimientosCaja no admite OTRO y no se encontró consumidor activo del miembro frontend. | Retirado del espejo y añadida prueba de paridad. |
| BUG-003 remitente .com frente a .es | Diferencia confirmada; dominio emisor verificado en Resend no acreditado. | Sin cambio. Envío de gestoría continúa deshabilitado. |
| BUG-004 ordenación direction/order | No reproducido. normalizeSort() traduce direction a order, formato oficial de Wix Data. | Sin cambio. |
| BUG-005 límite superior de consulta | No hay maximum declarado para paging.limit en el esquema oficial consultado; es int32 con mínimo 0. | No se inventa un máximo 100. DAL exige entero positivo y rango int32. |
| BUG-006 offset negativo | Confirmado: se convertía silenciosamente en 0. | Ahora se rechaza con QUERY_OFFSET_INVALID. |
| BUG-007 heurística contains() | Confirmado: elegía operador por sufijo del nombre de campo. Wix Query Language documenta $hasSome/$hasAll para arrays y no documenta $contains. | Eliminados los helpers contains; uso explícito de hasSome/hasAll. Búsqueda de consumidores activos sin resultados. |
| BUG-008 política bulk patch incompleta | No reproducido. DAL llama a assertBulkPatchAllowed; política valida colección, controlType, campos/acciones y condiciones CAS. | Sin cambio. |
| BUG-009 condición bulk patch amplia | No reproducido en política actual: exige tipo y condiciones requeridas por cada contrato; restringe campos permitidos. | Sin cambio. |
| BUG-010 formato GUID obligatorio en remove | No confirmado. Wix Data usa IDs de tipo string; no se debe imponer GUID sin contrato de colección. | Sin cambio. |
| BUG-011 metadata circular | _cloneMeta() captura el fallo de clonación y devuelve metadata de contingencia. Puede perder metadata, pero no propaga la excepción. | Deuda de calidad, no se introduce una clonación cíclica que genere respuestas no serializables. |
| BUG-012 objeto como [object Object] | Confirmado en normalización de mensajes no string. | Normalización segura; fallback Error interno. |
| BUG-013 secretos/PII en logs | Confirmado: claves exactas y cadenas de mensajes/stack no se saneaban de forma suficiente. | Redacción por patrones en claves y strings, incluidos Bearer, query params, credenciales URL, emails, taxId y stack. |
| BUG-014 sobrescritura de campos protegidos | Ya corregido: los campos protegidos se asignan después del contexto saneado. | Sin cambio. |
| BUG-015 PII por nombres exactos | Confirmado parcialmente: faltaban variantes emailAddress, mobilePhone, taxId, etc. | Patrones controlados y cobertura de regresión. |
| BUG-016 allowEmpty | No reproducido. Documentación actual de assertValidEnum() ya declara rechazo de null/undefined sin parámetro allowEmpty. | Sin cambio. |
| BUG-017 GUID en registros horarios | Confirmado: resourceId y memberId solo comprobaban presencia. | Ahora se exige GUID válido. |
| BUG-018 recordedAt | No reproducido. Ya valida fecha parseable y rechaza Invalid Date. | Sin cambio. |
| BUG-019 workDate | No reproducido. _isValidDateOnly() exige YYYY-MM-DD y comprueba el calendario. | Sin cambio. |
| BUG-020 aliases históricos | Compatibilidad potencialmente necesaria. | Mantener lectura histórica; retirar solo con inventario de consumidores y datos. |

## Cambios de código propuestos

- dataAccess.js: rechazar límites no enteros, no positivos o fuera de int32; rechazar offsets negativos/no enteros/fuera de int32. Se conserva offset=0. No se impone límite superior arbitrario de 100.
- dataAccess.js: retirar operadores contains no documentados y heurística por nombre de campo. hasSome/hasAll quedan explícitos.
- validation.js: validar resourceId y memberId como GUID en RegistrosHorariosStaff.
- responseUtils.js: no convertir objetos arbitrarios a [object Object].
- logger.js: sanear secretos y PII en claves, cadenas, URLs y stacks; conservar timestamp/level/traceId/message protegidos.
- public/mmUtils.js: retirar PAYMENT_METHOD.OTRO para alinear con el enum backend.
- Tests: paginación, GUID, errores, redacción y paridad frontend/backend.

## Deuda estructural — decisión

No dividir internalConfig.js, dataAccess.js, responseUtils.js o validation.js por tamaño como objetivo aislado. La extracción solo se hará cuando exista una frontera estable de dominio, consumidores medidos y beneficio verificable. La arquitectura actual ya tiene dataAccessPolicy.js como frontera de autorización de escritura.

No se retira react ni se actualizan dependencias en esta intervención: falta evidencia reproducible de que sean código/dependencias muertos o incompatibles. No se habilitan writers fiscales.

## Documentación oficial Wix contrastada

- Query Data Items: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items
- API Query Language: https://dev.wix.com/docs/api-reference/articles/work-with-wix-apis/data-retrieval/about-the-wix-api-query-language
- Sorting and Paging: https://dev.wix.com/docs/api-reference/articles/work-with-wix-apis/data-retrieval/about-sorting-and-paging
- Bulk Patch Data Items: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-patch-data-items

El esquema de Query Data Items declara paging.limit y paging.offset como enteros int32 con mínimo 0, sin máximo explícito en el esquema consultado. El helper DAL no permite limit=0 porque su paginación next() no avanzaría.

## Validación pendiente

- CI de la PR: pendiente.
- Ejecución local de npm ci, lint y suite completa: no disponible en este entorno.
- Wix Local Editor/Preview/Runtime: pendiente; sitio sigue Draft y no se publica como parte de esta intervención.
- E2E: pendiente, sin escrituras económicas ni fiscales reales.
