# Estado actual del proyecto — Marian Madrid

**Fecha de corte:** 2026-11-14  
**Sitio objeto de auditoría:** `50b39f33-e753-4331-ab35-b2ed43dc97f7`  
**Naturaleza del sitio:** banco de pruebas aislado, sin actividad real, según declaración del propietario.  
**Plataforma:** Wix Editor Classic + Velo.  
**Repositorio:** `nachoortegazgz/marianmadridz`.

## Addendum operativo QA — 2026-11-14

**Decisión del propietario:** el Site ID `50b39f33-e753-4331-ab35-b2ed43dc97f7` se utilizará como entorno QA del proyecto con datos sintéticos y pagos simulados. El Site ID productivo `188bed94-177c-4bc9-a9f0-35080d874f3e` queda expresamente fuera de las pruebas.

**Estado técnico:** el inventario CMS QA está documentado en `docs/audits/2026-11-14-current-site-cms-normalization.md` (23 colecciones: 15 NATIVE y 8 WIX_APP). La conexión Wix disponible en esta sesión no pudo resolver el ID QA y solo identificó producción. Por ello, el acceso runtime y el aislamiento de todas las integraciones no están verificados. No se han ejecutado pruebas Wix Runtime/E2E ni se ha usado producción como sustituto.

**Trabajo permitido ahora:** auditoría de código/documentación, fixtures sintéticos, mocks offline de pagos y comunicaciones, pruebas automatizadas, CI, correcciones en ramas/PR y registro de evidencias. El adaptador de pago mock no debe realizar llamadas de red ni equivaler a una operación real.

**Gates:** mantener bloqueados cobros, reembolsos reales, facturación, tickets a clientes, emails/SMS/WhatsApp, gestoría, SharePoint/Power Automate, AEAT/Veri*Factu y escrituras fuera de QA. La bandera de mutaciones de QA no elimina gates funcionales independientes.

**Plan canónico:** [PLAN_ACCION_QA.md](PLAN_ACCION_QA.md). **Directrices raíz:** [DIRECTRICES_DESARROLLO_CODIGO.md](DIRECTRICES_DESARROLLO_CODIGO.md).

## Estado verificado

- Repositorio `main`: PR #361–#366 integradas; último merge `13b9ae095214e0c601f255fa75d629680c539933`. PR #367 alinea los contratos CMS; CI offline PASS (run #1137: 69 suites/631 tests) y secret scanning PASS (#561). Integrada en main mediante PR #367, merge `dfdee00d8ebc535427c95d49cae91b4c557e4209`.
- CI offline, contratos SDK, ESLint y secret scanning de las cuatro intervenciones: PASS.
- CMS del sitio actual: 23 colecciones, 15 NATIVE y 8 WIX_APP.
- Colecciones propias: 524 definiciones de campo; 140 registros en el corte leído.
- Los registros existentes deben tratarse como sintéticos/de prueba; no son evidencia de operaciones reales.
- `CajaActual.sequenceCounters` es OBJECT y su valor leído es objeto; `ticketSequence` no existe en el esquema actual.
- `ControlOperativo.ownerToken` no existe; `traceId` es la clave canónica de fencing.
- `MapaStaff` tiene 18 campos y 3 filas activas. Es exclusivamente el mapa de identidades Wix Bookings/Members; contiene `staffMemberId`, `resourceId`, `scheduleId`, `memberId` y `active`. No declara campos fiscales ni `recordType`.
- `DatosFiscales` existe físicamente con 28 campos y un registro sintético placeholder. Es la colección canónica para identidad fiscal, terceros y configuración fiscal; el registro actual no acredita identidad fiscal real.
- `ComplementosCatalogo` tiene 36 filas; `addonId` coincide con `_id` en las 36. `name` y `description` contienen el mismo texto en las 36, con tipos TEXT y RICH_TEXT.
- `InventarioStockVenta` y `MovimientosInventario` existen físicamente, pero son colecciones legacy sin writers activos en el código actual; no se reactiva su uso.

## Contratos alineados en la rama actual

- MapaStaff: hooks y validador limitados al esquema de personal. Validan GUIDs nativos staffMemberId, resourceId y scheduleId y, si están informados, memberId / thirdPartyId. No exigen recordType, traceId ni schemaVersion.
- DatosFiscales: declarado en BUSINESS_COLLECTIONS y usado por los lectores/escritores fiscales y el directorio de gestoría. Sus contratos ya no persisten traceId ni schemaVersion porque esos campos no existen en el esquema físico.
- ComplementosCatalogo: _id es la identidad CMS de origen; el DTO interno addOnId conserva el nombre del contrato de reserva. addonId permanece como espejo físico porque el campo sigue siendo obligatorio en CMS y se valida su igualdad con _id.
- ControlOperativo: traceId es el fencing token canónico; ownerToken no existe en el esquema.
- CajaActual.sequenceCounters es OBJECT y se lee como objeto JSON; ticketSequence no existe.
- No se fusionan MapaStaff.resourceId con _id: aunque coinciden en las tres filas, representan el ID nativo de recurso Bookings y el ID de registro CMS. Tampoco se fusionan serviceId y pricingPlanId.

## Bloqueos y discrepancias pendientes

1. ComplementosCatalogo.addonId sigue siendo obligatorio físicamente. Su retirada requiere cambiar el esquema y revisar todos los escritores externos/CMS.
2. CajaActual.id coincide con _id en el singleton leído; queda pendiente completar la búsqueda de consumidores antes de retirar el campo.
3. DatosFiscales.gestorName y gestorNombre coinciden en el único registro leído. gestorName queda como keyfield canónico propuesto; la columna duplicada no se borra en este cambio.
4. ComplementosCatalogo.name y description tienen el mismo texto, pero tipos TEXT y RICH_TEXT. Se conservan por semántica de etiqueta y contenido.
5. La sincronización entre el código versionado y los archivos del Editor Wix no está verificada.
6. Las pruebas runtime en el Editor y E2E siguen pendientes.

## Política de cambios

- Los bypasses globales de mutabilidad QA se han retirado del código. Los ledgers append-only permanecen inmutables; bulk remove queda limitado a purgas efímeras condicionadas. No hay barrera runtime por Site ID verificada.
- Colecciones Wix Apps excluidas; autenticación, autorización, permisos, validación de esquema y gates de efectos externos permanecen activos.
- No se ejecutan operaciones reales ni se interpretan datos sintéticos como actividad real.
- No se modifica el CMS en esta intervención; cambios de código/documentación se integran mediante PR y CI.

## Evidencias

- [Plan de acción QA](PLAN_ACCION_QA.md)
- [Directrices de desarrollo](DIRECTRICES_DESARROLLO_CODIGO.md)

- [Base maestra](PROJECT_BASELINE.md)
- [Diccionario de datos CMS](DICCIONARIO_DATOS_CMS.md)
- [Auditoría de esquema y contratos](docs/audits/2026-11-14-current-site-cms-normalization.md)
