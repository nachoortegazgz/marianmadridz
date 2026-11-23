# ADR — Namespacing de transactionId en eventos TPV SANDBOX

**Fecha:** 2026-11-20  
**Estado:** Aceptada para corrección de código; validación Wix Runtime pendiente.

## Contexto

La colección CMS física `MovimientosCaja` contiene un índice de usuario activo `transactionId_unique` con `unique=true`. Los eventos TPV lógicos (movimientos de caja, tickets, auditoría, pagos y otros) se proyectan en esa misma colección.

El generador previo calculaba `transactionId` únicamente a partir de `SANDBOX_RUN_ID` y `idempotencyKey`. Dos eventos lógicos distintos que recibieran la misma clave podían producir el mismo valor en el campo indexado como único. El `_id` también reutilizaba ese valor.

## Decisión

1. Conservar el índice único `transactionId_unique`.
2. Namespacing del identificador por `SANDBOX_RUN_ID + logicalCollection + idempotencyKey`.
3. Mantener la clave idempotente estable dentro de cada colección lógica.
4. Consultar primero el nuevo identificador y después el identificador legacy para reconocer reintentos históricos del mismo tipo de evento.
5. No modificar, borrar ni reescribir movimientos ya persistidos.
6. No modificar `CajaActual` si falla la inserción del movimiento.

## Evidencia

La API oficial Wix CMS devolvió seis índices para `MovimientosCaja`; el único índice de usuario con unicidad es `transactionId_unique`, sobre el campo `transactionId`. La colección declara `transactionId` como TEXT y required. Una lectura de datos devolvió un registro sintético de prueba sin `transactionId`; no se demostró un valor duplicado concreto. El defecto del generador es verificable por inspección de código.

## Consecuencias y límites

- Los nuevos eventos de distintas colecciones lógicas no comparten el mismo `transactionId` cuando comparten accidentalmente una clave idempotente.
- Los reintentos históricos de la misma colección siguen encontrando su identificador legacy.
- No se elimina ni se debilita la unicidad del ledger.
- Las pruebas unitarias no demuestran el éxito de la inserción en Wix Runtime.
- La repetición del arqueo debe esperar a un Sandbox backend aislado, CajaActual presembrada y pruebas E2E. La aceptación exige movimiento persistido, caja cerrada y diferencia de cero.

## Referencias oficiales

- [Wix CMS — List Indexes](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/indexes/list-indexes)
- [Wix CMS — Index Types](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/indexes/index-types)
- [Wix CMS — Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)
- [Wix CMS — Get Data Collection](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection)
