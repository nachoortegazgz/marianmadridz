> **Alcance corregido:** esta auditoría corresponde al sitio productivo 188bed94-177c-4bc9-a9f0-35080d874f3e y no al sitio QA 50b39f33-e753-4331-ab35-b2ed43dc97f7. El snapshot CMS QA de 2026-11-14 registra CajaActual revisión 1 con netAmount y staffResourceId; por tanto, la ausencia de esos campos en el esquema de producción no demuestra un defecto del contrato QA. No aplicar cambios basados en esta auditoría a QA ni a producción sin volver a leer el esquema del sitio objetivo.

# Auditoría de esquema live — CajaActual

**Fecha de lectura:** 2026-11-14  
**Sitio:** 50b39f33-e753-4331-ab35-b2ed43dc97f7 (banco de pruebas aislado, sin actividad real).  
**Fuente:** Wix Data Collections API, GET /data/v2/collections/CajaActual.  
**Revisión de colección:** 1. **39 campos**, incluidos los campos de sistema.

Este documento sustituye la captura histórica de CajaActual que describía operationDateHour, bizumAmount y los cuatro opening*Amount. Esos campos no existen en el esquema físico vigente.

## 1. Manifiesto físico verificado

| Campo | Tipo Wix |
|---|---|
| netAmount | NUMBER |
| closedBy | TEXT |
| sequenceCounters | OBJECT |
| versionState | NUMBER |
| stateHash | TEXT |
| lastMovementAt | DATETIME |
| differenceReason | TEXT |
| difference | NUMBER |
| countedCash | NUMBER |
| expectedCash | NUMBER |
| cashAmount | NUMBER |
| totalOutAmount | NUMBER |
| totalInAmount | NUMBER |
| paymentAmount | NUMBER |
| paymentCount | NUMBER |
| refundAmount | NUMBER |
| refundCount | NUMBER |
| salesAmount | NUMBER |
| salesCount | NUMBER |
| otherAmount | NUMBER |
| voucherAmount | NUMBER |
| cardAmount | NUMBER |
| openedBy | TEXT |
| openingAmount | NUMBER |
| closedAt | DATETIME |
| openedAt | DATETIME |
| traceId | TEXT |
| staffResourceId | TEXT |
| operationDate | DATE |
| cashRegisterStatus | TEXT |
| singletonKey | TEXT |
| isOpen | BOOLEAN |
| id | TEXT |
| currentSequence | NUMBER |
| fiscalPeriod | TEXT |
| _id | TEXT |
| _createdDate | DATETIME |
| _updatedDate | DATETIME |
| _owner | TEXT |

## 2. Valores del singleton leídos

- singletonKey = CAJA_PRINCIPAL.
- cashRegisterStatus = SIMULACION.
- isOpen = true; no coincide semánticamente con cashRegisterStatus=SIMULACION. El backend gobierna la sesión por cashRegisterStatus y no consume isOpen.
- id coincide con _id.
- sequenceCounters es un objeto JSON, no una cadena.
- currentSequence = 0; no se localizó consumidor activo en src/.
- openingAmount y expectedCash contienen el mismo importe en la fila sintética actual, pero representan conceptos distintos y no se fusionan.
- operationDate es DATE. No existe operationDateHour.
- No existen bizumAmount, openingCashAmount, openingCardAmount, openingBizumAmount ni openingOtherAmount.

## 3. Contrato de código alineado en la rama

Rama: fix/current-site-cms-contract-alignment.

- CAJA_KEYS.OPERATION_DATE apunta a operationDate.
- cajas.web.js persiste operationDate como fecha ISO YYYY-MM-DD, derivada de movement.operationDate cuando existe o del timestamp fuente.
- PAYMENT_METHOD.BIZUM se acumula en otherAmount, único bucket físico disponible para métodos no efectivo/tarjeta en CajaActual. El detalle del medio de pago permanece en MovimientosCaja.
- El DTO devuelve operationDate, otherAmount y openingAmount. No expone bizumAmount, operationDateHour ni los cuatro opening*Amount inexistentes.
- assertCajaActualRecord valida tipos NUMBER, BOOLEAN, OBJECT, DATE y el espejo id = _id cuando ambos están presentes.
- CASH_REGISTER_STATUS reconoce ABIERTA, CERRADA y SIMULACION. SIMULACION es un sentinel del banco de pruebas; no representa una sesión abierta.

## 4. Decisiones y candidatos de limpieza

- _id es el keyfield CMS. id es un espejo físico sin consumidor localizado; su retirada requiere revisar automatizaciones/vistas CMS.
- cashRegisterStatus es el estado canónico. isOpen no tiene consumidor localizado y contradice el valor SIMULACION; candidato a retirada tras revisar automatizaciones/vistas CMS.
- currentSequence no tiene consumidor localizado; sequenceCounters es el objeto usado por el backend. Candidato a retirada tras revisar contratos externos.
- openingAmount y expectedCash no se fusionan aunque coincidan en el registro actual.
- No se modifica el esquema Wix ni el registro singleton en esta intervención.

## 5. Formato oficial de Wix

Wix Data define el tipo DATE como String en formato ISO 8601 YYYY-MM-DD. El tipo DATETIME utiliza un objeto $date con fecha y hora ISO 8601. La implementación diferencia ambos tipos.

Documentación oficial: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-types-in-wix-data

## 6. Estado de validación

- Esquema físico: verificado por lectura Wix.
- Datos del singleton: verificados por lectura Wix.
- Código: alineación implementada en rama.
- PR #370 está abierto pero `dirty` (historial divergente respecto a main). No hay checks para el HEAD actual; los últimos checks exitosos son del SHA 68a2f327 y no validan estos cambios.
- Rebase, CI sobre HEAD, revisión del diff y pruebas Wix Editor/E2E: pendientes.
- No se ha ejecutado mutación CMS ni publicación Wix.
