# Auditoría Capa 0 — 28-11-2026

Estado: PR #670 integrada en main (squash 5a1c84e34c2112de1a3f4874ca0eb070bbf4845b); CI offline PASS. No se ha ejecutado Wix Runtime ni se han modificado datos CMS.

## Conciliación de los hallazgos

| Hallazgo | Resultado en main | Acción |
|---|---|---|
| BUG-001 DATOS_FISCALES duplicado | No reproducido. La clave no existe en BUSINESS_COLLECTIONS; hay pruebas que exigen su ausencia. | Sin cambio. |
| BUG-002 PAYMENT_METHOD.OTRO | Divergencia confirmada en el espejo frontend. El contrato backend de MovimientosCaja no admite OTRO y no se encontró consumidor activo del miembro frontend. | Retirado del espejo; prueba de paridad añadida. |
| BUG-003 remitente .com frente a .es | Diferencia confirmada; dominio emisor verificado en Resend no acreditado. | Sin cambio. Envío de gestoría continúa deshabilitado. |
| BUG-004 ordenación direction/order | No reproducido. normalizeSort() traduce direction a order, formato oficial de Wix Data. | Sin cambio. |
| BUG-005 máximo de consulta | El esquema oficial consultado declara paging.limit como int32 mínimo 0, sin máximo explícito. | No se inventa máximo 100. DAL exige entero positivo y rango int32. |
| BUG-006 offset negativo | Confirmado: se convertía silenciosamente en 0. | Rechazo explícito QUERY_OFFSET_INVALID. |
| BUG-007 heurística contains() | Confirmada. Wix Query Language documenta $hasSome/$hasAll para arrays; no documenta $contains. | Retirada heurística y helpers contains; uso explícito hasSome/hasAll. No hay consumidores activos localizados. |
| BUG-008 política bulk patch incompleta | No reproducido. DAL aplica assertBulkPatchAllowed; política valida colección, controlType, campos/acciones y CAS. | Sin cambio. |
| BUG-009 condición bulk patch amplia | No reproducido: exige el tipo y condiciones requeridas por cada contrato y restringe campos permitidos. | Sin cambio. |
| BUG-010 GUID obligatorio en remove | No confirmado. Wix Data usa IDs string; no imponer GUID sin contrato de colección. | Sin cambio. |
| BUG-011 metadata circular | _cloneMeta() captura fallo de clonación y devuelve metadata de contingencia. Puede perder metadata, pero no propaga excepción. | Deuda de calidad; no se crean respuestas cíclicas no serializables. |
| BUG-012 mensaje [object Object] | Confirmado en mensajes no string. | Normalización segura; fallback Error interno. |
| BUG-013 secretos/PII en logs | Confirmado: cadenas y campos compuestos no se saneaban suficientemente. | Redacción por patrones en claves y strings, URLs, query params, credenciales, emails y stacks. |
| BUG-014 sobrescritura de campos protegidos | Ya corregido: los campos protegidos se asignan después del contexto saneado. | Sin cambio. |
| BUG-015 PII por nombres exactos | Confirmado parcialmente: faltaban emailAddress, mobilePhone, taxId, etc. | Patrones compuestos y pruebas. |
| BUG-016 allowEmpty | No reproducido. La documentación actual de assertValidEnum() ya declara rechazo de null/undefined sin parámetro allowEmpty. | Sin cambio. |
| BUG-017 GUID en jornada laboral | Confirmado: resourceId y memberId solo comprobaban presencia. | Ahora se exige GUID válido. |
| BUG-018 recordedAt | No reproducido. Ya valida fecha parseable y rechaza Invalid Date. | Sin cambio. |
| BUG-019 workDate | No reproducido. _isValidDateOnly() exige YYYY-MM-DD y valida calendario. | Sin cambio. |
| BUG-020 aliases históricos | Compatibilidad potencialmente necesaria. | Mantener lectura histórica; retirar solo con inventario de consumidores/datos. |

## Cambios de código propuestos

- dataAccess.js: rechazar límites no enteros, no positivos o fuera de int32; rechazar offsets negativos/no enteros/fuera de int32. Se conserva offset=0. No se impone máximo arbitrario de 100.
- dataAccess.js: retirar operadores contains no documentados y heurística por nombre de campo; exponer hasSome/hasAll.
- validation.js: validar resourceId/memberId como GUID en RegistrosHorariosStaff.
- responseUtils.js: evitar convertir objetos arbitrarios a [object Object].
- logger.js: sanear claves y valores string recursivamente, además de mensajes, URLs y stacks.
- public/mmUtils.js: retirar PAYMENT_METHOD.OTRO para alinear con enum backend.
- Tests: paginación, GUID, errores, redacción y paridad frontend/backend.

## Deuda estructural

No dividir internalConfig.js, dataAccess.js, responseUtils.js o validation.js por tamaño como objetivo aislado. La extracción se hará solo con fronteras estables, consumidores medidos y beneficio verificable. dataAccessPolicy.js ya es la frontera de autorización de escritura.

No se retira react ni se actualizan dependencias en esta intervención: falta evidencia reproducible de que sean código/dependencias muertos o incompatibles. Writers fiscales siguen deshabilitados.

## Documentación oficial Wix contrastada

- Query Data Items: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items
- API Query Language: https://dev.wix.com/docs/api-reference/articles/work-with-wix-apis/data-retrieval/about-the-wix-api-query-language
- Sorting and Paging: https://dev.wix.com/docs/api-reference/articles/work-with-wix-apis/data-retrieval/about-sorting-and-paging
- Bulk Patch Data Items: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-patch-data-items

El esquema Query Data Items declara paging.limit y paging.offset como int32 con mínimo 0, sin máximo explícito. La DAL no admite limit=0 porque su paginación next() no avanzaría.

## Evidencia y validación

- La primera ejecución CI de PR #669 ejecutó Layer 1 y Layer 2 con PASS, pero la suite completa falló en LOGGER-SEC-01: se detectó que las cadenas primitivas de propiedades ordinarias no entraban en la recursión de saneamiento.
- Corrección integrada en PR #670: todas las propiedades pasan por sanitizeValue(), incluidas cadenas primitivas. La regresión que detectó el primer fallo pasa en CI.
- PR #670: Layer 1 29/384 PASS; Layer 2 16/250 PASS; suite offline 88/794 PASS; SDK Cart, Transactions y TPV PASS; ESLint PASS; npm audit PASS; Gitleaks PASS. Run 46081642075, job 140781735934.
- npm ci, lint y suite completa local: no ejecutados en este entorno.
- Wix Local Editor/Preview/Runtime y E2E: pendientes. Sitio Draft; no se publica como parte de esta intervención.
