# QA — estado del paquete de gestoría y plan de continuación

**Fecha de revisión:** 2026-11-09  
**Base:** `main` en `d6dd37cefbb9e5331ae3624d9bdce0b7bfc97af2`  
**PR de continuación:** [#225](https://github.com/nachoortegazgz/marianmadridz/pull/225)  
**Rama:** `fix/accountant-package-read-model-20261109`  
**HEAD revisado:** `cfcf48548808bdff16cf5093f18ce0fe9b8280e7`

Este documento actualiza el estado operativo posterior a la pausa descrita en `2026-11-09-accountant-package-snapshot-pause.md`. El documento de pausa se conserva como evidencia histórica; no se reescribe.

## 1. Resultado de CI y workflows

- Workflow conservado: `.github/workflows/backend-offline-quality.yml`.
- SHA del workflow en `main`: `a9fabc34419db7fb567e911850908cc6f773d992`.
- PR #225 no modifica ningún workflow.
- Ejecución de validación sobre PR #225: [run #42612675154](https://github.com/nachoortegazgz/marianmadridz/actions/runs/42612675154).
- Resultado: **SUCCESS**.
- Suite offline: 48 suites, 461 tests, 0 fallos.
- Contrato SDK Cart V2: PASS.
- Contrato SDK Bookings Reader V2: PASS.
- ESLint: PASS.
- Checkout del workspace, Node.js y `npm ci --ignore-scripts`: PASS.

La ejecución es CI offline. No valida Wix Local Editor, hooks en runtime ni despliegue del sitio.

## 2. Estado verificado de PaquetesGestoria

Lectura independiente mediante API Wix, sin inserciones:

- ID: `PaquetesGestoria`.
- Tipo: `NATIVE`.
- Revisión actual tras la corrección de campo: `2`.
- Permisos observados: `insert=ADMIN`, `update=ADMIN`, `remove=ADMIN`, `read=ADMIN`.
- Conteo consistente de items: `0`.
- Uso observado en Site Data Usage: `0 bytes / 0 items` en Live y Sandbox.

### Corrección de esquema aplicada

El contrato backend valida `invoiceData` como array de objetos. La colección declaraba inicialmente el campo como `OBJECT`. Se actualizó exclusivamente ese campo a:

- `type=ARRAY`
- `typeMetadata.array.elementType=OBJECT`
- `required=true`
- `encrypted=false`

La API confirmó la revisión 2 y la nueva definición. No se insertaron ni modificaron items. No se tocaron permisos, plugins ni otras definiciones de campo.

Fuente oficial: [Wix Data Types](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-types-in-wix-data) y [Update Data Collection Field](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/update-data-collection-field).

Wix documenta un tamaño máximo de **500 KB por item CMS**. El código todavía no implementa un límite conservador de payload; por ello no se deben insertar snapshots hasta implementar y probar esa protección.

## 3. Cambios de código incluidos en PR #225

- `fiscalDocuments.web.js` usa `BUSINESS_COLLECTIONS.PAQUETES_GESTORIA` como colección de lectura de paquetes.
- Historial filtra con campos reales del nuevo esquema: `periodType`, `fiscalYear`, `fiscalMonth`, `fiscalQuarter`.
- Listado de paquetes preparados filtra `packageStatus=PREPARED`.
- Se elimina el helper de prefijos de identificador, que deja de tener consumidores.
- `createManagerPackageVersion` permanece fail-closed con `PACKAGE_SNAPSHOT_IMPLEMENTATION_PENDING`.

La descarga consulta ahora la colección dedicada a snapshots. El envío de paquete y de documento concreto continúa bloqueado por `ACCOUNTANT_SEND_ENABLED=false`.

## 4. Riesgos que siguen abiertos

1. **Hash canónico:** definir un DTO estable y normalización exacta antes de calcular SHA-256; el mismo contrato debe usarse al verificar.
2. **Tamaño CMS:** imponer un límite de bytes inferior a 500 KB con margen; rechazar el snapshot completo antes de insertar, sin truncar facturas.
3. **Concurrencia/versionado:** no usar solo lectura de máximo + 1. Verificar el comportamiento real de inserciones concurrentes con ID determinista y conflicto; diseñar retry/idempotencia sobre el contrato confirmado.
4. **Append-only runtime:** los hooks `PaquetesGestoria_beforeInsert/beforeUpdate/beforeRemove` están en el código y tienen tests offline; su ejecución real en Wix sigue pendiente.
5. **Despacho externo:** no existe aún un ledger append-only verificado para intentos, respuestas, reintentos y deduplicación de envío. Resend permanece deshabilitado.
6. **Permisos:** los permisos CMS ADMIN son una capa adicional; toda autorización de negocio debe seguir en backend.

## 5. Próxima secuencia aprobada por el criterio técnico

| Orden | Trabajo | Condición de salida |
|---|---|---|
| P1 | Diseñar DTO y hash canónico del snapshot | Fixtures deterministas, igualdad de hash y rechazo de datos inválidos |
| P1 | Definir límite de tamaño CMS | Medición UTF-8 real, margen bajo 500 KB y prueba de rechazo sin escritura |
| P1 | Resolver versionado concurrente | Prueba de carrera/idempotencia contra semántica real de Wix; no solo mocks |
| P1 | Implementar inserción en PaquetesGestoria | Escritura append-only, ID determinista, traceId y lectura fuerte posterior |
| P1 | Validar hooks en Wix Local Editor/QA | Insert permitido; update/remove rechazados en runtime |
| P2 | Ledger de despacho de gestoría | Intentos y respuestas append-only, idempotencia y reconciliación; envío sigue deshabilitado |
| P2 | Completar Capa 3 M365/SharePoint | Tenant, permisos, PA-01…PA-07 y contratos de exportación verificados |

No habilitar envío de correo ni crear snapshots hasta superar las condiciones P1. No desplegar cambios a producción desde este PR.

## 6. Estado

- Workflows actuales: **conservados**.
- CI PR #225: **PASS**.
- Esquema CMS invoiceData: **corregido y confirmado**.
- Colección con datos: **no; 0 items**.
- Lecturas de paquetes separadas de HistoricoCierresZ en PR: **implementadas en código**.
- Creación de snapshots: **bloqueada intencionadamente**.
- Envío a gestoría: **bloqueado intencionadamente**.
- Hooks Wix runtime: **pendiente**.
- Wix Local Editor / deploy: **pendiente; no ejecutado**.
