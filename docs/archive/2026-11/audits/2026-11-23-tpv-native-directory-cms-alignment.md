# Auditoría y estabilización TPV — directorios nativos y retirada de colecciones

**Fecha:** 2026-11-23  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Baseline de código:** `main` en `65cfe6b645d94a264cec4a4b08778eaa22014e04`  
**Rama de trabajo:** `fix/tpv-native-identities-cms-alignment-20261123`  
**Estado:** cambios implementados en rama; pruebas/CI y Wix Runtime pendientes. **Release NO-GO**.

## 1. Objetivo y alcance

Alinear los consumidores del TPV con el CMS y las aplicaciones nativas actuales de Wix después de retirar las colecciones `TPV_IDENTITIES` / `TpvSandboxIdentities` y `PAQUETE_GESTORIA` / `PaquetesGestoria`. Mantener el contrato del widget donde sea necesario, sin conservar dependencias de identidad sintética ni recrear colecciones eliminadas.

No se ha cambiado el modelo de pagos, el ledger, los locks, la idempotencia ni los controles X/Z salvo los puntos estrictamente necesarios para sustituir la resolución de identidad.

## 2. Evidencia Wix — lectura en vivo

La lectura de Wix Data Collections API con `consistentRead=true` devolvió **30 colecciones**. No se encontraron coincidencias por ID ni display name para:

- `TpvSandboxIdentities`
- `TPV_IDENTITIES`
- `PaquetesGestoria`
- `PAQUETE_GESTORIA`

`MapaStaff` continúa presente: revisión **135**, **39 campos funcionales**. Entre los campos físicos están `recordType`, `staffMemberId`, `resourceId`, `identityStatus` y `rolBookings`.

Consulta de solo lectura a `MapaStaff` filtrada por `recordType=STAFF`:
- 3 registros.
- 3/3 contienen `staffMemberId` y `resourceId`.
- `identityStatus` aparece como `N/A`; no se utiliza como indicador de actividad.
- `rolBookings` aparece como `STAFF`.

Cruce de solo lectura con Wix Bookings `Query Staff Members`:
- 3 service providers nativos.
- 3/3 coinciden con los registros `MapaStaff` por `resourceId`.
- 0/3 coinciden por `MapaStaff.staffMemberId` frente al `_id` nativo de Bookings.

**Decisión de implementación:** `resourceId` es la clave de unión/autorización TPV, porque la coincidencia está verificada en los tres profesionales. El `staffMemberId` que devuelve el directorio TPV procede del `_id` actual de Bookings. Los valores divergentes de `MapaStaff.staffMemberId` no se corrigen en CMS en esta intervención; quedan como discrepancia de datos pendiente de reconciliación.

## 3. Correcciones de código

### 3.1 Directorio TPV nativo

Nuevo módulo: `src/backend/tpv/tpvNativeDirectory.js`.

- Clientes: `@wix/crm` / `contactsV5.searchContacts` para búsqueda y `contactsV5.getContact` para revalidar en backend el contacto seleccionado.
- Profesionales: `@wix/bookings` / `staffMembers.queryStaffMembers`, que devuelve service providers; se intersecta con `MapaStaff` por `resourceId`.
- Los métodos se elevan en backend con `auth.elevate`; los WebMethods mantienen la autorización de cajero/operador.
- Se rechazan IDs inválidos, profesionales no mapeados, duplicidades y resultados paginados incompletos.
- No se utilizan nombres, email ni IDs aportados por el navegador como prueba de autorización.

### 3.2 Compatibilidad widget

- Se conserva temporalmente el campo de transporte `customerIdentityId` para no romper el protocolo HTML existente. Su valor ahora es el `_id` de un contacto Wix nativo, nunca una identidad sintética.
- El backend re-resuelve el contacto antes de persistir la venta y guarda `customerContactId` dentro del payload TPV.
- `profesionalId` conserva el contrato del widget, pero su valor es `MapaStaff.resourceId` validado contra Bookings.
- `#htmlTPV` está en el artefacto raíz `#htmlTPV.txt`; se añadieron comentarios de contrato, sin cambiar el protocolo de mensajes.
- La página real es `src/pages/TPV.yl5th.js`, que conecta el HTML con el controlador compartido. El controlador está en `src/public/tpvPageController.js`; no existe `src/pages/pageTpvController.js` en el repositorio.
- El controlador normaliza `sessionId` y otros textos de entrada mediante `optionalString()`.

