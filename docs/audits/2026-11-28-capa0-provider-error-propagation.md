# Capa 0 — proveedores, identidad y DAL — 28-11-2026

Estado: cambios en rama, CI pendiente. Sin modificaciones de CMS, publicación, cobros ni operaciones fiscales.

## Diagnóstico confirmado

### Data Access Layer

- getItem(collection, id) devolvía null si collection o id eran vacíos. Eso confundía argumentos inválidos con un registro inexistente.
- queryReferencedItems() no tenía consumidores activos en el repositorio. La implementación normalizaba respuestas sin items/results a [], ocultando respuestas SDK incompatibles.
- Se ha endurecido getItem para exigir collection e id de tipo string no vacíos. Solo el error real de ausencia WDE0073 devuelve null.
- Se ha retirado queryReferencedItems() y su binding elevado/mocks tras búsqueda de consumidores en todo el repo.

### Bookings Staff y Members

La documentación oficial de Query Staff Members v1 declara:
- Respuesta: staffMembers[] y pagingMetadata con count, cursors y hasNext.
- cursorPaging.limit máximo 100.
- Solo devuelve staff que son service providers.
- resourceId admite filtro $eq.
- fields RESOURCE_DETAILS y ASSOCIATED_IDENTITY_STATUS están declarados.

Defectos confirmados en el código:
- _queryStaffMembers convertía una respuesta sin staffMembers a [].
- _fetchStaffByResourceId convertía errores de proveedor a null.
- _fetchAllStaff convertía errores de proveedor a [].
- getSiteMemberIdByContactId convertía errores de CRM a cadena vacía.
- security.js convertía errores de identidad y de consulta de staff a false/null.
- security.web.js y horario.web.js ocultaban errores de proveedor como denegación o NOT_STAFF.
- horario.web.js mantenía una resolución de identidad propia basada en contactId, en vez de delegar en security.js, que además verifica el memberId asociado y re-resuelve el resourceId.
- citasManager.web.js ocultaba errores de consulta de staff en la comprobación de rol administrador; además consultaba staff antes de comprobar si el miembro era propietario de la reserva.

## Cambios propuestos

- DAL: argumentos inválidos generan DATA_COLLECTION_REQUIRED o DATA_ITEM_ID_REQUIRED; ausencia real sigue siendo null.
- Código muerto: eliminado queryReferencedItems() al no existir consumidores.
- Staff: errores de proveedor se convierten en STAFF_PROVIDER_UNAVAILABLE; respuesta inválida en STAFF_PROVIDER_RESPONSE_INVALID; paginación incompleta en STAFF_PAGINATION_LIMIT_EXCEEDED. No se devuelve un subconjunto como si estuviera completo.
- Identidad Members: errores de proveedor distinguidos mediante MEMBER_IDENTITY_PROVIDER_UNAVAILABLE y respuesta inválida mediante MEMBER_IDENTITY_RESPONSE_INVALID.
- security.js: los errores técnicos ya no se convierten en no autorizado/no encontrado.
- horario.web.js: delega en getMyStaffContext de security.js; elimina la segunda implementación de identidad.
- citasManager.web.js: preserva errores de identidad y staff; primero valida la propiedad por memberId y solo consulta el directorio staff si necesita autorizar un administrador.
- Las funciones de display-only en cajas.web.js/reservas.web.js conservan fallback visual; no autorizan ni escriben datos.

## Pruebas añadidas/actualizadas

- getItem rechaza colección/ID vacíos o ID no string.
- La API muerta queryReferencedItems no se exporta.
- Paginación Bookings con cursor pendiente al llegar al límite lanza error, no devuelve resultados parciales.
- Fallos y respuestas inválidas de Bookings/CRM se propagan con código estable.
- security.isAdmin distingue proveedor no disponible de miembro no autenticado.
- horario.getMyStaffContext usa la identidad central y conserva error de proveedor.
- getBookingMemberProfile distingue fallo del proveedor Members de AUTH_REQUIRED.
- Contrato estático de propiedad en citasManager confirma que los errores de staff no se absorben.

## Pendientes/riesgos

1. Query Staff Members v1 solo devuelve service providers. Verificar que todos los resourceId de roles de sitio pertenecen a service providers. Si existe personal no proveedor, evaluar Query Staff Members v2 con contrato oficial; no asumir que v1 cubre a todo el personal.
2. secretAccess.js sigue convirtiendo fallo/ausencia de secreto a cadena vacía. La API oficial Get Secret Value documenta respuesta {value:string}, pero no errores específicos; no inventar distinción NOT_FOUND vs provider outage. Próxima fase.
3. events.js _getEmisorFiscal aún captura error de secreto y construye NIF vacío. Debe revisarse junto con secretAccess.
4. mmUtils._roundMoney y helpers numéricos aún convierten ciertos valores inválidos a 0; revisar consumidores de reservas, fiscalidad y caja antes de cambiar.
5. TPV_RUNTIME_POLICY mantiene CURRENCY y CURRENCY_CODE con EUR; pendiente inventario completo de consumidores.
6. Runtime Wix y E2E siguen pendientes; no hay publicación autorizada ni fixture aislado configurado.

## Fuentes oficiales

- Query Staff Members v1: https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members
- Query Staff Members v2: https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members-v-2
- API Query Language: https://dev.wix.com/docs/api-reference/articles/work-with-wix-apis/data-retrieval/about-the-wix-api-query-language
- Wix Data Query Items: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items
- Get Secret Value: https://dev.wix.com/docs/api-reference/business-management/secrets/get-secret-value

## Validación

- CI de esta rama: pendiente.
- npm ci/lint/test local: no ejecutados en este entorno.
- Wix Local Editor/Preview/Runtime: pendiente.
- E2E: pendiente, sin escrituras económicas o fiscales reales.
