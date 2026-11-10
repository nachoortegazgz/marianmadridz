# Estado actual del proyecto — Marian Madrid

**Revisión:** 2026-11-10  
**Repositorio:** [nachoortegazgz/marianmadridz](https://github.com/nachoortegazgz/marianmadridz)  
**Baseline de código:** `main` · `a193b9c9ce7657b100a7d2b279a001d0879a7cab`  
**Sitio:** https://www.marianmadrid.es/  
**Alcance:** estado documental y técnico contrastado con el árbol de `main`, auditorías existentes, CI y consultas live de solo lectura.

> Este documento es el índice de estado. No sustituye las decisiones de arquitectura, los contratos de código ni los informes de auditoría. Una capacidad solo se considera operativa cuando existe evidencia del nivel de validación que se indica.

## 1. Resumen ejecutivo

El repositorio contiene una solución Wix Editor/Velo con reservas Bookings V2, saga dual, checkout eCommerce Cart V2, proyección de pedidos, ledgers fiscal/laboral, Wix Stores Catalog V3 y controles de seguridad. PR #235 mantiene la recuperación fiscal idempotente de pedidos pagados dentro del alcance Bookings-only. La retirada del inventario personalizado está integrada; Wix Stores Catalog V3 queda como autoridad única del stock. ZONA STAFF incorpora consultas read-only de identidad, estado, historial y horas, sin habilitar fichajes ni caja. PR #250 añade un builder AEAT v0.1.2 aislado con vectores oficiales para alta y anulación; no está conectado a writers ni certifica Veri*Factu. PR #252 elimina de ZONA MARIAN los paneles sin backend operativo (gestión de personal, IA y envío a gestoría) y sus handlers huérfanos; se conservan solo acciones conectadas y permitidas. Las consultas REST nativas de Stores V3, Bookings y Gift Cards son de solo lectura. Wix Orders Settings confirma `inventoryUpdateTrigger=ON_ORDER_PAID` y `createInvoice=false`. Bookings V2 contiene 94 servicios: 70 tarifas fijas, 24 auxiliares sin precio, siete servicios visibles >100 EUR y ningún depósito configurado.

**No existe certificación E2E del runtime Velo ni evidencia de que el HEAD actual de `main` esté publicado.** No se deben equiparar el código fusionado, CI offline, las respuestas REST de Wix ni la publicación del sitio.

## 2. Estado por dominio

| Dominio | Estado actual | Evidencia / límite |
|---|---|---|
| Reservas simples y duales | Implementado en código; runtime pendiente | `reservas.web.js`, `citasManager.web.js`, `booking/bookingCore.js`, `booking/bookingSaga.js`; pruebas offline. Falta E2E real de creación, compensación, reprogramación y concurrencia. |
| Wix Bookings V2 | Catálogo conciliado en lectura | 94 servicios nativos ↔ 94 filas CMS; 70 visibles y 24 ocultos en ambos. IDs, títulos, precios y fases duales coinciden. Disponibilidad smoke anterior; runtime WebMethods pendiente. |
| Depósitos Bookings nativos | **BLOQUEO P0 fiscal; no activar** | 94 servicios leídos; 7 servicios visibles >100 EUR; 0 depósitos activos. Wix Help define depósito online + saldo presencial; API requiere `online=true` y `inPerson=false`. Confirmar el flujo en QA y disponibilidad de la función; verificar que ningún plan/paquete permite eludir el anticipo. La activación depende de factura/IVA/ledger de anticipo y rectificación (issue #209). |
| Checkout eCommerce Cart V2 | Contratos de SDK en CI | La suite de contratos no sustituye checkout, pago y webhooks E2E en entorno de prueba. |
| Stores Catalog V3 | V3 activo y APIs REST responden | `V3_CATALOG`; 24 productos visibles; 30 inventory items en una ubicación. Orders Settings: `inventoryUpdateTrigger=ON_ORDER_PAID`, `createInvoice=false`. La capa custom se ha retirado en la rama de refactorización; pendiente CI/QA. |
| Inventario personalizado | **Retirado en PR #239; QA runtime pendiente** | Wix Stores Catalog V3: 30/30 inventory items con tracking en una ubicación. Orders Settings: `ON_ORDER_PAID`. Módulo, WebMethods y panel custom eliminados en la rama. CI offline run 42721080098: 50 suites/488 tests OK en commit previo; reejecución del HEAD actual y QA Wix E2E pendientes. No se han escrito datos ni modificado históricos. |
| Ledger fiscal / Veri*Factu | **NO APTO para activar remisión Veri*Factu** | PR #250 incorpora `aeatHash.js` puro con vectores oficiales v0.1.2 para alta/anulación, sin consumers runtime. Siguen pendientes reconciliación de campos en writers, XML/XSD, transporte SOAP, respuesta/remisión, pruebas AEAT y aprobación legal. |
| Registro horario | Consultas read-only implementadas; escrituras deshabilitadas | ZONA STAFF consulta contexto, estado, historial y horas. Los lectores verifican firma HMAC y secuencia; faltan runtime Wix, idempotencia/concurrencia de writers y aceptación legal/operativa. No habilitar fichajes ni ajustes. |
| Paquetes de gestoría | Snapshot y envío bloqueados | `PaquetesGestoria` tiene confirmación de creación de esquema en auditoría; creación de snapshot deshabilitada por contrato/hash/tamaño/concurrencia pendientes. Envío Resend deshabilitado por configuración. |
| Capa 3 M365 / SharePoint | Arquitectura objetivo; no implantación demostrada | No existe `exportService.js` ni jobs de exportación. PA-01…PA-07 y SharePoint no auditados en el tenant. Transporte requiere ADR. |
| Asistente IA | No disponible; UI retirada | `aiAgent.web.js` falla cerrado con `AI_PROVIDER_NOT_CONFIGURED`. PR #252 elimina el panel IA inactivo de ZONA MARIAN; no se expone una capacidad sin proveedor configurado. |
| Gift Cards | App nativa instalada; personalización no implementada | Wix Gift Cards tiene 1 producto nativo configurado y 0 tarjetas emitidas. No existe `giftCards.web.js`, writer propio, QR scanner ni HMAC personalizado en `src/`. |
| Wix Invoices | **V1 activa; adopción de Invoices V2 recomendada cuando Wix la habilite** | GetSiteContext confirma app V1; `POST /invoices/v4/invoices/query` devuelve 428 `INVOICES_API_UNAVAILABLE`; `GET /invoices/v4/invoices-settings` devuelve 200. Wix gestiona el rollout automáticamente. No añadir un paquete Invoices V2 independiente no confirmado ni crear adapter hasta que el CRUD esté habilitado; seguir SDK universal/REST oficial. No sustituye SIF/Veri*Factu. QA: [compatibilidad Invoices V2](qa/2026-11-09-catalog-v3-invoices-compatibility.md). |
| Wix Forms & Payments | 4 esquemas nativos activos | Contacto mapea nombre/email/teléfono a CRM. Caja manual, control X y fichaje no tienen trigger backend; Wix Automations v2 devuelve 0 workflows activos y 0 borradores para `wix_form_app-form_submitted`. |
| Páginas personalizadas / widgets | Staff read-only conectado; Marian parcial; runtime pendiente | `#htmlAdmin.txt` y `#htmlOnlyStaff.txt` están versionados. ZONA STAFF consulta contexto, estado, historial y horas; fichajes, ajustes, caja e inventario permanecen deshabilitados. ZONA MARIAN conecta lectura caja/fiscal y acciones documentales; TPV solo aparece con caja `ABIERTA`, y el estado live `SIMULACION` lo bloquea. Falta comparar HTML real de Editor/publicado con Git y ejecutar runtime Wix. |
| Toolchain / lint | Bloqueo de mantenimiento | ESLint 8.25.0 está EOL; `@wix/eslint-plugin-cli@1.0.2` declara peer ESLint 8. La regla `no-invalid-backend-import` está desactivada y falta `src/velo.dependencies.json`. No forzar ESLint 10 ni editar artefactos Wix manualmente. |

## 3. Evidencia de validación

### CI

- Main incorpora PR #229–#233 y las correcciones posteriores de caja/ledger, fichajes read-only y el contrato hash AEAT aislado. PR #250 está integrado.
- Run #42656024671: 50 suites, 477 tests, 0 fallos; contratos SDK de Cart V2, Wix Data patch/bulkPatch y Bookings Reader V2.
- Run #42656358136: CI del checkpoint documental, SUCCESS.
- PR #232, run #42671109488 sobre el commit de código `3fc7482`: 50 suites, 479 tests, 0 fallos; SDK contracts y ESLint SUCCESS.
- PR #233, run #42711143272 sobre el commit de código `8d91c4c`: 51 suites, 488 tests, 0 fallos; SDK contracts, Bookings Reader V2 y ESLint SUCCESS.
- PR #250, run #42801308683 sobre el commit `0106ce1206bcaa6a17ac7b7f56c6c9b2d4869c8e`: 51 suites, 503 tests, 0 fallos; SDK contracts Cart V2 y Bookings Reader V2, ESLint SUCCESS. Incluye la corrección de regex detectada en la primera ejecución.
- La CI es offline: mocks/fixtures no prueban hooks CMS, permisos efectivos, SDK importado en Velo, webhooks reales ni concurrencia en Wix.

### Smoke live read-only — 2026-11-09

- Catalog Versioning: `V3_CATALOG` (HTTP 200).
- Stores Products V3: 24 productos visibles (HTTP 200).
- Inventory Items V3: 30 artículos, seguimiento de cantidad en los 30, una ubicación (HTTP 200).
- Bookings: 70 servicios visibles (HTTP 200).
- Disponibilidad: consulta y revalidación de un slot de Balayage Signature para 2026-11-10; Wix devolvió `bookable=true`, capacidad restante 1.
- No se crearon reservas, pedidos, pagos ni productos. No se modificaron CMS, stock o ledgers.

Detalle: [Informe QA runtime/smoke](qa/2026-11-09-runtime-smoke-production.md).

Auditoría de correcciones del informe consolidado: [Revisión de errores y estado de fixes](audits/2026-11-09-consolidated-error-report-review.md).
### Publicación

El último intento de publish documentado (run #42545413297, commit `072910c6`) es anterior a los merges #229/#230/#231 y fue detenido por una discrepancia de versión UI del Editor (`15941`). **No se ha vuelto a comprobar ese guard sobre el HEAD actual**. El estado de publicación del commit `cad48c04` queda sin verificar; no publicar ni desactivar el guard para resolverlo.

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
4. Inventario personalizado ya retirado: mantener Wix Stores como autoridad; ejecutar pruebas QA de pedidos, cancelaciones y reembolsos sin reconstruir proyecciones custom ni modificar históricos.
5. Clasificar los 94 servicios Bookings y validar en QA la función nativa de anticipo de 15 EUR solo para servicios >100 EUR; mantener bloqueado hasta cerrar factura, IVA, ledger y rectificación (issue #209).
6. Completar E2E de reservas simples/duales, compensación, cancelación, reprogramación y concurrencia con identidades QA y sin cobros reales.
7. Completar fichajes con idempotencia, serialización persistente y pruebas de carrera; habilitar ajustes solo como nuevos registros rectificativos y con RBAC manager.
8. Comparar HTML Components reales de Wix Editor/publicados con `#htmlAdmin.txt` y `#htmlOnlyStaff.txt`; validar IDs, mensajes, acciones y rutas en runtime antes de activar flags.
9. Reconciliar Wix Bookings/Orders con proyecciones CMS mediante lecturas; no crear movimientos ni reparar históricos hasta disponer de procedimiento backend controlado y autorización.
10. Probar hooks CMS, permisos, DISPLAY_TOKEN, locks, fencing, concurrencia e idempotencia en Wix runtime.
11. No crear automatizaciones Wix Forms ni flujos externos que contacten clientes; si se decide procesar formularios, hacerlo mediante backend idempotente y autorización explícita.

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

- Wix Bookings es autoridad de servicios, disponibilidad y reservas; Wix Stores Catalog V3 es autoridad única de stock comercial; Wix CMS propio solo conserva datos de dominio que no estén cubiertos nativamente. SharePoint solo custodia evidencia.
- Capa 3 no escribe en Capa 1.
- Ledgers fiscales, contables y laborales son append-only; rectificaciones mediante nuevos registros trazables.
- No pruebas con escrituras reales ni cambios de stock/reservas/pagos en producción. No activar automatizaciones que contacten clientes.
- No modificar históricos por REST ni borrar datos para hacer pasar pruebas.
- No desplegar sin CI verde, revisión del diff, QA runtime, autorización y estrategia de recuperación.
- Separar siempre: verificado en código, CI offline, APIs nativas live, runtime Wix, E2E y publicado.

## 6. Documentos canónicos

- [README e índice del repositorio](../README.md)
- [Registro de decisiones de negocio y arquitectura](DECISION-LOG.md)
- [QA de retirada de inventario personalizado](qa/2026-11-10-native-inventory-retirement.md)
- [ADR de depósitos e inventario nativo](adr/2026-11-10-deposit-and-native-inventory.md)
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


## 8. Auditoría de catálogo y retirada de stubs — 2026-11-10

Consulta live de Wix CMS (solo lectura): `ServiciosCatalogo` 95/95, `ComplementosCatalogo` 36/36 y `MapaStaff` 3/3 no tienen campo `status` en el esquema ni en los registros consultados. `MapaStaff.active` sí existe y se conserva como parte del contrato de correlación de identidad; `associatedWixIdentity.connection.status` es un estado nativo de conexión de Wix Members/Bookings y también se conserva. No se ha realizado ninguna migración ni escritura CMS.

Se retiró `src/backend/staffManager.web.js`, módulo sin consumidores que solo exponía stubs fail-closed. No existe campo ni flujo CMS `status` para servicios, complementos o personal y no se requiere migración ni borrado. ZONA STAFF ya conecta consultas read-only a los WebMethods canónicos de `horario.web.js`; la escritura de fichajes/ajustes y la caja siguen deshabilitadas. `MapaStaff.active` se conserva como selector de correlación de identidad y `associatedWixIdentity.connection.status` como estado nativo de conexión Wix. Evidencia: [auditoría de status de catálogos y personal](qa/2026-11-10-phase2-catalog-status-audit.md) y [issue #224](https://github.com/nachoortegazgz/marianmadridz/issues/224).


## 9. Integridad de caja y ledgers — auditoría live 2026-11-10

Wix CMS live (solo lectura) confirma cuatro filas `SMOKE_TEST` con `sequenceNumber=0` en `MovimientosCaja`, un registro `SMOKE_TEST` no balanceado en `LibroAsientosContablesDetalle`, y `CajaActual.cashRegisterStatus=SIMULACION` con 300 € y contadores de secuencia a cero. El agregador fiscal y varios lectores/heads no excluían estas filas; el código de esta rama añade exclusión por marcadores explícitos y secuencia positiva. La caja en estado SIMULACION queda fail-closed para estado operativo, movimientos manuales, proyección y cierre Z. No se modifican ni borran ledgers.

Otros hallazgos sin intervención en esta rama: dos fichajes QA en `RegistrosHorariosStaff` carecen de firma HMAC; 54/55 proyecciones `CitasF2` no tienen `sourceEventId`; `HistoricoCierresZ` y `PaquetesGestoria` están vacíos. Evidencia y límites: [auditoría live de contaminación de ledgers](qa/2026-11-10-smoke-ledger-contamination-audit.md). No declarar caja/contabilidad/fiscalidad funcionales ni publicar hasta completar runtime QA y resolver las anomalías históricas mediante procedimientos trazables.


## 10. ZONA MARIAN — disponibilidad del TPV

El panel de caja ya no se presenta como operativo por un flag estático: solo se muestra cuando `getCashierState` responde SUCCESS y `cashRegisterStatus=ABIERTA`. Con el estado live actual `SIMULACION`, la interfaz oculta el TPV. La protección backend del PR #246 permanece como segunda barrera. No se ha modificado Wix CMS ni se ha publicado el sitio.


## 11. Integridad de lectura de fichajes

Los lectores de jornada y horas verifican ahora la firma HMAC antes de calcular o devolver estados operativos. Historial muestra `integrityStatus` por fila sin exponer el HMAC; cálculos/estado fallan cerrados ante registros sin firma o firma inválida. El resumen mensual también rechaza datasets truncados. Los dos registros QA históricos sin firma permanecen intactos y requieren revisión; no se han generado fichajes ni correcciones.


## 12. ZONA STAFF — consultas read-only conectadas

ZONA STAFF ya conecta contexto de colaborador, estado de jornada, historial y cálculo de horas mediante WebMethods backend. El historial expone VERIFIED/UNVERIFIED sin filtrar HMAC; los cálculos solo se entregan si todas las firmas son válidas. Los rangos están limitados (historial 92 días; cálculo 31 días) y el cálculo agregado se resuelve en una única llamada backend. El widget muestra `NO VERIFICADO` en registros históricos sin firma.

Siguen deshabilitados los fichajes y ajustes de escritura, caja e inventario. No activar `enableClocking` hasta implementar y probar transiciones, idempotencia y concurrencia en un entorno QA aislado. La página aún no tiene validación Wix runtime/Preview.


El cálculo de horas valida secuencias de eventos por día, admite múltiples sesiones completas, suma pausas correctamente y expone jornadas abiertas sin incluir tiempo en curso. El historial distingue firma no verificada de secuencia semánticamente inválida.

## 13. Contrato puro de huella AEAT integrado — 2026-11-10

PR #250 se ha fusionado en `main` mediante squash (merge commit `3b26df214530a740e23dca8a501b99cce844e310`). Añade `src/backend/aeatHash.js` con builders separados para `RegistroAlta` y `RegistroAnulacion`, SHA-256 en mayúsculas y vectores oficiales AEAT v0.1.2. La primera ejecución CI detectó regex de importes con escape doble; se corrigió antes de fusionar. Run #42801308683: 51 suites / 503 tests / 0 fallos, contratos SDK Cart V2 y Bookings Reader V2 correctos y ESLint correcto.

El helper permanece aislado y no está conectado a `cajas.web.js` ni `eventLog.js`. No se ha cambiado `hashChain` compartido con contabilidad, no se han recalculado hashes históricos y no se han modificado ledgers. Antes de integrar writers se deben mapear sus snapshots inmutables, diferenciar los contratos de alta/anulación y probar secuencia, concurrencia y persistencia. Esto no certifica el SIF ni habilita remisiones AEAT.


## 14. Limpieza de ZONA MARIAN y contratos de estado — 2026-11-10

PR #252 se ha fusionado en `main` (commit `a193b9c9ce7657b100a7d2b279a001d0879a7cab`). El widget ya no contiene los paneles de gestión de personal, IA ni envío a gestoría que estaban inactivos o carecían de backend/contrato habilitado. Se retiraron sus mensajes, listeners, variables, handlers y referencias. El controlador ZONA MARIAN conserva solo acciones de la allowlist activa: estado de caja, cierre Z, resumen fiscal, libro de facturas, paquetes preparados y descarga.

La tabla de paquetes usa el campo canónico `packageStatus`. No se eliminan estados técnicos de respuesta (`status: SUCCESS/ERROR`), estados de reservas/pagos/ledgers ni el estado de conexión nativo de Wix. La auditoría live previa confirma que `ServiciosCatalogo`, `ComplementosCatalogo` y `MapaStaff` no tienen campo `status`; tampoco se mantiene un flujo de estado comercial de personal en la UI.

CI del PR #252, run #42802778737: 51 suites / 505 tests / 0 fallos; contratos SDK Cart V2 y Bookings Reader V2, y ESLint correctos. La validación se ejecutó sobre el head del PR; no equivale a runtime Wix ni a validación del commit mergeado. No se modificaron CMS, caja, ledgers, reservas, pagos ni publicación. El envío a gestoría sigue pendiente de snapshot inmutable e idempotencia (issue #223).
