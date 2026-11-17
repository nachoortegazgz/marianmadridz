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

Consultar [DECISION-LOG.md](DECISION-LOG.md). TEC-038 describe la política técnica fail-closed actualmente implementada; QA-2026-11-15-TEMP-MUTABILITY autoriza la excepción temporal, cuya implementación segura sigue pendiente.


> **Nota de baseline CMS:** los inventarios y recuentos CMS que acompañan este estado son snapshots históricos; no constituyen baseline vigente del Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e` hasta repetir una lectura de solo lectura contra el sitio QA actual.


## Addendum de estado live — 2026-11-17

Este addendum prevalece sobre cualquier snapshot anterior cuando exista contradicción con evidencia Wix live posterior.

### Estado real de Wix y sincronización

- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`; Wix Editor Classic; Velo habilitado.
- `GetSiteContext` consultado el 2026-11-17 devuelve **Draft**. No se ha ejecutado Preview ni Publish.
- La declaración histórica de que el código está publicado no queda acreditada por un identificador de publicación ni por read-back del SHA. Se clasifica como declaración del propietario, no como hecho verificado.
- La integración disponible no permite leer/escribir el código fuente Velo del Editor Classic ni confirmar sincronización GitHub↔Wix.

### CMS y maestro fiscal

- Inventario live: 50 colecciones (21 NATIVE, 29 WIX_APP); 201 registros NATIVE en el corte consultado.
- `DatosFiscales` no existe (Wix WDE0025).
- `MapaStaff` es NATIVE, 43 campos, revisión 135 y 5 registros: 3 STAFF, 1 TERCERO/PROVEEDOR y 1 GESTORIA. No existe `CONFIG_SISTEMA`.
- Contrato vigente propuesto: `MapaStaff` discriminado por `recordType` (STAFF/TERCERO/GESTORIA/CONFIG_SISTEMA). TEC-035 queda supersedida por TEC-039 y la evidencia live.
- La fila GESTORIA no tiene `emailFiscal`; no se puede enviar documentación a gestoría hasta que se configure un correo verificado.
- `ServiciosCatalogo` y `ComplementosCatalogo` tienen lectura/escritura CMS_EDITOR. Las 19 colecciones operativas y TPV QA tienen las cuatro acciones PRIVILEGED. Read-back confirmado.

### Caja, compensaciones y pedidos POS

- `ControlOperativo` mantiene 3 compensaciones FISCAL_LEDGER en PENDING_RECOVERY.
- Las tres compensaciones se correlacionan con dos pedidos POS Wix: uno de servicio totalmente reembolsado por 18,15 EUR y otro pedido mixto pagado en efectivo por 92,45 EUR.
- La reserva asociada a cada pedido permanece CONFIRMED/PENDING_LEDGER con totalAmount=0.
- El pedido POS en efectivo no aparece en MovimientosCaja (0) ni en la proyección de caja (salesCount=0; cashAmount=openingCashAmount=300 EUR). El propietario declara que los datos son sintéticos, pero no hay marcador técnico que acredite la sinteticidad de estos dos pedidos.
- `CajaActual` permanece ABIERTA. `closedAt` es anterior a `openedAt`; `sequenceCounters` se devuelve como JSON string aunque el esquema lo declara OBJECT. PR #419 prepara la corrección, sin modificar el singleton live.
- No se han reintentado compensaciones, creado movimientos, asientos, reembolsos ni cierres.

### Código, CI y despliegue

- PR #418: alineación de MapaStaff/fiscal y consumidores; CI offline verde (Layer 1: 331/331; Layer 2: 256/256; Secret scanning, SDK contracts y ESLint SUCCESS).
- PR #419: normalización de sesión de caja y sequenceCounters; CI offline verde (Layer 1: 331/331; Layer 2: 257/257; Secret scanning, SDK contracts y ESLint SUCCESS).
- Ambos PR siguen abiertos y no fusionados. No se ha ejecutado Wix runtime ni E2E publicado.
- `main` no tiene rulesets configurados; GET rulesets devuelve lista vacía. La integración no dispone de permisos administrativos para crear branch protection/required checks. No fusionar ni publicar hasta resolver este control.

### Fiscalidad, automatizaciones y Capa 3

- Writers fiscales, contables y laborales siguen deshabilitados. No existe CONFIG_SISTEMA y SIF/VERI*FACTU no está certificado.
- Siete automatizaciones activas PREINSTALLED, bloqueadas por Wix; algunas envían emails/notificaciones. No se ejecutaron ni modificaron.
- No está acreditado un pipeline Capa 3 completo SharePoint/Power Automate. El conector SharePoint no está instalado/conectado y no se dispone de conector Power Automate operativo.

### Inmutabilidad

Las instrucciones vigentes del proyecto mantienen los ledgers fiscales, contables y laborales como append-only e inmutables. Cualquier texto histórico que suspenda genéricamente append-only durante QA queda subordinado a esta regla vigente. No se borran ni sobrescriben movimientos, asientos, cierres ni evidencias; las correcciones económicas requieren nuevos registros rectificativos trazables.

**Estado de publicación: NO-GO.** Bloqueos P0: issues #415 y #416. Validación runtime, protección de main, configuración legal/SIF y reconciliación económica pendientes.
