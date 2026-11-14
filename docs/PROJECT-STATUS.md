# Estado del proyecto — sitio Marian Madrid

**Corte:** 2026-11-14  
**Sitio único de trabajo:** 50b39f33-e753-4331-ab35-b2ed43dc97f7  
**Naturaleza:** banco de pruebas aislado, sin actividad real, según declaración expresa del propietario.  
**Plataforma:** Wix Editor Classic + Velo.  
**Repositorio:** nachoortegazgz/marianmadridz.

## Situación actual

El sitio es el único objeto de trabajo. No se mantiene una matriz de comparación con otro sitio. Los registros presentes se consideran sintéticos y no acreditan actividad comercial, fiscal ni laboral.

### CMS verificado

- 23 colecciones: 15 NATIVE y 8 WIX_APP; 524 campos físicos NATIVE.
- CajaActual: 39 campos, 1 registro; operationDate DATE, openingAmount NUMBER, sequenceCounters OBJECT y otherAmount. cashRegisterStatus=SIMULACION; isOpen=true no es autoridad.
- ControlOperativo: 42 campos, 0 registros; ownerToken, retryAfter y nextRetryAt ausentes; traceId es fencing token.
- ComplementosCatalogo: 18 campos, 36 registros; addonId = _id en 36/36.
- MapaStaff: 18 campos, 3 registros; mapa de identidades de personal. thirdPartyId es TEXT opaco, no coincide con DatosFiscales._id y no tiene consumidor localizado.
- DatosFiscales: 28 campos, 1 placeholder; recordType, taxId, legalName, thirdPartyType y datos de gestoría; sin traceId ni schemaVersion.
- ServiciosCatalogo: 42 campos, 95 registros; serviceId y pricingPlanId son identificadores nativos distintos de _id CMS.
- InventarioStockVenta y MovimientosInventario permanecen físicamente, pero sus contratos y writers están retirados.

La especificación de campos y tipos está en [la auditoría del esquema actual](audits/2026-11-14-current-site-cms-normalization.md) y en [el diccionario CMS](../DICCIONARIO_DATOS_CMS.md).

### Código y documentación

La rama fix/current-site-cms-contract-alignment separa los contratos de MapaStaff y DatosFiscales, migra los lectores/escritores fiscales a DatosFiscales, usa _id como keyfield CMS canónico de ComplementosCatalogo y consolida gestorName como nombre de gestoría.

### Seguridad y operaciones

- ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true está autorizado para las colecciones propias del sitio aislado.
- Las colecciones WIX_APP permanecen fuera del alcance de mutación.
- Se mantienen RBAC, permisos, validaciones, secretos, allowlists y gates de writers/efectos externos.
- Writers fiscales/contables/laborales, pagos, reembolsos y envíos externos siguen fail-closed.
- No existe CONFIG_SISTEMA con identidad fiscal oficial verificada.

## Pendientes de cierre

1. Ejecutar CI completa, lint, contratos y secret scanning sobre la rama.
2. Revisar diff y abrir PR; no integrar con pruebas fallidas.
3. Validar hooks/WebMethods en Wix Editor y ejecutar pruebas sintéticas controladas.
4. Exportar código Velo del Editor y comparar con Git; la sincronización Editor↔Git no está acreditada.
5. Revisar consumidores externos antes de retirar físicamente campos espejo.
6. No habilitar writers fiscales ni afirmar cumplimiento Veri*Factu sin datos oficiales y pruebas end-to-end.

## Decisiones

Consultar [DECISION-LOG.md](DECISION-LOG.md). Las entradas históricas se conservan para trazabilidad; TEC-037 y TEC-038 describen la política y arquitectura vigentes.
