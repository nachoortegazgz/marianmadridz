# Auditoría CMS en vivo — 2026-11-01

- Repositorio: `nachoortegazgz/marianmadridz`
- Commit base verificado: `9ba400008aa6d795591371b2db7417b93cb66632`
- Sitio: `188bed94-177c-4bc9-a9f0-35080d874f3e`
- Alcance: lectura de definiciones CMS mediante Data Collections API.
- Mutaciones: ninguna.

## Resultado general

La API devolvió HTTP 200 y 35 colecciones. Se contrastaron las 13 colecciones NATIVE de negocio indicadas en la SSOT. Las 13 existen. Las revisiones y campos observados se resumen abajo; el esquema de Wix no impone por sí mismo validación estricta de campos a cada registro.

| Colección | Revisión observada | Hallazgo relevante |
|---|---:|---|
| MapaStaff | 13 | Incluye `staffMemberId` y `active`; además `memberId`, `resourceId`, `rolBookings`, `rolWebsite`, `scheduleId`, `sourceSystem`. |
| ServiciosCatalogo | 193 | Contiene los campos de catálogo y fases; estructura disponible. |
| CitasF2 | 19 | Incluye `bookingId`, `pairToken`, `resourceId`, `scheduleId`, `traceId`, `meta`. |
| MovimientosCaja | 75 | Incluye trazabilidad, datos fiscales, importes, hash y secuencia. |
| CajaActual | 45 | Incluye estado, saldo, contadores y hash de estado. |
| HistoricoCierresZ | 35 | Incluye snapshot, secuencias, hash, firma y estado de envío. |
| LibroAsientosContablesDetalle | 24 | Incluye debe/haber, cuenta, hashes y trazabilidad. |
| RegistrosHorariosStaff | 9 | Incluye recurso, miembro, eventos de fichaje y firma. |
| ControlOperativo | 15 | Incluye controlType, dedupeKey, traceId, estado, intentos, payload y version. |
| InventarioStockVenta | 19 | Incluye stockKey, variantId, locationId y catalogVersion. |
| MovimientosInventario | 26 | Incluye stockKey, lineItemId, catalogVersion, ubicación e idempotencia. |
| ComplementosCatalogo | 137 | Incluye addonId, precio, duración y relación con servicios. |
| DatosFiscales | 8 | Incluye identidad fiscal, régimen y configuración Veri*Factu. |

## Decisión MapaStaff

No se eliminan todavía `staffMemberId` ni `active`.

Motivos:
1. El esquema vivo confirma que ambos campos existen.
2. La auditoría anterior de Bookings confirmó que `staffMemberId` identifica al miembro de personal, mientras `resourceId` identifica el recurso de agenda y `scheduleId` el calendario.
3. La colección y el código pueden tener consumidores operativos de `staffMemberId`; quitarlo sin inventario exhaustivo de lecturas/escrituras y migración de registros sería un cambio destructivo.
4. El campo `active` no es automáticamente redundante: debe verificarse qué consumidores dependen de él y cuál será el sustituto canónico antes de retirarlo.

**Decisión provisional:** conservar los campos físicos actuales, prohibir nuevos usos no canónicos en código nuevo y completar un inventario de consumidores antes de una migración. No se afirma conformidad plena con el criterio SSOT que exige su ausencia.

## Wix Stores

La evidencia del contexto Wix y el estado del sitio confirman Catalog V1. La ADR-001 ya decide compatibilidad V1/V3 y aplaza el cambio del catálogo publicado. No se debe describir la migración a V3 como completada ni cambiar la versión sin ensayo de productos, variantes, stock, webhooks y storefront.

## Cart V2

El proyecto tiene una verificación offline de exports SDK y tests mock de checkout. Esto no demuestra una compra real en el entorno Wix. La migración Cart V2 no debe darse por validada en runtime por el mero éxito de CI.

## Criterio E2E actualizado por alcance

La prueba dual real queda excluida por instrucción expresa del propietario del proyecto. La exclusión debe constar como limitación de aceptación, no como prueba superada ni como defecto pendiente de ejecutar.

La certificación restante debe cubrir los flujos que sí forman parte del alcance: disponibilidad pública, reserva simple (si se autoriza la mutación QA), consulta/gestión de cita, cancelación controlada, pago presencial sin cobro online, notificaciones y pruebas de caja/fichaje/inventario que puedan ejecutarse sin emitir documentos fiscales reales ni alterar ledgers históricos.

## Limitaciones

- Esta auditoría verifica definiciones CMS, no los datos de cada registro, índices, permisos efectivos ni comportamiento de hooks.
- No se han escrito ni eliminado elementos.
- No se ha ejecutado una migración Catalog V1→V3.
- No se ha ejecutado ninguna reserva.
- Los permisos y la seguridad de cada WebMethod deben verificarse por separado.

## Fuente oficial

- Wix Data Collections API — List Data Collections: https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/list-data-collections
- Wix Data Collections API — Get Data Collection: https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection
