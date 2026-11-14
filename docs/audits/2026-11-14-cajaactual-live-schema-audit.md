> **Alcance corregido:** esta auditoría corresponde al sitio productivo 188bed94-177c-4bc9-a9f0-35080d874f3e y no al sitio QA 50b39f33-e753-4331-ab35-b2ed43dc97f7. El snapshot CMS QA de 2026-11-14 registra CajaActual revisión 1 con netAmount y staffResourceId; por tanto, la ausencia de esos campos en el esquema de producción no demuestra un defecto del contrato QA. No aplicar cambios basados en esta auditoría a QA ni a producción sin volver a leer el esquema del sitio objetivo.

# Auditoría de esquema live — CajaActual

**Fecha de consulta:** 2026-11-14.
**Sitio:** Marian Madrid, `188bed94-177c-4bc9-a9f0-35080d874f3e`.
**Entorno:** sitio publicado de referencia.
**Fuente primaria:** Wix Data Collections API, `GET https://www.wixapis.com/data/v2/collections/CajaActual`.
**Resultado:** HTTP 200, lectura únicamente; no se modificó CMS.

## 1. Definición devuelta por Wix

| Propiedad | Valor live |
|---|---|
| ID | `CajaActual` |
| Nombre visible | `CAJA_ACTUAL` |
| Tipo | `NATIVE` |
| Revisión | `9` |
| Última actualización | `2026-11-14T04:11:13.578Z` |
| Campo de presentación | `singletonKey` |
| Campos totales | 82 |
| Campos personalizados | 78 |
| Campos de sistema | 4 (`_id`, `_createdDate`, `_updatedDate`, `_owner`) |

Permisos devueltos: `read=ANYONE`, `insert=ADMIN`, `update=ADMIN`, `remove=ADMIN`.

## 2. Esquema físico

