> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`nachoortegazgz@gmail.com`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](docs/qa/QA-ENVIRONMENT-SSOT.md).

---

# Estado actual del proyecto — Marian Madrid

## Hito técnico — corrección de deployment backend (2026-11-14)

**CERRADO — CI PASS (offline)**

- PR #373 quedó integrada en `main` mediante merge `1b39ebb22c885f50320b7d52f5bc336cc0570ee5`; su CI inicial falló por el export ausente `assertMapaStaffRecord` y una aserción desactualizada de `CASH_REGISTER_STATUS`.
- PR correctiva #374: https://github.com/nachoortegazgz/marianmadridz/pull/374. HEAD validado: `da96c1b50f1910a287aea718bc6025d295e30e2b`. Merge en `main`: `1de381ecb6495e17a3eae5b75b43e8493166988a`.
- CI sobre el HEAD de PR #374 (`da96c1b50f1910a287aea718bc6025d295e30e2b`): Layer 1 **24 suites / 307 tests PASS**; Layer 2 **19 suites / 252 tests PASS**; regresión completa **70 suites / 644 tests PASS**; Cart V2, Order Transactions y Bookings Reader V2 PASS; ESLint PASS; Gitleaks full-history PASS. CI del merge commit `1de381ecb6495e17a3eae5b75b43e8493166988a` también PASS (Layer 1 24/307; Layer 2 19/252; regresión 70/644; SDK, ESLint y Gitleaks PASS).
- La corrección restaura `assertMapaStaffRecord`, mantiene `thirdPartyId` como TEXT opaco y corrige la regla de `CONFIG_SISTEMA.thirdPartyType = null`.
- PR #374 integrada en `main` mediante merge `1de381ecb6495e17a3eae5b75b43e8493166988a`.
- **Entorno QA:** el único sitio es `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). Wix GetSiteContext confirma que está Published, con dominio personalizado, Editor y Velo. El propietario confirma que fue creado para QA, nunca ha tenido actividad real y todos sus datos son sintéticos. Runtime/E2E con efectos externos no se ha ejecutado ni se declara validado.
- **Discrepancia documental pendiente:** el diccionario CMS contiene un addendum de consolidación fiscal de MapaStaff (42 campos), mientras que el baseline y el código activo describen el contrato separado MapaStaff/DatosFiscales. No desplegar ni migrar ese contrato hasta reconciliar evidencia live, rama de implementación y retirada de DatosFiscales.


**Fecha de corte:** 2026-11-14  
**Sitio objeto de trabajo:** 188bed94-177c-4bc9-a9f0-35080d874f3e
**Naturaleza:** banco de pruebas aislado, sin actividad real, según declaración expresa del propietario.  
**Plataforma:** Wix Editor Classic + Velo.  
**Repositorio:** `nachoortegazgz/marianmadridz`.

## Trabajo QA TPV — 2026-11-14

Se ha incorporado un simulador TPV sintético puro, sin persistencia ni llamadas externas, con validación de líneas, desglose de medios, pendientes, céntimos e idempotencia. La suite se incluye en Layer 1. La auditoría `docs/audits/2026-11-14-tpv-contract-gap-audit.md` documenta que el writer real aún no acepta todos los medios de negocio, no concilia `OTROS` en proyección/cierre y mantiene bloqueadas las escrituras fiscales. No se ha habilitado el writer real. CI del cambio TPV pendiente en el corte actual.

## Addendum operativo QA — 2026-11-14

**Decisión del propietario:** el Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e` es el único entorno QA del proyecto. No existe otro sitio QA ni un QA externo designado. El cliente sintético canónico es Nacho Pitt (`nachoortegazgz@gmail.com`) y la pasarela está desconectada.

**Estado técnico:** existe un inventario CMS histórico en `docs/audits/2026-11-14-current-site-cms-normalization.md`, pero sus 23 colecciones y esquemas no están revalidados contra el sitio QA vigente. Repetir lectura CMS de solo lectura antes de escrituras o migraciones. GetSiteContext confirma el sitio QA y sus metadatos; no certifica aislamiento de todas las integraciones ni validación runtime/E2E. No se han ejecutado pruebas Wix Runtime/E2E.

**Trabajo en curso:** auditoría y limpieza de código/documentación, fixtures sintéticos, mocks offline de pagos y comunicaciones, pruebas automatizadas, CI, correcciones en ramas/PR y registro de evidencias. No esperar a resolver el conector para completar H1-H3. El adaptador de pago mock no debe realizar llamadas de red ni equivaler a una operación real.

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
- [Diccionario CMS](DICCIONARIO_DATOS_CMS.md)
- [Auditoría del esquema y contratos](docs/audits/2026-11-14-current-site-cms-normalization.md)


## Hito QA — 2026-11-14: fixtures alineadas y bloqueo de automatizaciones

- PR #379 integrada en main: 27348a20bfb913fde43761d4c92dd46526a5e470.
- Fixtures sintéticas alineadas con Site ID QA y cliente Nacho Pitt; correo de fixture reservado example.test.
- CI PR #379: Layer 1 24/307 PASS; Layer 2 19/252 PASS; regresión 70/644 PASS; SDK contracts, ESLint y Secret scanning PASS.
- Auditoría read-only Wix Automations V2: 150 automatizaciones; 10 activas, 140 inactivas, 0 archivadas. Las diez activas son PREINSTALLED y están bloqueadas por readonly y/o disableStatusChange.
- Varias automatizaciones activas contienen acciones de email/notificación. No se desactivaron ni modificaron; no se sortearon locks.
- **Estado Runtime/E2E: BLOCKED_EXTERNAL_SIDE_EFFECTS.** Se mantienen mocks/offline y lecturas read-only hasta neutralización soportada por Wix/proveedor y verificación posterior.
- Evidencia: docs/audits/2026-11-14-qa-automations-isolation.md.


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
