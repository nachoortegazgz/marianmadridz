# Base de conocimiento del proyecto — Marian Madrid

**Corte documental:** 2026-11-23  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Rama de incorporación:** `audit/native-first-baseline-20261123` (PR #548, Draft)  
**Base de código revisada:** `main` en `26f51bcb3fb46c1c0e0e933ae6bb08c4c26d52f9`  
**Naturaleza:** referencia de contexto y arquitectura. No sustituye los documentos SSOT especializados ni acredita por sí sola el estado live de Wix.

---

## 1. Propósito y regla de autoridad

Este documento consolida el contexto técnico y operativo del ecosistema Marian Madrid para reducir contradicciones entre handoffs, memorias, auditorías y decisiones históricas. Es un mapa de conocimiento y una referencia de arranque; no es una segunda fuente de estado live.

### 1.1 Precedencia

La precedencia de requisitos del proyecto está definida por [Directriz del propietario — desarrollo, pruebas y objetivos finales](PROJECT-OWNER-DIRECTIVE-2026-11-20.md):

1. Requisitos, objetivos y criterios de aceptación expresos de Marian Madrid y del propietario.
2. Normativa legal vigente aplicable en España.
3. Documentación oficial vigente de Wix y de las integraciones para contratos, APIs, permisos y comportamiento.
4. Directriz del propietario de 2026-11-20.
5. Dossiers, ADR, informes, decision logs, código y snapshots históricos, que son artefactos derivados y deben alinearse.

Para conocer el **estado operativo del momento**, la referencia es [PROJECT-STATUS.md](PROJECT-STATUS.md). Para la **secuencia de trabajo**, [MASTER-EXECUTION-PLAN.md](MASTER-EXECUTION-PLAN.md). Para issues, [BACKLOG-RECONCILIATION](qa/BACKLOG-RECONCILIATION-2026-11-23.md). Para contratos y aceptación TPV, [matriz TPV](qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md). Para identidad y clasificación del entorno, [QA-ENVIRONMENT-SSOT](qa/QA-ENVIRONMENT-SSOT.md).

La documentación oficial Wix prevalece sobre cualquier suposición del repositorio acerca de APIs, SDK, permisos, límites, eventos o Runtime. Si las fuentes discrepan, se registra la contradicción y se solicita/obtiene evidencia antes de cambiar código o datos.

### 1.2 Estados probatorios

- **VERIFICADO:** comprobado en el SHA, configuración, herramienta o prueba identificada.
- **DECLARADO:** afirmado por el propietario o documento, sin comprobación independiente actual.
- **INFERIDO:** interpretación razonable de evidencia parcial; no constituye contrato.
- **PENDIENTE:** requiere inspección o prueba.
- **HISTÓRICO/SUPERSEDIDO:** se conserva para trazabilidad, pero no gobierna el estado actual.

Toda afirmación técnica de una intervención debe indicar su estado probatorio. Un test offline solo acredita su alcance y SHA; no demuestra Wix Runtime, CMS live, E2E, aislamiento ni cumplimiento legal.

---

## 2. Identidad del sitio y entorno

| Elemento | Referencia vigente | Estado |
|---|---|---|
| Negocio | Marian Madrid Peluquería y Estética | Declarado |
| Dominio | https://www.marianmadrid.es/ | Declarado / observado |
| Site ID | `188bed94-177c-4bc9-a9f0-35080d874f3e` | Verificado en read-back Wix documentado |
| Plataforma | Wix Editor clásico + Velo | Verificado en Site Context documentado |
| Estado de Wix | Draft en el read-back del 2026-11-23 | Verificado para ese instante; no inferir sincronización Git-Wix |
| Plan | Premium | Read-back documentado |
| Región / moneda / zona | España / EUR / Europe/Madrid | Read-back documentado; no convertir en constantes universales |
| Finalidad | Entorno único de desarrollo y QA; no ha tenido actividad comercial real | Declaración expresa del propietario |
| Datos de QA | Sintéticos | Declaración expresa del propietario |
| Pagos | Pasarela declarada desconectada; no se han realizado cobros reales | Declaración; verificar Dashboard antes de pruebas que puedan afectar pagos |
| Cliente de prueba canónico | Nacho Pitt — `nacho.pitt@example.test` | Fixture sintética documentada |

La clasificación del sitio como QA no cambia por el dominio personalizado ni por un estado Wix Published histórico. El read-back posterior del 2026-11-23 devuelve Draft y prevalece sobre snapshots Published anteriores para describir ese instante. Draft tampoco prueba por sí solo que no existan automatizaciones o efectos externos.

Aplicaciones observadas/declaradas: Wix Bookings, Wix Forms & Payments, Wix Gift Cards, Wix Payments, Wix Stores Catalog V3, Wix Invoices V1, Wix Members Area, Wix Blog y Promote SEO. Instalación observada no equivale a configuración o aceptación funcional.

### 2.1 Automatizaciones y efectos externos

El estado operativo del 2026-11-23 declara **ocho automatizaciones ACTIVE**: siete PREINSTALLED y una APPLICATION. La SSOT QA contiene lecturas históricas que alternan entre siete y ocho activas y documenta una automatización TPV de aplicación que estuvo INACTIVE en una lectura del 16-11. La descripción de PR #548 también contiene un resumen diferente. Se adopta el estado más reciente de PROJECT-STATUS para el resumen, pero la lista exacta, IDs, triggers, acciones e historial deben revalidarse read-only en Wix antes de Runtime/E2E.

Varias automatizaciones preinstaladas tienen acciones de email/notificación y restricciones Wix de modificación. La neutralización efectiva de comunicaciones no está acreditada. No disparar eventos que puedan activar notificaciones; no sortear restricciones, desinstalar apps ni cambiar automatizaciones sin evidencia y autorización.

---

## 3. Objetivo técnico y principios de ingeniería

Rol operativo: Principal Software Architect, Senior Full-Stack Engineer, Backend Specialist, Software Auditor y QA Engineering Lead para Wix Editor clásico + Velo, JavaScript/Node.js y Wix JavaScript SDK.

Objetivo: mantener y mejorar el sistema existente con el **mínimo código personalizado necesario**, priorizando fiabilidad, cumplimiento, funcionalidad, mantenibilidad y optimización, en ese orden.

Principios:

- Preferir capacidades nativas Wix cuando cubran correctamente el requisito. El código custom debe aportar valor funcional, contractual, de seguridad o normativo demostrado.
- No reconstruir procesos nativos ni módulos funcionales por preferencia tecnológica.
- No refactorizar por estética, reducir líneas por sí mismo ni introducir abstracciones prematuras.
- Frontend para presentación, interacción, captura y llamadas a WebMethods; sin autoridad de negocio ni de permisos.
- Reglas, validación, identidad y autorización en backend.
- Constantes canónicas en `internalConfig.js`, con configuración específica del sitio separada de contratos universales.
- Validaciones compartidas en `validation.js`, distinguiendo validación de entrada, autorización y persistencia.
- Secretos solo en backend y nunca en logs, frontend o documentación.
- Webhooks y procesos asíncronos idempotentes; locks/CAS cuando sean necesarios para integridad y concurrencia.
- No declarar pruebas, sincronización, Runtime, E2E ni despliegue que no se haya ejecutado.
- No modificar producción, fusionar PR, publicar ni habilitar efectos externos sin gates superados y autorización expresa.

---

## 4. Arquitectura y fuentes de verdad

| Capa | Responsabilidad | Límite |
|---|---|---|
| Capa 0 | Configuración, validación, seguridad, acceso a datos, logging, secretos y utilidades comunes | Neutral y reutilizable; evitar acoplamientos de sitio/entorno/dominio no justificados |
| Capa 1 | Wix CMS y aplicaciones nativas para datos transaccionales y dominios propios | Wix CMS es SSOT de datos propios; cada Wix App gobierna su dominio nativo |
| Capa 2 | Velo backend/WebMethods: reglas, autorización, validación, concurrencia, idempotencia, webhooks y procesos | Frontend no gobierna; backend valida identidad y permisos |
| Capa 3 | Microsoft 365, SharePoint y Power Automate como evidencia y transporte documental | No gobierna ni modifica Capa 1; no es SSOT transaccional |

- Wix Bookings gobierna reservas y recursos nativos.
- Wix Stores Catalog V3 gobierna catálogo/stock comercial nativo.
- Wix Payments y las APIs oficiales correspondientes gobiernan los pagos que se integren realmente.
- Wix Gift Cards, Invoices y demás apps gobiernan sus respectivos dominios nativos.
- No duplicar con CMS custom lo que una Wix App ya resuelve de forma soportada.
- SharePoint es repositorio documental/evidencia, no maestro de transacciones.
- Los registros fiscales, contables, laborales y económicos que estén definidos como ledgers append-only son inmutables; las rectificaciones se realizan mediante nuevos registros trazables. La directriz de QA permite datos de ensayo sintéticos y un reset preproducción controlado, pero no constituye permiso para mutar ledgers inmutables ni registros con significado legal. Cualquier caso de datos sintéticos que se pretenda actualizar/eliminar debe demostrar que no pertenece a un ledger append-only, estar identificado, en allowlist, autorizado server-side, respaldado y auditado. No hacer borrados indiscriminados.
- Antes del primer uso real debe existir un reset preproducción planificado, selectivo y verificable, y deben estar restablecidas las garantías de inmutabilidad, permisos, seguridad e integridad que correspondan.

---

## 5. Repositorio, ramas, CI y documentación

- Repositorio: [nachoortegazgz/marianmadridz](https://github.com/nachoortegazgz/marianmadridz).
- Rama principal: `main`.
- HEAD consultado en esta intervención: `26f51bcb3fb46c1c0e0e933ae6bb08c4c26d52f9` (23-11-2026).
- PR #548: [auditoría nativo-first](https://github.com/nachoortegazgz/marianmadridz/pull/548), rama `audit/native-first-baseline-20261123`, abierta, Draft, base main. Antes de esta actualización: head `5aee384fce48833115e6666ba0dcb863d8f0254b`, cinco documentos, mergeable=true. No está integrada en main.
- La protección de main se declara no configurada (`protected=false`), issue #210 abierta. Revalidar en GitHub; requiere ruleset/protección, PR obligatoria, checks requeridos y bloqueo de force-push/borrado.
- Secreto esperado de Actions: `CLI_API_KEY`. No revelar valor; verificar existencia/permisos de forma segura.
- Toolchain documentada: Node 24.22.1, Wix CLI 1.2.14, `@wix/sdk` 1.21.17 y lockfile npm v3. Contrastar con manifests/workflows y documentación oficial antes de cambiar o ejecutar.
- No generar manualmente `src/velo.dependencies.json`; seguir procedimiento oficial Wix CLI.

### 5.1 CI y límites

Comandos declarados: `npm ci`, `npm run lint`, `npm test`, `npm run test:layer1`, `npm run test:layer2`. Workflow principal: `.github/workflows/backend-offline-quality.yml`.

Resultados históricos documentados para SHAs concretos: Layer 1 364/364; Layer 2 255/255; suite offline 736/736; npm audit 0 vulnerabilidades; contratos Wix SDK/eCommerce/TPV, ESLint y Gitleaks SUCCESS. Son resultados vinculados a sus SHAs, no al HEAD futuro. No acreditan CMS live, Wix Runtime, E2E, concurrencia real, hardware, pagos, cumplimiento fiscal ni publicación.

El workflow `.github/workflows/wix-tpv-preview.yml` se documentó como manual, con `create_preview=false` por defecto, autenticación Wix y sin `wix publish`; verificar el YAML y su estado antes de invocarlo. Preview no equivale a publicación ni demuestra por sí solo el data plane de cada WebMethod.

### 5.2 Documentos canónicos

- [Estado operativo](PROJECT-STATUS.md).
- [Plan maestro](MASTER-EXECUTION-PLAN.md).
- [Backlog reconciliado](qa/BACKLOG-RECONCILIATION-2026-11-23.md).
- [Aceptación TPV](qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md).
- [Auditoría Wix/TPV](qa/2026-11-23-tpv-wix-audit-validation.md).
- [Directriz del propietario](PROJECT-OWNER-DIRECTIVE-2026-11-20.md).
- [SSOT de entorno QA](qa/QA-ENVIRONMENT-SSOT.md).
- [Dossier técnico](../DOSSIER%20T%C3%89CNICO%20CONSOLIDADO.md).
- [Flujos Capa 1 → Capa 3](reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md).
- [Diccionario CMS](reference/DICCIONARIO_DATOS_CMS.md).
- [Registro de decisiones](DECISION-LOG.md).
- [Estándares de desarrollo](engineering/DEVELOPMENT-STANDARDS.md).

Los documentos fechados de auditoría y QA son evidencia histórica/especializada. No deben interpretarse como estado live si PROJECT-STATUS o una lectura posterior los contradice.

---

## 6. Wix nativo primero: criterios de diseño

La funcionalidad nativa es la opción preferida si satisface el requisito y ofrece contratos/operación verificables. El custom code se limita a la lógica diferencial que no resuelve Wix nativamente.

- Bookings V2: reservas, servicios, disponibilidad y staff.
- Stores Catalog V3: catálogo y stock comercial.
- Payments: pagos únicamente mediante integración autorizada y probada.
- Gift Cards e Invoices: respetar las APIs y capacidades nativas disponibles para el sitio.
- No crear inventario paralelo, proyecciones de stock ni writers custom cuando Wix Catalog es autoridad.
- No asumir que una app instalada tiene cada API habilitada para este sitio; el rollout y disponibilidad deben comprobarse.
- Para cada requisito, comparar nativo vs custom, coste de mantenimiento, contrato oficial, permisos, límites y pruebas.

PR #548 incorpora una matriz nativo-vs-custom y una auditoría de minimización. Su baseline es documental y requiere revisión; no autoriza refactor ni cambio de datos.

---

## 7. CMS, Bookings, caja y flujos de negocio

### 7.1 Bookings y servicios combinables

Diseño histórico declarado:
- `Import2` como origen de servicios y campo `permitirCombinar`.
- `permitirCombinar=false`: flujo nativo Bookings.
- `permitirCombinar=true`: propuesta Dual Slot Validation with Exposure Gap; el cliente ve un único horario y backend crea fases F1/F2 dejando libre el intervalo de exposición.
- Campos mencionados: `tiempoFase1`, `tiempoExposicion`, `tiempoFase2`, `duracionTotal`, `f2ServiceId`.
- Colecciones citadas: `CitasF2`, `AGENDA_INTERNA`, `DUAL_BOOKING_GROUPS`, `MapaStaff`; MapaStaff fue declarado creado.
- Nombres propuestos: `primaryServiceGuid`, `secondaryServiceGuid`; `resourceId) como referencia de recurso profesional.

No asumir que esos campos/colecciones siguen vigentes ni que son la autoridad actual. Contrastar con diccionario CMS, esquema live, Bookings V2 y consumidores. Mantener solo lógica dual diferencial que no cubra la app nativa.

### 7.2 Caja y ledgers

- `MovimientosCaja`: evidencia/eventos históricos según el diseño actual.
- `CajaActual`: proyección operativa/sesión; todos los writers deben respetar la misma estrategia de concurrencia y consistencia.
- `HistoricoCierresZ`: cierres históricos.
- Ticket X: informe no cerrador de sesión; Ticket Z: cierre.
- Movimientos de caja y ventas se registran conforme al evento de negocio completado definido por el contrato.
- No reconstruir ni rectificar hechos históricos por inferencia.
- No mutar registros append-only; correcciones mediante eventos rectificativos.
- Las proyecciones operativas pueden tener reglas distintas, pero no se actualizan fuera del flujo backend autorizado ni sin evidencia fuente.

### 7.3 CMS y autoridad

No crear colecciones por conveniencia o por nombres propuestos. El modelo físico observado en main usa discriminadores lógicos TPV persistidos en colecciones de negocio compartidas; el diccionario CMS y el read-back live mandan sobre snapshots de diseño.

---

## 8. TPV: arquitectura y estado de aceptación

### 8.1 Estado operativo

El TPV se declara interno/sintético. No debe presentarse como integración de cobro real ni como sistema fiscal. La matriz de aceptación del 2026-11-23 confirma estáticamente ventas y pagos sintéticos propios; no se crea/vincula pedido, recibo o factura nativa en ese flujo; las escrituras nativas y pagos reales están bloqueados por la política TPV descrita en la matriz. La aceptación global sigue pendiente de Wix Runtime/E2E, identidades/roles, concurrencia y conciliación.

La matriz TPV documenta:
- Identidad Wix autenticada obtenida en backend mediante miembro/contactId y rol staff; el widget no es fuente de identidad.
- Roles canónicos `ADMIN`, `GESTION`, `ESTILISTA`; lectura de caja para ADMIN/GESTION y operaciones de escritura restringidas a ADMIN según el contrato estático.
- El profesional seleccionado en el widget aún no queda mapeado de forma demostrada al recurso Staff real del operador autenticado.
- Ventas/pagos y recibos propios sintéticos; no hay orderId, nativeReceiptId ni invoiceId nativo vinculado.
- Pagos divididos validados en céntimos; métodos sintéticos documentados: EFECTIVO, TARJETA, BIZUM, BONO, TARJETA_REGALO y OTROS. BONO/TARJETA_REGALO no significan canje real ni integración de saldo.
- Entradas/salidas del cajón físico solo afectan efectivo.
- X no cierra sesión; Z cierra y tiene controles idempotentes según lectura estática.
- Faltan pruebas Runtime/E2E de identidad, roles, locks, CajaActual, conciliación, devoluciones, X/Z y no-efectos externos.

### 8.2 Persistencia y discriminadores

La lectura estática de `src/backend/internalConfig.js` en main confirma:
- `TPV_COLLECTIONS` existe y define discriminadores lógicos `TPV_LOGICAL_*`; no son IDs de colecciones físicas.
- `TPV_LEGACY_COLLECTIONS` conserva marcadores `SANDBOX_LOGICAL_*) para compatibilidad histórica.
- El comentario de configuración indica persistencia de eventos lógicos en `MovimientosCaja` y sesiones en `CajaActual`.
- `TPV_PAYMENT_METHOD`, `TPV_RUNTIME_POLICY) y `TPV_IDENTITY_TYPES` están definidos/exportados en el archivo revisado.
- `TPV_RUNTIME_POLICY` contiene valores específicos del sitio (`SITE_ID`), moneda, zona, flags y marcadores legacy; no es una política universal neutral.

Por tanto, el hallazgo del archivo de entrada que afirmaba que esos cuatro exports no aparecían en la configuración revisada está **supersedido para el SHA main 26f51bcb**: los exports sí están presentes. Esto no elimina las tareas de revisar su contenido, consumidores y neutralidad.

### 8.3 Contradicción de gates TPV que debe resolverse

Los documentos de QA del 2026-11-20 describen una ruta de bloqueo `TPV_QA_RUNTIME_POLICY.ENABLED=false` y `assertTpvQaEnabled()`, mientras que:
- `internalConfig.js` en main exporta `TPV_RUNTIME_POLICY.ENABLED=true`;
- documentación de handoff del 2026-11-20 menciona otra denominación, `TPV_SANDBOX_RUNTIME_POLICY), y `assertTpvSandboxEnabled()`;
- el código `tpvUtils.js) importa `TPV_RUNTIME_POLICY` y conserva marcadores/compatibilidad sandbox.

No asumir que estas políticas son equivalentes ni que una habilita el flujo protegido por otra. Resolver en lectura estática completa: identificar WebMethods actuales, imports/exports, guards ejecutados antes del repositorio, rutas QA/Sandbox antiguas, widget y pruebas. La política efectiva debe fallar cerrada y no depender de etiquetas frontend. Hasta reconciliar y probar el data plane, no habilitar persistencia TPV en Wix Runtime.

### 8.4 Reglas TPV no negociables

- Diferenciar `status`, `sourceType` y `reconciliationStatus`.
- No invocar Wix Payments, crear pedidos/facturas nativos ni declarar cobro real desde el TPV sintético.
- Mantener `realPayment=false), `gatewayCalled=false) y `reconciliationStatus=NOT_RECONCILED` para operaciones sintéticas cuando esos campos formen parte del contrato activo.
- Identidad: `actorId) = usuario autenticado; `operatorId) = operador; `profesionalId)/`professionalId) = profesional seleccionado/asociado. Resolver nombre canónico y relación real con Bookings Staff.
- Contrato de devolución declarado: `{ paymentMethod, amount }`; no cambiar sin revisar backend y consumidores.
- Mantener idempotencia, claves, locks, auditoría y scope por sitio/sesión.
- No crear segundo repositorio TPV ni colecciones duplicadas: el modelo observado usa discriminadores lógicos y colecciones físicas compartidas.
- No sustituir CAS/locks por reintentos simples de update.

---

## 9. Auditoría de Capa 0: inventario de módulos

El archivo aportado por el propietario enumera los siguientes módulos y tareas. Se incorporan como plan de auditoría; el estado actual se matiza con la lectura estática de main indicada en cada caso.

| Módulo | Prioridad | Tareas principales |
|---|---:|---|
| `src/backend/internalConfig.js` | P0 | Quitar IDs fijos de staff; resolver roles dinámicamente; parametrizar ubicación/remitente/región; revisar duplicidad de datos fiscales; separar configuración por dominio; revisar políticas de colecciones y estados. |
| `src/backend/tpv/tpvUtils.js` | P0 | Neutralizar helpers/nombres sandbox sin perder compatibilidad histórica; revisar run IDs y dependencias de SITE_ID/LEDGER_VERSION/ENVIRONMENT; unificar métodos de pago; revisar consumidores de helpers antiguos. |
| `src/backend/tpv/tpvRepository.js` | P0 | Verificar exports, scope por sitio/sesión, filtros, idempotencia, locks y liberación segura; confirmar que todos los writers pasan por un único límite de persistencia. |
| `src/backend/dataAccess.js` | P1 | Asegurar que collection ID no procede del frontend; política central de colecciones; revisar bulkPatch/CAS, resultados, errores y límites de paginación. |
| `src/backend/security.js` | P1 | Resolver identidad/roles desde datos autorizados; separar memberId/contactId/resourceId/operatorId/actorId; mantener rate limiter fail-closed. |
| `src/backend/validation.js` | P1 | Centralizar GUID, dinero, fechas y estados; separar entrada/autorización/persistencia; legacy solo lectura; validar importes y rechazar identidad del frontend. |
| `src/backend/securityEngine.js` | P1 | Separar hash genérico de firma laboral; claves por dominio; versionar payload; preservar verificación histórica; revisar timingSafeEqual. |
| `src/backend/staff.js` | P1 | Eliminar listas hard-coded cuando exista resolución soportada por Contact ID/Bookings Staff API; mapear resourceId–rol; no usar nombres como identidad. |
| `src/backend/events.js` y `eventLog.js` | P0/P1 | Separar eventos TPV/fiscales; reconciliar sourceType/recordSource/reconciliationStatus; idempotencia de webhooks y secuenciación; evitar ledger fiscal desde sintéticos. |
| `src/public/mmUtils.js` | P1 | Mantener espejo frontend-safe; evitar duplicidades; no usar Math.random para IDs sensibles; probar conversión DST; revisar withTimeout y separar utilidades por dominio. |
| `src/backend/logger.js` | P1 | Enmascarar PII; no registrar secretos ni payloads completos; traceId/siteId seguros; niveles homogéneos. |
| `src/backend/secretAccess.js` y `mmSecrets.js` | P1 | No secretos literales; claves por dominio; fail-closed; rotación/versionado. |

### 9.1 Comprobaciones actuales ya observadas en main

- `internalConfig.js) sí exporta `TPV_COLLECTIONS`, `TPV_PAYMENT_METHOD`, `TPV_RUNTIME_POLICY) y `TPV_IDENTITY_TYPES`; la afirmación de exports ausentes del documento de entrada está obsoleta para el SHA revisado.
- `internalConfig.js) mantiene IDs fijos en `STAFF.IDS` y un mapa estático `WEBSITE_ROLE_BY_RESOURCE_ID); además incluye `STAFF_DEFAULT_NAME`.
- `TPV_COLLECTIONS) son discriminadores lógicos, no nombres de colecciones CMS físicas. No reemplazarlos por aliases físicos propuestos sin análisis.
- `TPV_RUNTIME_POLICY) contiene Site ID, EUR, Europe/Madrid, flags y marcadores legacy; la neutralidad y separación de configuración de sitio sigue siendo candidata a revisión.
- `tpvUtils.js) importa los exports TPV y contiene compatibilidad explícita con run ID/trace/sources legacy sandbox y estado `SIMULACION). Eliminar/renombrar solo después de mapear registros y consumidores.
- `tpvRepository.js) usa `dataAccess`, `internalConfig`, locks fiscales y locks TPV scoped. No fusionar locks por apariencia; demostrar que todos los writers de CajaActual comparten sección crítica y orden seguro.
- `dataAccess.js) centraliza acceso Wix Data mediante `@wix/data` y `auth.elevate`, con validadores y política de mutación. Conservar ese límite; revisar los controles concretos antes de simplificar.

### 9.2 Orden de auditoría

1. `internalConfig.js`
2. `tpvUtils.js`
3. `tpvRepository.js`
4. `dataAccess.js`
5. `security.js`
6. `validation.js`
7. `securityEngine.js`
8. `staff.js`
9. `events.js` y `eventLog.js`
10. `mmUtils.js`
11. `logger.js`, `secretAccess.js) y `mmSecrets.js)

Antes de borrar o renombrar cualquier símbolo: búsqueda global de consumidores, imports/exports, contratos externos, pruebas, runners, histórico y diff.

---

## 10. Backlog y prioridades

Prioridad P0:
- **#525 CajaActual:** inventariar todos los writers; serialización/CAS real; idempotencia; ausencia de lost updates; recuperación; concurrencia Wix Runtime.
- **#416 compensaciones:** conciliar cada registro con transacción y evidencia de origen; no inferir rectificativos ni reintentos.
- **#415 maestro fiscal:** reconciliar MapaStaff, esquema físico y consumidores; no recrear colecciones.
- **#520 automatizaciones:** auditar las ocho ACTIVE declaradas, triggers, acciones, historial y efectos; neutralización solo por vías soportadas.
- **#209 SIF/Veri*Factu:** validación normativa/técnica/proveedor/asesoría; mantener deshabilitados writers, firma, QR, emisión y remisión hasta aceptación.
- **#434 release readiness:** release NO-GO hasta cerrar gates.

Prioridad P1:
- **#210 protección main:** ruleset, PR obligatoria, checks requeridos, bloqueo de force-push/borrado.
- TPV E2E y Bookings/Payments E2E en entorno controlado, sin pagos ni comunicaciones reales; primero resolver aislamiento y automatizaciones.

P2: Capa 3, exportaciones, SharePoint, Power Automate, crons, webhooks y auditoría documental.  
P3: rendimiento, SEO, accesibilidad, UX móvil y mantenibilidad.  
P4: release solo con regresión, seguridad, sincronización Git-Wix, rollback, aceptación normativa y autorización.

---

## 11. Capa 3 — Microsoft 365

No está certificada como operativa:
- `exportService.js` no localizado en la auditoría anterior.
- Cuatro crons de exportación previstos no localizados.
- Flujos Power Automate PA-01 a PA-07 no auditados en tenant.
- Bibliotecas y permisos SharePoint no auditados.
- E2E Wix → transporte → Power Automate → SharePoint no ejecutado.
- Resend no localizado como integración runtime activa.

Existe una decisión de transporte pendiente entre Resend/Outlook/Power Automate/SharePoint y Microsoft Graph/mecanismos Microsoft nativos. Resolver mediante ADR comparativa y aprobación antes de implementar. SharePoint solo evidencia/documentación; no modifica ni gobierna datos de Capa 1.

---

## 12. Cumplimiento y seguridad

Ámbitos a validar con fuentes oficiales y profesionales competentes: RGPD/LOPDGDD, LSSI-CE, facturación, SIF/Veri*Factu cuando aplique, registro horario/laboral, conservación documental y normativa de consumidores.

La existencia de código, colecciones o CI no acredita cumplimiento. Requiere análisis de normativa vigente, configuración real, proveedor y asesoría. Ninguna decisión de QA dispensa obligaciones legales. No emitir ni transmitir documentos fiscales reales durante pruebas.

Invariantes:
- autorización y permisos en backend;
- secretos protegidos y mínimos privilegios;
- PII minimizada/enmascarada en logs;
- idempotencia y concurrencia;
- no mezclar eventos sintéticos con ledgers fiscales reales;
- no ejecutar pagos, reembolsos, facturación o comunicaciones externas reales durante QA;
- mantener evidencia, trazabilidad y rollback;
- no mutar ledgers append-only; rectificar con nuevos registros.

---

## 13. Método obligatorio de intervención

1. Reconciliar HEAD/SHA y documentación canónica antes de editar.
2. Identificar módulo, consumidores, imports/exports, contratos, enums, esquema CMS, permisos y dependencias.
3. Consultar documentación oficial vigente Wix e integraciones.
4. Definir comportamiento esperado y criterios de aceptación.
5. Caracterizar con pruebas existentes antes del cambio.
6. Implementar el cambio mínimo; preferir nativo cuando cubra el requisito.
7. Ejecutar pruebas proporcionales: unitarias, integración, regresión, concurrencia, idempotencia, seguridad, E2E, Wix Local Editor y Published cuando proceda.
8. Revisar diff completo, CI del SHA, riesgos, rollback y documentación.
9. No desplegar con pruebas fallidas, riesgos críticos abiertos o recuperación inviable.
10. Documentar qué se ejecutó, entorno, SHA, resultado y limitaciones.

Formato de informe técnico: **OBJETIVO · DIAGNÓSTICO · EVIDENCIA · IMPACTO · SOLUCIÓN · RIESGOS · IMPLEMENTACIÓN · VALIDACIÓN · DESPLIEGUE · DOCUMENTACIÓN**.

---

## 14. Contradicciones detectadas y resolución aplicada

| Contradicción | Resolución para esta base |
|---|---|
| Wix Editor clásico vs Wix Studio | Sitio declarado/observado como Wix Editor clásico; no asumir APIs o tooling de Studio. |
| Published histórico vs Draft actual | Read-back Wix documentado el 2026-11-23 devuelve Draft; los Published anteriores son snapshots históricos. |
| Siete vs ocho automatizaciones ACTIVE | PROJECT-STATUS 2026-11-23 declara ocho; revalidar IDs/acciones antes de Runtime/E2E. |
| Exports TPV supuestamente ausentes | El main SHA 26f51bcb confirma exports TPV_COLLECTIONS, TPV_PAYMENT_METHOD, TPV_RUNTIME_POLICY y TPV_IDENTITY_TYPES; el hallazgo adjunto queda supersedido. |
| TPV_COLLECTIONS como colecciones físicas | El código indica discriminadores lógicos; no crear colecciones duplicadas. |
| TPV_RUNTIME_POLICY vs TPV_QA_RUNTIME_POLICY vs TPV_SANDBOX_RUNTIME_POLICY | Contratos/nombres divergentes en código y documentación. Reconciliación P0 antes de habilitar persistencia Runtime. |
| Append-only vs CRUD de datos sintéticos QA | Mantener ledgers append-only e inmutables. La autorización de QA solo permite operaciones controladas sobre registros sintéticos no-append-only, con allowlist, backend ADMIN, backup, auditoría y rollback. La limpieza preproducción es selectiva, no indiscriminada. |
| Resend/Outlook/Power Automate vs Graph | ADR y aprobación pendientes. |
| CI offline vs aceptación Runtime | CI se asocia a SHA y alcance; nunca sustituye Runtime/E2E. |
| PR #548 Draft vs documentación canónica | PR abierta/Draft no está integrada en main; los entregables no son canónicos hasta merge autorizado. |

---

## 15. Estado de esta actualización y límites

Esta actualización incorpora una base de conocimiento en Markdown y referencias desde los índices del repositorio. El cambio es documental: no modifica `src/`, CMS, Wix Editor, automatizaciones, pagos, secretos ni configuración runtime.

La PR #548 sigue siendo Draft y requiere:
- revisión del diff completo;
- CI del nuevo SHA;
- revisión de consistencia con PROJECT-STATUS y los documentos SSOT;
- aprobación antes de merge.

No se declara ejecutada ninguna prueba local, Runtime o E2E por esta actualización documental. El release permanece **NO-GO**.

### Fuentes principales utilizadas

- [Directriz del propietario 2026-11-20](PROJECT-OWNER-DIRECTIVE-2026-11-20.md)
- [Estado operativo 2026-11-23](PROJECT-STATUS.md)
- [Plan maestro](MASTER-EXECUTION-PLAN.md)
- [SSOT de entorno QA](qa/QA-ENVIRONMENT-SSOT.md)
- [Matriz de aceptación TPV](qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md)
- [Baseline nativo-first PR #548](audits/2026-11-23-native-vs-custom-functionality-matrix.md)
- [Revisión de minimización PR #548](audits/2026-11-23-code-minimization-review.md)
- Auditoría Capa 0: archivo de entrada aportado por el propietario en esta conversación; sus hallazgos se han incorporado y contrastado parcialmente con el SHA main indicado.
