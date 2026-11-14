# QA — recreación live de CajaActual

**Fecha:** 2026-11-14  
**Entorno:** Wix producción — Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**URL:** https://www.marianmadrid.es/  
**Alcance:** creación de la colección de proyección CajaActual y singleton inicial. Sin operaciones comerciales.

## 1. Objetivo

Restablecer la colección que el backend ya consulta como `CajaActual`, conservando `MovimientosCaja` como fuente individual de cada movimiento/ticket.

## 2. Evidencia live antes del cambio

- La enumeración Wix Data Collections API devolvió 42 colecciones y no incluyó `CajaActual`.
- `MovimientosCaja` existía como `NATIVE`, revisión 78, con permisos ADMIN.
- Data Items Count API devolvió 0 elementos en `MovimientosCaja`.
- La lectura de esquema de `MovimientosCaja` confirmó campos de movimiento, importe, método/canal, secuencia, hash, timestamp, firma, traceId y trazabilidad fiscal.

## 3. Cambio realizado

Creada `CajaActual`:
- ID: `CajaActual`
- displayName: `CAJA_ACTUAL`
- Tipo: `NATIVE`
- Revisión: `1`
- Campos de negocio: 36
- Campos de sistema Wix: 4
- Permisos: `insert/update/remove/read=ADMIN`

Singleton creado:
- ID físico Wix: `04402566-25b1-4b93-8f93-5c3343c73249`
- Clave lógica: `singletonKey=CAJA_PRINCIPAL`
- Estado: `cashRegisterStatus=CERRADA`
- `isOpen=false`
- Saldos y contadores iniciales: cero
- `sequenceCounters={}`
- `operationDate=2026-11-14` (Europe/Madrid)
- `traceId=40d69093-9055-4e11-a348-315a875256e6`
- `openedAt`, `openedBy`, `closedAt`, `closedBy`: no informados

Índice solicitado:
- Nombre: `CajaActual_singletonKey_unique`
- Campo: `singletonKey ASC`
- Unicidad: true
- Estado en lectura posterior: `BUILDING`

## 4. Verificación posterior

- La colección se volvió a leer correctamente: revisión 1, tipo NATIVE, 40 campos incluidos sistema.
- La consulta por `singletonKey=CAJA_PRINCIPAL` devolvió exactamente un elemento.
- El elemento está cerrado y con importes a cero.
- `MovimientosCaja` mantiene revisión 78 y 0 elementos; no fue modificada.
- El inventario live posterior devolvió 43 colecciones: 14 NATIVE y 29 WIX_APP.

## 5. Integración backend

El backend actual resuelve el singleton mediante `singletonKey=CAJA_PRINCIPAL`; no debe asumir que el ID físico CMS es el valor lógico. El asignador de secuencia mantiene los contadores dentro de `sequenceCounters`.

La proyección de operaciones presenciales requiere una sesión existente ABIERTA, `openedAt` válido y caja no simulada. La recreación no abre la sesión, no establece saldo inicial y no habilita cobros. Las escrituras fiscales siguen sujetas a sus flags fail-closed.

## 6. Recomendaciones

1. Mantener un movimiento/ticket por registro en `MovimientosCaja`; no copiar el histórico a `CajaActual`.
2. Ejecutar la proyección solo después de persistir el movimiento fuente y hacerla idempotente por ID de origen.
3. Mantener efectivo físico separado de tarjeta y Bizum. Online y transferencias no deben alterar el cajón físico.
4. Completar un WebMethod seguro de apertura que resuelva autorización en backend, lock, saldo inicial contado/reconciliado, `openedAt` y `openedBy`.
5. No admitir pagos mixtos hasta definir `paymentBreakdown` y reconciliar exactamente la suma con el importe total.
6. No exponer `lineItems` como conceptos/unidades validados hasta definir y probar su esquema interno.
7. Evaluar `lastMovementId` como puntero a la última operación; no duplicar el ticket ni su hash completo en la proyección.
8. Migrar gradualmente `sequenceCounters.appliedMovementIds` a una idempotencia durable e indexada (por ejemplo, en `ControlOperativo`) para evitar crecimiento ilimitado. No retirar el mecanismo actual hasta probar replays y concurrencia.
9. Esperar a que el índice único esté `ACTIVE`; hasta entonces mantener el control backend que falla de forma cerrada si detecta más de un singleton.

## 7. Límites

- No se ejecutó Wix Local Editor, pruebas runtime ni E2E publicado.
- No se insertaron movimientos de prueba.
- No se activaron escritores fiscales/contables, pagos ni automatizaciones.
- No se publicó el sitio; la intervención fue exclusivamente CMS.
- El índice único no estaba todavía activo en la última lectura.

## 8. Estado

**CMS:** creado y verificado por lectura posterior.  
**Integración runtime:** pendiente de QA.  
**Apertura de caja:** pendiente de implementación y autorización.  
**Índice único:** BUILDING, pendiente de ACTIVE.  
**MovimientosCaja:** sin cambios.
