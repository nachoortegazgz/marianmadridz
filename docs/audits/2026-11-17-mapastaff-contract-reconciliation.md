# Reconciliación del maestro fiscal MapaStaff — 2026-11-17

## Objetivo

Alinear el contrato fiscal backend con el esquema físico live del CMS sin crear, mover, sobrescribir ni eliminar datos. Este cambio supersede la decisión TEC-035 del 2026-11-14 porque el esquema del CMS cambió posteriormente.

## Evidencia Wix live

Sitio: `188bed94-177c-4bc9-a9f0-35080d874f3e`, Editor Classic, Velo habilitado, estado Draft.

### Colecciones

- `GET /data/v2/collections/MapaStaff`: NATIVE, 43 campos, revisión 135.
- `GET /wix-data/v1/permissions?data_collection_id=DatosFiscales`: `WDE0025`, colección inexistente.
- `MapaStaff` tiene `itemRead/itemInsert/itemUpdate/itemRemove=PRIVILEGED`.
- El esquema físico de `MapaStaff` declara los campos de identidad Wix y los campos fiscales necesarios: `recordType`, `taxId`, `legalName`, `thirdPartyType`, `taxRegime`, `fiscalIdType`, `verifactuEnabled`, `verifactuVersion`, `fechaInicioVerifactu`, `schemaVersion`, `traceId`, `emailFiscal`, `phoneFiscal`, `address`, etc.

### Registros (solo metadatos)

- 3 registros `STAFF`.
- 1 registro `TERCERO` con `thirdPartyType=PROVEEDOR`.
- 1 registro `GESTORIA` con `thirdPartyType=GESTORIA`.
- No existe `CONFIG_SISTEMA`.
- La fila GESTORIA no tiene `emailFiscal`; el listado de destinatarios debe devolver cero destinatarios para esa fila. No se debe inferir ni derivar un correo.
- Los tres registros STAFF tienen `staffMemberId`, `resourceId`, `scheduleId`, `memberId`, `rolWebsite` y `rolBookings`; el esquema no declara `active`. No filtrar por `active=true`.
- No se exportaron valores de NIF, razón social, teléfonos, direcciones ni emails.

## Diagnóstico del código en main antes del cambio

- `internalConfig.js` declaraba una colección `DatosFiscales` inexistente.
- `eventLog.js`, `fiscalAggregator.web.js` y `fiscalDocuments.web.js` consultaban dicha colección.
- `data.js` tenía hooks `DatosFiscales_beforeInsert/Update/Remove` y un hook MapaStaff que solo aceptaba el contrato STAFF.
- `validation.js` exigía identificadores de Bookings para todo registro MapaStaff, incompatible con los registros físicos TERCERO y GESTORIA.
- `events.js` filtraba el mapa de personal por `active=true`, campo que no está declarado en el esquema live.
- `fiscalDocuments.web.js` aceptaba aliases `email/gestorEmail` y patrones embebidos que no forman parte del esquema live.

## Decisión canónica

`MapaStaff` es el maestro único discriminado por `recordType` para:

- `STAFF`: mapeo de identidad Bookings/Members.
- `TERCERO`: identidad fiscal de clientes/proveedores/otros terceros.
- `GESTORIA`: identidad de gestoría y sus datos de contacto fiscal.
- `CONFIG_SISTEMA`: singleton `CONFIG_SISTEMA_FISCAL`.

La ausencia de `CONFIG_SISTEMA` no se corrige con un placeholder. Solo se insertará cuando el titular/asesoría proporcione y verifique NIF, razón social y configuración legal/técnica del SIF. Los escritores fiscales y contables permanecen deshabilitados.

## Implementación propuesta en esta rama

Rama: `fix/fiscal-master-mapastaff-live-schema-2026-11-17`.

1. Eliminar `BUSINESS_COLLECTIONS.DATOS_FISCALES` y añadir `RECORD_TYPE.STAFF`.
2. Centralizar la validación discriminada en `assertMapaStaffRecord`; validar campos fiscales solo para TERCERO/GESTORIA/CONFIG_SISTEMA.
3. Trasladar el singleton fiscal y la protección de borrado a los hooks de MapaStaff.
4. Migrar el upsert de terceros, lectura de configuración y agregador fiscal a MapaStaff.
5. Resolver destinatarios de gestoría exclusivamente desde `recordType=GESTORIA` y campos físicos `emailFiscal/displayName/taxId/phoneFiscal/address`. Si falta emailFiscal, no se presenta como destinatario.
6. Resolver mapeos Bookings exclusivamente desde `recordType=STAFF`; eliminar el filtro por el campo no declarado `active`.
7. Actualizar pruebas unitarias/contratos para usar MapaStaff y añadir una prueba estática transversal del contrato.

No se modifica Wix CMS ni ningún registro en esta rama. No se crea el singleton CONFIG_SISTEMA. No se habilitan writers.

## Riesgos y mitigaciones

- **Riesgo:** la migración de constantes puede dejar consumidores no migrados. **Mitigación:** búsqueda global de `DATOS_FISCALES`, suite de CI y revisión del diff.
- **Riesgo:** la fila GESTORIA carece de emailFiscal. **Mitigación:** no se inventa un destinatario; el envío continúa deshabilitado.
- **Riesgo:** los registros STAFF no tienen campo active. **Mitigación:** el resolver filtra por `recordType=STAFF` y valida unicidad/GUIDs; la disponibilidad/validez nativa procede de Bookings.
- **Riesgo:** el singleton fiscal no existe. **Mitigación:** lectores fiscales fallan cerrados si no existe configuración verificable; no se inventa NIF ni razón social.
- **Riesgo:** el port de la rama histórica puede traer deuda obsoleta. **Mitigación:** no se fusiona la rama antigua; solo se portan bloques mínimos sobre main actual.

## Validación

CI offline superada en el último SHA del PR #418:
- Secret scanning: SUCCESS.
- Layer 1: 28 suites, 331 tests PASS, 0 FAIL.
- Layer 2: 19 suites, 256 tests PASS, 0 FAIL.
- Regresión offline, contratos SDK Wix y ESLint: SUCCESS.
- Diff revisado estáticamente; el PR sigue abierto y no se ha fusionado.

Pendiente:
- Pruebas runtime Wix de hooks, lectura de catálogo fiscal, Bookings y destinatarios.
- Confirmación de read-back del código en Wix Editor.
- Protección de `main`/required checks antes de merge.
- CONFIG_SISTEMA con datos legales verificados por el titular/asesoría.

No se declara validación runtime ni despliegue.

## Estado de despliegue

**NO-GO.** Este cambio solo alinea el código con el esquema físico. No resuelve las tres compensaciones pendientes, el estado de caja, la configuración SIF/VERI*FACTU, las pruebas runtime ni el despliegue Wix. Mantener todos los writers fiscales/contables deshabilitados.