```text
singletonKey:TEXT, closedAt:DATETIME, closedBy:TEXT, cierreZReference:TEXT,
openedAt:DATETIME, openedBy:TEXT, operationDateHour:DATETIME,
cashRegisterStatus:TEXT, openingCashAmount:NUMBER, openingCardAmount:NUMBER,
openingBizumAmount:NUMBER, openingOtherAmount:NUMBER, cashAmount:NUMBER,
cardAmount:NUMBER, bizumAmount:NUMBER, otherAmount:NUMBER,
cashMovementId:TEXT, lastMovementAt:DATETIME, snapshotUpdatedAt:DATETIME,
snapshotSource:TEXT, snapshotVersion:NUMBER, salesCount:NUMBER,
expectedCash:NUMBER, countedCash:NUMBER, difference:NUMBER,
differenceReason:TEXT, sequenceCounters:OBJECT, ticketSequence:NUMBER,
lastOperationId:TEXT, lastOperationType:TEXT, lastOperationAmount:NUMBER,
lastOperationPaymentMethod:TEXT, lastOperationAt:DATETIME,
lastOperationStatus:TEXT, traceId:TEXT, posIntegrationStatus:TEXT,
ticketSyncStatus:TEXT, orderId:TEXT, checkoutId:TEXT, paymentId:TEXT,
transactionId:TEXT, paymentReference:TEXT, paymentStatus:TEXT,
paymentMethod:TEXT, paymentBreakdown:OBJECT, amountReceived:NUMBER,
changeReturned:NUMBER, posPaymentStatus:TEXT, posPaymentMethod:TEXT,
posPaymentProvider:TEXT, posAmount:NUMBER, posCurrency:TEXT,
posPaidAt:DATETIME, ticketNumber:TEXT, ticketIssuedAt:DATETIME,
ticketType:TEXT, ticketSeries:TEXT, lineItems:OBJECT,
conceptOperations:OBJECT, conceptQuantities:OBJECT, customerName:TEXT,
customerTaxId:TEXT, customerAddress:TEXT, netPrice:NUMBER,
discountAmount:NUMBER, roundingAmount:NUMBER, taxableBaseTotal:NUMBER,
appliedTax:NUMBER, taxTotal:NUMBER, ticketTotal:NUMBER, fiscalText:TEXT,
verifactuReference:TEXT, verificationQr:TEXT, ticketXControlReference:TEXT,
contactId:TEXT, catalogItemId:TEXT, serviceId:TEXT, bookingId:TEXT,
_id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

## 3. Diferencias respecto al diccionario anterior

El esquema anterior documentaba revisión 64 y 59 campos personalizados. La lectura live actual devuelve revisión 9 y 78 campos personalizados. Los siguientes campos del esquema anterior ya no aparecen en la respuesta live: `staffResourceId`, `conceptList`, `pvp`, `totalSum`, `netAmount`. La respuesta actual incorpora, entre otros, `snapshotUpdatedAt`, `snapshotSource`, `snapshotVersion`, `lastOperationId`, `lastOperationType`, `lastOperationAmount`, `lastOperationPaymentMethod`, `lastOperationAt`, `lastOperationStatus`, `posIntegrationStatus`, `posPaymentStatus`, `posPaymentMethod`, `posPaymentProvider`, `posAmount`, `posCurrency`, `posPaidAt`, `checkoutId`, `paymentId`, `transactionId`, `contactId`, `catalogItemId`, `serviceId` y `bookingId`.

## 4. Discrepancia de contrato con el código del repositorio

Revisión estática sobre `main` (HEAD consultado: `906918b3468c4490797e30509a8156c550ba6b2b`):

- `src/backend/cajas.web.js:167` define `CAJA_KEYS.TOTAL = "netAmount"`, campo ausente del esquema live.
- `src/backend/cajas.web.js:1122` escribe `cashRegister.staffResourceId`, campo ausente del esquema live.
- `src/backend/cajas.web.js:1364` devuelve `netAmount` desde la proyección de CajaActual.
- `src/backend/tests/site.flows.offline.test.mjs` contiene fixtures y aserciones sobre `netAmount`; las pruebas offline no demuestran que el esquema publicado de Wix acepte/retenga esa propiedad.
- `src/backend/eventLog.js:695-702` escribe `staffResourceId` en `MovimientosCaja`; es un contrato de otra colección y no se debe trasladar automáticamente a CajaActual.
- Las búsquedas de código realizadas para `snapshotUpdatedAt`, `snapshotSource`, `snapshotVersion`, `lastOperationId`, `posPaymentStatus`, `checkoutId`, `paymentId` y `transactionId` no devolvieron consumidores en el índice consultado.

**Interpretación:** el contrato físico de CajaActual en Wix y parte del contrato usado por backend/tests están desalineados. Esto no demuestra un fallo de escritura: la documentación Wix indica que el esquema CMS no se aplica estrictamente a todos los valores almacenados. Sí impide afirmar que la definición CMS y el modelo de código están sincronizados.

## 5. Riesgo y decisión

**P1 — pendiente de reconciliación.** No modificar código ni datos por inferencia. Antes de cambiar el modelo:

1. Inspeccionar todos los consumidores y writers de CajaActual, incluyendo `dataAccess`, validadores, WebMethods, crons, hooks y pruebas.
2. Determinar con evidencia si `netAmount` es alias de negocio que debe mantenerse, sustituirse o eliminarse; no inferirlo por su ausencia en el esquema.
3. Determinar si `staffResourceId` debe existir en CajaActual o si la identidad debe resolverse desde otra proyección.
4. Acordar qué campos nuevos son realmente parte del contrato de negocio y si requieren persistencia o solo están declarados en CMS.
5. Definir migración de esquema y compatibilidad, con pruebas unitarias, integración, regresión, concurrencia e idempotencia.
6. Validar persistencia y lectura en Wix QA aislado antes de cualquier publicación.

**Seguridad:** `read=ANYONE` junto a campos de identificación de cliente, datos fiscales y referencias de pago es un riesgo P1. No se cambiaron permisos; evaluar necesidad de lectura pública y revisar los caminos de acceso efectivos. No usar datos personales reales mientras esta configuración permanezca.

## 6. Alcance de la validación

- Verificado: lectura de la definición live mediante Wix API, HTTP 200; revisión, fechas, permisos, cardinalidad y claves/tipos de campos.
- Verificado: búsqueda estática de los consumidores señalados en el código y tests de `main`.
- No ejecutado: Wix Local Editor, runtime WebMethods, escrituras/lecturas de prueba, E2E, prueba de acceso visitante, ni suite CI nueva.
- No realizado: cambios de código, cambios CMS, publicación o despliegue.

**Estado:** auditoría documental basada en esquema live; no certifica comportamiento runtime.
