# Evidencia QA — corrección WDE0123 en arqueo TPV

**Fecha:** 2026-11-20  
**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Colección:** `MovimientosCaja`  
**Estado:** corrección de código propuesta; aceptación runtime pendiente.

## Objetivo

Evitar colisiones en el campo indexado `transactionId` entre eventos lógicos distintos que comparten la colección CMS física `MovimientosCaja`.

## Evidencia verificada

- Wix CMS List Indexes devolvió seis índices activos/definidos.
- Índice único de usuario: `transactionId_unique`, campo `transactionId`, `unique=true`.
- Los índices sobre `fechaExpedicionFactura + sequenceNumber`, `recordTimestamp` y `sequenceNumber` son no únicos.
- El esquema físico declara `transactionId` como TEXT y required.
- Query Data Items devolvió un registro sintético de prueba. La propiedad `transactionId` no estaba presente en su objeto `data`; por tanto, no se ha identificado un valor duplicado concreto en los datos consultados.
- No se ejecutó ninguna mutación Wix/CMS.

## Defecto de código

El generador anterior derivaba el identificador solo de `SANDBOX_RUN_ID` y `idempotencyKey`, sin incluir la colección lógica. Dos eventos de distinto tipo podían colisionar en el índice único de la colección física común.

## Corrección

- Nuevo identificador determinista namespaced por `SANDBOX_RUN_ID`, colección lógica y clave idempotente.
- `_id` conserva el mismo identificador namespaced, evitando también colisiones de clave primaria entre eventos lógicos.
- Compatibilidad de lectura legacy: la búsqueda consulta el nuevo ID y, si no aparece, el ID previo para reconocer reintentos ya persistidos del mismo tipo de evento.
- El índice CMS no se elimina ni se cambia.
- Los históricos permanecen intactos.
- El movimiento se inserta antes de actualizar la proyección `CajaActual`; si la inserción falla, no se debe cerrar ni modificar la caja.

## Validación pendiente

1. CI de la rama y pruebas unitarias de generación namespaced.
2. Sandbox backend aislado y singleton `CajaActual` presembrado.
3. Repetir arqueo con una nueva clave de idempotencia, solo en Sandbox.
4. Confirmar un movimiento nuevo con `transactionId` único y `movementType=SIMULATED_TPV_CASH_MOVEMENT`.
5. Confirmar que la proyección `CajaActual` se actualiza una sola vez.
6. Confirmar estado cerrado y `difference=0`.
7. Repetir la misma solicitud para demostrar replay idempotente sin duplicar movimiento ni proyección.
8. Comparar LIVE antes/después y verificar que permanece intacto.

Hasta completar los pasos runtime, el arqueo no está validado y no se autoriza su despliegue.
