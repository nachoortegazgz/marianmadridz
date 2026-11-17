# Wix CMS permissions hardening — 2026-11-17

## Estado

- Sitio: Marian Madrid Peluquería y Estética
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`
- Editor: Wix Editor Classic; Velo habilitado.
- Estado devuelto por `GetSiteContext`: **Draft**.
- Repositorio y base de esta evidencia: `nachoortegazgz/marianmadridz`, main `f94e1e0f4a3e6f99fbfaab604474996b3ac0df4e`.
- Alcance: lectura de permisos y colecciones, cambios de permisos CMS y read-back. No se modificaron datos, esquemas, ledgers, reservas, pagos, automatizaciones ni publicación.

## Cambios aplicados en Wix

Se aplicó `PRIVILEGED` a las cuatro acciones (`itemRead`, `itemInsert`, `itemUpdate`, `itemRemove`) de las siguientes 19 colecciones:

### Colecciones operativas y sensibles

- `MapaStaff`
- `ControlOperativo`
- `HistoricoCierresZ`
- `PaquetesGestoria`
- `RegistroIntegracion`
- `MovimientosCaja`
- `LibroAsientosContablesDetalle`
- `CajaActual`
- `CitasF2`
- `RegistrosHorariosStaff`

### Colecciones de simulación TPV

- `TPV_QA_Auditoria`
- `TPV_QA_MovimientosCaja`
- `TPV_QA_Pagos`
- `TPV_QA_Reembolsos`
- `TPV_QA_SesionesCaja`
- `TPV_QA_TicketX`
- `TPV_QA_TicketZ`
- `TPV_QA_VentaLineas`
- `TPV_QA_Ventas`

Cada cambio devolvió éxito y se hizo una segunda consulta `GET /wix-data/v1/permissions?data_collection_id=<id>`; las 19 lecturas devolvieron los cuatro valores `PRIVILEGED` y `specialPermissions: []`.

### Catálogos propios con campos internos

Se detectó una segunda exposición en los catálogos:

- `ServiciosCatalogo` tenía `itemRead=ANYONE` y contiene campos internos `margin`, `internalNotes` y `precioCosteBase`.
- `ComplementosCatalogo` tenía `itemRead=ANYONE` y contiene clasificación fiscal/contable (`tipoImpositivo`, `codigoImpuesto`, `claveRegimen`, `cuentaContableIngreso`).

Se cambió únicamente el permiso de lectura de ambas colecciones a `CMS_EDITOR`; inserción, actualización y eliminación permanecen en `CMS_EDITOR`. Read-back confirmado. Así, los editores conservan mantenimiento en Content Manager y los visitantes no pueden leer directamente los campos internos.

La revisión de consumidores encontró que las páginas `Pagina de servicio 2` y `Calendario de reservas 2` llaman al WebMethod público `getServiceBySlugOrId` en `src/backend/reservas.web.js`. Ese método consulta mediante `dataAccess.js`/ `auth.elevate` y devuelve `_toPublicService`, un DTO allowlist que excluye los campos internos. La prueba `RES-DTO-01` verifica que no se expongan `margin`, `precioCosteBase`, `internalNotes` ni campos arbitrarios. No se identificó consulta CMS directa en esos page controllers. Aun así, la prueba runtime en Wix después del cambio sigue pendiente.

## Fundamento técnico

- Wix Data Permissions API: https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-permissions/introduction
- Update Permissions: https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-permissions/update-permissions
- Get Permissions: https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-permissions/get-permissions

Wix define `PRIVILEGED` como acceso reservado a administradores del sitio y usuarios con permisos especiales. La implementación del repositorio centraliza el acceso CMS en `src/backend/dataAccess.js` mediante `auth.elevate(items.*)`; las consultas/escrituras de las páginas deben seguir pasando por WebMethods backend. Esta inspección estática no sustituye una prueba runtime de cada WebMethod después del cambio de permisos.

## Inventario CMS observado

La API `GET https://www.wixapis.com/data/v2/collections` devolvió `pagingMetadata.total = 50`: 21 colecciones NATIVE y 29 WIX_APP según la clasificación devuelta en las páginas inspeccionadas.

