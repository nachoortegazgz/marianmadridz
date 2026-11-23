# Auditoría TPV — registros sintéticos legacy fuera de contrato (2026-11-23)

**Sitio:** 188bed94-177c-4bc9-a9f0-35080d874f3e.  
**Método:** Wix CMS Query Data Items con consistentRead=true; inspección estática de main.  
**Estado:** solo lectura. No se han escrito, actualizado ni eliminado datos.

## 1. Grupo de registros detectado

Siete registros comparten el prefijo TPV-QA-1795437582366 y timestamp 2026-11-23 12:39:42Z:

| Colección | Registros | Datos observados |
|---|---:|---|
| MovimientosCaja | 3 | SALE CASH +20 EUR; SALE CARD +35 EUR; REFUND CARD -35 EUR. synthetic=true, recordSource=TPV_QA_DEVELOPMENT, source=TPV_FUNCTIONAL_TEST, status=SIMULATED_SUCCESS, reconciliationStatus=RECONCILED. |
| LibroAsientosContablesDetalle | 3 | +20, +35, -35 EUR; eventType TPV_SALE_SIMULATED / TPV_REFUND_SIMULATED; projectionStatus=SIMULATED_ONLY; schemaVersion=TPV-QA-1. |
| HistoricoCierresZ | 1 | recordDomain=TPV_CUSTOM_QA; closingStatus=SIMULATED; closingSource=TPV_FUNCTIONAL_TEST; totalOperations=3; totalCash=20 EUR; isIntegrityVerified=true; closingSignatureStatus=NOT_SIGNED. |

El total neto de la prueba es 20 EUR (20 + 35 - 35), coincidente con el total del cierre simulado. Esta coherencia aritmética no acredita que los registros cumplan el contrato fiscal/contable ni que se hayan ejecutado mediante el writer autorizado.

## 2. Aislamiento y trazabilidad

Ninguno de los siete registros contiene testRunId, siteId, sourceType ni sessionId. No existe fila ControlOperativo que coincida con el prefijo TPV-QA-1795437582366. Los traceId usan el patrón legacy TPV-QA-<timestamp>-<phase>, no el contrato neutral actual TPV:<siteId>:<sessionId>:<operationId>.

Las tres filas MovimientosCaja no contienen schemaVersion, hash ni previousRecordHash. Sí tienen synthetic=true y recordSource=TPV_QA_DEVELOPMENT, pero esos marcadores no bastan para ser reconocidas como un test-run válido.

## 3. Contraste con contratos de main

### MovimientosCaja

data.js::MovimientosCaja_beforeInsert exige traceId, schemaVersion y hash antes de validar el dominio. Para eventos TPV sintéticos, _isCurrentSyntheticTpvRow exige:
- recordSource canónico (TPV_LEDGER/TPV_SYNTHETIC/TPV_SANDBOX_SYNTHETIC).
- movementType SIMULATED_TPV_*.
- payloadFiscal con sourceType, siteId, ledgerVersion, schemaVersion, reconciliationStatus, sessionId o excepción de auditoría, isSynthetic=true, realPayment=false, externalSideEffects=false y requestFingerprint.
- hash SHA-256, sequenceNumber=0 y traceId del sitio/run permitido.

Las tres filas detectadas no cumplen el contrato y serían rechazadas por el hook actual.

### LibroAsientosContablesDetalle

data.js::LibroAsientosContablesDetalle_beforeInsert llama a assertAccountingLedgerRecord. Las filas detectadas carecen de journalEntryId, recordSource, documentId, sequenceNumber, desgloseDetallado.accountCode/debitAmount/creditAmount, hash y previousRecordHash. Aunque contienen amount/accountingAmount/accountingSign y projectionStatus=SIMULATED_ONLY, no son asientos válidos bajo el contrato actual. No deben entrar en informes PGC ni sustituir el ledger.

### HistoricoCierresZ

