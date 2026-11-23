# MovimientosCaja — discrepancia de recuento entre snapshots (2026-11-23)

**Sitio:** marianmadrid.es.  
**siteId:** 188bed94-177c-4bc9-a9f0-35080d874f3e.  
**Método actual:** Query Data Items con consistentRead=true, returnTotalCount=true, limit=100.  
**Estado:** solo lectura; sin mutaciones.

## 1. Comparación

| Snapshot | Total | Clasificación registrada |
|---|---:|---|
| Auditoría 2026-11-12 | 10 | 4 SMOKE_TEST; 1 INTERNAL/VENTA_ONLINE no sintética; 5 SIMULATED_PAYMENT con sequenceNumber 1–5 |
| Relectura 2026-11-23 | 5 | 5 filas actuales, todas sintéticas; totalCount=5; hasNext=false |

Diferencia neta: -5 filas. La fila que el snapshot del 12-11 clasificó como no sintética no aparece en la lectura actual.

## 2. Límites de la evidencia

El snapshot de 12-11 no guardó los IDs de los diez elementos, por política de minimización de datos. Por ello no es posible identificar qué registros concretos desaparecieron ni comparar sus campos individualmente. La consulta actual confirma totalCount=5, pero no devuelve elementos eliminados ni un historial de auditoría de CMS.

La colección MovimientosCaja tiene collectionRevision=109 y updatedDate=2026-11-17T00:13:59.272Z. Ese metadato corresponde a la colección y no acredita la fecha o autoría de una eliminación de elementos.

No se puede concluir:
- que la limpieza fuera autorizada;
- que la eliminación fuera no autorizada;
- que los diez registros antiguos fueran los mismos que los cinco actuales;
- que el asiento no sintético se haya rectificado o trasladado correctamente.

## 3. Contexto actual

Los cinco elementos actuales son sintéticos. Tres pertenecen al grupo TPV-QA-1795437582366 (23-11-2026 12:39:42Z) y están marcados synthetic=true, source=TPV_FUNCTIONAL_TEST y recordSource=TPV_QA_DEVELOPMENT. Los otros dos son registros sintéticos anteriores. Este grupo no contiene testRunId/siteId/sourceType/sessionId y no cumple el contrato actual de hooks; se audita por separado en 2026-11-23-tpv-synthetic-records-contract-audit.md.

## 4. Riesgo y prioridad

La colección es append-only. La desaparición aparente de una fila previamente clasificada como no sintética es una discrepancia de integridad P0 hasta conocer la causa. El hecho de que los registros actuales sean sintéticos no demuestra que el conjunto histórico eliminado también lo fuera.

## 5. Acciones necesarias

1. Consultar Wix Activity Logs, historial de CMS y backups del sitio entre 2026-11-12 y 2026-11-23.
2. Identificar si hubo reset, importación, restauración, limpieza o cambio de colección.
3. Recuperar los IDs/valores desde un backup autorizado si existe; no reinsertar por inferencia.
4. Determinar el destino de la fila anteriormente clasificada INTERNAL/VENTA_ONLINE y acreditar si fue rectificada o exportada.
5. Confirmar con el titular si se autorizó una limpieza/reset y conservar la evidencia de aprobación.
6. Mantener MovimientosCaja inmutable; no hacer update/remove ni reconstruir saldos.

## 6. Estado

**Verificado:** 10 filas en snapshot del 12-11; 5 filas actuales; diferencia neta -5; no hay IDs antiguos para correlación.  
**Pendiente:** Activity Logs, backup, autoría y autorización del posible reset.  
**No ejecutado:** restauración, limpieza, inserción, modificación, conciliación o cierre de caja.

Mantener P0 abierto en #435/#434.

## 7. Control de auditoría disponible

Consulta consistente de ControlOperativo: 63 filas (5 TPV_FUNCTIONAL_TEST, 13 WEBHOOK_EVENT, 3 COMPENSATION, 31 WEBHOOK_CLAIM, 3 DAYS_CACHE, 3 SLOT_LOCK, 2 IDEMPOTENCY y 3 RATE_LIMIT). No hay ningún controlType, kind, status, operationType ni traceId con términos CLEANUP, RESET, MIGRAT, PURGE, DELETE, TRUNCAT o RESTORE.

La búsqueda del repositorio no encuentra handler dataItemDeleted ni wixData_onDataItemDeleted. La documentación oficial Wix ofrece el webhook REST Data Item Deleted, que se dispara cuando se elimina o trunca un elemento, pero no hay evidencia en esta conexión de que esté suscrito o de que conserve un histórico recuperable. La ausencia de esos marcadores no demuestra que no hubiera limpieza; solo que no aparece en ControlOperativo ni en los handlers del repo.
