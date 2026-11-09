# Estado actual del proyecto — Marian Madrid

**Revisión:** 2026-11-09  
**Repositorio:** [nachoortegazgz/marianmadridz](https://github.com/nachoortegazgz/marianmadridz)  
**Baseline de código:** `main` · `cad48c04bfe9206a23a2eb0a582e360e36a21864`  
**Sitio:** https://www.marianmadrid.es/  
**Alcance:** estado documental y técnico contrastado con el árbol de `main`, auditorías existentes, CI y consultas live de solo lectura.

> Este documento es el índice de estado. No sustituye las decisiones de arquitectura, los contratos de código ni los informes de auditoría. Una capacidad solo se considera operativa cuando existe evidencia del nivel de validación que se indica.

## 1. Resumen ejecutivo

El repositorio contiene una solución Wix Editor/Velo con reservas Bookings V2, saga dual, checkout eCommerce Cart V2, proyección de pedidos, ledger fiscal/laboral, inventario Stores Catalog V3 y controles de seguridad. CI offline está verde en la revisión Capa 1 consolidada. Las APIs REST nativas de Stores V3, Bookings y Gift Cards han respondido en consultas de solo lectura. La conciliación adicional confirmó el catálogo Bookings 94/94 y detectó que la proyección CMS de inventario no tiene maestros canónicos para las 30 variantes.

**No existe certificación E2E del runtime Velo ni evidencia de que el HEAD actual de `main` esté publicado.** No se deben equiparar el código fusionado, CI offline, las respuestas REST de Wix ni la publicación del sitio.

## 2. Estado por dominio

| Dominio | Estado actual | Evidencia / límite |
|---|---|---|
| Reservas simples y duales | Implementado en código; runtime pendiente | `reservas.web.js`, `citasManager.web.js`, `booking/bookingCore.js`, `booking/bookingSaga.js`; pruebas offline. Falta E2E real de creación, compensación, reprogramación y concurrencia. |
| Wix Bookings V2 | Catálogo conciliado en lectura | 94 servicios nativos ↔ 94 filas CMS; 70 visibles y 24 ocultos en ambos. IDs, títulos, precios y fases duales coinciden. Disponibilidad smoke anterior; runtime WebMethods pendiente. |
| Checkout eCommerce Cart V2 | Contratos de SDK en CI | La suite de contratos no sustituye checkout, pago y webhooks E2E en entorno de prueba. |
| Stores Catalog V3 | V3 activo y APIs REST responden | `V3_CATALOG`; 24 productos visibles; 30 inventory items en una ubicación. Adaptador V3 presente; import SDK/scopes Velo pendientes. |
| Proyección de inventario | **Bloqueada por falta de maestros CMS** | Stores V3: 30/30 inventory items con tracking en una ubicación. `InventarioStockVenta`: 1 fila sin `productId`/`variantId`/`stockKey`; 0/30 maestros canónicos. El backend devuelve `INVENTORY_MASTER_MAPPING_REQUIRED` si falta el maestro. No se han escrito datos. |
| Ledger fiscal / Veri*Factu | **NO APTO para activar remisión Veri*Factu** | Auditoría de código: no hay transporte SOAP AEAT, XML XSD ni flujo de respuesta/remisión. Las huellas internas no acreditan conformidad AEAT. |
| Registro horario | Implementación parcial | Writers/hooks existen; faltan pruebas runtime, auditoría de firma de históricos y aceptación legal/operativa. |
| Paquetes de gestoría | Snapshot y envío bloqueados | `PaquetesGestoria` tiene confirmación de creación de esquema en auditoría; creación de snapshot deshabilitada por contrato/hash/tamaño/concurrencia pendientes. Envío Resend deshabilitado por configuración. |
| Capa 3 M365 / SharePoint | Arquitectura objetivo; no implantación demostrada | No existe `exportService.js` ni jobs de exportación. PA-01…PA-07 y SharePoint no auditados en el tenant. Transporte requiere ADR. |
| Asistente IA | Deshabilitado de forma segura | `aiAgent.web.js` falla cerrado con `AI_PROVIDER_NOT_CONFIGURED`; ZONA MARIAN mantiene `enableAIAssistant=false`. Copy público actual requiere comprobación visual. |
| Gift Cards | App nativa instalada; personalización no implementada | Wix Gift Cards tiene 1 producto nativo configurado y 0 tarjetas emitidas. No existe `giftCards.web.js`, writer propio, QR scanner ni HMAC personalizado en `src/`. |
| Páginas personalizadas / widgets | Parcial; contratos HTML incompletos | Wix devuelve 9 páginas estáticas y 2 dinámicas. Se detectaron y corrigieron en rama dos rutas erróneas (`/administracion` y `/politica-de-privacidad`). Los HTML de `#htmlAdministracion`, `#htmlAdmin` y `#htmlOnlyStaffPanel` no están sincronizados en el repo; ZONA STAFF tiene todos los flags funcionales desactivados y no enruta acciones de caja. |
| Toolchain / lint | Bloqueo de mantenimiento | ESLint 8.25.0 está EOL; `@wix/eslint-plugin-cli@1.0.2` declara peer ESLint 8. La regla `no-invalid-backend-import` está desactivada y falta `src/velo.dependencies.json`. No forzar ESLint 10 ni editar artefactos Wix manualmente. |

## 3. Evidencia de validación

### CI

- Main incorpora PR #229 (correcciones Capa 1), PR #230 (checkpoint documental) y PR #231 (smoke live y reconciliación Catalog V3).
- Run #42656024671: 50 suites, 477 tests, 0 fallos; contratos SDK de Cart V2, Wix Data patch/bulkPatch y Bookings Reader V2.
- Run #42656358136: CI del checkpoint documental, SUCCESS.
- La CI es offline: mocks/fixtures no prueban hooks CMS, permisos efectivos, SDK importado en Velo, webhooks reales ni concurrencia en Wix.

### Smoke live read-only — 2026-11-09

- Catalog Versioning: `V3_CATALOG` (HTTP 200).
- Stores Products V3: 24 productos visibles (HTTP 200).
- Inventory Items V3: 30 artículos, seguimiento de cantidad en los 30, una ubicación (HTTP 200).
- Bookings: 70 servicios visibles (HTTP 200).
- Disponibilidad: consulta y revalidación de un slot de Balayage Signature para 2026-11-10; Wix devolvió `bookable=true`, capacidad restante 1.
- No se crearon reservas, pedidos, pagos ni productos. No se modificaron CMS, stock o ledgers.

Detalle: [Informe QA runtime/smoke](qa/2026-11-09-runtime-smoke-production.md).

### Publicación

El último intento de publish documentado (run #42545413297, commit `072910c6`) es anterior a los merges #229/#230 y fue detenido por una discrepancia de versión UI del Editor (`15941`). **No se ha vuelto a comprobar ese guard sobre el HEAD actual**. El estado de publicación del commit `cad48c04` queda sin verificar; no publicar ni desactivar el guard para resolverlo.

## 4. Prioridades de trabajo

### P0 — Fiscal / cumplimiento

1. Mantener desactivada cualquier declaración de conformidad Veri*Factu y la remisión hasta cerrar la auditoría técnica.
2. Definir el SIF emisor, series, responsabilidades y coexistencia con Wix Invoices.
3. Corregir mediante diseño y pruebas el builder de huella para nuevos registros; no recalcular ni modificar históricos.
4. Implementar, si se aprueba, XML/ SOAP AEAT, certificado, respuesta síncrona, cola/reintentos y trazabilidad conforme a especificación oficial.
5. Validar legalmente el sistema con asesoría y entorno de pruebas AEAT antes de activar.

Referencia: [Auditoría de preparación Veri*Factu](qa/2026-11-09-verifactu-readiness-audit.md).

### P1 — Runtime Wix y datos

1. Abrir Wix Local Editor conectado al sitio y reconciliar versión UI/código.
2. Verificar import real de `@wix/stores`, manifiesto generado por Wix CLI y scopes V3.
3. Ejecutar E2E con miembros/servicios/slots QA y pagos no cobrables: reserva simple/dual, compensación, checkout Cart V2, webhooks, cancelación y reprogramación.
4. Registrar y validar los maestros de inventario mediante `registerInventoryMaster` en QA; no crear mappings por REST ni en producción sin autorización.
5. Probar hooks CMS, permisos, DISPLAY_TOKEN, locks, fencing, concurrencia e idempotencia.
6. Sincronizar los HTML Components de administración y staff desde Wix Local Editor y conciliar IDs, mensajes, acciones y rutas antes de habilitar flags.
7. Reconciliar Wix Bookings/Orders con proyecciones CMS mediante lecturas; no crear movimientos ni reparar históricos hasta disponer de procedimiento backend controlado y autorización.

### P1 — Capa 3

1. Resolver ADR de transporte (Resend frente a Microsoft Graph/mecanismo Microsoft).
2. Auditar tenant, SharePoint, Power Automate, licencias, DLP, conexiones y permisos.
3. Aprobar contrato de exportación, minimización de PII, checksum, versión e idempotencia.
4. Implementar exportadores/jobs solo después de aprobar arquitectura y acceso.
5. Mantener bloqueados creación de snapshots y despacho a gestoría hasta cerrar los controles pendientes.

### P2 — Toolchain

1. Generar `src/velo.dependencies.json` mediante Wix CLI for Sites, nunca a mano.
2. Reconciliar el manifiesto/lockfile Wix con el paquete `@wix/stores`.
3. Migrar el lint a una cadena mantenida sin perder reglas Wix; no forzar peer dependencies.
4. Reactivar `@wix/cli/no-invalid-backend-import` solo cuando el manifiesto generado permita validarla.

## 5. Invariantes para toda intervención

- Wix CMS/Wix Apps son SSOT transaccional según dominio; SharePoint solo custodia evidencia.
- Capa 3 no escribe en Capa 1.
- Ledgers fiscales, contables y laborales son append-only; rectificaciones mediante nuevos registros trazables.
- No pruebas con escrituras reales ni cambios de stock/reservas/pagos en producción.
- No modificar históricos por REST ni borrar datos para hacer pasar pruebas.
- No desplegar sin CI verde, revisión del diff, QA runtime, autorización y estrategia de recuperación.
- Separar siempre: verificado en código, CI offline, APIs nativas live, runtime Wix, E2E y publicado.

## 6. Documentos canónicos

- [README e índice del repositorio](../README.md)
- [Directrices de arquitectura, desarrollo y QA](../DIRECTRICES_DESARROLLO_CODIGO.txt)
- [Dossier técnico consolidado](../DOSSIER%20TÉCNICO%20CONSOLIDADO.md)
- [Necesidades y criterios de aceptación](../NECESIDADES%20WEB%20MARIAN.txt)
- [Flujos Capa 1 → Capa 3](../DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md)
- [Auditoría Catalog V3 e inventario](audits/2026-11-09-catalog-inventory-state.md)
- [Auditoría de conciliación frontend/backend/Wix Apps](audits/2026-11-09-frontend-native-reconciliation.md)
- [Auditoría implantación Capa 3](audits/2026-11-09-capa3-implementation-state.md)
- [Auditoría Veri*Factu](qa/2026-11-09-verifactu-readiness-audit.md)

---
*Este estado corresponde a la revisión del repositorio y las evidencias disponibles el 9 de noviembre de 2026. Debe actualizarse cuando cambien main, la configuración Wix o el resultado de las pruebas.*
