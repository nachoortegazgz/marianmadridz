# TPV QA fail-closed remediation — 2026-11-20

**Base:** `a801405f77dddfe8fcfe76a825be47e656aa542c`  
**Scope:** runtime safety gate only; no CMS writes, no deployment.

## Objective

Prevent TPV synthetic persistence from being invoked against the site's Live CMS dataset until a backend-verifiable Sandbox boundary exists.

## Verified findings

1. `TPV_QA_RUNTIME_POLICY.ENABLED` was `true` in canonical `src/backend/internalConfig.js`.
2. `assertTpvQaEnabled()` checked the static `ENVIRONMENT: "SANDBOX"` flag, but did not verify the runtime data plane or request environment.
3. `src/public/tpvPageController.js` checked `wixWindowFrontend.viewMode` before dispatching QA requests. That is a frontend gate, not a backend authorization boundary; the exported WebMethods independently enforce role permissions and call `assertTpvQaEnabled()`.
4. Wix Site Context reports the target site as an Editor site with Velo enabled and Draft status. The previous Management API CMS read observed one `CajaActual` record and no synthetic identities in the dataset accessible through that API. It did not establish Preview data-plane behavior.
5. The installed Wix documentation describes `wix preview` as creating a preview of build output and explicitly says it does not publish the project. That does not, by itself, prove that a WebMethod invocation has a backend-enforced Sandbox data-plane guarantee. See [Wix CLI preview](https://dev.wix.com/docs/wix-cli/cli-for-headless/command-reference/project-commands/preview).

## Implemented

- `TPV_QA_RUNTIME_POLICY.ENABLED=false` in canonical runtime configuration.
- `assertTpvQaEnabled()` now rejects before any QA repository operation with `TPV_QA_DISABLED_UNTIL_SANDBOX_ISOLATION`.
- The HTML bridge no longer advertises `environment=SANDBOX`; it reports `DISABLED` and rejects `CASHIER_STATE` and all `QA_*` messages.
- Offline test loader explicitly overrides the canonical disabled flag only in its in-memory test module source. This is test-only and does not modify production configuration.
- Contract tests assert the canonical production setting remains disabled and the widget controller remains fail-closed.
- Updated `docs/qa/QA-ENVIRONMENT-SSOT.md` to supersede the prior frontend-only assumption.

## Impact

All TPV QA WebMethods that call `assertTpvQaEnabled()` fail closed, including session open/read, synthetic sales, cash movements, payment simulation, refunds, X/Z close and audit/config/permissions. The catalog UI is not allowed to bootstrap because the widget receives a disabled environment context.

No changes to:
- `CajaActual`, `MovimientosCaja`, `ControlOperativo`, `HistoricoCierresZ`, identities or any other CMS collection.
- Wix roles or collection permissions.
- Real payments, Orders, Bookings, Gift Cards, fiscal/accounting/labor ledgers, email, hardware or external providers.
- Site publication or deployment state.

## Validation status

The source-level and offline tests are included in the PR and must pass CI. They do not prove Wix Runtime isolation. A successful CI run validates only the code and offline harness.

## Release decision

**NO-GO for TPV persistent QA and NO-GO for production release.**

Reactivation requires:
1. A Wix-supported, backend-verifiable environment/data-plane signal or a physically separate Sandbox site/tenant whose credentials and CMS collections cannot target Live.
2. Positive Preview test and negative Published/direct-WebMethod test.
3. Before/after LIVE collection snapshots proving no mutation.
4. Idempotent seed/bootstrap for synthetic identities and QA cash register in the proven isolated environment.
5. Complete TPV E2E and regression, plus rollback evidence.

No synthetic seed or cash bootstrap should be attempted against the current site until the first condition is satisfied.
## Addendum — contrato oficial de Sandbox en Preview (2026-11-20)

### Documentación oficial contrastada

La documentación vigente de Wix aclara el comportamiento de los datos en Preview:

- El Sandbox CMS es **opcional y está deshabilitado por defecto**. Debe habilitarse desde CMS > Manage > More Actions > Advanced Settings > Sandbox.
- Con Sandbox habilitado, las interacciones de Preview con colecciones CMS propias usan la versión Sandbox; sus cambios persisten en Sandbox y no pasan a Live salvo sincronización explícita.
- Las colecciones de Wix Apps no tienen versión Sandbox: en Preview siguen usando Live y los cambios realizados sobre ellas se reflejan en el sitio publicado.
- La Site Data Usage API informa uso LIVE/SANDBOX por colección, pero sus contadores no certifican por sí solos que el toggle Sandbox esté actualmente habilitado ni demuestran qué almacén utilizó una invocación concreta.

Fuentes oficiales:
- Velo — About Testing Your Code in Preview Mode: https://dev.wix.com/docs/develop-websites/articles/workspace-tools/testing-monitoring/testing-troubleshooting/about-testing-your-code-in-preview-mode
- Wix Help Center — CMS: Accessing and Syncing Your Sandbox and Live Collections: https://support.wix.com/en/article/cms-accessing-and-syncing-your-sandbox-and-live-collections
- Wix Site Data Usage API: https://dev.wix.com/docs/api-reference/business-solutions/cms/operations/site-data-usage/introduction

### Consecuencia para Marian Madrid

1. Las colecciones propias CajaActual, MovimientosCaja, ControlOperativo, HistoricoCierresZ y TpvSandboxIdentities solo constituyen un banco de pruebas separado si Sandbox está habilitado para el sitio y las operaciones se ejecutan realmente en Preview.
2. Los lectores de catálogo de Bookings y Stores (obtenerServicios, obtenerProductos, obtenerVariantesProducto) consultan aplicaciones Wix; no deben considerarse aislados por el Sandbox CMS. Se mantienen estrictamente read-only.
3. Los 107 elementos/204.766 bytes de uso SANDBOX observados en la consulta previa son evidencia de uso registrado, pero no sustituyen la comprobación actual del toggle ni una prueba funcional de lectura desde Preview.
4. No se habilita TPV_QA_RUNTIME_POLICY.ENABLED, no se crean identidades ni se inicializa CajaActual hasta verificar en el Editor que Sandbox está habilitado, comprobar permisos/esquemas de las colecciones propias y realizar una prueba de lectura de entorno desde una invocación real de Preview.
5. La sincronización Sandbox → Live es una operación separada, potencialmente irreversible en sus efectos sobre los elementos coincidentes. No se utilizará como mecanismo de despliegue de datos de QA.

### Estado de esta aclaración

- **Verificado documentalmente:** Preview utiliza Sandbox para colecciones CMS propias cuando Sandbox está habilitado; Wix App Collections continúan en Live.
- **Verificado por API anteriormente:** hay uso de datos en ambos entornos.
- **Pendiente de comprobar en el sitio:** estado actual del toggle Sandbox y permisos por colección.
- **Pendiente de ejecutar:** lectura backend desde Editor Preview y prueba negativa equivalente en contexto publicado/direct-WebMethod.
- **Decisión:** se mantiene el gate fail-closed. Esta aclaración reduce la incertidumbre del diseño, pero no autoriza escrituras ni cambia la decisión NO-GO.
