# Implementación de snapshots trimestrales inmutables para gestoría — 2026-11-10

**Rama:** `feat/immutable-quarterly-manager-snapshots-20261110`  
**Base:** `main` · `09f947eea4e0914f5ffca5a08d3494db676b8997`  
**Estado:** implementación propuesta en PR; CI y runtime Wix pendientes.

## 1. Objetivo

Habilitar en ZONA MARIAN la creación y descarga de snapshots trimestrales de gestoría, conservando una copia inmutable del resumen fiscal y del libro de facturas expedidas. La operación no envía correos ni altera ledgers de origen.

## 2. Cambios

- `createManagerPackageVersion` exige autorización `requireMarianManager`, periodo trimestral válido y `operationId` UUID.
- Las operaciones se deduplican mediante un claim técnico `ControlOperativo.IDEMPOTENCY`. El claim no es un ledger fiscal, contable ni laboral.
- El snapshot se inserta exclusivamente mediante `dalInsert` en `PaquetesGestoria`; no usa upsert, update ni save.
- La versión se obtiene mediante lectura fuerte y se reintenta ante colisiones de ID, con un máximo de tres intentos.
- Se calcula `snapshotHash` SHA-256 sobre una serialización determinista del contenido canónico.
- Se limita el tamaño serializado del item a 450 KiB para mantener margen respecto al límite oficial de Wix CMS de 500 KB por item.
- Las descargas recomputan y verifican `snapshotHash`; si no coincide, se bloquea la descarga.
- El listado de paquetes preparados devuelve solo metadatos, no los arrays `invoiceData` ni `summaryData`.
- ZONA MARIAN incorpora una acción explícita para crear el snapshot trimestral. El widget descarga el CSV que realmente devuelve el WebMethod, en vez de intentar abrir un `data.url` inexistente.
- Se corrige el separador de líneas del CSV.
- La previsualización llama al agregador fiscal interno bajo la autorización de Marian Manager y rechaza fuentes incompletas.

## 3. Garantías y límites

### Integridad

No se modifica, recalcula ni elimina ningún registro de:

- `MovimientosCaja`
- `LibroAsientosContablesDetalle`
- `HistoricoCierresZ`
- `RegistrosHorariosStaff`

Tampoco se crean reservas, pedidos, pagos, cierres Z ni snapshots reales durante esta implementación.

### Idempotencia y concurrencia

- `operationId` identifica una operación del cliente.
- Si la operación ya terminó, se devuelve el snapshot persistido.
- Si el proceso insertó el snapshot pero no pudo completar el claim, el siguiente intento recupera el documento por `traceId`.
- Un timeout de inserción se trata como resultado incierto: el claim no se elimina, para impedir que un reintento cree otra versión.
- Un claim expirado sin snapshot requiere reparación explícita; no se borra ni se reclama automáticamente porque un worker antiguo podría reanudarse.

### Tamaño

Wix documenta un máximo de 500 KB por item CMS. El límite interno de 450 KiB deja margen para la serialización y metadatos.

### Alcance funcional

La implementación de esta rama solo genera snapshots **trimestrales**. El agregador fiscal mensual no existe todavía; la API rechaza `MONTHLY` expresamente. El envío a gestoría permanece deshabilitado por `ACCOUNTANT_SEND_ENABLED=false`. No se habilita Resend ni se envía ninguna comunicación.

## 4. Fuentes oficiales Wix

- [Wix Data APIs — CMS introduction](https://dev.wix.com/docs/api-reference/business-solutions/cms/introduction): máximo de 500 KB por item.
- [Insert Data Item](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/insert-data-item): operación create-only; si el ID ya existe, la inserción falla. No es un upsert.

## 5. Validación

**Pendiente de ejecutar en CI:** suite offline, contratos SDK Cart V2 / Bookings Reader V2 y ESLint sobre el head de la rama.

**No ejecutado:** Wix Local Editor, runtime WebMethods, permisos efectivos de `PaquetesGestoria`, inserción en CMS QA, prueba de concurrencia real y descarga desde el sitio publicado.

La existencia de la colección `PaquetesGestoria` y sus hooks está documentada, pero sus permisos efectivos y la aplicación runtime de los hooks requieren una segunda lectura independiente y pruebas en un entorno QA Wix aislado.

## 6. Condiciones para activar

1. CI verde sobre el head final.
2. Verificación read-only de esquema y permisos de `PaquetesGestoria`.
3. Prueba en un sitio QA aislado y descartable, con fixtures propios; nunca editar ledgers del CMS publicado.
4. Pruebas de UUID repetido, concurrencia, colisión de versión, timeout ambiguo, hash alterado, tamaño límite y descarga.
5. Revisión del diff y aprobación antes de integrar o desplegar.

La creación de snapshots no acredita conformidad SIF/VERI*FACTU ni convierte el borrador fiscal en una declaración tributaria oficial.