### 3.3 Consumidores actualizados

- `tpvCatalogo.web.js`: búsqueda de contactos, validación de contacto y listado de profesionales nativos.
- `tpvVentas.web.js`: revalidación de contacto y profesionales por `resourceId`.
- `tpvMovimientos.web.js` y `tpvDevoluciones.web.js`: autorización centralizada mediante `resolveAuthorizedProfessional()`.
- `tpvRepository.js` y `tpvCaja.web.js`: retirada del bootstrap de identidades presembradas.
- Eliminado `src/backend/tpv/tpvIdentities.js`.
- `internalConfig.js`, `dataAccess.js`, `dataAccessPolicy.js`, `data.js` y `validation.js`: retiradas las constantes, allowlists, validadores y hooks de ambas colecciones eliminadas.

### 3.4 Paquetes de gestoría

- `PaquetesGestoria` ya no figura en el registro de colecciones ni en las políticas de escritura/validación/hooks.
- Las operaciones de creación, historial, descarga y envío de snapshots devuelven `PACKAGE_STORAGE_REMOVED` después de autorización de manager; no consultan ni recrean la colección.
- Se ha eliminado el código privado de persistencia de snapshots y el despacho de email que dependía de ese almacén.
- Se conserva la previsualización fiscal como lectura no persistente y el listado de destinatarios `GESTORIA` desde `MapaStaff`.

### 3.5 Dependencia SDK

Se añadió `@wix/crm` versión fijada `1.0.1686` a `package.json`. Debe sincronizarse/instalarse con el package manager de Wix en el entorno del sitio antes de Preview/Runtime.

## 4. Pruebas y controles añadidos/actualizados

- Nueva suite `tpv.native-directory.test.mjs`: cruce de directorios, discrepancia del `staffMemberId` legacy, rechazo de profesionales no autorizados, duplicidades, búsqueda y revalidación de Contacts.
- Actualizados contratos TPV, bootstrap, políticas CMS, validadores, hooks, simulador de pagos y pruebas de APIs fiscales retiradas.
- Actualizado el verificador de SDK Wix para comprobar exports de Contacts V5 y Bookings Staff.

**No ejecutado todavía:** `npm test`, `npm run lint`, `npm run verify:wix-tpv-native-sdk`, CI de GitHub, Wix Preview, Wix Runtime ni E2E. No se declara validado lo que no se ha ejecutado.

## 5. Riesgos y pendientes

1. **P1 — discrepancia MapaStaff.staffMemberId:** 0/3 valores coinciden con Bookings `_id`; la unión por `resourceId` sí coincide 3/3. No se ha escrito en CMS. Revisar si procede rectificar esos campos con trazabilidad.
2. **P1 — permisos/scopes:** verificar en Preview/Runtime que la app dispone de lectura de Contacts y Bookings Staff y que `auth.elevate` opera con los permisos esperados.
3. **P1 — consumidores UI de paquetes:** revisar cualquier pantalla/automatización que invoque los métodos de paquetes; recibirá `PACKAGE_STORAGE_REMOVED`.
4. **P1 — paquete Wix:** instalar/sincronizar `@wix/crm` en el sitio antes de Runtime.
5. **P1 — concurrencia/idempotencia:** las correcciones no sustituyen las pruebas existentes de locks, ledger, X/Z, devoluciones ni reintentos.

## 6. Integridad, reversión y despliegue

- No se modificó CMS, registros, permisos, pagos, automatizaciones ni datos históricos.
- No se modificaron los contratos append-only ni se borraron/sobrescribieron ledgers.
- No se fusionó ni desplegó esta rama.
- No revertir a ciegas los consumidores de las colecciones retiradas. Cualquier reversión debe conservar los guards `PACKAGE_STORAGE_REMOVED` y no reintroducir lecturas/escrituras a colecciones inexistentes.
- Condición de merge: suite offline y lint verdes, diff revisado, verificador SDK verde y conformidad del propietario.
- Condición de release: además, sincronización de paquetes Wix y Preview/Runtime/E2E con permisos reales, sin pagos ni efectos externos.

## 7. Fuentes oficiales

- [Wix Contacts V5 — Search Contacts](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts-v5/search-contacts?apiView=SDK)
- [Wix Contacts V5 — Get Contact](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts-v5/get-contact?apiView=SDK)
- [Wix Bookings — Query Staff Members](https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members?apiView=SDK)
- [Wix CMS — Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)
