# Reconciliación de baseline y contratos CMS — 2026-11-14

## Autoridad y alcance

El único sitio objeto de trabajo es 50b39f33-e753-4331-ab35-b2ed43dc97f7, Wix Editor Classic + Velo. El propietario declara que es un banco de pruebas aislado y que no tiene actividad real. No existe una matriz de comparación con otro sitio para esta intervención.

El código Velo del Editor no queda vinculado a un SHA de Git por la mera lectura de Wix GetSiteContext. La correspondencia Editor↔Git requiere exportación y comparación.

## CMS verificado

Fuente: Wix Data Collections API, lectura de colecciones y campos.

- 23 colecciones: 15 NATIVE y 8 WIX_APP.
- 524 definiciones físicas de campo NATIVE.
- MapaStaff: 18 campos, 3 registros; solo identidad de personal.
- DatosFiscales: 28 campos, 1 registro placeholder; no declara traceId ni schemaVersion.
- CajaActual: 39 campos, 1 singleton; operationDate DATE, openingAmount NUMBER, sequenceCounters OBJECT, cashRegisterStatus TEXT, isOpen BOOLEAN, id TEXT y currentSequence NUMBER.
- ComplementosCatalogo: 18 campos, 36 registros; addonId=_id en 36/36.
- ControlOperativo: 42 campos, 0 registros; traceId es fencing token; ownerToken, retryAfter y nextRetryAt no existen.
- ServiciosCatalogo: 42 campos, 95 registros; serviceId y pricingPlanId son identificadores nativos distintos de _id CMS.
- InventarioStockVenta y MovimientosInventario permanecen físicamente, pero sus contratos y writers están retirados.

## Hallazgos de contrato y datos

1. MapaStaff no es maestro fiscal. Su contrato se limita a staffMemberId, resourceId, scheduleId, memberId y active.
2. DatosFiscales es el maestro de terceros, gestoría y configuración fiscal. CONFIG_SISTEMA no existe; los writers fiscales permanecen fail-closed.
3. ComplementosCatalogo usa _id como keyfield CMS canónico. addonId permanece como espejo físico requerido por el esquema actual; addOnId es el campo de transporte Bookings.
4. CajaActual.sequenceCounters es OBJECT. operationDateHour y bizumAmount no existen; operationDate DATE y otherAmount son los campos físicos. Bizum se agrega en otherAmount y el detalle queda en MovimientosCaja.
5. CajaActual cashRegisterStatus=SIMULACION e isOpen=true; el backend gobierna por cashRegisterStatus. id=_id; currentSequence=0 no tiene consumidor localizado.
6. gestorName es el nombre canónico de gestoría; gestorNombre solo se conserva como espejo físico y se elimina en una actualización si coincide.
7. ServiciosCatalogo.serviceId y pricingPlanId son IDs nativos diferentes de _id CMS; no se fusionan.

## Alineación de código

Rama: fix/current-site-cms-contract-alignment.

- internalConfig.js separa RECORD_TYPE fiscal de MapaStaff y añade SIMULACION a CASH_REGISTER_STATUS.
- validation.js y data.js mantienen validadores independientes para MapaStaff, DatosFiscales y CajaActual.
- dataAccessPolicy.js aplica RECORD_TYPE a DatosFiscales, no a MapaStaff.
- eventLog.js, fiscalAggregator.web.js y fiscalDocuments.web.js consumen DatosFiscales.
- cajas.web.js escribe operationDate como DATE ISO YYYY-MM-DD, agrega Bizum en otherAmount y proyecta openingAmount.
- ComplementosCatalogo usa _id como identidad CMS y addonId como espejo físico.

## Estado de seguridad y validación

- ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true permite update/remove individual y masivo sobre colecciones propias incluidas en ISOLATED_SITE_MUTABLE_COLLECTIONS; operaciones masivas requieren IDs explícitos y límite 1.000.
- WIX_APP queda excluido. Se mantienen RBAC, permisos, validaciones, secretos, allowlists de inserción y gates de efectos externos.
- No existe CONFIG_SISTEMA con identidad fiscal oficial verificada.
- PR #370 está abierto pero `dirty` (historial divergente respecto a main). No hay checks para el HEAD actual; los últimos checks exitosos son del SHA 68a2f327 y no validan estos cambios. Rebase, CI sobre HEAD, lint, secret scanning, revisión del diff, pruebas Wix Editor y E2E sintéticas están pendientes.
- No se ha ejecutado una mutación CMS, migración de registros ni publicación Wix en esta intervención.