data.js::HistoricoCierresZ_beforeInsert llama a assertHistoricoCierresZ. La fila simulada carece de fiscalPeriod y de totalTaxAmount/totalTaxBase, requeridos por el validador. El registro es explícitamente SIMULATED/TPV_CUSTOM_QA y NOT_SIGNED, pero no satisface el contrato de inserción actual.

## 4. Causa posible y límites

La persistencia pudo originarse en:
1. un writer legacy anterior al contrato actual;
2. una escritura por Wix CMS REST/Data Items que no pasó por los hooks Velo;
3. código Wix Runtime desincronizado respecto al main actual.

No se dispone de log de autoría ni de evidencia de ejecución del Editor/Preview para atribuir una causa concreta. La sincronización Git–Wix sigue sin acreditarse. No se debe afirmar que el hook está desplegado en Wix solo porque exista en GitHub.

## 5. Riesgos

- Las filas sintéticas están en colecciones append-only; no pueden actualizarse ni borrarse mediante el flujo normal.
- La ausencia de marcadores canónicos impide clasificarlas como el test-run neutral actual.
- Debe comprobarse que los lectores y agregadores fiscales/contables excluyen projectionStatus=SIMULATED_ONLY y los dominios TPV_CUSTOM_QA/TPV_QA_DEVELOPMENT.
- Los registros no contienen orderId/bookingId y no están correlacionados con #10032/#10033; no resuelven las compensaciones fiscales PENDING_RECOVERY.
- CajaActual permanece ABIERTA con traceId=0 y sin sessionId/testRunId; el test-run no acredita una sesión TPV aislada.

## 6. Acciones seguras

1. Identificar el escritor exacto mediante Wix Activity Logs, historial CMS, logs de automatizaciones/Preview y autoría de los registros.
2. Verificar si los hooks Velo actuales están sincronizados en Editor/Preview y si las escrituras CMS REST los eluden.
3. Auditar lectores, agregadores y exportaciones para confirmar que SIMULATED_ONLY y TPV_CUSTOM_QA no se contabilizan.
4. No modificar ni eliminar filas; son append-only. Si la política de limpieza preproducción contempla registros sintéticos, requerirá un mecanismo legal/técnico específico aprobado que no vulnere la inmutabilidad.
5. Reanudar pruebas TPV solo con el contrato neutral completo: testRunId, siteId, sourceType, sessionId, schemaVersion, requestFingerprint, hash QA independiente, secuencia cero, idempotencia, autorización backend y aislamiento del data plane.
6. Probar en Wix Preview/Sandbox; no usar REST Management API como sustituto de Preview ni escribir sobre Live.

## 7. Estado

**Verificado:** siete registros sintéticos legacy; contratos de main; ausencia de los cuatro marcadores de aislamiento; ausencia de ControlOperativo correlacionado.  
**Inferido:** posible writer legacy, bypass CMS REST o despliegue Wix desincronizado.  
**Pendiente:** autoría, data plane, exclusión de agregadores, sincronización Wix, Preview E2E.

Mantener NO-GO TPV/producción. Incidencias de seguimiento: #435 y #434. No modificar ledgers.


### 4.1 Correlación de autoría con pedidos POS

Los siete registros TPV-QA comparten un único valor CMS _owner. Ese owner coincide con createdBy.userId de los pedidos POS #10032 y #10033; ambos pedidos tienen el mismo creador. Se ha comprobado por comparación booleana y no se exponen identificadores personales.

**Interpretación limitada:** existe un actor común entre el grupo TPV sintético y los pedidos POS. Esto hace plausible que los pedidos formen parte de una sesión de pruebas, pero no lo demuestra: el mismo usuario puede crear operaciones reales o de prueba. No hay checkoutId/externalId ni marcador QA verificable en los pedidos, y la actividad MERCHANT_COMMENT no contiene indicadores textuales de test/QA/demo/prueba. Mantener #10032/#10033 como posibles hechos económicos hasta que el titular aporte evidencia de prueba, recibo/caja o trazas del adquirente.
