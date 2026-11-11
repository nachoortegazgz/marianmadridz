# Informe de ejecución y estado QA — 2026-11-11

**Repositorio:** `nachoortegazgz/marianmadridz`  
**Baseline revisado:** `main` · `e3499b1da1cc80a79ae94748dd214c9c1b0741af`  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · https://www.marianmadrid.es/  
**Alcance de esta revisión:** GitHub y Wix, inspección estática y consultas Wix REST de solo lectura. No se han creado reservas, pedidos, pagos, movimientos, fichajes, snapshots CMS ni comunicaciones.

> El sitio aparece como Published. La autorización para usarlo como QA no convierte su calendario, checkout, CMS o ledger en un entorno aislado. Este informe no declara E2E runtime ni publicación de código nuevo.

## 1. Resultado ejecutivo

- `main` está en el commit indicado y no tiene protección activa: el objeto de rama devuelve `protected=false`, `protection.enabled=false` y checks obligatorios vacíos.
- El último CI integral registrado para la serie de reservas (PR #273) fue verde: 53 suites, 523 tests, 0 fallos; contratos Wix SDK y ESLint correctos. Es validación offline, no runtime.
- Wix confirma sitio publicado, Editor, Velo habilitado, zona `Europe/Madrid`, moneda EUR, Wix Invoices V1 y Wix Stores Catalog V3.
- No se ha desplegado código a Wix en esta ejecución.
- No se han enviado emails ni WhatsApp, ni se han iniciado pagos o reembolsos.

## 2. Estado por incidencia priorizada

| Issue | Estado contrastado | Próximo gate |
|---|---|---|
| #209 Veri*Factu (P0) | Bloqueado. Existe helper AEAT puro con vectores oficiales, pero no está conectado a writers. No se acredita XML/XSD, transporte AEAT, certificado, presentador, respuesta ni declaración responsable. | Cerrar matriz fiscal, emisor/SIF, series, certificado/representación y aprobación de asesoría; después completar transporte y pruebas AEAT. No activar remisión ni anticipos. |
| #261 permisos CMS (P1) | Discrepancia live. Data Permissions v1 devuelve CMS_EDITOR para read/insert/update/remove; Data Collections v2 devuelve ADMIN en las mismas acciones. `allowedDataPermissions` está a true. | Resolver qué representación gobierna Content Manager y probar con identidad CMS_EDITOR aislada. No se han modificado permisos. |
| #210 protección `main` (P1) | No protegida. El GET de la rama lo confirma. La consulta directa de branch protection devuelve 403 por permisos de la integración conectada. | Aplicar ruleset/protección con credenciales de administración del repositorio y verificar checks requeridos. |
| #223 snapshots gestoría (P1) | Snapshot trimestral create-only con hash, límite 450 KiB y claim idempotente. El agregador mensual no existe. `ACCOUNTANT_SEND_ENABLED=false`; no se envían correos. | Implementar periodo mensual y registro durable/idempotente de despacho antes de habilitar Resend. |
| #224 ZONA STAFF (P1) | La issue declara consultas read-only integradas y writers laborales/caja bloqueados. | Idempotencia, serialización persistente por empleado/día, concurrencia real, ajustes rectificativos y QA runtime aislado. Mantener writers cerrados. |
| #237 inventario custom (P1) | Código retirado en PR #238 y corrección semántica/documental en PR #241. En `main` no existe `src/backend/inventario.web.js`; el webhook conserva marcador `WIX_CATALOG_OWNER` / `NO_CUSTOM_STOCK_WRITE`. | Validar venta, cancelación, refund/restock y pedidos mixtos en Wix QA sin stock ni pedidos reales. |
| #162 reprogramación dual (P1) | Journal y locks con fencing/CAS integrados; reconciliador específico `DUAL_RESCHEDULE` sigue pendiente. | Reconciliar solo cuando ambas fases estén exactamente en destino; estados mixtos permanecen `REPAIR_REQUIRED`. |
| #159 token display (P1) | Idempotencia de emisión integrada en PR #178; falta concurrencia runtime y auditoría de consumidores no versionados. | Prueba concurrente Wix aislada y auditoría de Editor/HTML. |
| #164 bridge calendario (P1) | `MessageEvent.source` y origen allowlist se validan en código. | Handshake en navegador real, incluido iframe hermano confiable; no usar wildcard. |
| #211 campaña E2E (P1) | No ejecutada. No está acreditado sandbox/test de Wix Payments ni buzón aislado. | Confirmar sandbox, aislamiento de notificaciones y limpieza de datos operativos antes de E2E. |
| #188 área cliente (P1) | Runbook preparado; Mis reservas/Mis pedidos y entrega de webhook en publicado pendientes de E2E autenticado. | Probar ownership de miembro, Cart/Order y reprogramación/cancelación dual sin operaciones reales. |
| #173 Capa 3 (P2) | No existe evidencia de `exportService.js`, jobs de export ni flujos PA-01…PA-07/SharePoint verificados. | Inventariar M365, aprobar transporte y probar con datos sintéticos; Wix CMS sigue siendo SSOT. |

## 3. Hallazgos adicionales

### 3.1 Permisos CMS

Consulta live de cinco colecciones:

- `MovimientosCaja`
- `LibroAsientosContablesDetalle`
- `HistoricoCierresZ`
- `RegistrosHorariosStaff`
- `PaquetesGestoria`

La API Data Permissions v1 devuelve `CMS_EDITOR` para las cuatro acciones en todas ellas. La API Data Collections v2 devuelve `ADMIN` para las cuatro acciones en esas mismas colecciones. La respuesta v2 indica que las cuatro acciones admiten configuración de permisos.

La capa `src/backend/dataAccess.js` centraliza operaciones `@wix/data` con `auth.elevate(items.*)`. La documentación oficial de Wix describe `PRIVILEGED` como restringido a administradores y sujetos con permisos especiales, y confirma que los data hooks también se ejecutan desde Content Manager.

No se ha aplicado un cambio de permisos debido a la discrepancia entre las dos lecturas y a que no se dispone de una identidad CMS_EDITOR aislada para verificar la denegación. Tampoco se ha insertado un registro de prueba en ledgers append-only.

### 3.2 Inventario nativo

PR #238 retiró módulo, WebMethods, UI y escrituras de stock personalizadas. PR #241 corrigió el marcador de autoridad para pedidos Bookings, Stores y mixtos. La implementación actual deja Wix Stores Catalog V3 como autoridad de stock. El runtime de venta/cancelación/reembolso sigue pendiente.

### 3.3 Paquetes de gestoría

El snapshot trimestral se crea mediante inserción create-only, hash canónico y claim idempotente. La descarga verifica el hash. La función de envío requiere un `documentId` persistido y está bloqueada por configuración (`ACCOUNTANT_SEND_ENABLED=false`). No se debe habilitar hasta que el despacho tenga trazabilidad durable e idempotencia de proveedor y se complete el agregador mensual.

### 3.4 Balanceo de profesionales

El código ordena por minutos reservados y usa el nombre como desempate estable. El dossier que describe rotación no coincide con el comportamiento implementado. No se ha añadido cursor de rotación porque no existe decisión documentada sobre su estado transaccional.

## 4. Acciones ejecutadas en esta revisión

1. Leído el contexto actual del sitio Wix.
2. Leída la rama `main` y confirmado el commit `e3499b1da1cc80a79ae94748dd214c9c1b0741af`.
3. Confirmado `protected=false` en la rama; la integración no tiene acceso administrativo al endpoint de branch protection.
4. Consultadas, solo lectura, las colecciones y permisos CMS de los cinco ledgers indicados.
5. Revisado el código de `dataAccess.js`, `fiscalDocuments.web.js`, `events.js` e `internalConfig.js`.
6. Añadidos comentarios de evidencia y bloqueo a los issues #209, #210, #211, #223 y #261.
7. No se han realizado escrituras en Wix, publicaciones, cambios de permisos, envíos ni transacciones.

## 5. Condiciones de no-go

- No activar Veri*Factu, facturas de anticipo ni depósitos Bookings hasta cerrar el P0 fiscal.
- No habilitar fichajes, caja o inventario custom desde UI.
- No enviar paquetes a gestoría ni activar Resend.
- No crear reservas, pedidos, pagos o reembolsos de prueba en el sitio publicado mientras no exista sandbox/aislamiento demostrado.
- No cambiar permisos de CMS mientras persista la contradicción de las APIs y no se pueda probar la identidad CMS_EDITOR.
- No declarar E2E runtime, conformidad fiscal o publicación del HEAD de `main` sin evidencia de ejecución.

## 6. Reversión

Este cambio es únicamente documental. No altera código de negocio, colecciones, permisos, reservas, pedidos, inventario, ledgers ni configuración Wix. La reversión consiste en revertir el commit documental de esta rama.

## 7. Fuentes de evidencia

- [main — commit revisado](https://github.com/nachoortegazgz/marianmadridz/commit/e3499b1da1cc80a79ae94748dd214c9c1b0741af)
- [PR #238 — retirada de inventario custom](https://github.com/nachoortegazgz/marianmadridz/pull/238)
- [PR #241 — corrección semántica de autoridad de inventario](https://github.com/nachoortegazgz/marianmadridz/pull/241)
- [PR #273 — reconciliación de carga de reservas](https://github.com/nachoortegazgz/marianmadridz/pull/273)
- [Wix Data Permissions — introducción](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-permissions/introduction)
- [Wix Data Collections — List Data Collections](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/list-data-collections)
- [Wix Data Hooks — introducción](https://dev.wix.com/docs/velo/events-service-plugins/data/hooks/wix-data-hooks/introduction)

**Estado final de esta revisión:** documentación de auditoría preparada; cambios funcionales y runtime siguen pendientes según los gates anteriores.
