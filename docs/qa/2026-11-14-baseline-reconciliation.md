> **Addendum de vigencia — 2026-11-14:** la política de mutabilidad descrita más abajo es histórica. TEC-038 retiró los bypasses globales; no usar `QA_RECORD_MUTATIONS_ENABLED` como permiso actual. El propietario designa `50b39f33-e753-4331-ab35-b2ed43dc97f7` como QA y declara el sitio despublicado/pasarela desconectada; el conector actual no resuelve ese ID, limitación que no cambia el destino autorizado.

# Reconciliación de baseline y recuperación de validadores — 2026-11-14

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

- 41 colecciones: 12 `NATIVE` y 29 `WIX_APP`.
- 980 definiciones físicas de campo.
- `MapaStaff`: revisión 105, 56 campos físicos.
- `DatosFiscales`, `InventarioStockVenta` y `MovimientosInventario`: no aparecen en el inventario live y los GET individuales devolvieron 404 / `WDE0025`.
- No recrear esas colecciones por referencias históricas o allowlists de QA.

## Política de QA y seguridad

- `QA_RECORD_MUTATIONS_ENABLED=true` permanece activa por autorización expresa del propietario.
- Esta bandera permite update/remove en CMS propias durante QA; no habilita insert, writers fiscales/contables/laborales, pagos, reembolsos ni efectos externos.
- La bandera es un bloqueo de producción. No se modifica en esta intervención.
- No se ha cambiado CMS live, Wix Editor, permisos, automatizaciones, datos ni configuración de aplicaciones.
- No se ha publicado ni desplegado código.

## Inventario e integraciones

- Wix Stores Catalog V3 es la autoridad operativa del catálogo/stock comercial.
- La capa de inventario personalizado está retirada por decisión documentada en el ADR de inventario nativo. No se reactivan writers ni exports de inventario personalizados.
- Capa 3 (SharePoint / Power Automate) continúa como diseño documental; su operación end-to-end no está certificada.
- El documento `NECESIDADES WEB MARIAN.txt` aportado en esta conversación no está versionado en Git; su matriz de requisitos debe reconciliarse antes de tratar sus estados declarados como aceptación. Las directrices originales tampoco estaban versionadas; se ha creado `docs/engineering/DEVELOPMENT-STANDARDS.md` como versión consolidada y vigente basada en ese estándar.

## Criterios de cierre de esta tanda

1. Los exports importados por todos los consumidores existen y mantienen sus contratos.
2. La suite `npm test`, `npm run test:layer1`, `npm run test:layer2` y `npm run lint` pasan en CI sobre el mismo SHA.
3. La inspección de diff no detecta cambios en reglas de negocio ajenas al hallazgo.
4. Se documenta el estado de CI con enlaces y SHA reales.
5. No se publica en Wix hasta resolver el bloqueo de QA y obtener autorización expresa.


## Addendum posterior — decisión de QA del propietario, 2026-11-14

El propietario designa `50b39f33-e753-4331-ab35-b2ed43dc97f7` como entorno QA y ordena continuar pruebas con datos sintéticos y pasarela simulada. El sitio `188bed94-177c-4bc9-a9f0-35080d874f3e` es producción y queda excluido de QA. La conexión Wix de la sesión no resolvió el Site ID QA; por tanto, el bloqueo se limita a Wix Runtime/E2E. Continúan permitidas pruebas offline/mock y CI, sin llamadas a proveedores ni efectos externos. El plan vigente es [PLAN_ACCION_QA.md](../../PLAN_ACCION_QA.md). Este addendum actualiza la recomendación anterior de no duplicar producción: no se está ordenando duplicar ni modificar producción, sino utilizar el Site ID QA ya designado por el propietario, sujeto a resolver su acceso técnico.
