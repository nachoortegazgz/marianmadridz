# Estado actual del proyecto — Marian Madrid

**Fecha de corte:** 2026-11-14  
**Sitio objeto de trabajo:** 50b39f33-e753-4331-ab35-b2ed43dc97f7  
**Naturaleza:** banco de pruebas aislado, sin actividad real, según declaración expresa del propietario.  
**Plataforma:** Wix Editor Classic + Velo.  
**Repositorio:** nachoortegazgz/marianmadridz.

## Estado del CMS verificado

- 23 colecciones: 15 NATIVE y 8 WIX_APP; 524 campos físicos en las colecciones NATIVE.
- Los registros presentes se consideran sintéticos/de prueba; no acreditan operaciones comerciales, fiscales ni laborales reales.
- CajaActual: 39 campos, 1 registro. operationDate es DATE, openingAmount NUMBER y sequenceCounters OBJECT. cashRegisterStatus=SIMULACION; isOpen=true no es autoridad. id=_id; currentSequence=0 sin consumidor localizado.
- ControlOperativo: 42 campos, 0 registros. ownerToken, retryAfter y nextRetryAt no existen; traceId es el token de fencing canónico.
- ComplementosCatalogo: 18 campos, 36 registros. addonId coincide con _id en 36/36; traceId está vacío. name y description coinciden en texto, pero son TEXT y RICH_TEXT.
- MapaStaff: 18 campos, 3 registros. Contiene staffMemberId, resourceId, scheduleId, memberId y active. thirdPartyId es TEXT opaco, no es GUID ni coincide con DatosFiscales._id y no tiene consumidor localizado; no tratarlo como FK. No declara recordType ni campos fiscales.
- DatosFiscales: 28 campos, 1 registro placeholder. Contiene recordType, taxId, legalName, thirdPartyType, address y gestorName/gestorNombre. No declara traceId ni schemaVersion; fechaInicioVerifactu es TEXT.
- ServiciosCatalogo: 42 campos, 95 registros (94 SERVICE y 1 PRICING_PLAN). serviceId y pricingPlanId son IDs nativos distintos de _id CMS.
- InventarioStockVenta y MovimientosInventario existen físicamente con registros sintéticos, pero sus contratos y writers están retirados; no se reactiva inventario custom.

## Alineación de código en la rama actual

- Rama: fix/current-site-cms-contract-alignment; HEAD a8a44cb8e75fd3c9d57fe3279a02ae47411b50a6.
- internalConfig.js incorpora DatosFiscales a BUSINESS_COLLECTIONS y delimita RECORD_TYPE a los registros fiscales.
- validation.js y data.js separan MapaStaff (identidad de personal) de DatosFiscales (maestro fiscal).
- dataAccessPolicy.js aplica la validación de recordType a DatosFiscales, no a MapaStaff.
- eventLog.js, fiscalAggregator.web.js y fiscalDocuments.web.js leen/escriben el maestro fiscal en DatosFiscales usando únicamente campos físicos declarados.
- ComplementosCatalogo usa _id como identidad CMS canónica y mantiene addonId como espejo físico mientras la columna exista.
- cajas.web.js usa operationDate DATE ISO YYYY-MM-DD, acumula Bizum en otherAmount y devuelve openingAmount; no consume operationDateHour, bizumAmount ni los cuatro opening*Amount inexistentes.
- gestorName queda como nombre canónico; gestorNombre deja de ser consumido y solo se elimina durante una actualización si ambos valores existentes coinciden.

## Estado de integración Git

- PR #370 está abierto pero no es mergeable (`dirty`): 109 commits ahead y 57 behind `main`.
- No hay checks para HEAD a8a44cb. Los últimos checks exitosos corresponden a 68a2f327 y no cubren los cambios posteriores.
- Rebase/reconciliación y CI sobre el SHA actual siguen pendientes. No fusionar ni publicar hasta resolverlos.

## Seguridad y límites operativos

- ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true permite update/remove individuales y masivos sobre colecciones propias incluidas en ISOLATED_SITE_MUTABLE_COLLECTIONS.
- Las operaciones masivas requieren IDs explícitos y un máximo de 1.000 registros.
- Las colecciones WIX_APP quedan excluidas. Se mantienen RBAC, permisos, validaciones, secretos, allowlists de inserción y gates de writers/efectos externos.
- Los writers fiscales, contables y laborales, los pagos, reembolsos y envíos externos permanecen fail-closed.
- No existe registro CONFIG_SISTEMA con datos fiscales oficiales verificados.
- No se han ejecutado mutaciones CMS, migraciones de registros ni publicación Wix durante esta intervención.

## Bloqueos y validación pendiente

1. Ejecutar CI completa, lint, contratos y secret scanning sobre la rama actual.
2. Revisar el diff completo y crear PR; no integrar si falla alguna prueba.
3. Verificar hooks y WebMethods en Wix Editor y ejecutar pruebas sintéticas controladas.
4. Exportar el código Velo del Editor y contrastarlo con Git; la sincronización Editor↔Git no está acreditada.
5. Revisar consumidores externos, vistas y automatizaciones antes de retirar físicamente addonId, traceId de ComplementosCatalogo, gestorNombre o CajaActual.id.
6. No habilitar writers fiscales ni afirmar cumplimiento Veri*Factu hasta disponer de datos oficiales y validar el flujo end-to-end.

## Evidencia principal

- [Base maestra](PROJECT_BASELINE.md)
- [Diccionario CMS](DICCIONARIO_DATOS_CMS.md)
- [Auditoría del esquema y contratos](docs/audits/2026-11-14-current-site-cms-normalization.md)
