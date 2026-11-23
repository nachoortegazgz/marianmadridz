# Relevo técnico — 2026-11-23

**Repositorio:** `nachoortegazgz/marianmadridz`  
**main:** `995c085aa2ef45fea6d57f95f86d4c75c7cf7f7d` (PR #536)  
**PR de trabajo:** [#541](https://github.com/nachoortegazgz/marianmadridz/pull/541) — abierta, no integrada  
**Rama:** `feat/tpv-payment-exports-after-p0-20261123`  
**HEAD validado:** `651faa2775d8733d465cea5f33ab9d4a41f80f69`

## Objetivo
Continuar la auditoría de TPV sobre el estado real de GitHub, corregir incompatibilidades entre widget, WebMethods, validadores y contratos de persistencia, y mantener el release bloqueado hasta obtener evidencia Wix Runtime.

## Cambios implementados

1. **Selección de cliente en #htmlTPV:** el botón Cliente abre búsqueda de identidades sintéticas con `CUSTOMERS_SEARCH`; los resultados se renderizan escapados, se conserva `customerIdentityId` y se envía en `SALE_REGISTER`. El backend vuelve a validar la identidad.
2. **Identidades canónicas:** `assertTpvIdentity` exige `sourceType=SYNTHETIC`, `siteId` y `schemaVersion=2`, además de tipo/ID, email de prueba, estado activo y `syntheticOnly=true`. La política de inserción ya exigía esos campos; el validador está alineado.
3. **Compatibilidad histórica:** la validación legacy solo se activa con `allowLegacyRead: true`, admite los IDs históricos `SANDBOX-*` y el formato transicional `TPV-*` con `environment/testRunId`, y no autoriza nuevas escrituras. El fixture histórico se valida exclusivamente por esa ruta.
4. **Idempotencia:** la búsqueda de eventos contempla ID canónico, ID legacy por colección y el formato legacy compartido.
5. **WebMethods/exportaciones:** la clasificación de seguridad contempla exportaciones que escriben una entrada de auditoría; mantienen autorización backend antes de la persistencia.
6. **Widget/contratos:** selección de variantes, DTO de venta, búsqueda de cliente, Control X read-only, cierre Z idempotente y operaciones de caja comparten las aserciones contractuales correspondientes.
7. **Concurrencia CajaActual:** el test FLOW-CAJA-05C ahora verifica que el lock CAS queda en estado RELEASED y expirado. El registro no se elimina: la implementación lo conserva para compare-and-swap; la expectativa antigua de borrar la fila no correspondía al contrato actual.
8. **Fixtures y validación:** el ledger de test incorpora schemaVersion/reconciliationStatus; el simulador diario inicializa todos los métodos canónicos (incluidos BONO y TARJETA_REGALO); las pruebas de identidad distinguen escritura neutral y lectura legacy.
9. **Documentación:** backlog, README TPV y este relevo reflejan el baseline real de main, PR, Wix y CI.

## Evidencia CI — HEAD validado

<badge color="success">SUCCESS</badge> **Backend offline quality gates — run 45100503963**  
- Layer 1: 30 suites, 364/364 pruebas, 0 fallos.
- Layer 2: 17 suites, 255/255 pruebas, 0 fallos.
- Suite offline completa: 77 suites, 732/732 pruebas, 0 fallos.
- npm audit: 0 vulnerabilidades reportadas.
- Contratos Wix SDK, Wix eCommerce Order Transactions y Wix TPV Catalog: SUCCESS.
- ESLint: SUCCESS.

<badge color="success">SUCCESS</badge> **Secret scanning — run 45100503949**.

## Estado Wix verificado

Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`; Marian Madrid Peluquería y Estética. Estado **Draft**, editor clásico, Velo Enabled, EUR, Europe/Madrid. Apps: Bookings, Forms & Payments, Gift Cards, Payments, Stores Catalog V3, Invoices V1, Members Area, Blog y Promote SEO. Esta lectura no prueba que el HEAD de Git esté sincronizado con Wix Editor ni acredita Preview/Runtime.

## Pendiente / release gate

- Confirmar read-back del SHA `651faa2775d8733d465cea5f33ab9d4a41f80f69` en Wix Git Integration/Editor; no se ha demostrado sincronización.
- Ejecutar aceptación en Wix Preview con CMS Sandbox: abrir sesión, catálogo, seleccionar cliente/profesional, venta sintética, pago mixto, entrada/salida, devolución sintética, X, Z, exportaciones e idempotencia/replay.
- Ejecutar pruebas negativas en Published sin escrituras: llamadas no autorizadas, datos legacy en ruta de escritura, siteId ajeno, hash/version inválidos y capacidades externas deshabilitadas.
- Aclarar semántica de `AUDIT_LIST`: el controlador lo conecta al lector de movimientos de `tpvMovimientos.web.js`, mientras `tpvAuditoria.web.js` conserva un método homónimo no referenciado por consumidores del repositorio. No renombrar ni eliminar sin resolver compatibilidad externa.
- Reconciliar #416 (compensaciones fiscales), #520 (automatizaciones), #526 (reservas online), #525 (lock CajaActual) y demás gates del backlog antes del release.

**Estado:** PR #541 abierta; CI offline completo aprobado en su HEAD actual; Wix Runtime pendiente; **NO-GO para producción**. No se han ejecutado escrituras CMS, pagos, reembolsos, cambios de configuración Wix ni despliegues durante esta revisión.
