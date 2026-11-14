# Estado actual del proyecto — Marian Madrid

**Fecha de corte:** 2026-11-14  
**Sitio objeto de auditoría:** `50b39f33-e753-4331-ab35-b2ed43dc97f7`  
**Naturaleza del sitio:** banco de pruebas aislado, sin actividad real, según declaración del propietario.  
**Plataforma:** Wix Editor Classic + Velo.  
**Repositorio:** `nachoortegazgz/marianmadridz`.

## Estado verificado

- CMS live: 23 colecciones, 15 NATIVE y 8 WIX_APP.
- Colecciones propias: 524 definiciones de campo; 140 registros en el corte leído.
- Los registros existentes deben tratarse como sintéticos/de prueba; no son evidencia de operaciones reales.
- `CajaActual.sequenceCounters` es OBJECT y su valor leído es objeto; `ticketSequence` no existe en el esquema actual.
- `ControlOperativo.ownerToken` no existe; `traceId` es la clave canónica de fencing.
- `MapaStaff` tiene 18 campos y 3 filas activas. No declara `recordType` ni campos fiscales; los tres registros contienen `staffMemberId`, `resourceId`, `scheduleId`, `memberId` y `active`.
- `DatosFiscales` existe físicamente con 28 campos y un registro placeholder. No debe tratarse como identidad fiscal real.
- `ComplementosCatalogo` tiene 36 filas; `addonId` coincide con `_id` en las 36. `name` y `description` contienen el mismo texto en las 36, con tipos TEXT y RICH_TEXT.
- `InventarioStockVenta` y `MovimientosInventario` existen físicamente, pero son colecciones legacy sin writers activos en el código actual; no se reactiva su uso.

## Bloqueos y discrepancias

1. El lector de eventos de personal consultaba `MapaStaff.recordType`, campo que no existe. La rama de corrección elimina ese filtro y conserva `staffMemberId` + `active`.
2. Los hooks y validadores de `MapaStaff`, además de `eventLog.js` y `fiscalDocuments.web.js`, siguen esperando discriminadores/campos fiscales que no están en el esquema actual de `MapaStaff`. No se cambia ese flujo sin decidir y probar la fuente fiscal canónica.
3. `DatosFiscales` no declara `traceId` ni `schemaVersion`; el contrato de sus writers debe reconciliarse antes de habilitar escrituras fiscales.
4. `ComplementosCatalogo.addonId` es un espejo de `_id`; el código de lectura pasa a priorizar `_id` y rechazar divergencias. La columna física no se elimina en esta intervención.
5. La sincronización del código del Editor Wix con Git no está verificada.
6. No hay certificación E2E de runtime ni despliegue asociado a SHA.

## Política de cambios

- Mutaciones update/remove sobre colecciones propias habilitadas por autorización expresa mediante `ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true`.
- Colecciones Wix Apps excluidas; autenticación, autorización, permisos, validación de esquema y gates de efectos externos permanecen activos.
- No se ejecutan operaciones reales ni se interpretan datos sintéticos como actividad real.
- No se modifica el CMS live en esta intervención; cambios de código/documentación se someten a PR y CI.

## Evidencias

- [Base maestra](PROJECT_BASELINE.md)
- [Diccionario de datos CMS](DICCIONARIO_DATOS_CMS.md)
- [Auditoría de esquema y contratos](docs/audits/2026-11-14-current-site-cms-normalization.md)
