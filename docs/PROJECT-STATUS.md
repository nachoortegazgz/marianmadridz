# Estado actual del proyecto — Marian Madrid

**Revisión:** 2026-11-11  
**Repositorio:** [nachoortegazgz/marianmadridz](https://github.com/nachoortegazgz/marianmadridz)  
**Baseline de código:** `main` · `4bfb04e6d907f682b571f94fa3e66446215d1e84` (PR #259, #263, #267, #264 y #256 integradas; revisión documental 2026-11-11)  
**Sitio:** https://www.marianmadrid.es/  
**Alcance:** estado documental y técnico contrastado con el árbol de `main`, auditorías existentes, CI y consultas live de solo lectura.

> Este documento es el índice de estado. No sustituye las decisiones de arquitectura, los contratos de código ni los informes de auditoría. Una capacidad solo se considera operativa cuando existe evidencia del nivel de validación que se indica.

## Addendum de hardening — 2026-11-11

- PR #284 está mergeada en GitHub; la integración no acredita despliegue en Wix. Su cobertura de caja sigue limitada a EFECTIVO + PRESENCIAL.
- PR #286 está abierta como draft en `audit/p0-p1-hardening`. Protege por defecto los writers fiscales y contables, mantiene las recuperaciones en cola mientras los writers están deshabilitados y añade escaneo Gitleaks.
- CI offline del head `edceb4fdadc273a5cd27b59d7ba446baf60f8bb3`: run `43001943879`, 55 suites / 534 tests / 0 fallos; contratos SDK Wix, Bookings Reader V2 y ESLint correctos.
- Gitleaks full-history sobre el mismo HEAD: run `43001943895`, SUCCESS.
- La regla oficial `@wix/cli/no-invalid-backend-import` continúa desactivada por incompatibilidad de carga del plugin. El nuevo contrato cubre únicamente el límite estático de imports frontend y no equivale a la regla oficial.
- No hay certificación Wix Runtime/Preview/E2E ni evidencia de despliegue del HEAD. No fusionar ni desplegar hasta disponer de QA Wix aislado y autorización explícita.


## 1. Resumen ejecutivo

El repositorio contiene una solución Wix Editor/Velo con reservas Bookings V2, saga dual, checkout Cart V2, proyección de pedidos y ledgers fiscal/laboral. La retirada del inventario custom está integrada y Wix Stores Catalog V3 es la autoridad de stock. ZONA STAFF tiene consultas read-only integradas; writers laborales y caja siguen bloqueados. PR #250 incorpora el contrato puro AEAT v0.1.2 con vectores oficiales, sin conexión a writers ni certificación Veri*Factu. PR #252 retira paneles inactivos de ZONA MARIAN. PR #259 limita Staff a consultas verificables. PR #264 endurece replay del ledger contable. PR #256 implementa snapshots trimestrales inmutables, sin envío a gestoría. Wix Invoices sigue en V1 y su API V2 devolvió 428 en la última prueba documentada. Bookings V2 contiene 94 servicios: 70 tarifas fijas, 24 auxiliares sin precio, siete servicios visibles >100 EUR y ningún depósito configurado.

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
| Ledger fiscal / Veri*Factu | **NO APTO para activar remisión Veri*Factu** | PR #250 incorpora `aeatHash.js` puro con vectores oficiales v0.1.2 para alta/anulación, sin consumers runtime. PR #258 aclara que `cajas.web.js` y `eventLog.js` usan una cadena interna `hashChain`; renombra los builders privados y elimina un wrapper redundante sin alterar hashes. Siguen pendientes transición de series/cadena, reconciliación de campos, XML/XSD, transporte SOAP, respuesta/remisión, pruebas AEAT y aprobación legal. |
| Registro horario | Consultas read-only implementadas; writers bloqueados en backend | ZONA STAFF consulta contexto, estado, historial y horas. Los lectores verifican firma HMAC y secuencia. PR #254 añade `STAFF_CLOCKING_CONFIG` y bloquea también las llamadas directas a `registrarFichaje`/`registrarAjusteHorario`; faltan idempotencia, lock persistente, transiciones/concurrencia y runtime Wix QA antes de reactivar. |
| Paquetes de gestoría | Snapshot trimestral implementado en PR #256; CI/runtime QA pendientes | PR #256 añade hash canónico, límite 450 KiB, claim idempotente y alta create-only versionada en `PaquetesGestoria`; listado metadata-only y descarga con verificación hash. Solo trimestre; agregador mensual pendiente. Envío Resend sigue deshabilitado. No hay inserciones CMS reales. |
| Capa 3 M365 / SharePoint | Arquitectura objetivo; no implantación demostrada | No existe `exportService.js` ni jobs de exportación. PA-01…PA-07 y SharePoint no auditados en el tenant. Transporte requiere ADR. |
| Asistente IA | No disponible; UI retirada | `aiAgent.web.js` falla cerrado con `AI_PROVIDER_NOT_CONFIGURED`. PR #252 elimina el panel IA inactivo de ZONA MARIAN; no se expone una capacidad sin proveedor configurado. |
| Gift Cards | App nativa instalada; personalización no implementada | Wix Gift Cards tiene 1 producto nativo configurado y 0 tarjetas emitidas. No existe `giftCards.web.js`, writer propio, QR scanner ni HMAC personalizado en `src/`. |
| Wix Invoices | **V1 activa; adopción de Invoices V2 recomendada cuando Wix la habilite** | GetSiteContext confirma app V1; `POST /invoices/v4/invoices/query` devuelve 428 `INVOICES_API_UNAVAILABLE`; `GET /invoices/v4/invoices-settings` devuelve 200. Wix gestiona el rollout automáticamente. No añadir un paquete Invoices V2 independiente no confirmado ni crear adapter hasta que el CRUD esté habilitado; seguir SDK universal/REST oficial. No sustituye SIF/Veri*Factu. QA: [compatibilidad Invoices V2](qa/2026-11-09-catalog-v3-invoices-compatibility.md). |
| Wix Forms & Payments | 4 esquemas nativos activos | Contacto mapea nombre/email/teléfono a CRM. Caja manual, control X y fichaje no tienen trigger backend; Wix Automations v2 devuelve 0 workflows activos y 0 borradores para `wix_form_app-form_submitted`. |
| Páginas personalizadas / widgets | Staff read-only integrada; Marian con caja/fiscal/documentos y snapshot trimestral; runtime pendiente | PR #259 está fusionada en main (`a4bc95c`). ZONA STAFF solo permite `READY`, `CONTEXT`, `GET_STATE`, `GET_HISTORY` y `HOURS_CALC`; no expone writers de fichaje, ajustes, caja ni inventario. ZONA MARIAN conserva estado de caja, cierre Z, resumen fiscal, libro de facturas y paquetes preparados; PR #256 añade creación/descarga de snapshots trimestrales. Rutas Wix confirmadas: `/onlystaff` y `/zona-marian`; no inventar `/pos-checkout`, `/caja-actual` ni `/mi-calendario`. CI PR #259: run 42814723943 SUCCESS. Falta comparar HTML real del Editor con snapshots Git y ejecutar Wix runtime/Preview. |
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


## 15. Writers de jornada bloqueados también en backend — 2026-11-10

PR #254 se ha fusionado en `main` (commit `5be351e06557cf0bb8900e6a4453c07f1db86b73`). La auditoría detectó que `registrarFichaje` seguía aceptando invocaciones directas de `Permissions.SiteMember` aunque el frontend mantuviera `enableClocking=false`; el writer insertaba sin idempotencia, comprobación de secuencia previa ni serialización concurrente.

Se centraliza `STAFF_CLOCKING_CONFIG` en `internalConfig.js` con `WRITES_ENABLED=false` y `ADJUSTMENTS_ENABLED=false`. Ambos WebMethods fallan cerrados antes de insertar; el fichaje valida primero que la identidad corresponde a staff y el ajuste conserva el control manager. Los WebMethods read-only no cambian.

CI del PR #254, run #42803615666: 51 suites / 505 tests / 0 fallos; contratos SDK Cart V2 y Bookings Reader V2 y ESLint correctos. Los flags no deben reactivarse hasta implementar `operationId`, lock persistente por empleado/día, validación de transiciones, manejo de replay/timeout y pruebas reales de concurrencia en Wix QA. No se modificaron fichajes históricos ni se escribieron datos CMS en Wix.


## 16. Checkpoint de Fase 2 — 2026-11-11 (main actual)

**Baseline:** `main` · `4bfb04e6d907f682b571f94fa3e66446215d1e84`. Este checkpoint actualiza las secciones históricas anteriores; no acredita publicación ni runtime Wix del HEAD actual.

### Cambios integrados

- **PR #259 — ZONA STAFF read-only:** fusionada en `a4bc95c`; elimina TPV/caja, pagos/salidas, cierres X/Z, botones de fichaje y ajustes sin writer operativo, y rutas Wix no existentes. Mantiene contexto, estado, historial y cálculo de horas en lectura. CI HEAD PR: run `42814723943` SUCCESS.
- **PR #263 — ZONA MARIAN:** elimina el mensaje `MM_NAV` no emitido y sin handler. CI: 52 suites / 509 tests, 0 fallos.
- **PR #267 — ZONA MARIAN:** elimina propiedades de contexto y flags fallback no consumidos; conserva intacta la autorización `access.isMarianManager`. CI: 52 suites / 513 tests, 0 fallos.
- **PR #264 — ledger contable:** el replay verifica hash de cada fila, metadata persistida y predecessor; claims COMPLETED no retornan éxito sin comprobar filas. Si faltan filas o hay discrepancias, pasa a `REPAIR_REQUIRED`. CI: 52 suites / 513 tests, 0 fallos.
- **PR #256 — snapshots trimestrales:** fusionada en main por commit `4bfb04e`. Implementa snapshots create-only con hash, claim idempotente, límite 450 KiB, listado metadata-only y descarga verificada. CI del head PR: run `42810977998`, 51 suites / 512 tests / 0 fallos. No se ha creado un snapshot CMS real ni se ha enviado correo.

Los resultados CI son offline; no demuestran ejecución de WebMethods Velo, hooks CMS, concurrencia nativa, pagos o publicación. No hay run post-merge devuelto para el SHA actual de main.

### Flujo `status` descartado

La auditoría live CMS del 2026-11-10 confirma que `ServiciosCatalogo`, `ComplementosCatalogo` y `MapaStaff` no tienen campo `status` ni valores de ese campo. No hay migración ni borrado que realizar. Se conserva `MapaStaff.active` como selector de correlación de identidad, `associatedWixIdentity.connection.status` como estado nativo Wix, `packageStatus` para snapshots y los estados de reservas, pagos, respuestas y ledgers que sí pertenecen a contratos funcionales. `staffManager.web.js` y los paneles inactivos de personal/IA/envío a gestoría ya fueron retirados. Evidencia: [auditoría de catálogo/status](qa/2026-11-10-phase2-catalog-status-audit.md).

### Gobernanza CMS de ledgers — P1 #261

Relectura Wix Data Permissions API del 2026-11-11 (solo lectura): las cinco colecciones `MovimientosCaja`, `LibroAsientosContablesDetalle`, `HistoricoCierresZ`, `RegistrosHorariosStaff` y `PaquetesGestoria` devuelven `CMS_EDITOR` para `itemRead`, `itemInsert`, `itemUpdate` e `itemRemove`. El backend centraliza operaciones mediante `auth.elevate` en `dataAccess.js`; Wix confirma que los hooks se ejecutan también desde Content Manager y que `beforeInsert` recibe `HookContext` con `userId` y `userRole`. No se han cambiado permisos live. La opción de mínimo privilegio es probar `itemInsert=PRIVILEGED` en un sitio QA aislado y comprobar cada writer elevado y cada bloqueo CMS antes de autorizar un cambio de producción. Issue [#261](https://github.com/nachoortegazgz/marianmadridz/issues/261) permanece abierto.

### Paquetes de gestoría — P1 #223

PR #256 ya está integrada: la creación de snapshots trimestrales está implementada en código. Sigue pendiente el agregador mensual y el flujo de despacho reproducible: identidad separada por periodo, persistencia del snapshot exacto antes del envío, registro append-only de entrega/messageId y recuperación idempotente ante timeout. Resend continúa deshabilitado. No se han creado snapshots CMS reales ni enviado comunicaciones.

### Seguridad del repositorio y despliegue

Issue [#210](https://github.com/nachoortegazgz/marianmadridz/issues/210) documenta que `main` no tenía protección ni checks obligatorios en la última lectura API del 2026-11-09. No se ha revalidado ni modificado la configuración en esta revisión. No se ha publicado el HEAD `4bfb04e` en Wix ni se ha comprobado paridad del HTML real del Editor con Git.

### Entorno QA

El contexto Wix actual muestra el sitio Marian Madrid publicado con Velo y varias copias draft sin Velo habilitado. No se ha identificado un sitio QA/staging de Marian Madrid que reúna Bookings, CMS, Members y Cart V2 con Velo activo. No utilizar el sitio publicado para crear reservas, pagos, fichajes o ledgers sintéticos que puedan contaminar operación real. Debe provisionarse un sitio QA aislado antes de las pruebas E2E y de permisos.

### Criterio de salida de Fase 2 — pendiente

Fase 2 **no está completada**. Bloqueos principales:

1. **P0 fiscal:** issue #209; el helper AEAT aislado no equivale a SIF operativo. Faltan definición final del SIF emisor, reconciliación con Wix Invoices V1, builders conectados a writers solo tras reconciliar snapshots, XML/XSD, transporte, respuestas, reintentos, pruebas AEAT y aprobación de asesoría. No activar Veri*Factu ni depósitos Bookings.
2. **Reservas:** falta E2E en QA para simples/duales, compensación, reprogramación/cancelación, checkout sandbox/no cobrable, webhooks y propiedad de Cart/Order ([#162](https://github.com/nachoortegazgz/marianmadridz/issues/162), [#188](https://github.com/nachoortegazgz/marianmadridz/issues/188), [#211](https://github.com/nachoortegazgz/marianmadridz/issues/211)).
3. **Caja/contabilidad:** CajaActual permanece en `SIMULACION`; TPV y cierre Z están fail-closed. Existen filas históricas `SMOKE_TEST` que se excluyen de lecturas, sin borrarlas. Falta aprobar mapeo PGC, validar writers/locks en QA y cerrar #261.
4. **Registro horario:** consultas Staff read-only implementadas; fichajes y ajustes siguen bloqueados hasta operationId, lock persistente por empleado/día, transiciones, replay/timeout e idempotencia con concurrencia Wix QA ([#224](https://github.com/nachoortegazgz/marianmadridz/issues/224)).
5. **Páginas:** Staff y Marian tienen superficies acotadas a capacidades conectadas; falta Wix runtime/Preview con identidades QA y contraste del HTML real del Editor.
6. **Despacho documental:** snapshots trimestrales implementados, pero sin agregador mensual, envío, confirmación persistida ni recuperación idempotente ([#223](https://github.com/nachoortegazgz/marianmadridz/issues/223)).

**Restricciones mantenidas:** sin cambios de permisos CMS en producción, sin inserciones en ledgers, sin reservas/pagos reales, sin comunicaciones a clientes, sin envío a gestoría y sin publicación. Los registros históricos no se recalculan ni sobrescriben.


## Actualización de estado — 2026-11-11

La guía ejecutiva consolidada y vigente para la siguiente intervención es [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md). Resume arquitectura, decisiones, estado de las reservas, caja física, catálogo de servicios, fiscalidad, Capa 3, validación y plan priorizado. Esta guía no sustituye los contratos detallados ni los ADR.

La revisión de 2026-11-11 añade, entre otros, estos puntos que prevalecen sobre cualquier texto histórico incompatible de este documento:
- CajaActual representa exclusivamente el efectivo físico del cajón. Tarjeta, Bizum, online, transferencias y pagos bancarios no alteran su saldo.
- MovimientosCaja conserva su función de registro fiscal de operaciones; no se convierte en un ledger exclusivo de efectivo. LibroAsientosContablesDetalle consolida los hechos económicos según contratos contables aprobados.
- La implementación parcial de esta regla se integró mediante la PR #284 (mergeada en GitHub; el despliegue Wix no está acreditado). Solo proyecta actualmente EFECTIVO + PRESENCIAL; no cubre todavía aportaciones, retiradas, pagos físicos a proveedores ni ajustes.
- La creación de una reserva nativa de prueba el 2026-11-11 no produjo su proyección CitasF2 ni marcador WEBHOOK_EVENT. La causa no está aislada; no realizar backfill, cancelación ni más reservas de prueba hasta resolverla.
- ServiciosCatalogo se declara por el propietario SSOT de la configuración de servicios hacia Wix Bookings, pero el mapeo de name/complementos y staffMembers aún requiere auditoría de esquema, consumidores y sincronización real.
- La CI offline verde no acredita Wix runtime, E2E publicado ni despliegue.

La sección histórica anterior se conserva para trazabilidad; cuando contradiga estos puntos, aplicar esta actualización para el estado a 2026-11-11 y registrar la resolución definitiva en el ADR correspondiente.

## Addendum — conciliación de pagos y reembolsos Wix (2026-11-11)

- PR #286 sigue abierta como draft, sin merge ni despliegue. La rama añade al hardening fail-closed la conciliación de reembolsos por eventos Velo estables: wixEcom_onOrderPaymentStatusUpdated y wixEcom_onOrderUpdated.
- La lectura de transacciones utiliza @wix/ecom.orderTransactions.listTransactionsForSingleOrder con elevación. Solo se registran refunds con todas las transacciones terminales; summary.refunded debe reconciliar con importes SUCCEEDED y las transacciones FAILED aportan cero.
- SDK_CONFIG.CURRENCY_CODE=EUR está respaldado por las propiedades live del sitio. Los reembolsos con otra moneda se rechazan; no hay soporte multimoneda.
- Cobertura añadida: siete pruebas unitarias y escenario offline de venta, refund pendiente, parcial mixto, total posterior, residual IVA, replay y concurrencia.
- CI offline SUCCESS sobre el HEAD de código 48b509f (run 43034820298): 56 suites / 543 tests / 0 fallos; SDK @wix/ecom orderTransactions, Bookings Reader V2 y ESLint correctos. Gitleaks full-history SUCCESS (run 43034820526). Las actualizaciones posteriores son exclusivamente documentales; el código validado no ha cambiado.
- Wix Runtime y E2E publicado siguen pendientes por falta de sitio QA aislado. La cuenta tiene el sitio productivo Marian Madrid y el sitio personal ortega nacho cv web (Velo enabled, plan Free), pero el segundo no replica Bookings/Stores/Members. No se duplica producción porque Wix no garantiza que el duplicado excluya CMS personalizado; no ejecutar webhooks, pagos, reembolsos ni escrituras fiscales sobre producción.
- El evento Velo onOrderTransactionsUpdated no se utiliza porque está en Developer Preview y su descripción no garantiza la transición de estado de refunds ya creados.
- La documentación de QA está en docs/qa/QA-SIMULATION-2026-11.md y el detalle de cambios en docs/audits/2026-11-11-p0-p1-hardening.md.



## Addendum — estado real de PR #286 y automatizaciones Wix (2026-11-11)

- CI del HEAD de código `d30e03473fe2bfe39b93a881ef4b765fcd72691d`: backend offline quality run `43038637356`, 57 suites / 548 tests / 0 fallos; Gitleaks run `43038637350` SUCCESS. No hay revisiones humanas registradas. Los commits posteriores son documentales y requieren que CI vuelva a ejecutarse.
- PR #286 permanece abierta como draft, sin merge ni despliegue.
- La auditoría de automatizaciones Wix aplicó cambios de estado: 67 activas se pausaron y verificaron (66 email y una WhatsApp). Las cuatro automatizaciones WhatsApp están inactivas.
- Nueve automatizaciones de email siguen activas por restricciones Wix `readonly` y/o `disableStatusChange`. La allowlist Resend no gobierna los envíos nativos Wix.
- No se envió email, WhatsApp ni SMS. El móvil sintético `666724634` no se configuró porque la acción nativa WhatsApp no tiene una receta pública soportada para modificar destinatarios por API.
- Pendiente: revisión humana completa; runtime/E2E aislado de eventos de pago/reembolso; aislamiento de los nueve flujos email restantes; decisión e implementación de una integración WhatsApp oficialmente soportada.
- No desplegar: el código mantiene los writers fiscales/contables fail-closed y no existe evidencia de validación Wix Runtime del HEAD.

Evidencia: [auditoría de aislamiento de notificaciones](audits/2026-11-11-wix-automation-recipient-isolation.md) y [auditoría P0/P1](audits/2026-11-11-p0-p1-hardening.md).


## Addendum post-merge PR #286 — 2026-11-11

PR #286 se fusionó en `main` por squash el 2026-11-11 15:00:16 UTC. Merge commit `0d8f6efc581bc6a3d892702ba1c32af73e829888`. Los addenda previos que describen PR #286 como draft/abierta quedan superados.

La CI offline del HEAD anterior al merge pasó: 57 suites / 548 tests / 0 fallos; contratos Wix SDK, Order Transactions, Bookings Reader V2, ESLint y Gitleaks correctos. La integración no acredita Wix Runtime ni despliegue. No se ha publicado el código ni se han mutado datos Wix.

Se mantienen los guards fiscales/contables fail-closed. No desplegar hasta validar runtime/E2E de pagos y reembolsos en entorno aislado y revisar el efecto operativo de los writers bloqueados. La auditoría Wix de notificaciones verificó 67 pausas (66 email, una WhatsApp); nueve automatizaciones email siguen activas por restricciones Wix. Las cuatro WhatsApp están inactivas; cero mensajes enviados. El móvil sintético 666724634 sigue sin configurar.

Detalle: [PR #286](https://github.com/nachoortegazgz/marianmadridz/pull/286), [merge commit](https://github.com/nachoortegazgz/marianmadridz/commit/0d8f6efc581bc6a3d892702ba1c32af73e829888), [auditoría de aislamiento de notificaciones](audits/2026-11-11-wix-automation-recipient-isolation.md).
