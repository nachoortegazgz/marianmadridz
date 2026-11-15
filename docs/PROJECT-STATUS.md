> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`nacho.pitt@example.test`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](qa/QA-ENVIRONMENT-SSOT.md).

---

# Estado del proyecto — sitio Marian Madrid

**Corte:** 2026-11-14  
**Sitio QA único de trabajo:** 188bed94-177c-4bc9-a9f0-35080d874f3e  
**Naturaleza:** entorno QA previo al despliegue real; nunca ha tenido actividad real y sus datos son sintéticos, según declaración expresa del propietario.  
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

PR #370 está abierto pero GitHub informa `dirty` (historial divergente respecto a main). No hay checks asociados al HEAD actual; los últimos checks exitosos son de 68a2f327 y no validan los cambios posteriores. Rebase y CI actual pendientes; no fusionar ni publicar.

### Seguridad y operaciones

- La decisión QA-2026-11-15-TEMP-MUTABILITY autoriza temporalmente correcciones de datos sintéticos, pero la mutabilidad no está habilitada técnicamente: la política central aún bloquea update/remove de ledgers append-only.
- No existe una bandera global de mutabilidad; no habilitarla sin identidad de sitio verificada server-side, ADMIN-only, allowlist por colección, backup y auditoría.
- Las colecciones WIX_APP y los claims/eventos de idempotencia permanecen protegidos.
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


> **Nota de baseline CMS:** los inventarios y recuentos CMS que acompañan este estado son snapshots históricos; no constituyen baseline vigente del Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e` hasta repetir una lectura de solo lectura contra el sitio QA actual.