Las colecciones de catálogo propio `ServiciosCatalogo` y `ComplementosCatalogo` tienen lectura, inserción, actualización y eliminación `CMS_EDITOR`; el read-back de ambas confirmó los cuatro valores. Los visitantes consumen los DTO públicos de los WebMethods, no acceso CMS directo. Las colecciones de sistema Wix App no se modificaron. En particular, Wix documenta `Members/FullData` y `Members/PublicData` como colecciones de sistema con lectura pública fija; el campo `privacyStatus` de FullData distingue perfiles públicos y privados. `Forms/subscribers03` conserva inserción pública, coherente con un formulario de suscripción. No se alteraron permisos de colecciones propiedad de Wix Apps.

La respuesta completa de inventario excede el límite de respuesta cuando incluye esquemas extensos; dos páginas no pudieron parsearse por truncamiento. Por tanto, este documento no declara una auditoría de seguridad de campo a campo de las 50 colecciones ni sustituye la revisión de las colecciones WIX_APP.

## Comprobaciones del repositorio

- `src/backend/dataAccess.js`: operaciones CMS centralizadas con `auth.elevate`; políticas de acceso aplicadas en la capa DAL.
- `src/backend/internalConfig.js`: `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false`, `ALLOW_SIMULATION_RECORDS=false`; escrituras de jornada y ajustes deshabilitados.
- `src/backend/jobs.config`: 15 jobs declarados.
- Comparación estática con `src/backend/crons.js`: los 15 nombres declarados en `jobs.config` tienen una exportación correspondiente. Esto no acredita que los jobs estén instalados o ejecutándose en Wix.
- `src/backend/events.js` y `src/backend/webhookEventClaims.js`: los ocho handlers Bookings/eCommerce usan claims previos a los efectos; PR #289 está integrada. La idempotencia propia de cada efecto sigue siendo necesaria ante interrupciones.
- La suite de CI no se ha ejecutado desde este cambio de permisos. El combined status consultado para el SHA de main no devolvió checks (lista vacía); no se interpreta como CI PASS.

## Pendiente de validación runtime

1. En Wix QA, comprobar que un miembro no privilegiado y un CMS_EDITOR no pueden leer ni mutar las 19 colecciones.
2. Comprobar que los WebMethods backend autorizados siguen leyendo/escribiendo donde corresponde mediante `auth.elevate`.
3. Probar las rutas de TPV QA sin pagos, notificaciones, fiscal writers ni hardware reales.
4. Probar hooks append-only y RBAC desde Content Manager y WebMethods.
5. Verificar que las páginas ZONA MARIAN, ZONA STAFF, TPV y calendario funcionan sin acceso CMS directo.
6. Reconciliar el baseline físico actual de colecciones/campos/registros. No crear `DatosFiscales` ni migrar esquemas por inferencia.
7. Confirmar la situación de las tres compensaciones fiscales pendientes y la caja antes de cualquier writer.
8. Completar el QA fiscal/SIF/VERI*FACTU con asesoría y fuentes AEAT oficiales antes de habilitar emisión o remisión.
9. Verificar Bookings, Stores, área de cliente, automatizaciones y cron jobs en entorno aislado.
10. Configurar branch protection/ruleset de `main` y required checks; la integración GitHub disponible en esta sesión permite leer repositorio/PR/CI, pero no expone una operación para cambiar branch protection.
11. Confirmar sincronización GitHub → Wix Editor mediante read-back del código; no se ha demostrado en esta intervención.
12. Completar revisión de accesibilidad, textos legales, precios con IVA, privacidad y términos antes de publicación.

## Decisión de despliegue

**NO-GO.** La corrección de permisos reduce la superficie de exposición de 19 colecciones, pero no se ha ejecutado runtime Wix después de los cambios, no se ha demostrado sincronización del código, no se ha acreditado cumplimiento fiscal ni se ha completado la campaña E2E. No publicar ni activar writers reales hasta superar los criterios anteriores.

## Inmutabilidad y datos

No se borró, editó ni insertó ningún registro. No se modificó ningún ledger ni snapshot. Los cambios de este hito afectan exclusivamente a permisos de colecciones CMS.
