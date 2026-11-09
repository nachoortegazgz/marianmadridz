# DOSSIER TÉCNICO CONSOLIDADO — Entorno QA crado para pruebas y simulacro de despliegue: www.marianmadrid.es

Aquí tienes el **Resumen Ejecutivo Previo** y el **Mapa de Contenidos Estructurado** del Dossier Técnico Consolidado adjunto. Este documento está diseñado para alinear inmediatamente al modelo IA con el contexto, las restricciones y la arquitectura del proyecto `marianmadrid.es`, permitiendo una navegación semántica y técnica precisa.

---

# 1. RESUMEN EJECUTIVO PREVIO: CONTEXTO Y DIRECTRICES DE ROL

### 1.1 Identidad y Misión del Proyecto
*   **Proyecto:** Marian Madrid Peluquería y Estética (`www.marianmadrid.es`).
*   **Naturaleza:** Salón físico en Zaragoza (C/ Maurice Ravel 35) transformado en un punto de venta digital integral mediante Wix Editor + Velo.
*   **Objetivo Técnico:** Implementar una capa propia (CMS + Backend) sobre Wix para cubrir requerimientos no nativos: reservas duales con gap de exposición, ledger fiscal Veri*Factu, cierre Z automatizado, control horario laboral e inventario espejo.
*   **Financiación:** Cofinanciado por Kit Digital (NextGenerationEU). Plazo legal Veri*Factu para autónomos: **1 de julio de 2027**.

### 1.2 Directrices de Fiabilidad y Profesionalidad (SSOT v10.0)
El análisis y cualquier intervención posterior deben regirse estrictamente por estas prioridades inviolables:
1.  **Fiabilidad Absoluta:** Los ledgers fiscales/laborales son *append-only*. Cero tolerancia a pruebas fallidas o despliegues sin rollback.
2.  **Funcionalidad Real:** Prohibido el código especulativo. Solo se implementa lo exigido por ley o negocio hoy.
3.  **Cumplimiento Normativo 100%:** Veri*Factu (Ley 11/2021), PGC, RD 8/2019 (jornada laboral), RGPD/LOPDGDD.
4.  **Mínimo Código:** Lógica en backend (`webMethods`), constantes en `internalConfig.js`, validaciones en `validation.js`. Frontend sin lógica de negocio.
5.  **Cero Complejidad Innecesaria:** Eliminación de abstracciones prematuras, seguridad desproporcionada y deuda técnica.

### 1.3 Metodología de Trabajo y Restricciones Críticas
*   **Arquitectura:** Unidireccional (Frontend → WebMethods → Dominio/Sagas → Seguridad/Validación → Datos/CMS).
*   **Runtime:** Wix Velo Sandbox (Node.js). Prohibido `fs`, `path`, `process.env`. Solo módulos `wix-*` / `@wix/*` y npm whitelist.
*   **Seguridad:** RBAC doble capa (Velo Permissions + `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID` (internalConfig.js)). Secretos en Wix Secrets Manager. HMAC-SHA256 para firma de fichajes laborales; los eventos nativos de Wix se reciben mediante backend/events.js.
*   **Estado Actual del Catálogo:** Wix Stores **Catalog V1** activo. Migración a V3 preparada en código (PR #13) pero **no activada en producción**. Requiere ADR y QA real.
*   **Bookings V2 SDK:** Uso estricto de `resource._id` y `location._id` (SDK JS), no `resource.id` (REST). Documentado en ADR-002.
*   **Colecciones Legacy:** 8 colecciones prohibidas. Cualquier acceso lanza `FISCAL_VIOLATION`.

### 1.4 Estado de Madurez Técnica
*   **Código:** Migración SDK v2 fusionada en `main` (PRs #5, #10, #11, #12, #13, #15). Tests offline verdes (Vitest).
*   **Producción:** **NO CERTIFICADA EN SITIO REAL.** Faltan QA en Local Editor, sincronización Wix CLI y pruebas E2E con datos reales.
*   **Documentación:** Biblia SSOT v10.0 + Anexo Aclaratorio (corrección Catalog V3, MapaStaff como NATIVE #13, enum `CANCELED` con 1 L).

---

# 2. MAPA DE CONTENIDOS DEL DOSSIER TÉCNICO CONSOLIDADO

Aquí tienes el **Mapa de Contenidos Estructurado** diseñado para insertarse inmediatamente después de la definición de rol y directrices básicas. Este mapa actúa como índice semántico y técnico para que el modelo IA (o cualquier auditor humano) localice instantáneamente cualquier dato, restricción o contrato dentro del Dossier Técnico Consolidado.

---

Este mapa permite la navegación semántica y técnica precisa por las 4 capas del sistema Marian Madrid. Úsalo como referencia cruzada antes de responder cualquier consulta técnica, normativa u operativa.

### BLOQUE A: IDENTIDAD, CONTEXTO Y DIRECTRICES (Capítulos 1–3)
*Define QUIÉN es el sistema, QUÉ restricciones tiene y BAJO QUÉ reglas se toman decisiones.*

| Capítulo | Título | Contenido Clave y Datos de Búsqueda Rápida |
| :--- | :--- | :--- |
| **1** | Identidad y Contexto | • Site ID: `188bed94-...874f3e` · Location ID: `7a12abfd-...573d4802`<br>• Staff Resource Type ID: `1cd44cf8-...1155`<br>• Personal: Marian (ADMIN), Andrea/Alba (ESTILISTA)<br>• Wix App IDs oficiales (Bookings, Stores, Members, Invoices, etc.)<br>• Dominio, repositorio Git, zona horaria, moneda, idioma |
| **2** | Stack Técnico y Runtime | • Tabla de tecnologías (Wix Editor, Velo Sandbox, MongoDB, Vitest, Wix CLI)<br>• Restricciones Velo: whitelist npm, prohibido `fs`/`path`/`process.env`<br>• APIs canónicas: Bookings V2, Stores V1, Cart V2 (Feb 2027), `elevate()`<br>• Módulos permitidos vs. prohibidos |
| **3** | Principios SSOT y Prioridades | • 5 Prioridades inviolables (Fiabilidad > Funcionalidad > Normativa > Mínimo Código > Cero Complejidad)<br>• Anti-patrones prohibidos (10 prácticas)<br>• Flujo de evaluación de decisiones (6 pasos)<br>• Principios operativos: SSOT, CMS autoridad, append-only, aislamiento frontend-backend |

### BLOQUE B: ARQUITECTURA Y MODELO DE DATOS (Capítulos 4–7)
*Define CÓMO se estructura el sistema, QUÉ datos gestiona y QUÉ contratos aplica.*

| Capítulo | Título | Contenido Clave y Datos de Búsqueda Rápida |
| :--- | :--- | :--- |
| **4** | Arquitectura del Sistema | • Diagrama de capas unidireccional (Frontend → WebMethods → Dominio → Seguridad → Datos)<br>• Estructura de directorios `backend/` y `public/` (22 módulos)<br>• Reglas de dependencia entre capas<br>• Uso restringido de `elevate()` |
| **5** | Modelo de Reservas | • Contratos Bookings V2: `timeZone` vs `timezone`, `BUSINESS` vs `OWNER_BUSINESS`<br>• Reserva Simple: flujo end-to-end con revalidación en servidor<br>• Reserva Dual (F1+F2): `pairToken`, gap de exposición, saga de compensación<br>• `FlowControlSettings`: `skipAvailabilityValidation`, `skipBusinessConfirmation`<br>• Duraciones desglosadas: `phase1Duration + exposureDuration + phase2Duration` |
| **6** | Modelo CMS | • 13 Colecciones NATIVE (tabla con tipo, rol y protección)<br>• 20 Colecciones WIX_APP (solo lectura)<br>• 8 Colecciones Legacy PROHIBIDAS (`FISCAL_VIOLATION`)<br>• Protecciones append-only (`beforeUpdate`/`beforeRemove`)<br>• Invariantes de integridad (hash chain, partida doble, stock, duración)<br>• Campos canónicos transversales (21 campos clave)<br>• Reglas N1-N5 de nomenclatura |
| **7** | Enums Canónicos | • Wix nativos (inglés): `BOOKING_STATUS_WIX`, `PAYMENT_STATUS_WIX`<br>• CMS: `BOOKING_STATUS_CMS` (`CANCELED` 1L), `BOOKING_TYPE`<br>• Negocio (español): `MOVEMENT_TYPE`, `TIPO_IMPOSITIVO`, `ROL_WEBSITE`, `CLOCK_EVENT_TYPE`, etc.<br>• Addons: `addonId` (singular PK) vs `addOnIds` (array transporte)<br>• Validación obligatoria: `assertValidEnum()` |

### BLOQUE C: SEGURIDAD, INTEGRACIONES Y BACKEND (Capítulos 8–12)
*Define QUÉ protege el sistema, CON QUÉ se conecta y QUÉ lógica ejecuta.*

| Capítulo | Título | Contenido Clave y Datos de Búsqueda Rápida |
| :--- | :--- | :--- |
| **8** | Seguridad y Permisos | • RBAC doble capa: Velo Permissions + `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID` (internalConfig.js)<br>• Roles: ADMIN / GESTION / ESTILISTA<br>• Secretos en Wix Secrets Manager (`mmSecrets.js`)<br>• HMAC-SHA256 de fichajes laborales; sin middleware X-MM anti-replay activo<br>• Rate limiting por surface (public-booking, reservas, availability, display-token)<br>• Minimización PII: enmascaramiento en logs, exclusión datos tarjeta<br>• Eventos backend Bookings gestionados por Wix + deduplicación `eventId` |
| **9** | Integraciones | • Apps Wix nativas: reglas por app (Bookings V2, Stores V1, eCom Cart V2)<br>• Externas: Resend (email), OpenAI (IA), Wix Payments (proveedor nativo de pagos), IONOS (DNS/correo), M365 (custodia)<br>• Gestión colecciones WIX_APP: solo lectura, mutación vía SDK oficial<br>• Prohibición de llamadas externas desde frontend |
| **10** | Backend: Módulos y Hooks | • Catálogo completo de 18 WebMethods con permisos Velo y rol negocio<br>• Flujos críticos: venta online, cancelaciones, cierre Z nocturno<br>• Hooks CMS por colección (`data.js`): validaciones beforeInsert/beforeUpdate<br>• Helpers: `mmUtils.js`, `securityEngine.js`, `validation.js`, `widgetBridge.js` |
| **11** | Jobs y Webhooks | • 8 crons en `jobs.config` (tabla con frecuencia, dominio y operación)<br>• Webhooks Bookings V2: 5 eventos + procesamiento seguro idempotente<br>• Webhooks eCommerce: independientes de V1/V3<br>• Catalog V3 webhooks: pendientes (Developer Preview, no activar sin ADR)<br>• Reglas invariables: jobs nunca escriben directo en append-only |
| **12** | Estándares de Código | • Reglas N1-N5 detalladas con ejemplos<br>• G10 ASCII Strict (ñ permitida en términos españoles canónicos)<br>• Convenciones enums y códigos de error estandarizados<br>• Plantilla cabecera módulo (@module, @version, @apis, @changelog)<br>• Reglas "Cero Deuda" v1.0: cero alias, cero legacy silencioso, cero deprecated |

### BLOQUE D: NORMATIVA, CAPA 3, REFERENCIAS Y ANEXO DE FLUJOS (Capítulos 13–14 + Anexos)
*Define QUÉ cumplimiento legal garantiza, CÓMO se entrega al gestor y DÓNDE verificar fuentes.*

| Capítulo | Título | Contenido Clave y Datos de Búsqueda Rápida |
| :--- | :--- | :--- |
| **13** | Normativa Aplicable | • Fiscal: Ley 11/2021 Veri*Factu, RD 1007/2023, RD 1619/2012, Ley 37/1992 IVA<br>• Contable: PGC RD 1514/2007 (partida doble, cuentas 6 dígitos)<br>• Laboral: RD 8/2019 registro horario inalterable 4 años<br>• Privacidad: RGPD/LOPDGDD, LGT 58/2003, LSSI-CE, RD 253/2025 Bizum<br>• Matriz consolidada de cumplimiento con estado y evidencia |
| **14** | Glosario e Identificadores | • IDs inmutables sitio/ubicación/personal<br>• Resumen colecciones (13 NATIVE, 20 WIX_APP, 8 legacy)<br>• 21 campos canónicos críticos con función<br>• Librerías helpers y catálogo WebMethods<br>• 21 códigos de error estandarizados<br>• Fuentes oficiales Wix Developers y marco legal español |
| **ANEXO A** | Capa 3: Modelo Simplificado Gestor | • Filosofía: "Tú trabajas, el sistema recopila, el gestor organiza"<br>• 4 carpetas de Marian: VENTAS (auto), GASTOS (manual), BANCO (manual), PERSONAL (auto)<br>• Rutina mensual: ~20 min/mes<br>• Entrega trimestral: paquete cerrado día 15 post-trimestre<br>• Checklist trimestral de verificación |
| **ANEXO B** | Solución Técnica Capa 3 Automatizada | • Patrón email estructurado: Wix → Resend → Power Automate → SharePoint<br>• Conectores estándar M365 Business Standard (sin Premium)<br>• Módulo `backend/exports/exportService.js` + 4 crons de export<br>• 7 flujos Power Automate (PA-01 a PA-07)<br>• Estructura SharePoint: 7 carpetas principales + subcarpetas anuales<br>• Permisos: Marian (Full Control), GestorAquí tienes el **Mapa de Contenidos Estructurado** diseñado para insertarse inmediatamente después de la definición de rol y directrices básicas. Este mapa actúa como índice semántico y técnico para que el modelo IA (o cualquier auditor humano) localice instantáneamente cualquier dato, restricción o contrato dentro del Dossier Técnico Consolidado.
| **ANEXO FLUJOS CAPA 3** | Detalle del End-to-End de los datos desde sitio wix a registro externo organizado  |

---

## MAPA DE CONTENIDOS ESTRUCTURADO — DOSSIER TÉCNICO CONSOLIDADO

Este mapa permite la navegación semántica y técnica precisa por las 4 capas del sistema Marian Madrid. Úsalo como referencia cruzada antes de responder cualquier consulta técnica, normativa u operativa.

### BLOQUE A: IDENTIDAD, CONTEXTO Y DIRECTRICES (Capítulos 1–3)
*Define QUIÉN es el sistema, QUÉ restricciones tiene y BAJO QUÉ reglas se toman decisiones.*

| Capítulo | Título | Contenido Clave y Datos de Búsqueda Rápida |
| :--- | :--- | :--- |
| **1** | Identidad y Contexto | • Site ID: `188bed94-...874f3e` · Location ID: `7a12abfd-...573d4802`<br>• Staff Resource Type ID: `1cd44cf8-...1155`<br>• Personal: Marian (ADMIN), Andrea/Alba (ESTILISTA)<br>• Wix App IDs oficiales (Bookings, Stores, Members, Invoices, etc.)<br>• Dominio, repositorio Git, zona horaria, moneda, idioma |
| **2** | Stack Técnico y Runtime | • Tabla de tecnologías (Wix Editor, Velo Sandbox, MongoDB, Vitest, Wix CLI)<br>• Restricciones Velo: whitelist npm, prohibido `fs`/`path`/`process.env`<br>• APIs canónicas: Bookings V2, Stores V1, Cart V2 (Feb 2027), `elevate()`<br>• Módulos permitidos vs. prohibidos |
| **3** | Principios SSOT y Prioridades | • 5 Prioridades inviolables (Fiabilidad > Funcionalidad > Normativa > Mínimo Código > Cero Complejidad)<br>• Anti-patrones prohibidos (10 prácticas)<br>• Flujo de evaluación de decisiones (6 pasos)<br>• Principios operativos: SSOT, CMS autoridad, append-only, aislamiento frontend-backend |

### BLOQUE B: ARQUITECTURA Y MODELO DE DATOS (Capítulos 4–7)
*Define CÓMO se estructura el sistema, QUÉ datos gestiona y QUÉ contratos aplica.*

| Capítulo | Título | Contenido Clave y Datos de Búsqueda Rápida |
| :--- | :--- | :--- |
| **4** | Arquitectura del Sistema | • Diagrama de capas unidireccional (Frontend → WebMethods → Dominio → Seguridad → Datos)<br>• Estructura de directorios `backend/` y `public/` (22 módulos)<br>• Reglas de dependencia entre capas<br>• Uso restringido de `elevate()` |
| **5** | Modelo de Reservas | • Contratos Bookings V2: `timeZone` vs `timezone`, `BUSINESS` vs `OWNER_BUSINESS`<br>• Reserva Simple: flujo end-to-end con revalidación en servidor<br>• Reserva Dual (F1+F2): `pairToken`, gap de exposición, saga de compensación<br>• `FlowControlSettings`: `skipAvailabilityValidation`, `skipBusinessConfirmation`<br>• Duraciones desglosadas: `phase1Duration + exposureDuration + phase2Duration` |
| **6** | Modelo CMS | • 13 Colecciones NATIVE (tabla con tipo, rol y protección)<br>• 20 Colecciones WIX_APP (solo lectura)<br>• 8 Colecciones Legacy PROHIBIDAS (`FISCAL_VIOLATION`)<br>• Protecciones append-only (`beforeUpdate`/`beforeRemove`)<br>• Invariantes de integridad (hash chain, partida doble, stock, duración)<br>• Campos canónicos transversales (21 campos clave)<br>• Reglas N1-N5 de nomenclatura |
| **7** | Enums Canónicos | • Wix nativos (inglés): `BOOKING_STATUS_WIX`, `PAYMENT_STATUS_WIX`<br>• CMS: `BOOKING_STATUS_CMS` (`CANCELED` 1L), `BOOKING_TYPE`<br>• Negocio (español): `MOVEMENT_TYPE`, `TIPO_IMPOSITIVO`, `ROL_WEBSITE`, `CLOCK_EVENT_TYPE`, etc.<br>• Addons: `addonId` (singular PK) vs `addOnIds` (array transporte)<br>• Validación obligatoria: `assertValidEnum()` |

### BLOQUE C: SEGURIDAD, INTEGRACIONES Y BACKEND (Capítulos 8–12)
*Define QUÉ protege el sistema, CON QUÉ se conecta y QUÉ lógica ejecuta.*

| Capítulo | Título | Contenido Clave y Datos de Búsqueda Rápida |
| :--- | :--- | :--- |
| **8** | Seguridad y Permisos | • RBAC doble capa: Velo Permissions + `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID` (internalConfig.js)<br>• Roles: ADMIN / GESTION / ESTILISTA<br>• Secretos en Wix Secrets Manager (`mmSecrets.js`)<br>• HMAC-SHA256 de fichajes laborales; sin middleware X-MM anti-replay activo<br>• Rate limiting por surface (public-booking, reservas, availability, display-token)<br>• Minimización PII: enmascaramiento en logs, exclusión datos tarjeta<br>• Eventos backend Bookings gestionados por Wix + deduplicación `eventId` |
| **9** | Integraciones | • Apps Wix nativas: reglas por app (Bookings V2, Stores V1, eCom Cart V2)<br>• Externas: Resend (email), OpenAI (IA), Wix Payments (proveedor nativo de pagos), IONOS (DNS/correo), M365 (custodia)<br>• Gestión colecciones WIX_APP: solo lectura, mutación vía SDK oficial<br>• Prohibición de llamadas externas desde frontend |
| **10** | Backend: Módulos y Hooks | • Catálogo completo de 18 WebMethods con permisos Velo y rol negocio<br>• Flujos críticos: venta online, cancelaciones, cierre Z nocturno<br>• Hooks CMS por colección (`data.js`): validaciones beforeInsert/beforeUpdate<br>• Helpers: `mmUtils.js`, `securityEngine.js`, `validation.js`, `widgetBridge.js` |
| **11** | Jobs y Webhooks | • 8 crons en `jobs.config` (tabla con frecuencia, dominio y operación)<br>• Webhooks Bookings V2: 5 eventos + procesamiento seguro idempotente<br>• Webhooks eCommerce: independientes de V1/V3<br>• Catalog V3 webhooks: pendientes (Developer Preview, no activar sin ADR)<br>• Reglas invariables: jobs nunca escriben directo en append-only |
| **12** | Estándares de Código | • Reglas N1-N5 detalladas con ejemplos<br>• G10 ASCII Strict (ñ permitida en términos españoles canónicos)<br>• Convenciones enums y códigos de error estandarizados<br>• Plantilla cabecera módulo (@module, @version, @apis, @changelog)<br>• Reglas "Cero Deuda" v1.0: cero alias, cero legacy silencioso, cero deprecated |

### BLOQUE D: NORMATIVA, CAPA 3 Y REFERENCIAS (Capítulos 13–14 + Anexos)
*Define QUÉ cumplimiento legal garantiza, CÓMO se entrega al gestor y DÓNDE verificar fuentes.*

| Capítulo | Título | Contenido Clave y Datos de Búsqueda Rápida |
| :--- | :--- | :--- |
| **13** | Normativa Aplicable | • Fiscal: Ley 11/2021 Veri*Factu, RD 1007/2023, RD 1619/2012, Ley 37/1992 IVA<br>• Contable: PGC RD 1514/2007 (partida doble, cuentas 6 dígitos)<br>• Laboral: RD 8/2019 registro horario inalterable 4 años<br>• Privacidad: RGPD/LOPDGDD, LGT 58/2003, LSSI-CE, RD 253/2025 Bizum<br>• Matriz consolidada de cumplimiento con estado y evidencia |
| **14** | Glosario e Identificadores | • IDs inmutables sitio/ubicación/personal<br>• Resumen colecciones (13 NATIVE, 20 WIX_APP, 8 legacy)<br>• 21 campos canónicos críticos con función<br>• Librerías helpers y catálogo WebMethods<br>• 21 códigos de error estandarizados<br>• Fuentes oficiales Wix Developers y marco legal español |
| **ANEXO A** | Capa 3: Modelo Simplificado Gestor | • Filosofía: "Tú trabajas, el sistema recopila, el gestor organiza"<br>• 4 carpetas de Marian: VENTAS (auto), GASTOS (manual), BANCO (manual), PERSONAL (auto)<br>• Rutina mensual: ~20 min/mes<br>• Entrega trimestral: paquete cerrado día 15 post-trimestre<br>• Checklist trimestral de verificación |
| **ANEXO B** | Solución Técnica Capa 3 Automatizada | • Patrón email estructurado: Wix → Resend → Power Automate → SharePoint<br>• Conectores estándar M365 Business Standard (sin Premium)<br>• Módulo `backend/exports/exportService.js` + 4 crons de export<br>• 7 flujos Power Automate (PA-01 a PA-07)<br>• Estructura SharePoint: 7 carpetas principales + subcarpetas anuales<br>• Permisos: Marian (Full Control), Gestor (Read), Staff (Sin acceso)<br>• Cumplimiento normativo mapeado |
| **ANEXO C** | Guía Práctica Implementación Capa 3 | • Paso a paso para amateurs: Fase 1 (SharePoint) → Fase 2 (Power Automate) → Fase 3 (Email) → Fase 4 (Pruebas) → Fase 5 (Rutina) → Fase 6 (Entrega) → Fase 7 (Copilot)<br>• Solución de problemas comunes (6 escenarios)<br>• Glosario para Marian (14 términos en lenguaje sencillo)<br>• Tiempo total: 3-4 horas implementación + 20 min/mes operación |

### ⚠️ NOTAS CRÍTICAS TRANSVERSALES (Vigentes en todo el dossier)

| Nota | Detalle | Impacto |
| :--- | :--- | :--- |
| **Catalog V3 prioritario** | La migración es prioritaria (contradice SSOT original §16.4). Código tiene adaptador dual (PR #13), sitio sigue en V1. Requiere ADR y QA real. | No escribir código nuevo asumiendo V1 permanente |
| **MapaStaff NATIVE #13** | Ya incorporada al inventario CMS. Pendiente ADR sobre campos `staffMemberId` y `active`. | Verificar esquema vivo antes de modificar |
| **Enum `CANCELED` = 1L** | Canon Wix oficial. El comentario "doble L" en SSOT §8.2 es erróneo. | Usar siempre `CANCELED` (una L) en código |
| **`UPDATED` ≠ estado** | Es tipo de evento webhook, NO estado de reserva. Eliminar del enum de estados. | No persistir `UPDATED` como bookingStatus |
| **Bookings V2 SDK ≠ REST** | SDK usa `resource._id` / `location._id`; REST usa `.id`. Documentado en ADR-002. | Verificar contexto (SDK vs REST) antes de acceder |
| **Lockfile desincronizado** | `wix.lock` no refleja `@wix/stores` ni `@wix/site-pricing-plans`. Requiere `wix install` local con Node ≥24.22.1. | No publicar sin reconciliar lockfile |
| **Producción NO certificada** | Código fusionado en `main`, tests offline verdes. Faltan QA Local Editor, sync Wix CLI y pruebas E2E reales. | No asumir funcionamiento en sitio publicado |

---

### INSTRUCCIONES DE USO DEL MAPA

1.  **Antes de responder cualquier consulta:** Localiza el capítulo/anexo relevante en este mapa.
2.  **Para consultas técnicas:** Cruza Bloque B (modelo datos) + Bloque C (backend/seguridad).
3.  **Para consultas normativas:** Consulta Bloque D cap. 13 + matriz de cumplimiento.
4.  **Para consultas operativas de Marian:** Consulta exclusivamente Anexo A + Anexo C.
5.  **Para implementaciones nuevas:** Verifica primero las Notas Críticas Transversales antes de escribir código.
6.  **Para entregas al gestor:** Sigue estrictamente el flujo del Anexo B (solución técnica) + Anexo C (guía práctica).


## 1. Identidad y contexto del proyecto

Marian Madrid Peluquería y Estética es un salón físico en Zaragoza que opera como punto de venta completo: agenda online, cobro presencial y online, facturación legal, control horario y stock. El ecosistema técnico se construye sobre Wix Editor con Velo, añadiendo una capa propia (CMS + backend) para los requerimientos no cubiertos de forma nativa.

### Identificadores canónicos (inmutables)

| Campo | Valor |
| --- | --- |
| Site ID | `188bed94-177c-4bc9-a9f0-35080d874f3e` |
| Location ID (`LOCATION_ID`) | `7a12abfd-bf30-4847-bcdf-00dc573d4802` |
| Staff Resource Type ID | `1cd44cf8-756f-41c3-bd90-3e2ffcaf1155` |
| Dominio | `https://www.marianmadrid.es` |
| Repositorio | `https://github.com/nachoortegazgz/marianmadridz` |
| Dirección | C/ Maurice Ravel 35, Local — 50012 Zaragoza |
| Zona horaria | `Europe/Madrid` |
| Moneda | `EUR` (2 decimales) |
| Idioma | `es-ES` |
| Correo negocio | `hola@marianmadrid.es` |

### Personal y roles

| Nombre | `resourceId` (Bookings) | `rolWebsite` |
| --- | --- | --- |
| Marian Madrid | `e556070a-6d6a-402e-8422-11133033ea76` | `ADMIN` |
| Andrea Staff | `07f7344f-e7e4-4c53-854b-47fd82ac8d40` | `ESTILISTA` |
| Alba Staff | `9b905bfd-1a09-485d-9273-a24a20dfe648` | `ESTILISTA` |

`rolBookings` es siempre `STAFF` para todos en la API nativa de Wix. `thirdPartyId` permanece vacío hasta vincular fichas fiscales en `DatosFiscales`; prohibido rellenar por inferencia.

### Wix App IDs oficiales

| App | App ID |
| --- | --- |
| Wix Bookings | `13d21c63-b5ec-5912-8397-c3a5ddb27a97` |
| Wix Stores | `215238eb-22a5-4c36-9e7b-e7c08025e04e` |
| Wix Members | `14cc59bc-f0b7-15b8-e1c7-89ce41d0e0c9` |
| Wix Forms & Payments | `14ce1214-b278-a7e4-1373-00cebd1bef7c` |
| Wix Invoices | `13ee94c1-b635-8505-3391-97919052c16f` |
| Wix Gift Cards | `d80111c5-a0f4-47a8-b63a-65b54d774a27` |
| Wix Events | `140603ad-af8d-84fb-9004-ee174e35054d` |

## 2. Stack técnico y restricciones del runtime

El proyecto corre íntegramente en la infraestructura de Wix. No es multi-tenant, no es SaaS y no escala horizontalmente por encima de la infraestructura propia de Wix.

### Plataforma y herramientas

| Capa | Tecnología |
| --- | --- |
| Editor y hosting | Wix Editor / Studio (cloud, SSL/HTTPS automático) |
| Runtime backend | Node.js en sandbox Velo / Wix JavaScript SDK v2 |
| Capa de datos | Wix CMS (respaldado internamente por MongoDB) |
| Frontend | SDK client-side `$w` + widgets HTML vía `postMessage` |
| Pruebas unitarias | Vitest con mocks de Wix APIs |
| Control de código | Git + Wix CLI (`wix dev`) |
| Secretos | Wix Secrets Manager |

### Restricciones del runtime Velo

- **Módulos permitidos**: exclusivamente módulos `wix-*` / `@wix/*` y librerías de npm incluidas en la whitelist de Velo.
- **Prohibido**: `process.env`, módulos del core de Node.js con acceso a sistema de archivos (`fs`, `path`) o procesos nativos, comandos de terminal.
- **Comunicaciones salientes**: únicamente `wix-fetch` / `wix-http-functions`. Las claves de servicios externos se almacenan en el Secrets Manager de Wix y nunca llegan al cliente.
- **Restricción de colecciones `WIX_APP`**: solo lectura desde código propio; toda mutación se realiza a través del SDK oficial de la App correspondiente.

### APIs y versiones canónicas

| Módulo | API objetivo | Restricción |
| --- | --- | --- |
| Bookings | `@wix/bookings` V2 | V1 prohibida |
| Stores catálogo | Catalog V1 | migración en pausa temporal a Catalog V3. Avisar cuando sea recomendable |
| eCommerce | `@wix/ecom` Cart V2 | Migración Cart V2 — plazo Feb 2027 |
| Datos / CMS | `@wix/data` | `suppressAuth` sustituido por `elevate()` |
| Members | `@wix/members` | Migración gradual desde `wix-members-backend` |
| Secretos | `@wix/secrets` | Centralizado en `mmSecrets.js` |
| Elevación | `elevate()` de `@wix/essentials` | Uso restringido; ver sección 8 |
| Frontend / routing | `$w`, `wix-location`, `wix-window` | Permanecen en Velo sin sustituto SDK |

## 3. Principios SSOT y prioridades de diseño

Cada decisión de diseño se evalúa en este orden estricto. La prioridad de menor número prevalece siempre en caso de conflicto.

### Las cinco prioridades (orden inviolable)

1. **Fiabilidad** — Ninguna fase se cierra con pruebas fallidas. Los ledgers fiscales y laborales son inmutables por diseño (append-only); no se modifican ni eliminan, solo se corrigen mediante registros rectificativos que enlazan al anterior.
2. **Funcionalidad real** — Solo se implementa lo que el negocio requiere hoy. Prohibido el código especulativo o colecciones/módulos sin consumidor confirmado.
3. **Cumplimiento normativo 100%** — Sin excepciones en los ámbitos fiscal (Veri\*Factu, RD 1007/2023), contable (PGC), laboral (RD 8/2019) y privacidad (RGPD/LOPDGDD).
4. **Mínimo código** — El frontend no contiene lógica de negocio. Las constantes residen en `backend/internalConfig.js`, las validaciones en `backend/validation.js` y los hooks CMS en `backend/data.js`.
5. **Cero complejidad innecesaria** — Eliminar funciones sobredimensionadas, comprobaciones redundantes, mecanismos de seguridad desproporcionados para operaciones internas, y ramas para casos hipotéticos.

### Anti-patrones prohibidos

- Duplicar validaciones entre frontend y backend.
- Añadir flags de configuración o campos sin consumidor activo.
- Mantener colecciones o módulos helper de un único uso.
- Aplicar seguridad desproporcionada en rutas internas o abstracciones prematuras para cambio de proveedor.
- Logs de depuración permanentes, código comentado o comentarios que explican el "qué" en vez del "por qué".
- Reescribir código funcional por razones estéticas.

### Principios operativos fundamentales

- **Una sola fuente de verdad (SSOT)**: cada constante, tipo o schema vive en un único lugar.
- **El CMS como autoridad**: Wix Bookings, Members y Stores dictan sus contratos; el código se adapta.
- **Ledgers inmutables**: `MovimientosCaja`, `LibroAsientosContablesDetalle`, `RegistrosHorariosStaff` y `MovimientosInventario` son estrictamente append-only.
- **Aislamiento frontend-backend**: la interfaz invoca únicamente `webMethods` expuestos; nunca accede directamente al CMS.
- **Validación en runtime**: todo enum persistido se valida obligatoriamente mediante `assertValidEnum()` en `backend/validation.js`.
- **Trazabilidad**: `traceId` (UUID v4) en toda mutación transaccional; claves en `backend/mmSecrets.js`; minimización estricta de PII.


## 4. Arquitectura del sistema y capas

El flujo de comunicación es unidireccional y estricto. Ninguna capa puede saltarse la inmediatamente inferior.

```
Frontend ($w / HTML widgets)
    ↓  invoca webMethods publicados
Fachada WebMethods (*.web.js)
    ↓  delega en orquestadores de dominio
Dominio y Sagas (bookingSaga, bookingCore, staff…)
    ↓  usa capas transversales
Seguridad + Validación (securityEngine.js, validation.js)
    ↓  accede a datos
Capa de Datos — SDK @wix/data + APIs Wix (Bookings, Members, eCommerce)
```

### Estructura de directorios de referencia

| Ruta | Responsabilidad |
| --- | --- |
| `backend/internalConfig.js` | Constantes canónicas (SSOT de código) |
| `backend/validation.js` | Validación runtime centralizada |
| `backend/data.js` | Hooks CMS (integridad + append-only) |
| `backend/logger.js` | Logging estructurado con enmascaramiento PII |
| `backend/mmSecrets.js` | Catálogo de nombres de secretos |
| `backend/responseUtils.js` | Normalización de respuestas DTO |
| `backend/security.js` | Autenticación, RBAC y control de acceso |
| `backend/securityEngine.js` | Criptografía: SHA-256, HMAC, JWT |
| `backend/staff.js` | Resolución y filtrado de personal |
| `backend/booking/bookingCore.js` | Primitivas: locks, persistencia y elevación |
| `backend/booking/bookingSaga.js` | Orquestador transaccional (Simple + Dual F1+F2) |
| `backend/reservas.web.js` | Consulta pública de disponibilidad y catálogo |
| `backend/citasManager.web.js` | Gestión de reservas duales, pagos y reprogramación |
| `backend/cajas.web.js` | Ledger fiscal Veri\*Factu, caja y cierre Z |
| `backend/inventario.web.js` | Control de stock y reconciliación |
| `backend/horario.web.js` | Fichajes laborales y cálculo de jornada |
| `backend/fiscalAggregator.web.js` | Agregación de impuestos y libros de facturas |
| `backend/fiscalDocuments.web.js` | Generación de paquetes documentales para gestoría |
| `backend/events.js` | Procesador de webhooks (Bookings, eCom) |
| `backend/crons.js` | Implementación de tareas programadas |
| `backend/jobs.config` | Configuración de crons |
| `public/mmUtils.js` | Utilidades client-side: formato, zona horaria, PII |
| `public/widgetBridge.js` | Protocolo postMessage entre páginas Velo y widgets HTML |

### Reglas de dependencia entre capas

- El frontend consume contratos publicados por webMethods; nunca importa lógica privada del backend.
- Los módulos de dominio coordinan operaciones y no duplican directamente reglas de proveedores.
- El acceso a CMS debe pasar por las abstracciones del proyecto cuando existan.
- Los webhooks y jobs deben ser idempotentes y tolerar reintentos.
- `elevate()` se usa solo para operaciones de sistema con justificación explícita (ver sección 8).

## 5. Modelo de reservas: simple y dual

Todos los servicios son de tipo `APPOINTMENT`. No se usan tipos `CLASS` ni `COURSE`. La arquitectura distingue dos flujos de reserva según si el servicio tiene o no fases con gap de exposición.

### Contratos críticos de Bookings V2

La API Bookings V2 tiene diferencias explícitas de capitalización según el método:

| Operación | Parámetro zona horaria | `locationType` |
| --- | --- | --- |
| Consulta disponibilidad (`listAvailabilityTimeSlots`) | `timeZone` (Z mayúscula) | `"BUSINESS"` |
| Creación de reserva (`createBooking`) | `timezone` (todo minúsculas) | `"OWNER_BUSINESS"` |

Estas diferencias son intencionadas en la API de Wix y deben respetarse exactamente.

### Reserva simple - Proceso alineado con flujo nativo de wix bookings

1. Frontend solicita servicios y disponibilidad via webMethods públicos.
2. Backend consulta slots nativos de Bookings (`listAvailabilityTimeSlots`, `locationType: "BUSINESS"`).
3. En la operación de creación, el servidor revalida la disponibilidad del slot exacto.
4. `backend/staff.js` resuelve y asigna explícitamente un `resourceId` y `scheduleId`.
5. Se crea la reserva nativa (`createBooking`, `locationType: "OWNER_BUSINESS"`).
6. `bookingCore.js` inserta en `CitasF2` con `bookingStatus = "PENDING"`, `paymentStatus = "NOT_PAID"`, `bookingType = "SIMPLE"` y un `traceId` UUID v4.
7. Si hay pago previo, se redirige al checkout eCom; el webhook confirma el estado final.

La disponibilidad mostrada al usuario no garantiza que el slot siga libre al confirmar. La revalidación es obligatoria en servidor.

### Reserva dual con gap de exposición (F1 + F2) - proceso con algoritmo dual gestionando las 2 fases del servicio como 2 reservas simples

**Prohibición absoluta**: no usar `createMultiServiceBooking`. La API nativa Multiservice exige secuencia sin ningún hueco; el gap de exposición requiere otro enfoque.

La arquitectura DUAL implementa dos llamadas independientes a `createBooking` vinculadas por un `pairToken` (UUID v4):

- **F1** (`bookingType = "DUAL_F1"`): fase de aplicación. Lleva el importe total del servicio.
- **F2** (`bookingType = "DUAL_F2"`): fase de lavado/peinado. `totalAmount = 0`; usa metadata booleana `noFee: true` y envía `selectedPaymentOption: BOOKING_PAYMENT_OPTION.OFFLINE`. El Writer se invoca sin opciones de bypass (`undefined`), por lo que Wix conserva sus validaciones nativas de disponibilidad y de opción de pago. El mutex `SLOT_LOCK` es coordinación adicional; no sustituye la validación final de Bookings.
- Ambas comparten el mismo `pairToken` en `CitasF2` y `ControlOperativo`.

**Cálculo temporal**:

```
InicioF2 = InicioF1 + phase1Duration + exposureDuration
```

**Saga de compensación**: si la creación de F2 o su persistencia fallan, el backend ejecuta `cancelBooking` sobre F1 y registra el evento en `ControlOperativo`. El proceso es idempotente: reintentos deben producir el mismo resultado final.

### Configuración de FlowControlSettings

| Parámetro | Uso |
| --- | --- |
| `skipAvailabilityValidation: true` | No se usa en la saga dual vigente; F1 y F2 conservan la validación nativa de disponibilidad de Wix. |
| `skipBusinessConfirmation: true` | Confirma automáticamente reservas con pago online validado |
| `skipSelectedPaymentOptionValidation: true` | No se usa en la saga dual vigente; F2 envía la opción offline configurada. |

### Duración desglosada (campo `ServiciosCatalogo`)

| Campo | Descripción |
| --- | --- |
| `phase1Duration` | Minutos de trabajo inicial (F1) |
| `exposureDuration` | Minutos de espera/gap (profesional libre) |
| `phase2Duration` | Minutos de trabajo final (F2) |
| `totalDuration` | Suma estricta de los tres anteriores |
| `linkedPhases` | GUID del servicio F2 en Wix Bookings |
| `allowCombine` | Boolean: habilita la reserva dual en UI |
| `clientHidden` | Boolean: oculta F2 del catálogo público |

### Nomenclatura de keyfields (reglas N1–N5)

Estas reglas se aplican a los KEYFIELDs y a las ETIQUETAS VISIBLES de los campos de todas las colecciones CMS. La nomenclatura debe ser consistente entre CMS, backend, frontend, WebMethods y webhooks.

- **N1 — KEYFIELDs en camelCase:** todos los KEYFIELDs se escriben en `camelCase`. Se conservan los nombres técnicos nativos de Wix en inglés cuando exista un identificador nativo (`bookingId`, `serviceId`, `resourceId`, `slug`). Cuando no exista un ID nativo, se utilizan las denominaciones normalizadas aplicables de AEAT y PGC en español, según corresponda (`numSerieFactura`, `taxBase`, `tipoImpositivo`).
- **N2 — IDs nativos y siglas:** los IDs técnicos nativos de Wix se mantienen exactamente en inglés, sin traducirlos. Las siglas integradas en un KEYFIELD se escriben en mayúsculas, manteniendo la estructura camelCase (`payloadAEAT`).
- **N3 — Traducción de etiquetas técnicas visibles:** las etiquetas visibles que representen KEYFIELDs se expresan en español y en `camelCase`, conservando el orden de los términos del KEYFIELD original. Se traduce el término cuando corresponda (`serviceId` → `servicioId`), pero no se traducen los anglicismos aceptados por el proyecto (`staff`).
- **N4 — Identificación inequívoca para el usuario:** cada etiqueta visible debe permitir identificar el dato que contiene, estar redactada en español y seguir `camelCase`. La etiqueta visible no sustituye ni modifica el KEYFIELD técnico.
- **N5 — ENUMS:** cuando un campo tenga un conjunto cerrado de opciones seleccionables, debe definirse y documentarse como ENUM, explicando previamente qué representa el dato y enumerando después sus valores permitidos. Los valores persistidos deben respetar el enum canónico correspondiente.

**Estructura obligatoria para documentar los campos de una colección:**

| KEYFIELD | ETIQUETA VISIBLE | Tipo | Dato que contiene e información relevante |
| --- | --- | --- | --- |
| `traceId` | `trazaId` | TEXT UUID v4 | Trazabilidad end-to-end. Obligatorio en toda escritura. |

## 6. Modelo CMS: colecciones, keyfields e integridad

El CMS propio tiene **13 colecciones NATIVE** activas. Las 20 colecciones `WIX_APP` son de estricta lectura. Las 8 colecciones legacy están prohibidas; cualquier acceso a ellas lanza `FISCAL_VIOLATION`.

### Colecciones NATIVE (autoridad del negocio)

| Colección | Tipo | Rol |
| --- | --- | --- |
| `DatosFiscales` | MASTER mutable | Maestro de terceros + singleton `CONFIG_SISTEMA` Veri\*Factu |
| `CajaActual` | SINGLETON mutable | Estado en tiempo real del cajón físico |
| `MovimientosCaja` | LEDGER append-only | Registro fiscal inalterable (Veri\*Factu) |
| `CitasF2` | LEDGER con updates controlados | Proyección interna de reservas |
| `LibroAsientosContablesDetalle` | LEDGER append-only | Contabilidad de doble partida (PGC) |
| `HistoricoCierresZ` | LEDGER append-only | Cierre Z diario de caja |
| `ServiciosCatalogo` | CATALOG mutable | Maestro de servicios, duraciones, precios e impuestos |
| `ComplementosCatalogo` | CATALOG mutable | Maestro de add-ons y suplementos |
| `MapaStaff` | MASTER mutable | Identidad del personal y correlación de IDs |
| `RegistrosHorariosStaff` | LEDGER append-only | Fichajes laborales (RD 8/2019) |
| `ControlOperativo` | CONTROL mixto | Locks, deduplicación webhooks, rate limiting |
| `InventarioStockVenta` | MASTER mutable | Snapshot de stock comercial |
| `MovimientosInventario` | LEDGER append-only | Variaciones de stock con idempotencia |

### Protecciones append-only (backend/data.js)

Los hooks `beforeUpdate` y `beforeRemove` en `MovimientosCaja`, `LibroAsientosContablesDetalle`, `RegistrosHorariosStaff` y `MovimientosInventario` interceptan cualquier intento de modificación y retornan `FISCAL_VIOLATION`. La corrección se realiza siempre insertando un nuevo registro rectificativo que enlaza al original.

### Invariantes de integridad obligatorias

- **MovimientosCaja**: `taxBase + taxAmount ≈ amount` (redondeo a 2 decimales con `_roundMoney()`). Cadena SHA-256: `hash = SHA256(previousRecordHash + numSerieFactura + amount + timestamp)`.
- **ServiciosCatalogo**: `totalDuration === phase1Duration + exposureDuration + phase2Duration`.
- **InventarioStockVenta**: `stockAvailable === stockOnHand - stockReserved` y ningún valor negativo.
- **LibroAsientosContablesDetalle**: para un mismo `entryId`, `SUM(debit) === SUM(credit)`.
- **CajaActual**: colección `SINGLE_ITEM`; un único registro físico `SINGLE_ITEM_ID` con `singletonKey = CAJA_PRINCIPAL`. Los contadores global/anual viven en `sequenceCounters` del registro principal. Eliminación bloqueada.

### Campos canónicos transversales

| KEYFIELD | ETIQUETA VISIBLE | Tipo | Dato que contiene e información relevante |
| --- | --- | --- | --- |
| `traceId` | `trazaId` | TEXT UUID v4 | Trazabilidad end-to-end. Obligatorio en toda escritura. |
| `pairToken` | `parTokenReserva` | TEXT UUID v4 | Vincula citas DUAL\_F1 y DUAL\_F2. |
| `bookingId` | `reservaBookingsId` | TEXT | GUID de Wix Bookings. No equivale a `_id` CMS. |
| `serviceId` | `servicioBookingsId` | TEXT | GUID del servicio en Wix Bookings. Distinto de `catalogId`. |
| `resourceId` | `recursoBookingsId` | TEXT | GUID del recurso en Wix Bookings. Distinto de `memberId`. |
| `memberId` | `miembroMembersId` | TEXT | GUID de usuario en Wix Members. Distinto de `resourceId`. |
| `catalogId` | `catalogoServiciosId` | TEXT | `_id` del registro en `ServiciosCatalogo`. |
| `transactionId` | `transaccionId` | TEXT | Clave de idempotencia única de la transacción. |
| `dedupeKey` | `deduplicacionClaveOperacion` | TEXT | Clave indexada para deduplicación atómica. |
| `movementToken` | `movimientoTokenInventario` | TEXT | Clave de idempotencia en `MovimientosInventario`. |
| `hash` | `huellaFiscal` | TEXT | Huella SHA-256 en `MovimientosCaja`. |
| `previousRecordHash` | `anteriorRegistroHuellaFiscal` | TEXT | Enlace al registro fiscal anterior. |
| `recordHash` | `registroHuellaContable` | TEXT | Huella en `LibroAsientosContablesDetalle`. |
| `sequenceNumber` | `secuenciaNumeroCaja` | NUMBER | Secuencia monótona asignada desde `CajaActual.CAJA_PRINCIPAL.sequenceCounters`. |
| `numSerieFactura` | `numeroSerieFactura` | TEXT | Número de ticket/factura correlativo sin saltos. |

### ControlOperativo — tipos de control

| `controlType` | Uso |
| --- | --- |
| `SLOT_LOCK` | Bloqueo temporal de slot durante saga dual |
| `WEBHOOK_EVENT` | Deduplicación de eventos webhook (append-only) |
| `DEDUPE_KEY` | Tipo de control para claims durables de deduplicación (contabilidad/inventario); `dedupeKey` es el campo llave del registro. |
| `RATE_LIMIT` | Control de frecuencia por surface/IP |
| `SYSTEM_FLAG` | Alertas y flags de sistema |
| `IDEMPOTENCY` | Control transaccional genérico |

## 7. Enums canónicos

Todo enum persistido en el CMS debe validarse mediante `assertValidEnum()` en `backend/validation.js` antes de escribir. Ningún valor no listado aquí puede persistirse.

### Enums Wix nativos (inglés — preservar exactamente)

```javascript
// Estados de reserva en Wix Bookings V2
BOOKING_STATUS_WIX = { CREATED, PENDING, CONFIRMED, DECLINED,
  WAITING_LIST, CANCELED, REFUNDED }

// Estados de pago en Wix eCom / Bookings
PAYMENT_STATUS_WIX = { UNDEFINED, NOT_PAID, PENDING_PAYMENT,
  PENDING_LEDGER, PAID, PARTIALLY_PAID, REFUNDED,
  PARTIALLY_REFUNDED, EXEMPT }
```

### Enums CMS (persistidos en CitasF2)

```javascript
// CitasF2.bookingStatus
BOOKING_STATUS_CMS = { PENDING, CONFIRMED, COMPLETED, CANCELED,
  REFUNDED, NO_SHOW }  // CANCELED con una sola L

// CitasF2.paymentStatus
PAYMENT_STATUS_CMS = { NOT_PAID, PENDING_PAYMENT, PENDING_LEDGER,
  PAID, PARTIALLY_PAID, REFUNDED, PARTIALLY_REFUNDED, EXEMPT, UNDEFINED }

// CitasF2.bookingType
BOOKING_TYPE = { SIMPLE, DUAL_F1, DUAL_F2 }
```

### Enums de negocio (español)

```javascript
// MovimientosCaja.movementType
MOVEMENT_TYPE = { COBRO, DEVOLUCION, APORTACION, RETIRO,
  PAGO_PROVEEDOR, AJUSTE }

// MovimientosCaja.channelType
CHANNEL_TYPE = { PRESENCIAL, ONLINE }

// Opciones de pago nativas de Bookings Writer V2
BOOKING_PAYMENT_OPTION = { ONLINE, OFFLINE }

// MovimientosCaja.paymentMethod
PAYMENT_METHOD = { EFECTIVO, TARJETA, BIZUM, TRANSFERENCIA,
  WIX_PAYMENTS, OTRO }

// Tipos impositivos AEAT
TIPO_IMPOSITIVO = { ZERO: 0, SUPERREDUCIDO: 0.04,
  REDUCIDO: 0.10, GENERAL: 0.21 }

// RegistrosHorariosStaff.clockEventType
CLOCK_EVENT_TYPE = { ENTRADA, SALIDA, PAUSA_INICIO,
  PAUSA_FIN, AJUSTE }

// MovimientosInventario.movementType
MOV_INVENTARIO = { VENTA, DEVOLUCION, AJUSTE, ENTRADA_STOCK,
  SALIDA_STOCK, TRANSFERENCIA }

// Rol de negocio centralizado en internalConfig.STAFF.WEBSITE_ROLE_BY_RESOURCE_ID
ROL_WEBSITE = { ADMIN, GESTION, ESTILISTA }

// ControlOperativo.controlType
CONTROL_TYPE = { ALERT, COMPENSATION, DAYS_CACHE, DEDUPE_KEY, DISPLAY_TOKEN,
  DUAL_CACHE, IDEMPOTENCY, LEDGER_IDEMPOTENCY, SLOT_LOCK, RATE_LIMIT,
  SYSTEM_FLAG, WEBHOOK_EVENT }
```

### Addons — nomenclatura crítica

- `addonId`: campo singular en `ComplementosCatalogo` (PK de cada complemento). Nunca `addOnId` (legacy).
- `addOnIds`: array de transporte hacia Wix Bookings (plural). Contiene valores de `addonId`.

## 8. Seguridad, identidad y permisos

### Modelo de autorización RBAC

La seguridad opera en dos capas superpuestas:

1. **Barrera de plataforma (Velo Permissions)**: el decorador del webMethod (`Permissions.Anyone`, `Permissions.SiteMember`, `Permissions.Admin`) aplica el primer filtro de red.
2. **Control de roles de negocio (RBAC SSOT)**: `backend/security.js` resuelve la identidad mediante Wix Members + Bookings Staff Members API y asigna el rol desde `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID` (internalConfig.js).

`MapaStaff` no es la autoridad RBAC vigente. Se conserva como mapeo de respaldo `staffMemberId` → `resourceId`/`scheduleId` para proyecciones de eventos nativos cuando el payload Wix no aporta esos identificadores; la resolución exige una única fila activa y GUID válidos.

| Rol | Acceso |
| --- | --- |
| `ADMIN` | Configuración fiscal, cierre Z, catálogo, auditoría e inventario completo |
| `GESTION` | Operación de caja, cobros presenciales, arqueos X, gestión de stock |
| `ESTILISTA` | Solo propia agenda y fichajes laborales propios |

### Uso estricto de elevate()

`elevate()` de `@wix/essentials` permite omitir comprobaciones de permisos de Wix. Uso autorizado solo en:

- Creación, cancelación o reprogramación de reservas en Wix Bookings V2 en nombre del sistema.
- Generación de checkouts y pedidos en la API de eCommerce.
- Consultas internas al CMS sobre colecciones protegidas.

Prohibido como atajo generalizado para evitar diseñar controles de permisos. Cada invocación debe acotarse a la llamada específica.

### Gestión de secretos

Todos los tokens, llaves criptográficas y secretos de integración se almacenan en el Wix Secrets Manager. En código solo se referencian sus nombres canónicos (centralizados en `backend/mmSecrets.js`):

```javascript
export const SECRETS = Object.freeze({
  FISCAL_KEY: "SECRET_FISCALKEY",
  FISCAL_NIF_EMISOR: "FISCAL_NIF_EMISOR",
  FISCAL_SIGNER_ENDPOINT: "FISCAL_SIGNER_ENDPOINT",
  FISCAL_SIGNER_BEARER: "FISCAL_SIGNER_BEARER",
});
```

Reglas: nunca en frontend, nunca en logs, nunca en repositorio.

### Firma criptográfica HMAC-SHA256

HMAC-SHA256 se utiliza para firmar y verificar registros de fichaje laboral. No se ha identificado en el código vigente un middleware de firma general `X-MM-Signature`/`X-MM-Timestamp` ni una ventana anti-replay de ±60 segundos; no debe describirse como protección implementada.

### Rate limiting

Límites por IP/clave de solicitante, persistidos en `ControlOperativo` (`controlType = "RATE_LIMIT"`):

| Surface | Máximo | Ventana |
| --- | --- | --- |
| `public-booking` | 5 peticiones | 10 segundos |
| `reservas` | 20 peticiones | 5 segundos |
| `availability` | 12 peticiones | 5 segundos |
| `display-token` | 5 peticiones | 60 segundos |

### Minimización de PII

- Prohibido almacenar números de tarjeta, fechas de caducidad o CVV en ninguna colección CMS.
- Los logs enmascaran datos personales con `_maskEmail`, `_maskPhone`, `_maskName` (en `public/mmUtils.js`).
- Los DTOs retornados al frontend excluyen hashes Veri\*Factu, cuentas contables PGC, márgenes y notas privadas.

### Webhooks de Bookings

Eventos suscritos: `booking_created`, `booking_updated`, `booking_confirmed`, `booking_canceled`, `booking_rescheduled`.

Procesamiento seguro:

1. Los handlers de `backend/events.js` son eventos backend Velo gestionados por Wix y reciben el objeto de evento entregado por la plataforma; no son endpoints HTTP públicos. Si se recibe un JWT raw, se procesa con `wixClient.webhooks.process`.
2. Extraer `eventId` del payload.
3. Verificar idempotencia en `ControlOperativo` (`controlType = "WEBHOOK_EVENT"`) antes de cualquier mutación.
4. Si `eventId` ya existe, abortar sin error (procesamiento idempotente).

## 9. Integraciones Wix y externas

### Apps Wix nativas instaladas

| App | Rol | Restricción |
| --- | --- | --- |
| Wix Bookings | SSOT de servicios, slots, recursos y reservas | Solo API V2; V1 prohibida |
| Wix Stores | SSOT de catálogo público y stock comercial | Catalog V1; Catalog V3 prohibido |
| Wix eCommerce | SSOT de checkout, pedidos y webhooks de pago | Migración Cart V2 — plazo Feb 2027 |
| Wix Members | Identidad autenticada de clientes y personal | `@wix/members` |
| Wix Invoices V1 | Facturación nativa Wix | Separado del ledger propio Veri\*Factu |
| Wix Gift Cards | Gestión de tarjetas regalo | Integración nativa |

Las colecciones `WIX_APP` son de **estricta lectura**. Prohibido ejecutar `wixData.insert()`, `wixData.update()` o `wixData.remove()` sobre ellas. Toda mutación debe hacerse vía SDK oficial de la App.

### Reglas críticas por app

**Bookings**: la disponibilidad mostrada al usuario no garantiza que el slot siga libre. Revalidar siempre en servidor. `resource.id` y `scheduleId` deben pasarse explícitamente al crear reservas.

**Stores Catalog V1**: migración a v3 temporalmente en pausa. Cualquier migración a V3 requiere ADR propio, análisis de compatibilidad con `InventarioStockVenta` y aprobación explícita. Prohibido mezclar objetos V1 y V3. Avisar cuando sea recomendable iniciar migración.

**eCommerce / Cart V2**: la migración desde Checkout V1 es obligatoria antes de Feb 2027. Los pagos no confirman automáticamente una reserva; la confirmación proviene del webhook `order_payment_status_updated`.

### Integraciones externas

| Integración | Patrón | Notas |
| --- | --- | --- |
| Resend | `fetch()` backend con secreto en Wix Secrets | Email transaccional; no sustituir por SDK Wix sin rediseño |
| OpenAI API | `fetch()` backend con secreto en Wix Secrets | Timeout `AbortController` ≤ 9 s; respuesta fallback si JSON malformado |
| Wix Payments | Proveedor de pagos nativo de Wix; gestiona pagos, payouts, reembolsos y contracargos desde su panel. | Métodos disponibles según país y configuración de la cuenta; confirmar en el panel del sitio. |
| IONOS | DNS/correo corporativo (infraestructura externa) | No forma parte de la lógica transaccional |
| Microsoft 365 | OneDrive para custodia de Cierres Z; Power Automate para automatización | Si se activa, es repositorio de evidencia, no autoridad transaccional |

Todas las llamadas externas se ejecutan únicamente desde backend. El frontend nunca recibe claves de API ni credenciales de servicios externos.

### Gestión de colecciones WIX\_APP (20 colecciones)

Ejemplos de colecciones nativas reservadas para lectura:

- `Bookings/Schedule`, `Bookings/Services`, `Bookings/Staff`
- `Members/FullData`, `Members/PrivateMembersData`, `Members/PublicData`
- `Stores/Products`, `Stores/Collections`, `Stores/Orders`, `Stores/Variants`
- `Locations/Locations`

Nunca mutar estas colecciones directamente desde código propio.

## 10. Backend: módulos, webMethods y hooks

### WebMethods públicos y permisos

| Módulo | WebMethod | Permiso Velo | Rol negocio requerido |
| --- | --- | --- | --- |
| `security.web.js` | `checkAdminAccess` | SiteMember | `ADMIN` |
| `security.web.js` | `checkCajeroAccess` | SiteMember | `ADMIN` o `GESTION` |
| `security.web.js` | `checkStaffCollaboratorAccess` | SiteMember | Cualquiera de los 3 roles |
| `reservas.web.js` | `getServiceBySlugOrId` | Anyone | Público |
| `reservas.web.js` | `getAvailableDays` | Anyone | Público |
| `reservas.web.js` | `generateDisplayToken` | Anyone | Propietario autenticado o credencial anónima vigente |
| `reservas.web.js` | `getConfirmedBookingForDisplay` | Anyone | Propietario autenticado o token de visualización de un solo uso |
| `reservas.web.js` | `resolveStaffForSlot` | Anyone | Público |
| `reservas.web.js` | `invalidateCachesInternal` | Admin | `ADMIN` |
| `citasManager.web.js` | `processDualBooking` | SiteMember | Miembro Wix autenticado |
| `citasManager.web.js` | `confirmPayment` | Admin | `ADMIN` |
| `citasManager.web.js` | `rescheduleExistingBooking` | SiteMember | Propietario / Staff |
| `cajas.web.js` | `registerManualTransaction` | SiteMember | `ADMIN` o `GESTION` |
| `cajas.web.js` | `registerZClosing` | Admin | `ADMIN` |
| `cajas.web.js` | `verifyIntegrity` | Admin | `ADMIN` |
| `cajas.web.js` | `getCashierState` | SiteMember | `ADMIN` o `GESTION` |
| `horario.web.js` | `registrarFichaje` | SiteMember | Personal autenticado |
| `horario.web.js` | `getEstadoJornada` | SiteMember | Personal autenticado |
| `fiscalAggregator.web.js` | `getQuarterlyTaxSummary` | SiteMember | `ADMIN` o `GESTION` |
| `fiscalDocuments.web.js` | `createManagerPackageVersion` | SiteMember | `ADMIN` o `GESTION` |

### Flujos de negocio críticos

**Venta online y confirmación por pago**:

1. `CitasF2.paymentStatus = "PENDING_PAYMENT"` al crear la intención de compra.
2. Pago procesado en la pasarela eCom / Wix Payments.
3. Evento backend `order_payment_status_updated` recibido y deduplicado en `ControlOperativo`.
4. Se asigna `sequenceNumber` monótono desde `CajaActual.CAJA_PRINCIPAL.sequenceCounters` y se inserta append-only en `MovimientosCaja` con `channelType = "ONLINE"`, `movementType = "COBRO"`, hash SHA-256 encadenado.
5. `CitasF2` actualizado a `paymentStatus = "PAID"`, `bookingStatus = "CONFIRMED"`.

**Cancelaciones y reembolsos**:

1. Evento backend `booking_canceled` deduplicado.
2. `CitasF2` actualizado a `bookingStatus = "CANCELED"`, `paymentStatus = "REFUNDED"`.
3. Registro rectificativo append-only en `MovimientosCaja` con `movementType = "DEVOLUCION"` y hash encadenado.
4. Si hay devolución de stock: registro en `MovimientosInventario` con `movementType = "DEVOLUCION"`.

**Visualización segura de la confirmación de reserva**:

1. `generateDisplayToken` permite emitir un token a un miembro autenticado solo si es propietario de la reserva y esta está confirmada.
2. Para un visitante anónimo, `confirmationToken` debe corresponder a un registro `DISPLAY_TOKEN` vigente, ligado al mismo `bookingId` y dentro de su límite de intentos. La API devuelve esa misma credencial como token de visualización; no acuña un segundo bearer ni crea otra fila. Los reintentos de emisión devuelven el mismo token y respetan su TTL restante.
3. `getConfirmedBookingForDisplay` exige el token para visitantes anónimos; para miembros autenticados exige propiedad de la reserva. Tras validar, consume el registro del token y devuelve un DTO público mínimo. El replay secuencial se rechaza.
4. El CMS conserva únicamente el hash del token en el identificador `DT_<hash>`; nunca se persiste el bearer en claro. La garantía de consumo exactamente una vez bajo concurrencia real debe validarse en Wix QA; la suite offline no sustituye esa prueba.

**Cierre Z diario**:

1. Se agregan y consolidan todas las transacciones del día.
2. Se verifica la continuidad de la cadena de hashes SHA-256.
3. Se inserta un documento inmutable en `HistoricoCierresZ` con totales por medio de pago, resumen impositivo y firma criptográfica del periodo.

### Hooks CMS (backend/data.js)

Validaciones `beforeInsert` / `beforeUpdate` por colección:

- **MovimientosCaja**: presencia de `hash`, `schemaVersion`, `traceId`; cuadre `taxBase + taxAmount ≈ amount`.
- **CitasF2**: enums válidos via `assertValidEnum()`, `traceId` presente, coherencia `pairToken` en duales. `beforeRemove` bloqueado.
- **ServiciosCatalogo**: unicidad `serviceId`/`sku`/`slug`; `totalDuration === phase1Duration + exposureDuration + phase2Duration`; `tipoImpositivo` en enum AEAT.
- **MapaStaff**: no tiene hook CMS activo. El lector de eventos filtra por `staffMemberId` + `active`, rechaza cero o múltiples coincidencias y valida `resourceId`/`scheduleId` como GUID. No es fuente de roles RBAC.
- **RegistrosHorariosStaff**: `clockEventType` válido; `notes` obligatorio cuando `recordType === "AJUSTE"`.
- **ControlOperativo**: `beforeInsert` ejecuta `assertControlOperativo` (`controlType`, `dedupeKey`, `traceId`; `eventId` en `WEBHOOK_EVENT`; `resourceId` + `expiresAt` en `SLOT_LOCK`). `beforeUpdate` conserva la guardia append-only y normaliza; las actualizaciones parciales mantienen validación en el writer.
- **InventarioStockVenta**: no hay hook CMS `beforeInsert`/`beforeUpdate` implementado en `data.js`; las validaciones se mantienen en los writers de inventario.
- **MovimientosInventario**: unicidad `movementToken`; `reason` obligatorio cuando `movementType === "AJUSTE"`.
- **DatosFiscales**: validación NIF/NIE/CIF/VAT-UE con `isValidNifOrEuVat()`. `beforeRemove` bloquea eliminación de `CONFIG_SISTEMA_FISCAL`.

### Funciones de utilidad transversal

**`public/mmUtils.js`** (client-side + shared):

- `makeTraceId(prefix)` / `_generateUUID()` — generación de trazabilidad
- `_roundMoney(v)` — redondeo bancario a 2 decimales
- `_stableSerialize(value)` — serialización determinista con ordenación de claves
- `getMadridLocalStringNoZ(utcDate)` / `getUtcDateFromMadridLocal(local)` — conversión zona horaria
- `withTimeout(promiseOrFactory, ms, label)` / `_executeWithRetry(fn, retries, delay)` — control asíncrono

**Contrato operativo de timeout:** `withTimeout` admite una promesa o una factory. Para efectos secundarios (Bookings Writer, confirmación, cancelación y WebMethods de reserva) usar factory `() => operation()`. El timeout solo limita la espera local: no cancela la operación Wix ya iniciada. Si expira una operación de escritura, clasificar el resultado como incierto, bloquear el reintento ciego y reconciliar por identidad/idempotencia. El watchdog del widget debe superar el watchdog Velo y mantener bloqueada la sesión cuando el resultado sea incierto.
- `_maskEmail()` / `_maskPhone()` / `_maskName()` — enmascaramiento PII

**`backend/securityEngine.js`**:

- `hashSHA256(input)` — hash hex SHA-256
- `hmacSha256Hex(key, payload)` — firma HMAC-SHA256
- `hashChain(prevHash, payload)` — `SHA256(prevHash + payload)` Veri\*Factu
- `timingSafeEqual(a, b)` — comparación tiempo constante

# DOSSIER TÉCNICO CONSOLIDADO — marianmadrid.es (continuación)

A continuación se completan los capítulos 11 a 14 del dossier, alineados con los documentos fuente consultados.

---

## 11. JOBS PROGRAMADOS Y WEBHOOKS

### 11.1 Infraestructura de tareas programadas

El scheduler de Velo ejecuta las tareas declaradas en `backend/jobs.config` mediante el módulo `backend/crons.js`. Todas las frecuencias se evalúan en zona horaria `Europe/Madrid` y respetan la política de concurrencia `Forbid` (no solapamiento) con un máximo de 3 reintentos en *exponential backoff*.

| Tarea (`functionName`) | Cron (Madrid) | Dominio | Operación |
| :--- | :--- | :--- | :--- |
| `cleanExpiredLocks` | `15 * * * *` | Concurrencia | Purga `SLOT_LOCK` expirados mediante `bulkRemove` condicionado por `controlType` y `expiresAt` vigente en el momento del borrado. |
| `cleanExpiredDualCache` | `20 * * * *` | Reservas | Purga registros `DUAL_CACHE` legacy expirados; el código vigente ya no genera snapshots de disponibilidad dual. |
| `runPendingCompensationsJob` | `30 * * * *` | Sagas | Reintenta cancelación de F1 cuando F2 falló. |
| `cleanExpiredDaysCache` | `0 1 * * *` | Disponibilidad | Invalida caché de días disponibles. |
| `verifyNightlyZClosing` | `20 1 * * *` | Fiscal | Cierre Z automático: agrega `MovimientosCaja`, valida cadena SHA-256 y consolida en `HistoricoCierresZ`. |
| `systemHealthCheck` | `0 7 * * *` | Operativo | Verifica CMS, Secrets Manager y continuidad del ledger fiscal. |
| `cleanAuditLogs` | `0 2 * * 0` | Auditoría | Aplica retención sobre logs técnicos caducados. |

**Caché y locks de disponibilidad (contrato vigente):**
- `DAYS_CACHE` almacena solo fechas/días disponibles (TTL de 5 minutos); no contiene listas de slots.
- `reservas.web.js` no conserva slots F1/F2 ni combinaciones en memoria o `ControlOperativo`. Cada solicitud de disponibilidad obtiene los slots de Wix Bookings V2 y construye el subconjunto que se devuelve al cliente.
- `DUAL_CACHE` queda reservado para purgar registros legacy; no se generan nuevas filas.
- `SLOT_LOCK` utiliza `version` numérica y `lockToken` opaco. Renovación, recuperación y liberación aplican `bulkPatchItems` con condición de versión (las filas legacy sin versión se migran mediante comparación de `expiresAt`). La liberación marca el lease expirado; `cleanExpiredLocks` elimina únicamente registros que sigan expirados al ejecutar el borrado.
- El heartbeat de la saga propaga la versión más reciente para la liberación final. La reprogramación dual conserva versión y token de cada lock adquirido. Los locks coordinan procesos del backend; no sustituyen la validación nativa de disponibilidad de Wix Bookings.

**Reglas invariables:**
- Los jobs **nunca escriben directamente** en colecciones *append-only*; invocan servicios que pasan por `backend/data.js`.
- Las tareas de sincronización externa no confirmadas (p. ej. M365 bidireccional) permanecen **deshabilitadas** hasta ADR específico.
- Todo job genera y propaga un `traceId` UUID v4.

### 11.2 Webhooks de Bookings V2

Eventos suscritos en el panel de Wix y procesados por `backend/events.js`:

| Evento | Propósito |
| :--- | :--- |
| `booking_created` | Persistencia inicial en `CitasF2` con `bookingStatus = PENDING`. |
| `booking_updated` | Actualización de `slotStart`, `slotEnd`, `resourceId`. |
| `booking_confirmed` | Transición a `CONFIRMED` tras validación de pago. |
| `booking_canceled` | Transición a `CANCELED` + asiento rectificativo en `MovimientosCaja`. |
| `booking_rescheduled` | Regeneración de `pairToken` si aplica y reasignación de slot. |

**Procesamiento seguro:**
1. El webhook llega como JWT firmado por Wix. Se verifica con la clave pública oficial.
2. Se extrae `eventId` del payload.
3. Se consulta `ControlOperativo` (`controlType = "WEBHOOK_EVENT"`, `dedupeKey = eventId`). Si ya existe, se aborta sin error (idempotencia estricta).
4. Se inserta el registro de deduplicación *append-only* y se ejecuta la mutación de dominio.
5. Toda mutación propaga `traceId` y se enmascara PII en logs.

### 11.3 Webhooks de eCommerce

| Evento | Propósito |
| :--- | :--- |
| `order_payment_status_updated` | Confirma pago y actualiza `CitasF2.paymentStatus = PAID`. |
| `order_created` | Registra intención de compra con `PENDING_PAYMENT`. |
| `order_refund_updated` | Dispara asiento rectificativo y devolución de stock si `sideEffects.restock.lineItems` está presente. |

**Regla crítica:** los webhooks de eCommerce son **independientes** de la versión de catálogo (V1/V3). No cambian entre migraciones.

### 11.4 Webhooks pendientes de activación (Catalog V3)

Los eventos V3 de Velo (`ProductsV3` / `InventoryItemsV3`) están actualmente en **Developer Preview** según la documentación oficial de Wix (consultada el 30-10-2026). Por tanto:

- **No se activan en producción** sin ADR y QA explícito.
- Su registro y deduplicación quedan pendientes en `ControlOperativo`.
- Mientras tanto, la conciliación de inventario se realiza por replay administrativo con cola `ControlOperativo` (`alertType` asociado).

---

## 12. ESTÁNDARES DE CÓDIGO Y NOMENCLATURA

### 12.1 Reglas canónicas de nomenclatura (N1–N5)

| Regla | Descripción | Ejemplo |
| :--- | :--- | :--- |
| **N1** | Contrato único compartido por CMS, backend, frontend y webhooks. | `bookingId` se escribe igual en los cuatro niveles. |
| **N2** | IDs técnicos nativos de Wix se conservan en inglés. | `bookingId`, `serviceId`, `resourceId`, `slug`. |
| **N3** | Si no existe ID nativo, se adoptan estándares AEAT/PGC en español. | `numSerieFactura`, `taxBase`, `tipoImpositivo`. |
| **N4** | Campos y variables en `camelCase`; etiqueta visible en español `camelCase`. | `taxBase` → *Base Imponible*. |
| **N5** | Enums cualificados por dominio para evitar ambigüedad. | `bookingStatus`, `movementType`, `clockEventType`. |

### 12.2 Estándar G10 ASCII Strict

- Código backend libre de caracteres no-ASCII, **excepto la "ñ"** cuando forme parte de términos españoles canónicos (`año`, `niño`).
- Cada archivo JS debe declarar cabecera con: módulo, versión, responsabilidad, APIs consumidas y versión de la API.
- Prohibidos los comentarios narrativos que explican el "qué" en lugar del "por qué".
- Prohibido el código comentado en repositorio.

### 12.3 Convenciones de enums

- Todo enum se declara como objeto `Object.freeze` en `backend/internalConfig.js` o módulo equivalente.
- Se valida en runtime mediante `assertValidEnum()` antes de persistir.
- Los enums Wix nativos se preservan en inglés; los enums de negocio se escriben en español.
- Prohibido persistir literales planos (*hardcoded strings*) sin pasar por el validador.

### 12.4 Convenciones de errores

Toda excepción del backend devuelve un DTO normalizado con uno de los códigos canónicos (ver §14.7). Los errores se clasifican en:

- **Validación:** `INVALID_PAYLOAD`, `INVALID_DATES`.
- **Concurrencia:** `TOKEN_BUSY`, `LOCK_ACQUISITION_FAILED`.
- **Seguridad/Legal:** `FISCAL_VIOLATION`, `FISCAL_SIGN_FAIL`, `ACCESS_DENIED`.
- **Integración:** `BOOKING_CREATION_FAILED`, `CHECKOUT_FAILED`.
- **Negocio:** `SLOT_UNAVAILABLE`, `SERVICE_NOT_FOUND`, `DUAL_NOT_ALLOWED`.
- **Persistencia:** `LEDGER_WRITE_FAIL`, `DATA_CONFLICT`, `IDEMPOTENCY_CONFLICT`.

### 12.5 Cabecera de módulo (plantilla canónica)

```javascript
/**
 * @module bookingCore
 * @version 2.4.0
 * @responsibility Primitivas de locks, persistencia y elevación para reservas.
 * @apis @wix/bookings (Bookings Writer V2), @wix/data (elevate), @wix/essentials
 * @standards SSOT v10.0 §5.3, §12, §14
 * @changelog
 *  - 2026-10-30: corrección REST/SDK (resource._id vs resource.id) — ADR-002
 *  - 2026-10-24: revalidación de hallazgos H-01..H-13
 */
```

### 12.6 Reglas de calidad "Cero Deuda" (v1.0)

Según `DIRECTRICES_DESARROLLO_CODIGO.txt`:

- **Cero alias** en código productivo (ni en tests).
- **Cero rutas legacy silenciosas**: fallback de lectura permitido solo con `warn` trazable y plan de migración con fecha `review-by`.
- **Cero APIs `@deprecated` vivas**.
- **Cero símbolos exportados sin consumidor verificable** en `src/`.
- **Cero contratos zombis** (parámetros ignorados, enums sin transición).
- **Regla anti-regresión:** ninguna eliminación sin `grep` de consumidores en `src/` y suite verde posterior.

---

## 13. NORMATIVA APLICABLE

El sistema garantiza el cumplimiento estricto del marco legal español y europeo. Cada norma se mapea a su implementación técnica concreta.

### 13.1 Fiscal y Veri*Factu

| Norma | Exigencia | Implementación en Marian Madrid |
| :--- | :--- | :--- |
| **Ley 11/2021** (Medidas de Prevención del Fraude Fiscal) | Sistemas informáticos garantistas de inalterabilidad, trazabilidad y sin borrados. | Ledgers *append-only* (`MovimientosCaja`, `LibroAsientosContablesDetalle`, `RegistrosHorariosStaff`, `MovimientosInventario`) con hooks `beforeUpdate`/`beforeRemove` que lanzan `FISCAL_VIOLATION`. |
| **RD 1007/2023** (Reglamento Veri*Factu) | Huella SHA-256 encadenada, secuencia monótona, QR de verificación. | `hash = SHA256(previousRecordHash + numSerieFactura + amount + timestamp)` en `MovimientosCaja`; `sequenceNumber` asignado desde `CajaActual.CAJA_PRINCIPAL.sequenceCounters`; `verificationQR` generado. Plazo legal autónomos: **1-jul-2027**. |
| **RD 1619/2012** (Obligaciones de Facturación) | Facturas simplificadas correlativas, series rectificativas (R1–R5). | `numSerieFactura` correlativo sin saltos; `tipoRectificativa` y `previousInvoiceId` en asientos de devolución. |
| **Ley 37/1992** (IVA) | Tipos impositivos oficiales y desglose base/cuota. | `tipoImpositivo` validado contra enum `TIPO_IMPOSITIVO` (`0`, `0.04`, `0.10`, `0.21`); invariante `taxBase + taxAmount ≈ amount` con `_roundMoney()`. |

### 13.2 Contabilidad

| Norma | Exigencia | Implementación |
| :--- | :--- | :--- |
| **PGC (RD 1514/2007)** | Libro diario en partida doble, cuentas a 6 dígitos. | `LibroAsientosContablesDetalle` con `accountCode` (6 dígitos), `debitAmount` y `creditAmount`; invariante `SUM(debit) === SUM(credit)` por `entryId`. |

### 13.3 Laboral

| Norma | Exigencia | Implementación |
| :--- | :--- | :--- |
| **RD 8/2019** (Art. 34.9 ET) | Registro diario de jornada, inalterable, conservación 4 años. | `RegistrosHorariosStaff` *append-only* con `clockEventType` (`ENTRADA`, `SALIDA`, `PAUSA_INICIO`, `PAUSA_FIN`, `AJUSTE`); `notes` obligatorio en `AJUSTE`; retención legal garantizada por el CMS. |

### 13.4 Privacidad y conservación

| Norma | Exigencia | Implementación |
| :--- | :--- | :--- |
| **RGPD (UE) 2016/679** y **LOPDGDD 3/2018** | Minimización de PII, consentimiento, derechos ARCO+. | Enmascaramiento automático en logs (`_maskEmail`, `_maskPhone`, `_maskName`); exclusión de datos de tarjeta en CMS; Consent Mode v2 en web; servidores en UE (IONOS + Wix). |
| **LGT 58/2003** y **Código de Comercio art. 30** | Conservación de documentación fiscal y mercantil 4–6 años. | Retención nativa del CMS; `HistoricoCierresZ` con firma criptográfica del periodo; copias en OneDrive M365. |
| **LSSI-CE 34/2002** | Transparencia de precios, información previa al pago. | Precios con IVA incluido; Aviso Legal, Política de Privacidad y Condiciones de Cancelación en footer. |
| **RD 253/2025** | Obligaciones de información sobre cobros mediante Bizum, cuando resulte aplicable. | El Cierre Z conserva el desglose registrado; no se presume que Wix Payments presente declaraciones ni comunique automáticamente estos datos a AEAT. Validar alcance y responsable con AEAT/asesoría. |

### 13.5 Matriz de cumplimiento consolidada

| Ámbito | Estado | Evidencia |
| :--- | :--- | :--- |
| Veri*Factu (transición) | ✅ Cumple | Ledger inmutable + cadena SHA-256 + Cierre Z nocturno. |
| IVA 21% / desgloses | ✅ Cumple | `_roundMoney()` + enum `TIPO_IMPOSITIVO`. |
| Registro horario | ✅ Cumple | `RegistrosHorariosStaff` exportable a PDF. |
| RGPD / LOPDGDD | ✅ Cumple | Servidores UE, PII enmascarada, Consent Mode v2. |
| Ley Antifraude / control de cobros | Pendiente de acreditación integral | El ledger propio mantiene trazabilidad e inalterabilidad; el proveedor de pago no sustituye las obligaciones del sistema de facturación. |
| LSSI-CE | ✅ Cumple | Textos legales en footer, precios con IVA. |

---

## 14. GLOSARIO E IDENTIFICADORES CANÓNICOS

### 14.1 Identificadores de sitio y ubicación (inmutables)

| Clave | Valor |
| :--- | :--- |
| **Site ID** | `188bed94-177c-4bc9-a9f0-35080d874f3e` |
| **Location ID** (`LOCATION_ID`) | `7a12abfd-bf30-4847-bcdf-00dc573d4802` |
| **Staff Resource Type ID** | `1cd44cf8-756f-41c3-bd90-3e2ffcaf1155` |
| **Location Type — Time Slots V2** | `BUSINESS` |
| **Location Type — Bookings Writer V2** | `OWNER_BUSINESS` |
| **Zona horaria** | `Europe/Madrid` |
| **Moneda** | `EUR` (2 decimales) |
| **Idioma** | `es-ES` |
| **Dominio** | `https://www.marianmadrid.es` |
| **Repositorio** | `https://github.com/nachoortegazgz/marianmadridz` |

### 14.2 Personal y roles (`MapaStaff`)

| Nombre | `resourceId` (Bookings) | `rolBookings` | `rolWebsite` |
| :--- | :--- | :--- | :--- |
| Marian Madrid | `e556070a-6d6a-402e-8422-11133033ea76` | `STAFF` | `ADMIN` |
| Andrea Staff | `07f7344f-e7e4-4c53-854b-47fd82ac8d40` | `STAFF` | `ESTILISTA` |
| Alba Staff | `9b905bfd-1a09-485d-9273-a24a20dfe648` | `STAFF` | `ESTILISTA` |

> `thirdPartyId` permanece vacío hasta vincular fichas fiscales en `DatosFiscales`. Prohibido rellenarlo por inferencia.

### 14.3 Wix App IDs oficiales

| App | App ID |
| :--- | :--- |
| Wix Bookings | `13d21c63-b5ec-5912-8397-c3a5ddb27a97` |
| Wix Stores | `215238eb-22a5-4c36-9e7b-e7c08025e04e` |
| Wix Members | `14cc59bc-f0b7-15b8-e1c7-89ce41d0e0c9` |
| Wix Forms & Payments | `14ce1214-b278-a7e4-1373-00cebd1bef7c` |
| Wix Invoices | `13ee94c1-b635-8505-3391-97919052c16f` |
| Wix Gift Cards | `d80111c5-a0f4-47a8-b63a-65b54d774a27` |
| Wix Events | `140603ad-af8d-84fb-9004-ee174e35054d` |

### 14.4 Resumen de colecciones CMS

**13 colecciones NATIVE de negocio:**
`DatosFiscales`, `CajaActual`, `MovimientosCaja`, `CitasF2`, `LibroAsientosContablesDetalle`, `HistoricoCierresZ`, `ServiciosCatalogo`, `ComplementosCatalogo`, `MapaStaff`, `RegistrosHorariosStaff`, `ControlOperativo`, `InventarioStockVenta`, `MovimientosInventario`.

**20 colecciones `WIX_APP` (solo lectura):**
`Blog/Categories`, `Blog/Posts`, `Blog/Tags`, `Bookings/Schedule`, `Bookings/Services`, `Bookings/Staff`, `CampaignManager/campaigns`, `CampaignManager/userConfig`, `Forms/subscribers03`, `Locations/Locations`, `Marketing/Coupons`, `Members/Badges`, `Members/FullData`, `Members/PrivateMembersData`, `Members/PublicData`, `Stores/Collections`, `Stores/InventoryItems`, `Stores/Orders`, `Stores/Products`, `Stores/Variants`.

**8 colecciones legacy prohibidas** (acceso lanza `FISCAL_VIOLATION`):
`ConfiguracionFiscal`, `AsientosContables`, `EventosSistemaFacturacion`, `FacturasRecibidas`, `LibroRegistroFacturasExpedidas`, `LibroRegistroFacturasRecibidas`, `PlanCuentasContables`, `CategoriasServicio`.

### 14.5 Campos canónicos críticos

| Campo | Colección principal | Función |
| :--- | :--- | :--- |
| `taxId` | `DatosFiscales` | NIF/NIE/CIF/VAT-UE validado. |
| `sequenceNumber` | `MovimientosCaja` | Secuencia monótona desde `CajaActual.CAJA_PRINCIPAL.sequenceCounters`. |
| `numSerieFactura` | `MovimientosCaja` | Número correlativo sin saltos. |
| `transactionId` | `MovimientosCaja` | Clave de idempotencia del hecho económico. |
| `hash` / `previousRecordHash` | `MovimientosCaja` | Huellas SHA-256 encadenadas Veri*Factu. |
| `recordHash` | `LibroAsientosContablesDetalle` | Huella de línea contable. |
| `bookingId` | `CitasF2` | GUID oficial de Wix Bookings V2. |
| `pairToken` | `CitasF2` | UUID v4 que vincula `DUAL_F1` + `DUAL_F2`. |
| `bookingStatus` | `CitasF2` | Estado interno (`PENDING`, `CONFIRMED`, `CANCELED`, `NO_SHOW`). |
| `paymentStatus` | `CitasF2` | Estado de tesorería (`NOT_PAID`, `PENDING_PAYMENT`, `PENDING_LEDGER`, `PAID`, `PARTIALLY_PAID`, `REFUNDED`, `PARTIALLY_REFUNDED`, `EXEMPT`, `UNDEFINED`). |
| `resourceId` | `MapaStaff`, `CitasF2` | GUID del recurso en Wix Bookings. |
| `memberId` | `MapaStaff` | GUID de usuario en Wix Members. |
| `staffMemberId` / `scheduleId` | `MapaStaff` | Mapeo de respaldo a `resourceId`/`scheduleId`; los campos históricos `rolBookings`/`rolWebsite` no gobiernan el RBAC actual. |
| `serviceId` | `ServiciosCatalogo` | GUID inmutable del servicio en Bookings. |
| `slug` | `ServiciosCatalogo` | Identificador público para routing. |
| `linkedPhases` | `ServiciosCatalogo` | GUID de la Fase 2 vinculada. |
| `addonId` / `addOnIds` | `ComplementosCatalogo` | PK del complemento / array de transporte a Bookings. |
| `clockEventType` | `RegistrosHorariosStaff` | Tipo de fichaje laboral. |
| `controlType` / `dedupeKey` | `ControlOperativo` | Discriminador técnico y clave de deduplicación. |
| `stockOnHand` / `stockReserved` / `stockAvailable` | `InventarioStockVenta` | Invariante `available === onHand - reserved`. |
| `movementToken` | `MovimientosInventario` | Clave de idempotencia del movimiento de stock. |
| `traceId` | Transversal | UUID v4 obligatorio de trazabilidad end-to-end. |

### 14.6 Enums canónicos

**Wix nativos (inglés, preservar exactamente):**
```javascript
BOOKING_STATUS_WIX = { CREATED, PENDING, CONFIRMED, DECLINED,
  WAITING_LIST, CANCELED, REFUNDED }
PAYMENT_STATUS_WIX = { UNDEFINED, NOT_PAID, PENDING_PAYMENT,
  PENDING_LEDGER, PAID, PARTIALLY_PAID, REFUNDED,
  PARTIALLY_REFUNDED, EXEMPT }
```
> Nota: `UPDATED` es **tipo de evento webhook**, no estado de reserva. Se elimina del enum de estados (Anexo aclaratorio SSOT v10.0).

**CMS (`CitasF2`):**
```javascript
BOOKING_STATUS_CMS = { PENDING, CONFIRMED, COMPLETED, CANCELED, REFUNDED, NO_SHOW }
PAYMENT_STATUS_CMS = { NOT_PAID, PENDING_PAYMENT, PENDING_LEDGER,
  PAID, PARTIALLY_PAID, REFUNDED, PARTIALLY_REFUNDED, EXEMPT, UNDEFINED }
BOOKING_TYPE         = { SIMPLE, DUAL_F1, DUAL_F2 }
```
> `CANCELED` se escribe con **una sola L** (canon Wix oficial).

**Negocio (español):**
```javascript
MOVEMENT_TYPE   = { COBRO, DEVOLUCION, APORTACION, RETIRO,
                    PAGO_PROVEEDOR, AJUSTE }
CHANNEL_TYPE    = { PRESENCIAL, ONLINE }
PAYMENT_METHOD  = { EFECTIVO, TARJETA, BIZUM, TRANSFERENCIA,
                    WIX_PAYMENTS, OTRO }
TIPO_IMPOSITIVO = { ZERO: 0, SUPERREDUCIDO: 0.04,
                    REDUCIDO: 0.10, GENERAL: 0.21 }
CLOCK_EVENT_TYPE = { ENTRADA, SALIDA, PAUSA_INICIO,
                     PAUSA_FIN, AJUSTE }
MOV_INVENTARIO  = { VENTA, DEVOLUCION, AJUSTE, ENTRADA_STOCK,
                    SALIDA_STOCK, TRANSFERENCIA }
ROL_WEBSITE     = { ADMIN, GESTION, ESTILISTA }
CONTROL_TYPE    = { ALERT, COMPENSATION, DAYS_CACHE, DEDUPE_KEY,
                    DISPLAY_TOKEN, DUAL_CACHE, IDEMPOTENCY,
                    LEDGER_IDEMPOTENCY, SLOT_LOCK, RATE_LIMIT,
                    SYSTEM_FLAG, WEBHOOK_EVENT }
```

### 14.7 Librerías de helpers y utilidades

**`public/mmUtils.js` (client-side):**
`makeTraceId(prefix)`, `_generateUUID()`, `_roundMoney(v)`, `_stableSerialize(value)`, `getUtcDateFromMadridLocal(local)`, `getMadridLocalStringNoZ(utcDate)`, `withTimeout(promiseOrFactory, ms, label)`, `_executeWithRetry(fn, retries, delay)`, `_maskEmail()`, `_maskPhone()`, `_maskName()`.

**`public/widgetBridge.js`:**
`createWidgetBridge(widget, options)`, `bridge.post(type, payload, messageId)`, `bridge.postContext()`, `bridge.destroy()`, `bridge.getTraceId()`, `bridge.isReady()`.

**`backend/securityEngine.js`:**
`hashSHA256(input)`, `hmacSha256Hex(key, payload)`, `hashChain(prevHash, payload)`, `timingSafeEqual(a, b)`.

**`backend/validation.js`:**
`assertValidEnum(value, enumObject, fieldName)`, `assertCitasF2(item)`, `assertDatosFiscales(item)`, `assertControlOperativo(item)`, `assertRegistrosHorariosStaff(item)`, `assertMovimientosInventario(item)`, `isValidNifOrEuVat(taxId)`.

### 14.8 Catálogo de WebMethods públicos

| Módulo | WebMethod | Permiso Velo | Rol negocio |
| :--- | :--- | :--- | :--- |
| `security.web.js` | `checkAdminAccess` | SiteMember | ADMIN |
| `security.web.js` | `checkCajeroAccess` | SiteMember | ADMIN / GESTION |
| `security.web.js` | `checkStaffCollaboratorAccess` | SiteMember | ADMIN / GESTION / ESTILISTA |
| `reservas.web.js` | `getServiceBySlugOrId` | Anyone | Público |
| `reservas.web.js` | `getAvailableDays` | Anyone | Público |
| `reservas.web.js` | `resolveStaffForSlot` | Anyone | Público |
| `reservas.web.js` | `invalidateCachesInternal` | Admin | ADMIN |
| `citasManager.web.js` | `processDualBooking` | SiteMember | Miembro Wix autenticado |
| `citasManager.web.js` | `confirmPayment` | Admin | ADMIN |
| `citasManager.web.js` | `rescheduleExistingBooking` | SiteMember | Propietario / Staff |
| `cajas.web.js` | `registerManualTransaction` | SiteMember | ADMIN / GESTION |
| `cajas.web.js` | `registerZClosing` | Admin | ADMIN |
| `cajas.web.js` | `verifyIntegrity` | Admin | ADMIN |
| `cajas.web.js` | `getCashierState` | SiteMember | ADMIN / GESTION |
| `horario.web.js` | `registrarFichaje` | SiteMember | Personal autenticado |
| `horario.web.js` | `getEstadoJornada` | SiteMember | Personal autenticado |
| `fiscalAggregator.web.js` | `getQuarterlyTaxSummary` | SiteMember | ADMIN / GESTION |
| `fiscalDocuments.web.js` | `createManagerPackageVersion` | SiteMember | ADMIN / GESTION |

### 14.9 Resumen de hooks CMS (`backend/data.js`)

| Colección | `beforeInsert` | `beforeUpdate` | `beforeRemove` |
| :--- | :--- | :--- | :--- |
| `MovimientosCaja` | Valida `hash`, `schemaVersion`, `traceId`, enums y cuadre `taxBase + taxAmount ≈ amount`. | **Bloqueado** → `FISCAL_VIOLATION`. | **Bloqueado** → `FISCAL_VIOLATION`. |
| `LibroAsientosContablesDetalle` | Valida partida doble (`debit === credit`). | **Bloqueado**. | **Bloqueado**. |
| `RegistrosHorariosStaff` | Valida `clockEventType`; `notes` obligatorio si `recordType === "AJUSTE"`. | **Bloqueado**. | **Bloqueado**. |
| `MovimientosInventario` | Valida `movementToken` único; `reason` obligatorio si `movementType === "AJUSTE"`. | **Bloqueado**. | **Bloqueado**. |
| `CitasF2` | Valida enums, `traceId`, coherencia `pairToken`. | Actualizaciones controladas. | **Bloqueado**. |
| `ServiciosCatalogo` | Unicidad `serviceId`/`sku`/`slug`; `totalDuration === phase1 + exposure + phase2`. | Controlado. | Solo ADMIN. |
| `DatosFiscales` | Valida NIF/NIE/CIF/VAT-UE. | Controlado. | Bloqueado para `CONFIG_SISTEMA_FISCAL`. |
| `CajaActual` | Valida `singletonKey = CAJA_PRINCIPAL` (colección `SINGLE_ITEM`). | `sequenceCounters` editable solo por backend bajo bloqueo fiscal global. | **Bloqueado**. |
| `InventarioStockVenta` | Valida `stockAvailable === stockOnHand - stockReserved`. | Controlado. | Solo ADMIN. |
| `ControlOperativo` | Valida `controlType`, `dedupeKey`, `traceId`. | Controlado. | Controlado. |
| `MapaStaff` | Mapeo de respaldo; lectura falla cerrada ante mapping ausente/ambiguo o GUID inválidos. | Sin hook CMS. | Solo ADMIN. |
| `ComplementosCatalogo` | Unicidad `addonId`/`sku`. | Controlado. | Solo ADMIN. |
| `HistoricoCierresZ` | Valida firma de cierre. | **Bloqueado**. | **Bloqueado**. |

### 14.10 Códigos de error estandarizados

| Código | Categoría | Causa raíz |
| :--- | :--- | :--- |
| `INVALID_PAYLOAD` | Validación | Payload malformado o tipos incorrectos. |
| `TOKEN_BUSY` | Concurrencia | Mutex `SLOT_LOCK` ya ocupado. |
| `FISCAL_SIGN_FAIL` | Criptografía | Fallo al calcular/verificar HMAC o SHA-256. |
| `FISCAL_VIOLATION` | Seguridad/Legal | Intento de mutar ledger *append-only*. |
| `BOOKING_CREATION_FAILED` | Integración | Error en `Bookings Writer V2`. |
| `CHECKOUT_FAILED` | eCommerce | Error en carrito/checkout. |
| `AUTH_REQUIRED` | Seguridad | Usuario no autenticado. |
| `ACCESS_DENIED` | Seguridad | Rol no autorizado en `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID` (internalConfig.js). |
| `RATE_LIMITED` | Protección | Límite de tasa excedido. |
| `SLOT_UNAVAILABLE` | Negocio | Slot ya no disponible. |
| `SERVICE_NOT_FOUND` | Catálogo | `serviceId` o `slug` no registrado. |
| `RESOURCE_NOT_AVAILABLE` | Negocio | Profesional sin disponibilidad. |
| `DUAL_NOT_ALLOWED` | Negocio | Servicio no permite combinación dual. |
| `INVALID_DATES` | Validación | Rango de fechas malformado. |
| `TIMEOUT` | Runtime | Tiempo de ejecución superado. |
| `DATA_CONFLICT` | Persistencia | Violación de índices de unicidad. |
| `IDEMPOTENCY_CONFLICT` | Control | Transacción duplicada. |
| `LOCK_ACQUISITION_FAILED` | Concurrencia | Imposibilidad de escribir bloqueo. |
| `TRANSACTION_FAILED` | Tesorería | Fallo en cobro de caja. |
| `COMPENSATION_FAILED` | Saga | Cancelación de F1 fallida tras fallo de F2. |
| `LEDGER_WRITE_FAIL` | Persistencia | Error de escritura en ledger inmutable. |

### 14.11 Fuentes oficiales de referencia

**Documentación Wix Developers (consultada noviembre 2026):**
- CMS / Data API: `dev.wix.com/docs/api-reference/business-solutions/cms`
- SDK Data: `dev.wix.com/docs/sdk/api-reference/data/introduction`
- Bookings V2: `dev.wix.com/docs/api-reference/business-solutions/bookings`
- Bookings Writer V2: `dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-writer-v2/introduction`
- Time Slots V2: `dev.wix.com/docs/api-reference/business-solutions/bookings/time-slots/time-slots-v2/introduction`
- Stores Catalog V3: `dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/introduction`
- Migración V1→V3: `dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/catalog-v1-to-v3-migration-guide`
- Catalog Versioning: `dev.wix.com/docs/api-reference/business-solutions/stores/catalog-versioning/introduction`
- eCommerce Cart V2: `dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/cart-v2`
- Velo-to-SDK Mapping: `dev.wix.com/docs/develop-websites/articles/coding-with-velo/develop-with-the-sdk/velo-to-sdk-api-mapping`
- Git Integration & Wix CLI for Sites: `dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites`

**Marco legal español:**
- Ley 11/2021 (fraude fiscal / Veri*Factu)
- RD 1007/2023 (Reglamento Veri*Factu)
- RD 1619/2012 (obligaciones de facturación)
- Ley 37/1992 (IVA)
- PGC — RD 1514/2007
- RD 8/2019 (registro de jornada)
- RGPD (UE) 2016/679 y LOPDGDD 3/2018
- LGT 58/2003
- LSSI-CE 34/2002
- RD 253/2025 (reporte AEAT Bizum)

---

## ANEXO CAPA 3

# MODELO SIMPLIFICADO DE ENTREGA AL GESTOR
## Marian Madrid Peluquería y Estética

**Principio rector:** *Tú trabajas en el salón. El sistema recopila. El gestor organiza.*

---

## 1. FILOSOFÍA DEL MODELO

Marian no es contable ni gestora. Su trabajo es atender clientas. Este modelo está diseñado para que:

- **El 90% de la documentación se genera sola** (Cierre Z diario, movimientos de caja, fichajes).
- **Marian dedica máximo 20 minutos al mes** a guardar facturas de proveedores y descargar el extracto bancario.
- **El gestor recibe un paquete cerrado** cada trimestre con todo lo que necesita para presentar los modelos tributarios.

> **Regla de oro:** Si Marian tiene que pensar dónde va un documento, el sistema ha fallado. Todo debe tener una única carpeta de destino obvia.

---

## 2. LAS 4 CARPETAS DE MARIAN

Marian solo necesita conocer **4 carpetas**. Nada más. Todo lo demás lo organiza el gestor.

```
📂 Marian Madrid — Gestión
│
├── 🟢 1. VENTAS (automático — no tocas nada)
│
├── 🔴 2. GASTOS (guardas las facturas de proveedores)
│
├── 🔵 3. BANCO (descargas el extracto una vez al mes)
│
└── 🟡 4. PERSONAL (automático — no tocas nada)
```

| Carpeta | Color | ¿Qué contiene? | ¿Quién la llena? | Frecuencia |
| :--- | :--- | :--- | :--- | :--- |
| **1. VENTAS** | 🟢 Verde | Cierres Z, tickets, cobros del día | **El sistema** (Power Automate) | Diaria, automática |
| **2. GASTOS** | 🔴 Rojo | Facturas de proveedores (productos, alquiler, luz, gestoría…) | **Marian** (foto o PDF) | Cuando llega la factura |
| **3. BANCO** | 🔵 Azul | Extractos bancarios de Ibercaja | **Marian** (descarga 1 vez/mes) | Mensual |
| **4. PERSONAL** | 🟡 Amarillo | Fichajes de Alba y Andrea, resumen de horas | **El sistema** (Power Automate) | Semanal, automática |

> **Lo que NO está aquí** (contratos, seguros, licencias, Kit Digital) lo guarda Marian en una carpeta aparte llamada **"DOCUMENTOS DEL NEGOCIO"** que solo abre cuando el gestor o una administración lo pide. No forma parte de la entrega periódica.

---

## 3. LO QUE ES AUTOMÁTICO (Marian no hace nada)

Estos procesos se ejecutan solos gracias al sistema Wix + Power Automate ya implantado:

| Proceso | Qué genera | Cuándo | Dónde cae |
| :--- | :--- | :--- | :--- |
| Cierre Z diario | PDF con resumen del día: total cobrado, desglose por método de pago, IVA | Cada noche a las 01:20 | `1. VENTAS / Cierres Z /` |
| Movimientos de caja | Excel con cada cobro/devolución del día | Cada noche a las 03:00 | `1. VENTAS / Movimientos /` |
| Cobros online procesados por Wix Payments | Informe/registro de transacciones y payouts de Wix Payments | Según disponibilidad del panel | `1. VENTAS / WIX_PAYMENTS /` |
| Fichajes de Alba y Andrea | Excel semanal con entradas/salidas/pausas | Cada lunes a las 06:00 | `4. PERSONAL / Fichajes /` |
| Resumen mensual de horas | PDF por trabajadora | Día 1 de cada mes | `4. PERSONAL / Resumen mensual /` |
| Ventas online (tienda) | Excel con pedidos, IVA y método de pago | Día 2 de cada mes | `1. VENTAS / Tienda online /` |
| Reservas de servicios | Excel con citas realizadas, importes y estado | Día 2 de cada mes | `1. VENTAS / Reservas /` |

**Resultado:** Cuando Marian abre la carpeta `1. VENTAS` a final de mes, ya tiene todo el mes registrado sin haber hecho nada.

---

## 4. LO QUE MARIAN HACE MANUALMENTE (máximo 20 min/mes)

### 4.1 Guardar facturas de gastos (🔴 Carpeta GASTOS)

**¿Cuándo?** Cada vez que recibe una factura de un proveedor.

**¿Cómo?**

1. Si es **papel**: le hace una foto con el móvil (o escanea con la app de Microsoft 365 / Lens).
2. Si es **email/PDF**: lo guarda directamente.
3. Lo sube a la carpeta `2. GASTOS / 2026 / NombreDelMes /`.
4. Le pone un nombre sencillo: `Factura_Loreal_Enero.pdf`

**¿Qué facturas guardar?**

| Tipo de gasto | Ejemplo |
| :--- | :--- |
| Productos de peluquería | L'Oréal, Davines, Olaplex, Wella |
| Alquiler del local | Factura del arrendador de C/ Maurice Ravel 35 |
| Suministros | Luz (Endesa), agua, internet |
| Gestoría / asesoría | Factura del propio gestor |
| Material fungible | Toallas, guantes, papel de aluminio, tinte |
| Marketing / publicidad | Si contrata algo puntual |
| Seguros | RC, local |
| Software / suscripciones | IONOS (dominio), comisiones Wix Payments |
| Reparaciones / mantenimiento | Avería del calentador, pintura del local |

> **Regla sencilla:** Si le han cobrado algo y le han dado una factura → foto → carpeta GASTOS. Si no hay factura (un café, una propina) → no se guarda.

### 4.2 Descargar el extracto bancario (🔵 Carpeta BANCO)

**¿Cuándo?** Una vez al mes, entre el día 1 y el 5.

**¿Cómo?**

1. Entra en la banca online de Ibercaja.
2. Descarga el extracto del mes anterior en PDF.
3. Lo guarda en `3. BANCO / 2026 /`.
4. Nombre: `Extracto_Ibercaja_Enero_2026.pdf`

> Si tiene activada la descarga automática del banco (muchos bancos lo permiten), este paso también se elimina.

### 4.3 Resumen del esfuerzo mensual de Marian

| Tarea | Tiempo | Frecuencia |
| :--- | :--- | :--- |
| Guardar facturas de proveedores (foto + subir) | ~10 min | Según llegan (2-4 al mes) |
| Descargar extracto bancario | ~3 min | 1 vez al mes |
| Revisar que el Cierre Z se generó (mirar la carpeta) | ~2 min | 1 vez al mes |
| **TOTAL** | **~15-20 min/mes** | |

---

## 5. ESTRUCTURA DE CARPETAS COMPLETA (SharePoint / OneDrive)

```
📂 Marian Madrid — Gestión
│
├── 📂 1. VENTAS
│   ├── 📂 Cierres Z
│   │   ├── 📂 2026
│   │   │   ├── 📂 01 Enero
│   │   │   │   ├── 2026-01-02_CierreZ_Z-0001.pdf
│   │   │   │   ├── 2026-01-03_CierreZ_Z-0002.pdf
│   │   │   │   └── ...
│   │   │   ├── 📂 02 Febrero
│   │   │   └── ...
│   ├── 📂 Movimientos
│   │   └── 📂 2026
│   │       ├── 2026-01_Movimientos_Caja.xlsx
│   │       └── ...
│   ├── 📂 WIX_PAYMENTS
│   │   └── 📂 2026
│   │       ├── 2026-01_Informe_Wix_Payments.ext (formato disponible en el panel)
│   │       └── ...
│   ├── 📂 Reservas
│   │   └── 📂 2026
│   │       ├── 2026-01_Reservas_Servicios.xlsx
│   │       └── ...
│   └── 📂 Tienda online
│       └── 📂 2026
│           ├── 2026-01_Ventas_Online.xlsx
│           └── ...
│
├── 📂 2. GASTOS
│   └── 📂 2026
│       ├── 📂 01 Enero
│       │   ├── 2026-01-05_Factura_Loreal_Productos.pdf
│       │   ├── 2026-01-10_Factura_Ibercaja_Comisiones.pdf
│       │   ├── 2026-01-12_Factura_Alquiler_Local.pdf
│       │   └── 2026-01-20_Factura_Endesa_Luz.pdf
│       ├── 📂 02 Febrero
│       └── ...
│
├── 📂 3. BANCO
│   └── 📂 2026
│       ├── 2026-01_Extracto_Ibercaja.pdf
│       ├── 2026-02_Extracto_Ibercaja.pdf
│       └── ...
│
├── 📂 4. PERSONAL
│   ├── 📂 Fichajes
│   │   └── 📂 2026
│   │       ├── 📂 01 Enero
│   │       │   ├── 2026-01_Fichajes_Andrea.xlsx
│   │       │   ├── 2026-01_Fichajes_Alba.xlsx
│   │       │   └── ...
│   └── 📂 Resumen mensual
│       └── 📂 2026
│           ├── 2026-01_Resumen_Horas_Andrea.pdf
│           ├── 2026-01_Resumen_Horas_Alba.pdf
│           └── ...
│
├── 📂 5. DOCUMENTOS DEL NEGOCIO (no se entrega periódicamente)
│   ├── Contrato de alquiler
│   ├── Póliza de seguro RC
│   ├── Póliza de seguro local
│   ├── Alta IAE / Licencia actividad
│   ├── Documentación Kit Digital
│   ├── Contrato IONOS
│   └── ...
│
└── 📂 6. ENTREGA AL GESTOR
    └── 📂 2026
        ├── 📂 T1 (Enero-Marzo)
        ├── 📂 T2 (Abril-Junio)
        ├── 📂 T3 (Julio-Septiembre)
        ├── 📂 T4 (Octubre-Diciembre)
        └── 📂 Anual
```

---

## 6. LA ENTREGA AL GESTOR: QUÉ RECIBE Y CUÁNDO

### 6.1 Frecuencia de entrega

| Periodicidad | Fecha límite | Qué contiene | Para qué lo usa el gestor |
| :--- | :--- | :--- | :--- |
| **Trimestral** | Día 15 del mes siguiente al trimestre | Paquete completo del trimestre | Presentar Modelo 303 (IVA) y Modelo 130 (IRPF) |
| **Anual** | 31 de enero del año siguiente | Consolidado del año completo | Modelo 390, Modelo 100 (Renta), cierre contable |

### 6.2 Contenido del paquete trimestral

Cuando llega el día 15 de abril, julio, octubre o enero, el gestor recibe (por email, SharePoint o carpeta compartida):

| Documento | Origen | Formato |
| :--- | :--- | :--- |
| Resumen de ventas del trimestre (servicios + tienda) | Carpeta `1. VENTAS` | Excel |
| Cierres Z diarios del trimestre | Carpeta `1. VENTAS / Cierres Z` | PDF (o ZIP) |
| Informe de transacciones/payouts de Wix Payments | Carpeta `1. VENTAS / WIX_PAYMENTS` | Formato disponible en el panel; exportación automatizada pendiente de verificar |
| Facturas de gastos del trimestre | Carpeta `2. GASTOS` | PDF (o ZIP) |
| Extracto bancario del trimestre | Carpeta `3. BANCO` | PDF |
| Fichajes y resumen de horas del personal | Carpeta `4. PERSONAL` | Excel + PDF |
| Notas o incidencias del trimestre (si las hay) | Marian | Texto libre |

### 6.3 Cómo se entrega

**Opción preferida (recomendada):** Carpeta compartida en SharePoint / OneDrive.

- Marian comparte la carpeta `6. ENTREGA AL GESTOR` con el gestor.
- El gestor tiene acceso de **solo lectura**.
- No hay que enviar emails con adjuntos. El gestor entra y descarga lo que necesita.

**Opción alternativa:** Email a `gestion@marianmadrid.es` con un ZIP.

### 6.4 Checklist trimestral (lo que Marian verifica antes de entregar)

```
☐ ¿Los Cierres Z se generaron todos los días del trimestre?
  (Mirar la carpeta 1. VENTAS / Cierres Z / y contar que haya ~90 PDFs)

☐ ¿He guardado todas las facturas de gastos del trimestre?
  (Revisar emails, papel acumulado en el mostrador)

☐ ¿He descargado los 3 extractos bancarios del trimestre?
  (Enero, Febrero, Marzo → o el trimestre que toque)

☐ ¿Los fichajes de Alba y Andrea están completos?
  (Mirar la carpeta 4. PERSONAL)

☐ ¿Hay alguna incidencia que deba contarle al gestor?
  (Devolución grande, compra de equipo, cambio de alquiler, etc.)
```

> Si todo está en verde → el paquete está listo. Si falta algo → Marian lo busca y lo sube. Si no lo encuentra → se lo dice al gestor y él lo resuelve.

---

## 7. RUTINA ANUAL COMPLETA (visión simplificada)

| Mes | Qué pasa | Qué hace Marian | Qué hace el sistema | Qué hace el gestor |
| :--- | :--- | :--- | :--- | :--- |
| **Enero** | Cierre del año anterior | Descarga extracto dic. + revisa gastos dic. | Genera Cierre Z diario, fichajes, ventas | Prepara Modelo 390, 100, 347 del año anterior |
| **Febrero** | Entrega anual al gestor | Envía/verifica carpeta `Anual` | — | Presenta Renta (Modelo 100) antes de junio |
| **Marzo** | Fin T1 | Verifica gastos de enero a marzo | Genera Cierres Z, movimientos, fichajes | Prepara Modelo 303 y 130 T1 |
| **Abril** | **Entrega T1** (día 15) | Verifica checklist trimestral | — | **Presenta Modelo 303 y 130 T1** (antes del 20 abril) |
| **Mayo-Junio** | Operativa normal | Guarda facturas, descarga extracto | Cierre Z diario | — |
| **Junio** | Fin T2 | Verifica gastos de abril a junio | Genera Cierres Z, movimientos, fichajes | Prepara Modelo 303 y 130 T2 |
| **Julio** | **Entrega T2** (día 15) | Verifica checklist trimestral | — | **Presenta Modelo 303 y 130 T2** (antes del 20 julio) |
| **Agosto-Sept** | Operativa normal | Guarda facturas, descarga extracto | Cierre Z diario | — |
| **Septiembre** | Fin T3 | Verifica gastos de julio a septiembre | Genera Cierres Z, movimientos, fichajes | Prepara Modelo 303 y 130 T3 |
| **Octubre** | **Entrega T3** (día 15) | Verifica checklist trimestral | — | **Presenta Modelo 303 y 130 T3** (antes del 20 octubre) |
| **Noviembre-Dic** | Operativa normal | Guarda facturas, descarga extracto | Cierre Z diario | — |
| **Diciembre** | Fin T4 + fin de año | Verifica gastos de octubre a diciembre | Genera Cierres Z, movimientos, fichajes | Prepara Modelo 303 y 130 T4 |
| **Enero siguiente** | **Entrega T4** (día 15) | Verifica checklist trimestral | — | **Presenta Modelo 303 y 130 T4** (antes del 20 enero) |

---

## 8. REGLAS SENCILLAS PARA MARIAN

Estas son las **únicas 7 reglas** que Marian necesita recordar:

| Nº | Regla | Ejemplo |
| :--- | :--- | :--- |
| 1 | **Si te dan una factura → foto → carpeta GASTOS** | Llega el repartidor de L'Oréal con la factura → foto con el móvil → subir |
| 2 | **Si pagas algo con tarjeta del negocio → guarda el justificante** | Compras toallas en Amazon → captura del email → carpeta GASTOS |
| 3 | **Una vez al mes → descarga el extracto del banco** | Día 2 de febrero → Ibercaja → PDF de enero → carpeta BANCO |
| 4 | **No toques las carpetas verdes (VENTAS) ni amarillas (PERSONAL)** | Esas se llenan solas. Solo mira que estén. |
| 5 | **Si el gestor te pide algo → busca en la carpeta que toca** | "¿Tienes la factura de la luz de marzo?" → carpeta GASTOS / 2026 / 03 Marzo |
| 6 | **Si no encuentras algo → dile al gestor que no lo tienes** | No inventes. No pasa nada. Él lo resuelve. |
| 7 | **El día 15 de abril, julio, octubre y enero → revisa el checklist** | 5 minutos. Si todo está → paquete listo. |

---

## 9. QUÉ NO TIENE QUE HACER MARIAN

Para que quede absolutamente claro:

| Tarea | ¿La hace Marian? | ¿Quién la hace? |
| :--- | :--- | :--- |
| Calcular el IVA | ❌ No | El gestor |
| Presentar modelos tributarios | ❌ No | El gestor |
| Hacer asientos contables | ❌ No | El gestor |
| Generar el Cierre Z | ❌ No | El sistema (automático cada noche) |
| Registrar cada cobro individual | ❌ No | El sistema (MovimientosCaja) |
| Calcular horas extra de Alba y Andrea | ❌ No | El sistema (RegistrosHorariosStaff) |
| Generar facturas simplificadas | ❌ No | El sistema (Wix Invoices + Veri*Factu) |
| Conciliar banco con ventas | ❌ No | El gestor |
| Preparar el Modelo 303 | ❌ No | El gestor |
| Preparar la Renta | ❌ No | El gestor |
| Guardar datos de tarjetas de clientas | ❌ No | Prohibido (RGPD). Wix Payments procesa los datos de tarjeta durante el checkout; el CMS no almacena PAN ni CVV. |

---

## 10. AUTOMATIZACIÓN: LO QUE POWER AUTOMATE HACE POR MARIAN

Estos flujos ya están diseñados (ver PTD Kit Digital, Sección 7.5) y se ejecutan sin intervención:

| Flujo | Qué hace | Cuándo |
| :--- | :--- | :--- |
| **Cierre Z → OneDrive** | Detecta el CSV de Cierre Z generado por Wix → lo guarda en `1. VENTAS / Cierres Z / AAAA / MM /` | Cada noche, 02:30 |
| **Fichajes semanales** | Exporta los fichajes de `RegistrosHorariosStaff` → Excel por trabajadora → `4. PERSONAL /` | Cada lunes, 06:00 |
| **Alerta de Cierre Z faltante** | Si a las 08:00 no hay Cierre Z del día anterior → email a Marian | Cada día, 08:00 |
| **Resumen trimestral** | El día 10 post-trimestre, consolida todo en `6. ENTREGA AL GESTOR / T{n} /` | Trimestral |
| **Recordatorio al gestor** | El día 12 post-trimestre, envía email al gestor: "Paquete T{n} disponible" | Trimestral |

---

## 11. EJEMPLO PRÁCTICO: UN MES EN LA VIDA DE MARIAN

### Enero 2027 — Semana a semana

| Semana | Qué pasa en el salón | Qué hace el sistema | Qué hace Marian |
| :--- | :--- | :--- | :--- |
| **Semana 1** (1-7 enero) | Clientas de color, corte, keratina. Venta de champús. | Cierre Z cada noche. Fichajes de Alba y Andrea. | Nada. |
| **Semana 2** (8-14 enero) | Llega el repartidor de Davines con productos. Marian paga la factura de la luz. | Cierre Z. Fichajes. | Foto de la factura Davines → `GASTOS / 2027 / 01 Enero /`. Foto del recibo de la luz → misma carpeta. |
| **Semana 3** (15-21 enero) | Operativa normal. | Cierre Z. Fichajes. | Nada. |
| **Semana 4** (22-31 enero) | Operativa normal. | Cierre Z. Fichajes. | Día 30: descarga extracto Ibercaja de enero → `BANCO / 2027 /`. |
| **Día 1 febrero** | — | El sistema genera el resumen de horas de enero (PDF para Andrea y Alba). | Marian mira que el resumen está en `4. PERSONAL /`. Listo. |

**Tiempo total dedicado por Marian en enero: ~5 minutos.**

### Entrega T1 (día 15 de abril)

1. El sistema ya ha consolidado todo en `6. ENTREGA AL GESTOR / 2027 / T1 /`.
2. Marian abre la carpeta. Ve el Excel resumen, los ZIPs de Cierres Z, las facturas de gastos.
3. Revisa el checklist (¿está todo?).
4. Si falta alguna factura de enero que se le olvidó → la busca en el email → la sube.
5. Listo. El gestor ya tiene acceso.

**Tiempo total dedicado por Marian en la entrega trimestral: ~10 minutos.**

---

## 12. FORMATO DE ENTREGA AL GESTOR: EL "PAQUETE"

Cuando el gestor abre la carpeta del trimestre, encuentra exactamente esto:

```
📂 T1_2027/
│
├── 📄 00_RESUMEN_TRIMESTRE.xlsx          ← Hoja resumen con:
│   ├── Hoja 1: VENTAS (total por mes, por método de pago, IVA)
│   ├── Hoja 2: GASTOS (total por categoría, IVA soportado)
│   ├── Hoja 3: IVA (repercutido - soportado = resultado)
│   ├── Hoja 4: PERSONAL (horas, coste salarial)
│   └── Hoja 5: CHECKLIST (qué incluye este paquete)
│
├── 📂 VENTAS/
│   ├── Cierres_Z_T1.zip                  ← 90 PDFs (enero + febrero + marzo)
│   ├── Movimientos_Caja_T1.xlsx          ← Todos los cobros del trimestre
│   ├── WIX_PAYMENTS_T1.zip                      ← Extractos Wix Payments
│   ├── Reservas_T1.xlsx                  ← Servicios realizados
│   └── Tienda_Online_T1.xlsx             ← Pedidos online
│
├── 📂 GASTOS/
│   ├── 2027-01_Factura_Davines.pdf
│   ├── 2027-01_Factura_Alquiler.pdf
│   ├── 2027-01_Factura_Endesa.pdf
│   ├── 2027-02_Factura_Loreal.pdf
│   ├── ... (todas las facturas del trimestre)
│   └── INDICE_GASTOS.xlsx                ← Lista con: proveedor, fecha, base, IVA, total
│
├── 📂 BANCO/
│   ├── 2027-01_Extracto_Ibercaja.pdf
│   ├── 2027-02_Extracto_Ibercaja.pdf
│   └── 2027-03_Extracto_Ibercaja.pdf
│
└── 📂 PERSONAL/
    ├── Fichajes_T1_Andrea.xlsx
    ├── Fichajes_T1_Alba.xlsx
    ├── Resumen_Horas_T1_Andrea.pdf
    └── Resumen_Horas_T1_Alba.pdf
```

> El gestor descarga el ZIP, lo organiza según su propio sistema contable (A3, Sage, Holded, Contasol…) y presenta los modelos. Marian no necesita saber cómo lo hace.

---

## 13. PREGUNTAS FRECUENTES DE MARIAN

| Pregunta | Respuesta |
| :--- | :--- |
| "¿Tengo que hacer algo todos los días?" | **No.** El sistema genera el Cierre Z solo. Tú solo guarda facturas cuando lleguen. |
| "¿Qué pasa si un día no se genera el Cierre Z?" | Recibirás un email de alerta a las 8:00. Si pasa, llama al soporte técnico. |
| "¿Tengo que hacer facturas a mano?" | **No.** El sistema genera facturas simplificadas automáticamente con cada cobro. |
| "¿Qué pasa con las propinas?" | Las propinas en efectivo no son ingreso del negocio. No se registran. Si una clienta deja propina con tarjeta, solo se registra si el checkout y los datos nativos de Wix Payments exponen ese importe; pendiente de verificar. |
| "¿Tengo que darle mis claves del banco al gestor?" | **No.** El gestor solo necesita el extracto PDF. Nunca las claves. |
| "¿Qué pasa si una clienta me pide una factura?" | Se la generas desde el sistema (Wix Invoices). Si es una factura completa (no simplificada), pides sus datos fiscales y se emite. |
| "¿Y si compro algo con mi tarjeta personal para el negocio?" | Guarda el ticket/factura. Dile al gestor que lo pagaste tú. Él lo registra como aportación. |
| "¿Tengo que imprimir algo?" | **No.** Todo es digital. Solo imprimes si el gestor o una inspección lo pide expresamente. |
| "¿Cuánto tiempo tengo que guardar todo?" | Mínimo **4 años** (fiscal) y **6 años** (mercantil). El gestor te lo confirma. Pero en SharePoint/OneDrive queda guardado automáticamente. |
| "¿Y si viene una inspección?" | Abres la carpeta. Todo está organizado. En 15 minutos tienes cualquier documento desde 2024. |

---

## 14. RESUMEN VISUAL: EL FLUJO COMPLETO

```
┌─────────────────────────────────────────────────────────────────┐
│                    EL SALÓN (Marian trabaja)                     │
│  Clientas → Servicios → Cobros (efectivo/tarjeta/Bizum)         │
│  Alba y Andrea → Fichan entrada/salida                           │
│  Tienda online → Pedidos → Pagos                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ (automático, cada noche)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              EL SISTEMA (Wix + Power Automate)                   │
│  • Genera Cierre Z diario                                        │
│  • Registra cada movimiento de caja                              │
│  • Registra fichajes                                             │
│  • Registra ventas online                                        │
│  • Genera facturas simplificadas                                 │
│  • Encadena hashes SHA-256 (Veri*Factu)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ (Power Automate lo deposita)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           LAS 4 CARPETAS (SharePoint / OneDrive)                 │
│  🟢 VENTAS  │  🔴 GASTOS  │  🔵 BANCO  │  🟡 PERSONAL          │
│  (auto)     │  (Marian)   │  (Marian)  │  (auto)               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ (día 15 post-trimestre)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              📦 ENTREGA AL GESTOR                                │
│  Paquete trimestral consolidado                                  │
│  El gestor lo recibe, lo organiza según su sistema contable     │
│  y presenta los modelos tributarios ante la AEAT                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. CIERRE

Este modelo está diseñado para que **Marian dedique menos de 20 minutos al mes** a la gestión documental y **menos de 10 minutos por trimestre** a la entrega al gestor. El resto lo hace el sistema.

La clave no es que Marian aprenda contabilidad. La clave es que el sistema genere la documentación de forma automática, fiable y conforme a la ley (Veri*Factu, PGC, RD 8/2019, RGPD), y que Marian solo tenga que guardar las facturas de sus proveedores y descargar un extracto bancario.

**El gestor recibe un paquete limpio, completo y trazable. Marian sigue atendiendo clientas.**

---

# SOLUCIÓN TÉCNICA — CAPA 3 AUTOMATIZADA

> **Estado de implantación verificado — 8 de noviembre de 2026:** este anexo define la arquitectura objetivo de Capa 3; no acredita que esté desplegada. En `main` no existe `src/backend/exports/exportService.js`, no hay llamadas runtime a Resend ni los cuatro jobs específicos de exportación en `jobs.config`. Existe `verifyNightlyZClosing`, pero no genera ni envía actualmente el CSV de Cierre Z. El tenant M365, SharePoint y los flujos PA-01…PA-07 no han sido auditados; su estado queda **pendiente de verificación**, no se presume activo.


## Wix (SSOT) → M365 Business Standard → SharePoint
### Marian Madrid Peluquería y Estética · marianmadrid.es

---

## 0. DECISIÓN DE ARQUITECTURA: POR QUÉ EL PATRÓN EMAIL

### 0.1 Restricción de licencia

La licencia **Microsoft 365 Business Standard** incluida en el Kit Digital incorpora Power Automate con **conectores estándar únicamente**. Los conectores HTTP (Request/Response), necesarios para recibir webhooks directos de Wix, son **PREMIUM** y no están incluidos.

| Conector Power Automate | ¿Incluido en M365 Business Standard? |
| :--- | :--- |
| Office 365 Outlook (email) | ✅ Sí — Estándar |
| SharePoint Online | ✅ Sí — Estándar |
| Excel Online (Business) | ✅ Sí — Estándar |
| OneDrive for Business | ✅ Sí — Estándar |
| Microsoft Teams | ✅ Sí — Estándar |
| Microsoft Forms | ✅ Sí — Estándar |
| HTTP / Request (webhook) | ❌ No — **Premium** (~15 €/mes) |
| Wix (conector nativo) | ❌ No existe |

### 0.2 Solución elegida

**Patrón email estructurado:** el backend de Wix (que ya integra Resend según SSOT §9) genera un correo con adjunto CSV/JSON y lo envía a `gestion@marianmadrid.es`. Power Automate detecta el email mediante el conector estándar **Office 365 Outlook**, extrae el adjunto y lo deposita en la carpeta correspondiente de **SharePoint Online**.

Este patrón:

- Está **ya descrito y aprobado** en el PTD Kit Digital (Sección 7.5, Fase 3).
- Usa **exclusivamente conectores estándar** incluidos en la licencia.
- No requiere registro de aplicaciones en Azure AD.
- No requiere conectores premium ni licencias adicionales.
- No requiere que Marian intervenga en los flujos automáticos.
- Es **100% legal**: los datos transitan por servidores de Microsoft en la UE (cumplimiento RGPD), el correo viaja cifrado (TLS 1.2+, SPF/DKIM/DMARC ya configurados en IONOS según PTD §19.3), y SharePoint aplica cifrado AES-256 en reposo.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  WIX VELO (SSOT)                                                       │
│  Crons → backend → Resend API → email a gestion@marianmadrid.es        │
│  Adjunto: CSV/JSON estructulado                                        │
│  Asunto: formato canónico para filtrado Power Automate                 │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ SMTP / TLS 1.2+
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  IONOS MX (mx00.ionos.es) → Buzón gestion@marianmadrid.es              │
│  SPF + DKIM + DMARC activos (PTD §19.3)                                │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ Conector Office 365 Outlook (ESTÁNDAR)
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  POWER AUTOMATE (M365 Business Standard)                                │
│  Trigger: "When a new email arrives (V3)"                               │
│  Filtro: remitente + asunto + adjunto                                   │
│  Acción: extraer adjunto → crear archivo en SharePoint                  │
│  Acción: actualizar Excel de consolidación (si aplica)                  │
│  Acción: notificar a Marian por Teams/Outlook (si aplica)               │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ Conector SharePoint Online (ESTÁNDAR)
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SHAREPOINT ONLINE — MarianMadrid_Documentacion                         │
│  Biblioteca de documentos con estructura de carpetas Capa 3             │
│  Permisos: Marian (escritura) · Gestor (lectura) · Sistema (escritura) │
│  Retención: 6 años (Código de Comercio art. 30)                        │
│  Versionado: 500 versiones por archivo                                  │
│  Cifrado: AES-256 en reposo · TLS 1.2+ en tránsito                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 0.3 Alternativas descartadas y motivo

| Alternativa | Motivo de descarte |
| :--- | :--- |
| Wix Webhook → Power Automate HTTP trigger | Conector HTTP es **Premium**. No incluido en M365 Business Standard. |
| Wix `wix-fetch` → Microsoft Graph API directo | Requiere registro de app en Azure AD, flujo OAuth2 client credentials, gestión de tokens. Complejidad desproporcionada para el volumen de datos. |
| Wix → Google Sheets → Power Automate | Conector Google no disponible en estándar. Añade dependencia externa. |
| Wix → FTP → OneDrive sync local | Requiere PC siempre encendido. Frágil. No auditable. |
| Copia manual por Marian | No es automatizado. Error humano. Incumple prioridad 1 (Fiabilidad). |

---

## 1. ARQUITECTURA DE LA SOLUCIÓN

### 1.1 Componentes del sistema

| Componente | Tecnología | Rol |
| :--- | :--- | :--- |
| **Origen de datos (SSOT)** | Wix CMS (`MovimientosCaja`, `HistoricoCierresZ`, `CitasF2`, `RegistrosHorariosStaff`, `InventarioStockVenta`, `MovimientosInventario`) | Autoridad transaccional. Genera los datos. |
| **Generador de exports** | Backend Velo: `backend/exports/` (nuevo módulo) + `backend/crons.js` | Consulta CMS, formatea CSV/JSON, invoca Resend. |
| **Transporte** | Resend API (ya integrado, SSOT §9) → email a `gestion@marianmadrid.es` | Canal de entrega. Cifrado TLS. |
| **Receptor** | Buzón IONOS `gestion@marianmadrid.es` → reenvío POP3 a M365 | Recepción del correo. |
| **Automatización** | Power Automate (M365 Business Standard) | Detecta email, extrae adjunto, deposita en SharePoint. |
| **Destino documental** | SharePoint Online — Biblioteca `MarianMadrid_Documentacion` | Almacenamiento inmutable, versionado, permisos, retención. |
| **Consolidación** | Excel Online (SharePoint) | Hojas de cálculo acumulativas para el gestor. |
| **Notificación** | Outlook / Teams (opcional) | Alerta a Marian si un flujo falla o si el paquete trimestral está listo. |

### 1.2 Flujo de datos end-to-end

```
Wix CMS (SSOT)
    │
    ├─ verifyNightlyZClosing (cron 01:20)
    │   └→ HistoricoCierresZ → export Z → Resend → email
    │
    ├─ exportDailyMovements (cron 03:00)
    │   └→ MovimientosCaja (día anterior) → export CSV → Resend → email
    │
    ├─ exportWeeklyFichajes (cron lunes 06:00)
    │   └→ RegistrosHorariosStaff (semana anterior) → export CSV → Resend → email
    │
    ├─ exportMonthlyVentas (cron día 2, 06:00)
    │   └→ CitasF2 + Stores/Orders (mes anterior) → export CSV → Resend → email
    │
    └─ exportMonthlyInventario (cron día 3, 06:00)
        └→ MovimientosInventario (mes anterior) → export CSV → Resend → email
    │
    ▼
gestion@marianmadrid.es
    │
    ▼
Power Automate (5 flujos, uno por tipo de export)
    │
    ▼
SharePoint Online → carpetas Capa 3
```

---

## 2. IMPLEMENTACIÓN EN WIX (BACKEND)

### 2.1 Módulo de exportación: `backend/exports/exportService.js`

Este módulo es el único punto de generación de exports. No duplica lógica: consulta el CMS, formatea y envía.

```javascript
/**
 * @module exportService
 * @version 1.0.0
 * @responsibility Generación de exports CSV/JSON y envío por email
 *                 para consumo de Power Automate (Capa 3).
 * @apis @wix/data (elevate), Resend (fetch), @wix/essentials
 * @standards SSOT v10.0 §0.2, §0.5, §18
 */

import { items } from '@wix/data';
import { elevate } from '@wix/essentials';
import { getSecret } from 'backend/secretAccess';
import { BUSINESS_COLLECTIONS } from 'backend/internalConfig';
import { getMadridLocalStringNoZ, _roundMoney } from 'public/mmUtils';

const EXPORT_EMAIL_TARGET = 'gestion@marianmadrid.es';
const EXPORT_EMAIL_FROM = 'sistema@marianmadrid.es';
const EXPORT_SUBJECT_PREFIX = '[MM-EXPORT]';

/**
 * Envía un email con adjunto CSV a gestion@ mediante Resend.
 * El asunto sigue formato canónico para filtrado en Power Automate:
 *   [MM-EXPORT] TIPO_EXPORT AAAA-MM-DD
 */
async function sendExportEmail({ exportType, dateLabel, csvContent, filename }) {
  const apiKey = await getSecret('RESEND_API_KEY');

  const subject = `${EXPORT_SUBJECT_PREFIX} ${exportType} ${dateLabel}`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EXPORT_EMAIL_FROM,
      to: [EXPORT_EMAIL_TARGET],
      subject: subject,
      html: `<p>Export automático del sistema Marian Madrid.</p>
             <p>Tipo: ${exportType}</p>
             <p>Fecha: ${dateLabel}</p>
             <p>Archivo adjunto: ${filename}</p>
             <p>No responder. Generado automáticamente.</p>`,
      attachments: [{
        filename: filename,
        content: csvContent,
        type: 'text/csv',
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`EXPORT_EMAIL_FAIL: ${response.status}`);
  }
}
```

### 2.2 Exportadores por tipo de dato

#### A. Cierre Z diario (ya existe el cron `verifyNightlyZClosing`)

Se añade al final del cron existente la llamada a export:

```javascript
// En backend/crons.js, dentro de verifyNightlyZClosing():
// ... tras insertar en HistoricoCierresZ ...

const cierreZ = {
  zNumber: closingRecord.zNumber,
  closeDate: closingRecord.closeDate,
  totalCash: closingRecord.totalCash,
  totalCard: closingRecord.totalCard,
  totalBizum: closingRecord.totalBizum,
  totalOnline: closingRecord.totalOnline,
  totalTaxBase: closingRecord.totalTaxBase,
  totalTaxAmount: closingRecord.totalTaxAmount,
  totalRefunds: closingRecord.totalRefunds,
  closingHash: closingRecord.closingHash,
  isIntegrityVerified: closingRecord.isIntegrityVerified,
};

await sendExportEmail({
  exportType: 'CIERRE_Z',
  dateLabel: cierreZ.closeDate,
  csvContent: buildCierreZCSV(cierreZ),
  filename: `${cierreZ.closeDate}_CierreZ_Z-${cierreZ.zNumber}.csv`,
});
```

#### B. Movimientos de caja diarios

```javascript
// Nuevo cron: exportDailyMovements — 0 3 * * *
export async function exportDailyMovements() {
  const yesterday = getMadridYesterday();

  const elevatedQuery = elevate(items.query);
  const result = await elevatedQuery(BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA)
    .eq('dateYmd', yesterday)
    .ascending('sequenceNumber')
    .limit(1000)
    .find();

  const rows = result.items.map(m => ({
    sequenceNumber: m.sequenceNumber,
    numSerieFactura: m.numSerieFactura,
    fechaExpedicionFactura: m.fechaExpedicionFactura,
    movementType: m.movementType,
    channelType: m.channelType,
    paymentMethod: m.paymentMethod,
    amount: _roundMoney(m.amount),
    taxBase: _roundMoney(m.taxBase),
    taxAmount: _roundMoney(m.taxAmount),
    tipoImpositivo: m.tipoImpositivo,
    hash: m.hash,
    transactionId: m.transactionId,
    traceId: m.traceId,
  }));

  await sendExportEmail({
    exportType: 'MOVIMIENTOS_CAJA',
    dateLabel: yesterday,
    csvContent: toCSV(rows),
    filename: `${yesterday}_Movimientos_Caja.csv`,
  });
}
```

#### C. Fichajes laborales semanales

```javascript
// Nuevo cron: exportWeeklyFichajes — 0 6 * * 1 (lunes 06:00)
export async function exportWeeklyFichajes() {
  const lastWeekRange = getMadridLastWeekRange();

  const elevatedQuery = elevate(items.query);
  const result = await elevatedQuery(BUSINESS_COLLECTIONS.REGISTROS_HORARIOS_STAFF)
    .between('recordedAt', lastWeekRange.start, lastWeekRange.end)
    .ascending('recordedAt')
    .limit(1000)
    .find();

  const rows = result.items.map(r => ({
    resourceId: r.resourceId,
    staffName: r.staffName,
    clockEventType: r.clockEventType,
    recordedAt: getMadridLocalStringNoZ(new Date(r.recordedAt)),
    recordType: r.recordType,
    notes: r.notes || '',
    traceId: r.traceId,
  }));

  await sendExportEmail({
    exportType: 'FICHAJES_SEMANAL',
    dateLabel: lastWeekRange.label,
    csvContent: toCSV(rows),
    filename: `${lastWeekRange.label}_Fichajes_Staff.csv`,
  });
}
```

#### D. Ventas y reservas mensuales

```javascript
// Nuevo cron: exportMonthlyVentas — 0 6 2 * * (día 2, 06:00)
export async function exportMonthlyVentas() {
  const lastMonth = getMadridLastMonth();

  // CitasF2: reservas del mes
  const elevatedQuery = elevate(items.query);
  const citas = await elevatedQuery(BUSINESS_COLLECTIONS.CITAS_F2)
    .startsWith('dateYmd', lastMonth.ymPrefix)
    .ascending('dateYmd')
    .limit(1000)
    .find();

  const rows = citas.items.map(c => ({
    dateYmd: c.dateYmd,
    bookingId: c.bookingId,
    bookingType: c.bookingType,
    bookingStatus: c.bookingStatus,
    paymentStatus: c.paymentStatus,
    serviceId: c.serviceId,
    resourceId: c.resourceId,
    totalAmount: _roundMoney(c.totalAmount),
    channelType: c.channelType || '',
    traceId: c.traceId,
  }));

  await sendExportEmail({
    exportType: 'VENTAS_MENSUAL',
    dateLabel: lastMonth.label,
    csvContent: toCSV(rows),
    filename: `${lastMonth.label}_Ventas_Reservas.csv`,
  });
}
```

#### E. Inventario mensual

```javascript
// Nuevo cron: exportMonthlyInventario — 0 6 3 * * (día 3, 06:00)
export async function exportMonthlyInventario() {
  const lastMonth = getMadridLastMonth();

  const elevatedQuery = elevate(items.query);
  const movimientos = await elevatedQuery(BUSINESS_COLLECTIONS.MOVIMIENTOS_INVENTARIO)
    .between('recordTimestamp', lastMonth.start, lastMonth.end)
    .ascending('recordTimestamp')
    .limit(1000)
    .find();

  const rows = movimientos.items.map(m => ({
    movementToken: m.movementToken,
    movementType: m.movementType,
    sku: m.sku,
    productName: m.productName || '',
    quantityDelta: m.quantityDelta,
    stockBefore: m.stockBefore,
    stockAfter: m.stockAfter,
    reason: m.reason || '',
    traceId: m.traceId,
  }));

  await sendExportEmail({
    exportType: 'INVENTARIO_MENSUAL',
    dateLabel: lastMonth.label,
    csvContent: toCSV(rows),
    filename: `${lastMonth.label}_Movimientos_Inventario.csv`,
  });
}
```

### 2.3 Declaración de crons en `backend/jobs.config`

Se añaden los nuevos crons a la configuración existente:

```json
{
  "jobs": [
    // ... crons existentes (cleanExpiredLocks, verifyNightlyZClosing, etc.) ...

    {
      "functionLocation": "/crons.js",
      "functionName": "exportDailyMovements",
      "description": "Export diario de MovimientosCaja a email para Capa 3",
      "executionConfig": { "cron": "0 3 * * *" }
    },
    {
      "functionLocation": "/crons.js",
      "functionName": "exportWeeklyFichajes",
      "description": "Export semanal de fichajes laborales a email para Capa 3",
      "executionConfig": { "cron": "0 6 * * 1" }
    },
    {
      "functionLocation": "/crons.js",
      "functionName": "exportMonthlyVentas",
      "description": "Export mensual de ventas y reservas a email para Capa 3",
      "executionConfig": { "cron": "0 6 2 * *" }
    },
    {
      "functionLocation": "/crons.js",
      "functionName": "exportMonthlyInventario",
      "description": "Export mensual de inventario a email para Capa 3",
      "executionConfig": { "cron": "0 6 3 * *" }
    }
  ]
}
```

### 2.4 Formato canónico del asunto del email

Power Automate filtra por el asunto. El formato es estricto:

```
[MM-EXPORT] {TIPO_EXPORT} {AAAA-MM-DD}
```

| `TIPO_EXPORT` | Frecuencia | Ejemplo de asunto |
| :--- | :--- | :--- |
| `CIERRE_Z` | Diario | `[MM-EXPORT] CIERRE_Z 2027-01-15` |
| `MOVIMIENTOS_CAJA` | Diario | `[MM-EXPORT] MOVIMIENTOS_CAJA 2027-01-15` |
| `FICHAJES_SEMANAL` | Semanal (lunes) | `[MM-EXPORT] FICHAJES_SEMANAL 2027-S03` |
| `VENTAS_MENSUAL` | Mensual (día 2) | `[MM-EXPORT] VENTAS_MENSUAL 2027-01` |
| `INVENTARIO_MENSUAL` | Mensual (día 3) | `[MM-EXPORT] INVENTARIO_MENSUAL 2027-01` |

### 2.5 Formato CSV canónico

Todos los CSV usan:
- Separador: coma (`,`)
- Codificación: UTF-8
- Primera línea: cabeceras en `camelCase` (nomenclatura SSOT)
- Sin PII: nunca se incluyen nombres de clientes, emails ni teléfonos
- Importes: 2 decimales, sin símbolo de moneda
- Fechas: formato ISO 8601 (`AAAA-MM-DD` o `AAAA-MM-DDTHH:mm:ss`)

### 2.6 Seguridad del flujo de exportación

| Aspecto | Implementación |
| :--- | :--- |
| **Autenticación Resend** | API key en Wix Secrets Manager (`RESEND_API_KEY`). Nunca en código ni frontend. |
| **Cifrado transporte** | TLS 1.2+ entre Resend y IONOS MX. SPF/DKIM/DMARC activos (PTD §19.3). |
| **Cifrado reposo** | SharePoint Online: AES-256. OneDrive: AES-256. |
| **PII** | Los CSV de export **nunca** incluyen datos de clientes. Solo datos económicos y operativos. |
| **Idempotencia** | Cada export incluye `traceId`. Power Automate verifica que el archivo no exista ya en SharePoint antes de crearlo. |
| **Elevación** | Las consultas al CMS usan `elevate()` de `@wix/essentials` (SSOT §8, uso restringido a operaciones de sistema). |

---

## 3. IMPLEMENTACIÓN EN POWER AUTOMATE

### 3.1 Flujos a crear (5 flujos, todos con conectores estándar)

| ID | Nombre del flujo | Trigger | Conectores usados | Frecuencia |
| :--- | :--- | :--- | :--- | :--- |
| **PA-01** | Cierre Z → SharePoint | When a new email arrives (V3) | Office 365 Outlook + SharePoint | Diario |
| **PA-02** | Movimientos Caja → SharePoint | When a new email arrives (V3) | Office 365 Outlook + SharePoint | Diario |
| **PA-03** | Fichajes → SharePoint | When a new email arrives (V3) | Office 365 Outlook + SharePoint | Semanal |
| **PA-04** | Ventas Mensual → SharePoint + Excel | When a new email arrives (V3) | Office 365 Outlook + SharePoint + Excel Online | Mensual |
| **PA-05** | Inventario → SharePoint + Excel | When a new email arrives (V3) | Office 365 Outlook + SharePoint + Excel Online | Mensual |

### 3.2 Estructura del flujo PA-01 (Cierre Z → SharePoint)

Este es el flujo principal y sirve como plantilla para los demás.

```
TRIGGER: When a new email arrives (V3)
│  Carpeta: Inbox
│  De: sistema@marianmadrid.es
│  Asunto contiene: [MM-EXPORT] CIERRE_Z
│  Tiene adjuntos: Sí
│
├─ PASO 1: Initialize variable
│   Nombre: fileName
│   Tipo: String
│   Valor: (vacío, se rellena en paso 2)
│
├─ PASO 2: Apply to each → Attachments
│   │
│   ├─ PASO 2.1: Compose
│   │   Salida: attachment.Name
│   │   → fileName = attachment.Name
│   │
│   ├─ PASO 2.2: Compose
│   │   Salida: base64ToBinary(attachment.ContentBytes)
│   │   → fileContent
│   │
│   └─ PASO 2.3: SharePoint → Create file
│       Site: MarianMadrid_Documentacion
│       Library: Documentos_Capa3
│       Path: /1_VENTAS/Cierres_Z/2027/
│       Name: fileName (del paso 2.1)
│       Content: fileContent (del paso 2.2)
│
├─ PASO 3: Condition → ¿Archivo creado correctamente?
│   │
│   ├─ SÍ:
│   │   └─ Send Email (Outlook)
│   │      Para: marian@marianmadrid.es
│   │      Asunto: "✅ Cierre Z recibido y archivado"
│   │      Cuerpo: "El Cierre Z {fileName} se ha guardado en SharePoint."
│   │
│   └─ NO:
│       └─ Send Email (Outlook)
│          Para: marian@marianmadrid.es
│          Asunto: "⚠️ Error al archivar Cierre Z"
│          Cuerpo: "No se pudo guardar {fileName}. Revisar manualmente."
│
└─ PASO 4: (Opcional) Mark email as read
```

### 3.3 Estructura del flujo PA-04 (Ventas Mensual → SharePoint + Excel)

Este flujo añade la actualización de un Excel consolidado en SharePoint.

```
TRIGGER: When a new email arrives (V3)
│  Asunto contiene: [MM-EXPORT] VENTAS_MENSUAL
│
├─ PASO 1: Extraer adjunto CSV
│   (igual que PA-01, pasos 1-2)
│
├─ PASO 2: SharePoint → Create file
│   Path: /1_VENTAS/Reservas/2027/
│   Name: 2027-01_Ventas_Reservas.csv
│
├─ PASO 3: Excel Online → List rows present in table
│   File: /1_VENTAS/Consolidado_Ventas_2027.xlsx
│   Table: VentasMensuales
│   (para verificar si el mes ya está cargado)
│
├─ PASO 4: Condition → ¿El mes ya existe en Excel?
│   │
│   ├─ NO → Parse CSV → Add rows to Excel table
│   │   Excel Online → Add a row
│   │   File: Consolidado_Ventas_2027.xlsx
│   │   Table: VentasMensuales
│   │   Row: { mes, totalVentas, totalIVA, totalReservas, ... }
│   │
│   └─ SÍ → Skip (idempotencia)
│
└─ PASO 5: Send Email → Marian
    "Ventas de {mes} consolidadas en Excel."
```

### 3.4 Flujo adicional PA-06: Gastos manuales de Marian

Para las facturas de proveedores que Marian escanea:

```
TRIGGER: When a new email arrives (V3)
│  De: marian@marianmadrid.es (o cualquier remitente)
│  Asunto contiene: [GASTO]
│  Tiene adjuntos: Sí
│
├─ PASO 1: Extraer adjunto (PDF o imagen)
│
├─ PASO 2: Extraer mes actual del asunto
│   Formato esperado: [GASTO] AAAA-MM Descripcion
│   Ejemplo: [GASTO] 2027-01 Factura Loreal productos
│
├─ PASO 3: SharePoint → Create file
│   Path: /2_GASTOS/2027/01_Enero/
│   Name: {attachment.Name}
│
└─ PASO 4: Send Email → Marian
    "Factura archivada en GASTOS."
```

> **Uso por Marian:** Cuando recibe una factura de proveedor, la reenvía a `gestion@marianmadrid.es` con asunto `[GASTO] 2027-01 Factura Loreal`. Power Automate la archiva automáticamente. Si prefiere, también puede subirla directamente a SharePoint desde el móvil.

### 3.5 Flujo PA-07: Preparación trimestral para el gestor

```
TRIGGER: Recurrence
│  Frecuencia: Mensual
│  Día: 10
│  Hora: 09:00
│  Solo en meses: Enero, Abril, Julio, Octubre
│
├─ PASO 1: Determinar trimestre terminado
│   Enero → T4 del año anterior
│   Abril → T1
│   Julio → T2
│   Octubre → T3
│
├─ PASO 2: SharePoint → Get files (múltiples carpetas)
│   - /1_VENTAS/Cierres_Z/{year}/
│   - /1_VENTAS/Movimientos/{year}/
│   - /1_VENTAS/Reservas/{year}/
│   - /2_GASTOS/{year}/
│   - /3_BANCO/{year}/
│   - /4_PERSONAL/Fichajes/{year}/
│
├─ PASO 3: SharePoint → Create folder
│   Path: /6_ENTREGA_GESTOR/{year}/T{n}_{year}/
│
├─ PASO 4: SharePoint → Copy files
│   Copiar todos los archivos del trimestre a la carpeta de entrega
│
├─ PASO 5: Excel Online → Create workbook
│   /6_ENTREGA_GESTOR/{year}/T{n}_{year}/Resumen_Trimestre.xlsx
│   Hojas: VENTAS, GASTOS, IVA, PERSONAL, CHECKLIST
│
├─ PASO 6: Send Email → Gestor + Marian
│   Asunto: "📦 Paquete T{n} {year} disponible"
│   Cuerpo: Enlace SharePoint + resumen importes
│
└─ PASO 7: Create Event (Outlook Calendar)
    Título: "PRESENTAR Modelo 303/130 T{n} {year}"
    Fecha: día 20 del mes
    Recordatorio: 5 días antes
```

---

## 4. IMPLEMENTACIÓN EN SHAREPOINT ONLINE

### 4.1 Creación del sitio y biblioteca

**Sitio SharePoint:** `MarianMadrid_Documentacion` (tipo: Team Site)
**Biblioteca de documentos:** `Documentos_Capa3`

Configuración de la biblioteca:

| Parámetro | Valor | Motivo |
| :--- | :--- | :--- |
| Versionado | Activado, 500 versiones | Trazabilidad de modificaciones |
| Content approval | Desactivado | Simplificar. El gestor valida. |
| Check out obligatorio | Desactivado | Permite edición concurrente del Excel |
| Retención | 6 años (política de retención M365) | Código de Comercio art. 30 |
| Cifrado | AES-256 (por defecto en SharePoint Online) | RGPD |
| Recycle bin | 93 días (por defecto) | Recuperación ante borrado accidental |

### 4.2 Estructura de carpetas

```
Documentos_Capa3/
│
├── 📁 1_VENTAS/
│   ├── 📁 Cierres_Z/
│   │   └── 📁 2027/
│   │       ├── 📁 01_Enero/
│   │       │   ├── 2027-01-02_CierreZ_Z-0001.csv
│   │       │   ├── 2027-01-03_CierreZ_Z-0002.csv
│   │       │   └── ...
│   │       └── ...
│   ├── 📁 Movimientos/
│   │   └── 📁 2027/
│   │       ├── 2027-01-02_Movimientos_Caja.csv
│   │       └── ...
│   ├── 📁 Reservas/
│   │   └── 📁 2027/
│   │       ├── 2027-01_Ventas_Reservas.csv
│   │       └── ...
│   └── 📁 Consolidado_Ventas_2027.xlsx
│
├── 📁 2_GASTOS/
│   └── 📁 2027/
│       ├── 📁 01_Enero/
│       │   ├── 2027-01-05_Factura_Loreal_Productos.pdf
│       │   └── ...
│       └── ...
│
├── 📁 3_BANCO/
│   └── 📁 2027/
│       ├── 2027-01_Extracto_Ibercaja.pdf
│       └── ...
│
├── 📁 4_PERSONAL/
│   ├── 📁 Fichajes/
│   │   └── 📁 2027/
│   │       ├── 2027-S01_Fichajes_Staff.csv
│   │       └── ...
│   └── 📁 Resumen_Mensual/
│       └── 📁 2027/
│
├── 📁 5_INVENTARIO/
│   └── 📁 2027/
│       ├── 2027-01_Movimientos_Inventario.csv
│       └── ...
│
├── 📁 6_ENTREGA_GESTOR/
│   └── 📁 2027/
│       ├── 📁 T1_2027/
│       ├── 📁 T2_2027/
│       ├── 📁 T3_2027/
│       ├── 📁 T4_2027/
│       └── 📁 Anual_2027/
│
└── 📁 9_DOCUMENTOS_NEGOCIO/
    ├── Contrato_Alquiler.pdf
    ├── Poliza_Seguro_RC.pdf
    ├── Alta_IAE.pdf
    └── ...
```

### 4.3 Permisos SharePoint

| Usuario / Grupo | Permiso | Motivo |
| :--- | :--- | :--- |
| **Marian Madrid** (`marian@marianmadrid.es`) | **Propietario** (Full Control) | Titular del negocio. Gestiona todo. |
| **Cuenta de sistema** (flujo Power Automate) | **Colaborar** (Contribute) | Necesario para que Power Automate cree archivos. |
| **Gestor / Asesor** (cuenta externa) | **Solo lectura** (Read) | Acceso de consulta. No puede modificar ni eliminar. |
| **Alba / Andrea** | **Sin acceso** | No acceden a datos financieros (RGPD, RBAC SSOT). |

> **Acceso del gestor:** Se invita como usuario externo al sitio SharePoint con permiso de solo lectura sobre `Documentos_Capa3`. El gestor puede navegar, descargar y copiar, pero no modificar ni eliminar. Esto cumple el principio de mínimo privilegio (SSOT §16.2 del Anexo Biblia por Wix).

---

## 5. IMPLEMENTACIÓN EN EXCEL ONLINE (CONSOLIDACIÓN)

### 5.1 Archivo consolidado de ventas

**Archivo:** `1_VENTAS/Consolidado_Ventas_2027.xlsx`
**Tabla:** `VentasMensuales`

| Columna | Tipo | Fuente |
| :--- | :--- | :--- |
| `mes` | Texto (`2027-01`) | Del CSV mensual |
| `totalReservas` | Número | Conteo de filas en CSV |
| `totalIngresos` | Número (€) | Suma de `totalAmount` |
| `totalIVA` | Número (€) | Suma de `taxAmount` (calculado) |
| `totalCancelaciones` | Número | Conteo de `bookingStatus = CANCELED` |
| `totalDevoluciones` | Número (€) | Suma de `movementType = DEVOLUCION` |
| `netoIngresos` | Número (€) | `totalIngresos - totalDevoluciones` |

### 5.2 Archivo consolidado de gastos

**Archivo:** `2_GASTOS/Consolidado_Gastos_2027.xlsx`
**Tabla:** `GastosMensuales`

> Este archivo se alimenta **manualmente** por Marian o por el gestor, ya que las facturas de proveedores llegan como PDF escaneado y no como datos estructurados. Power Automate solo archiva el PDF; la categorización del gasto la hace el gestor.

| Columna | Tipo | Quién la llena |
| :--- | :--- | :--- |
| `fecha` | Fecha | Marian o gestor |
| `proveedor` | Texto | Marian o gestor |
| `categoria` | Texto (Alquiler, Productos, Suministros, Asesoría, Marketing, Otros) | Gestor |
| `baseImponible` | Número (€) | Gestor |
| `ivaSoportado` | Número (€) | Gestor |
| `totalFactura` | Número (€) | Gestor |
| `deducible` | Sí/No | Gestor |
| `archivoFactura` | Enlace al PDF en SharePoint | Automático (Power Automate puede insertar el link) |

### 5.3 Copilot para análisis mensual

El día 25 de cada mes (según PTD §7.5), Marian abre el archivo consolidado y usa **Copilot en Excel** para generar el análisis de rentabilidad:

> **Prompt ejemplo para Copilot:**
> *"Analiza la tabla VentasMensuales. Compara los ingresos de este mes con los 3 meses anteriores. Identifica el servicio con mayor facturación y el día de la semana con más reservas. Genera un resumen en 5 puntos."*

Esto ya está descrito en el PTD Kit Digital (Sección 7.5) y no requiere desarrollo adicional.

---

## 6. CUMPLIMIENTO NORMATIVO DE LA SOLUCIÓN

| Norma | Cómo cumple esta solución |
| :--- | :--- |
| **RGPD / LOPDGDD** | Datos almacenados en SharePoint Online (servidores UE). Cifrado AES-256. Sin PII de clientes en los exports. Acceso del gestor limitado a solo lectura. Alba y Andrea sin acceso. |
| **Ley 11/2021 / Veri*Factu** | Los CSV incluyen `hash`, `previousRecordHash`, `sequenceNumber` y `numSerieFactura`. La cadena SHA-256 se preserva en el export. El Cierre Z incluye `closingHash` e `isIntegrityVerified`. |
| **RD 1619/2012** | `numSerieFactura` correlativo presente en cada movimiento exportado. |
| **Ley 37/1992 (IVA)** | `taxBase`, `taxAmount`, `tipoImpositivo` incluidos en cada CSV. El gestor puede calcular el Modelo 303 directamente. |
| **PGC** | Los datos de `MovimientosCaja` permiten al gestor generar los asientos contables. El libro diario lo elabora el gestor a partir de estos datos. |
| **RD 8/2019** | Fichajes exportados semanalmente con `clockEventType`, `recordedAt`, `staffName`. Retención 4 años en SharePoint. |
| **Código de Comercio art. 30** | Política de retención de 6 años en SharePoint. Versionado de 500 versiones. |
| **LGT 58/2003** | Documentación disponible ante requerimiento AEAT en <15 minutos (PTD §13, test de estrés). |
| **RD 253/2025 (Bizum)** | Obligación y sujeto obligado a validar con AEAT/asesoría. El Cierre Z conserva el desglose `totalBizum` cuando se registra; no se presume reporte automático de Wix Payments. |
| **LSSI-CE** | No aplica directamente a la Capa 3. Los textos legales están en el sitio web. |

---

## 7. PLAN DE IMPLEMENTACIÓN

### 7.1 Fases

| Fase | Tarea | Duración | Quién |
| :--- | :--- | :--- | :--- |
| **F1** | Crear sitio SharePoint + biblioteca + estructura de carpetas + permisos | 2 horas | Agente Digitalizador |
| **F2** | Implementar `backend/exports/exportService.js` en Wix Velo | 4 horas | Agente Digitalizador |
| **F3** | Añadir crons de export a `jobs.config` | 1 hora | Agente Digitalizador |
| **F4** | Probar envío de emails vía Resend (entorno Preview) | 1 hora | Agente Digitalizador |
| **F5** | Crear los 7 flujos Power Automate | 3 horas | Agente Digitalizador |
| **F6** | Probar end-to-end: Wix → email → Power Automate → SharePoint | 2 horas | Agente Digitalizador |
| **F7** | Crear Excel consolidado con tablas | 1 hora | Agente Digitalizador |
| **F8** | Invitar al gestor como usuario externo SharePoint (solo lectura) | 0,5 horas | Marian |
| **F9** | Formación a Marian: cómo reenviar facturas de gastos por email | 0,5 horas | Agente Digitalizador |
| **TOTAL** | | **~15 horas** | |

### 7.2 Validación antes de producción

| Prueba | Criterio de éxito |
| :--- | :--- |
| Cierre Z se genera y envía por email | Email recibido en `gestion@` con adjunto CSV válido |
| Power Automate detecta el email | Flujo se dispara en <2 minutos |
| Archivo se crea en SharePoint | CSV presente en `1_VENTAS/Cierres_Z/2027/MM/` |
| CSV contiene hash y sequenceNumber | Verificación manual del contenido |
| Gestor accede en solo lectura | Gestor puede descargar pero no editar |
| Alba y Andrea NO acceden | Acceso denegado |
| Flujo de gastos manual funciona | Marian reenvía email con `[GASTO]` → PDF archivado |
| Paquete trimestral se genera | Día 10: carpeta `6_ENTREGA_GESTOR/` con todo el trimestre |

---

## 8. RESUMEN: QUÉ HACE CADA QUIÉN

| Actor | Qué hace | Cuándo |
| :--- | :--- | :--- |
| **Wix (sistema)** | Genera Cierre Z, movimientos, fichajes, ventas, inventario → envía email a `gestion@` | Automático: diario, semanal, mensual |
| **Power Automate** | Detecta email → extrae CSV → lo guarda en SharePoint → actualiza Excel | Automático: en tiempo real |
| **Marian** | Reenvía facturas de proveedores a `gestion@` con asunto `[GASTO]`. Descarga extracto bancario una vez al mes. | ~15 min/mes |
| **Marian** | Revisa que el Cierre Z del día anterior está en SharePoint (mirar carpeta). | ~2 min/día (opcional) |
| **Power Automate** | Día 10 post-trimestre: consolida paquete para gestor → notifica | Automático: trimestral |
| **Gestor** | Accede a SharePoint (solo lectura) → descarga paquete → prepara modelos tributarios | Trimestral |
| **Copilot** | Marian analiza rentabilidad el día 25 con prompt en Excel | Mensual |

---

## 9. CIERRE

Esta solución implementa la **Capa 3 completa** utilizando **exclusivamente las herramientas incluidas en la licencia M365 Business Standard del Kit Digital** (SharePoint, Power Automate con conectores estándar, Excel Online, Outlook, Copilot), sin necesidad de conectores premium, licencias adicionales ni servicios externos de pago.

El flujo es: **Wix CMS (SSOT) → email estructurado → Power Automate → SharePoint**. Es el mismo patrón ya descrito y aprobado en el PTD Kit Digital (Sección 7.5, Fase 3: "Power Automate: Cierre Z CSV → OneDrive cada noche"), ampliado aquí a todos los procesos del negocio y con destino SharePoint en lugar de OneDrive para facilitar el acceso compartido al gestor.

La solución es **100% legal** (RGPD, Veri*Factu, PGC, RD 8/2019), **100% automatizada** para los datos que genera el sistema, y requiere de Marian **menos de 20 minutos al mes** de intervención manual (reenviar facturas de gastos y descargar extracto bancario).

---

*Documento generado el 6 de febrero de 2027. Basado en la Biblia SSOT v10.0, PTD Kit Digital (Secciones 7.5, 10, 11, 12, 19), Anexo Biblia Migración SDK, Directrices de Desarrollo de Código y documentación oficial de Microsoft 365 Business Standard.*
*Documento generado el 6 de noviembre de 2026. Basado en la Biblia SSOT v10.0, el PTD Kit Digital (Secciones 7.5, 10, 11), las Directrices de Desarrollo de Código y la normativa fiscal/laboral española vigente.*


## BLOQUE DE IMPLEMENTACION DE SOLUCION

# GUÍA PRÁCTICA DE IMPLEMENTACIÓN — CAPA 3
## Wix → Power Automate → SharePoint
### Paso a paso para Marian Madrid (sin conocimientos técnicos profesionales)

**Versión:** 1.0 · **Fecha:** 6 de febrero de 2027
**Tiempo total estimado:** 3-4 horas repartidas en 2-3 días
**Nivel necesario:** Saber usar email, navegar por páginas web y copiar/pegar texto

---

## 0. ANTES DE EMPEZAR: QUÉ NECESITAS TENER

### 0.1 Checklist de preparación

| Nº | Qué necesitas | ¿Lo tienes? | Dónde comprobarlo |
| :--- | :--- | :--- | :--- |
| 1 | Tu cuenta **marian@marianmadrid.es** funcionando | ☐ | Abre Outlook o Gmail y comprueba que recibes correos |
| 2 | Tu cuenta **gestion@marianmadrid.es** funcionando | ☐ | Abre Gmail (donde la tienes configurada con POP3) |
| 3 | Acceso a **Microsoft 365** (portal.office.com) | ☐ | Entra con marian@marianmadrid.es y tu contraseña |
| 4 | Licencia **M365 Business Standard** activa | ☐ | En portal.office.com → Administrador → Facturación → Licencias |
| 5 | Acceso a **SharePoint** | ☐ | En portal.office.com → icono SharePoint |
| 6 | Acceso a **Power Automate** | ☐ | En portal.office.com → icono Power Automate |
| 7 | El sistema Wix funcionando y generando Cierres Z | ☐ | Comprueba que el Cierre Z de anoche se generó |
| 8 | 3-4 horas de tiempo tranquilo (sin clientas) | ☐ | Elige un día que cierres el salón |

### 0.2 Regla de oro de esta guía

> **Si te pierdes, cierra todo y vuelve a abrir.** No pasa nada. SharePoint y Power Automate no borran nada si te equivocas. Todo se puede deshacer.

### 0.3 Qué NO necesitas hacer

- **No necesitas programar.** Todo se hace con clics y menús.
- **No necesitas instalar nada en el ordenador.** Todo funciona en el navegador web.
- **No necesitas llamar a un técnico.** Si algo falla, esta guía tiene una sección de problemas comunes al final.
- **No necesitas pagar nada extra.** Todo está incluido en tu licencia M365 Business Standard del Kit Digital.

---

## FASE 1 — CREAR EL SITIO SHAREPOINT Y LAS CARPETAS

**Tiempo estimado:** 30 minutos
**Qué vas a hacer:** Crear el "armario digital" donde se guardará toda la documentación.

### Paso 1.1 — Entrar en SharePoint

1. Abre tu navegador (Edge o Chrome).
2. Ve a **portal.office.com**.
3. Inicia sesión con **marian@marianmadrid.es** y tu contraseña.
4. En la barra de iconos de la izquierda (donde está el icono de Outlook, Word, Excel...), busca el icono de **SharePoint**. Es un cuadrado azul con una "S".
5. Haz clic en él.

> **Si no ves SharePoint:** Haz clic en los 9 puntos (⋮⋮⋮) arriba a la izquierda y busca "SharePoint" en la lista.

### Paso 1.2 — Crear el sitio

1. En la página principal de SharePoint, haz clic en **"+ Crear sitio"** (arriba a la izquierda).
2. Elige **"Sitio de equipo"** (la primera opción).
3. Rellena:
   - **Nombre del sitio:** `MarianMadrid Documentacion`
   - **Descripción:** `Documentación contable, fiscal y laboral para entrega al gestor`
   - **Privacidad:** selecciona **"Privado: solo los miembros pueden acceder al sitio"**
   - **Idioma:** Español
4. Haz clic en **"Siguiente"**.
5. En "Añadir miembros", **NO añadas a nadie todavía**. Haz clic en **"Finalizar"**.

> **Verás:** Una página con el nombre "MarianMadrid Documentacion" y un menú a la izquierda. Eso es tu sitio.

### Paso 1.3 — Crear la biblioteca de documentos

1. En el menú de la izquierda, haz clic en **"Documentos"** (viene por defecto).
2. Verás una biblioteca vacía. Vamos a crear las carpetas.

### Paso 1.4 — Crear las carpetas principales

Haz clic en **"+ Nuevo"** → **"Carpeta"**. Crea estas carpetas **una por una**, con estos nombres exactos:

| Nº | Nombre exacto de la carpeta | Para qué sirve |
| :--- | :--- | :--- |
| 1 | `1_VENTAS` | Todo lo que ingresas: cierres Z, cobros, reservas, tienda online |
| 2 | `2_GASTOS` | Facturas de proveedores que tú guardas |
| 3 | `3_BANCO` | Extractos bancarios de Ibercaja |
| 4 | `4_PERSONAL` | Fichajes y horas de Alba y Andrea |
| 5 | `5_INVENTARIO` | Movimientos de stock de productos |
| 6 | `6_ENTREGA_GESTOR` | Paquete trimestral que recibe el gestor |
| 7 | `9_DOCUMENTOS_NEGOCIO` | Contratos, seguros, licencias (no se entrega periódicamente) |

> **Truco:** Crea primero las 7 carpetas principales. Luego entras en cada una y creas las subcarpetas.

### Paso 1.5 — Crear las subcarpetas

**Dentro de `1_VENTAS`**, crea:

```
1_VENTAS/
├── Cierres_Z/
│   └── 2027/
│       ├── 01_Enero/
│       ├── 02_Febrero/
│       ├── 03_Marzo/
│       ├── 04_Abril/
│       ├── 05_Mayo/
│       ├── 06_Junio/
│       ├── 07_Julio/
│       ├── 08_Agosto/
│       ├── 09_Septiembre/
│       ├── 10_Octubre/
│       ├── 11_Noviembre/
│       └── 12_Diciembre/
├── Movimientos/
│   └── 2027/
├── Reservas/
│   └── 2027/
└── Tienda_Online/
    └── 2027/
```

**Dentro de `2_GASTOS`**, crea:

```
2_GASTOS/
└── 2027/
    ├── 01_Enero/
    ├── 02_Febrero/
    ├── 03_Marzo/
    ├── 04_Abril/
    ├── 05_Mayo/
    ├── 06_Junio/
    ├── 07_Julio/
    ├── 08_Agosto/
    ├── 09_Septiembre/
    ├── 10_Octubre/
    ├── 11_Noviembre/
    └── 12_Diciembre/
```

**Dentro de `3_BANCO`**, crea:

```
3_BANCO/
└── 2027/
```

**Dentro de `4_PERSONAL`**, crea:

```
4_PERSONAL/
├── Fichajes/
│   └── 2027/
└── Resumen_Mensual/
    └── 2027/
```

**Dentro de `5_INVENTARIO`**, crea:

```
5_INVENTARIO/
└── 2027/
```

**Dentro de `6_ENTREGA_GESTOR`**, crea:

```
6_ENTREGA_GESTOR/
└── 2027/
    ├── T1_Enero_Marzo/
    ├── T2_Abril_Junio/
    ├── T3_Julio_Septiembre/
    ├── T4_Octubre_Diciembre/
    └── Anual/
```

> **Consejo:** No te preocupes por crear las carpetas de 2028, 2029, etc. Las crearás cuando empiece cada año nuevo.

### Paso 1.6 — Verificar que todo está bien

1. Vuelve a la raíz de la biblioteca "Documentos".
2. Deberías ver 7 carpetas.
3. Entra en `1_VENTAS` → `Cierres_Z` → `2027` → deberías ver 12 carpetas de meses.
4. Si todo está, **Fase 1 completada**. ✅

---

## FASE 2 — CREAR LOS FLUJOS DE POWER AUTOMATE

**Tiempo estimado:** 90 minutos
**Qué vas a hacer:** Crear los "robots" que detectan emails con datos del sistema Wix y los guardan automáticamente en SharePoint.

> **¿Qué es Power Automate?** Es una herramienta de Microsoft que crea "robots" (flujos) que hacen tareas repetitivas por ti. En este caso: "Cuando llegue un email con un archivo adjunto desde el sistema Wix, guárdalo en la carpeta correcta de SharePoint."

### Paso 2.1 — Entrar en Power Automate

1. Ve a **portal.office.com**.
2. Busca el icono de **Power Automate** (es un icono azul con una flecha en forma de rayo).
3. Haz clic.
4. Si es la primera vez, te pedirá aceptar términos. Acepta.

### Paso 2.2 — Crear el Flujo 1: Cierre Z → SharePoint

Este es el flujo más importante. Es el que guarda automáticamente el Cierre Z que el sistema Wix genera cada noche.

1. En el menú de la izquierda, haz clic en **"+ Crear"**.
2. Elige **"Flujo de nube automatizado"** (la opción que tiene un icono de rayo).
3. En **"Nombre del flujo"**, escribe: `Cierre Z a SharePoint`
4. En **"Elija el desencadenador"**, busca y selecciona: **"Cuando llega un nuevo correo electrónico (V3)"** (está bajo la categoría "Office 365 Outlook").
5. Haz clic en **"Crear"**.

Ahora se abre el editor del flujo. Verás un primer bloque llamado "Cuando llega un nuevo correo electrónico (V3)". Vamos a configurarlo:

#### Configurar el desencadenador (el "cuándo")

1. Haz clic en el bloque **"Cuando llega un nuevo correo electrónico (V3)"** para abrir sus opciones.
2. Rellena estos campos:

| Campo | Qué escribir |
| :--- | :--- |
| **Carpeta** | `Bandeja de entrada` (Inbox) |
| **De** | `sistema@marianmadrid.es` |
| **Importancia** | `Cualquiera` |
| **Tiene datos adjuntos** | `Sí` |
| **Asunto Filtro** | `[MM-EXPORT] CIERRE_Z` |

> **¿Qué hace esto?** Le dice al robot: "Solo actúa cuando llegue un email de sistema@marianmadrid.es, con adjunto, y que en el asunto ponga [MM-EXPORT] CIERRE_Z."

3. Haz clic en **"Mostrar opciones avanzadas"** (abajo del todo del bloque).
4. En **"Incluir contenido del adjunto"**, selecciona **"Sí"**.
5. Haz clic en **"Guardar"** (arriba a la derecha).

#### Añadir el paso 2: Crear el archivo en SharePoint

1. Haz clic en **"+ Nuevo paso"** (debajo del bloque del desencadenador).
2. Busca **"SharePoint"** y haz clic.
3. Elige la acción **"Crear archivo"**.
4. Rellena:

| Campo | Qué escribir / seleccionar |
| :--- | :--- |
| **Dirección del sitio** | Selecciona `MarianMadrid Documentacion` (debería aparecer en la lista) |
| **Nombre de la biblioteca** | `Documentos` |
| **Ruta de la carpeta** | Haz clic en el icono de carpeta 📁 y navega: `1_VENTAS` → `Cierres_Z` → `2027` → selecciona la carpeta del mes actual |
| **Nombre del archivo** | Haz clic dentro del campo y luego en el panel de la derecha (Contenido dinámico), busca y selecciona **"Nombre del adjunto"** (aparece como `Attachments Name`) |
| **Contenido del archivo** | En Contenido dinámico, selecciona **"Contenido del adjunto"** (aparece como `Attachments Content`) |

> **Problema:** Si no ves "Nombre del adjunto" ni "Contenido del adjunto" en Contenido dinámico, es porque Power Automate necesita que haya un bucle "Para cada adjunto". En ese caso:
> 1. Haz clic en **"+ Nuevo paso"**.
> 2. Busca **"Para cada"** (Control → For each).
> 3. En "Seleccionar una salida de los pasos anteriores", elige **"Adjuntos"** del desencadenador.
> 4. Dentro del "Para cada", añade el paso "Crear archivo" de SharePoint.
> 5. Ahora sí verás "Nombre del adjunto" y "Contenido del adjunto" dentro del bucle.

5. Haz clic en **"Guardar"**.

#### Añadir el paso 3: Enviar confirmación por email (opcional pero recomendado)

1. Haz clic en **"+ Nuevo paso"**.
2. Busca **"Office 365 Outlook"** → **"Enviar correo electrónico (V2)"**.
3. Rellena:

| Campo | Qué escribir |
| :--- | :--- |
| **Para** | `marian@marianmadrid.es` |
| **Asunto** | `✅ Cierre Z guardado en SharePoint` |
| **Cuerpo** | `El Cierre Z se ha guardado correctamente en SharePoint. Revisa la carpeta 1_VENTAS/Cierres_Z/2027/` |

4. Haz clic en **"Guardar"**.

#### Probar el flujo

1. Arriba a la derecha, haz clic en **"Probar"**.
2. Selecciona **"Manualmente"** → **"Probar"**.
3. Power Automate te pedirá que envíes un email de prueba.
4. **Desde tu cuenta gestion@marianmadrid.es**, envía un email a ti misma con:
   - Asunto: `[MM-EXPORT] CIERRE_Z 2027-02-06`
   - Adjunta cualquier archivo (un PDF cualquiera, por ejemplo).
5. Vuelve a Power Automate y comprueba si el flujo se ejecutó.
6. Ve a SharePoint → `1_VENTAS` → `Cierres_Z` → `2027` → `02_Febrero` → ¿Está el archivo?

> **Si está:** ¡Flujo 1 funcionando! ✅
> **Si no está:** Ve a la sección "Solución de problemas" al final de esta guía.

### Paso 2.3 — Crear el Flujo 2: Movimientos de Caja → SharePoint

Repite el proceso del Paso 2.2, pero con estos cambios:

| Campo | Valor |
| :--- | :--- |
| **Nombre del flujo** | `Movimientos Caja a SharePoint` |
| **Asunto Filtro** | `[MM-EXPORT] MOVIMIENTOS_CAJA` |
| **Carpeta SharePoint destino** | `1_VENTAS` → `Movimientos` → `2027` |

### Paso 2.4 — Crear el Flujo 3: Fichajes → SharePoint

| Campo | Valor |
| :--- | :--- |
| **Nombre del flujo** | `Fichajes Staff a SharePoint` |
| **Asunto Filtro** | `[MM-EXPORT] FICHAJES_SEMANAL` |
| **Carpeta SharePoint destino** | `4_PERSONAL` → `Fichajes` → `2027` |

### Paso 2.5 — Crear el Flujo 4: Ventas Mensual → SharePoint

| Campo | Valor |
| :--- | :--- |
| **Nombre del flujo** | `Ventas Mensual a SharePoint` |
| **Asunto Filtro** | `[MM-EXPORT] VENTAS_MENSUAL` |
| **Carpeta SharePoint destino** | `1_VENTAS` → `Reservas` → `2027` |

### Paso 2.6 — Crear el Flujo 5: Inventario → SharePoint

| Campo | Valor |
| :--- | :--- |
| **Nombre del flujo** | `Inventario a SharePoint` |
| **Asunto Filtro** | `[MM-EXPORT] INVENTARIO_MENSUAL` |
| **Carpeta SharePoint destino** | `5_INVENTARIO` → `2027` |

### Paso 2.7 — Crear el Flujo 6: Gastos manuales de Marian

Este flujo es diferente: detecta cuando Marian reenvía una factura de proveedor por email.

1. **"+ Crear"** → **"Flujo de nube automatizado"**.
2. Nombre: `Gastos Marian a SharePoint`
3. Desencadenador: **"Cuando llega un nuevo correo electrónico (V3)"**.
4. Configuración:

| Campo | Valor |
| :--- | :--- |
| **Carpeta** | `Bandeja de entrada` |
| **Tiene datos adjuntos** | `Sí` |
| **Asunto Filtro** | `[GASTO]` |

5. **Nuevo paso** → **"Para cada"** → Adjuntos.
6. Dentro: **"SharePoint → Crear archivo"**.
   - Carpeta destino: `2_GASTOS` → `2027` → (mes actual)
   - Nombre: `Attachments Name`
   - Contenido: `Attachments Content`
7. **Nuevo paso** → **"Enviar correo electrónico"**:
   - Para: `marian@marianmadrid.es`
   - Asunto: `✅ Factura de gasto archivada`
   - Cuerpo: `La factura se ha guardado en 2_GASTOS/2027/`

> **Cómo lo usa Marian:** Cuando recibe una factura de L'Oréal, Ibercaja o cualquier proveedor, la reenvía a `gestion@marianmadrid.es` con asunto `[GASTO] 2027-02 Factura Loreal`. El robot la guarda automáticamente.

### Paso 2.8 — Verificar que todos los flujos están activos

1. En Power Automate, menú izquierdo → **"Mis flujos"**.
2. Deberías ver 6 flujos con un círculo verde (activos).

| Flujo | Estado |
| :--- | :--- |
| Cierre Z a SharePoint | 🟢 Activo |
| Movimientos Caja a SharePoint | 🟢 Activo |
| Fichajes Staff a SharePoint | 🟢 Activo |
| Ventas Mensual a SharePoint | 🟢 Activo |
| Inventario a SharePoint | 🟢 Activo |
| Gastos Marian a SharePoint | 🟢 Activo |

> **Fase 2 completada.** ✅

---

## FASE 3 — CONFIGURAR EL EMAIL PARA QUE RECIBA LOS EXPORTS DE WIX

**Tiempo estimado:** 15 minutos
**Qué vas a hacer:** Asegurarte de que el buzón `gestion@marianmadrid.es` recibe correctamente los emails del sistema Wix.

### Paso 3.1 — Verificar que gestion@ recibe emails

1. Abre Gmail (donde tienes configurado gestion@ con POP3).
2. Comprueba que puedes enviar y recibir emails.
3. Envía un email de prueba desde hola@marianmadrid.es a gestion@marianmadrid.es.
4. ¿Llegó? → Bien. No llegó → Revisa la configuración POP3 en Gmail.

### Paso 3.2 — Verificar que el sistema Wix envía a gestion@

El sistema Wix (backend Velo) ya está configurado para enviar los exports a `gestion@marianmadrid.es` mediante Resend. Esto lo configura el Agente Digitalizador en el código.

**Lo que Marian debe verificar:**

1. Pregunta al Agente Digitalizador: "¿El sistema ya envía los Cierres Z por email a gestion@?"
2. Si la respuesta es **sí**, pasa al Paso 3.3.
3. Si la respuesta es **no**, el Agente Digitalizador debe activar el módulo `exportService.js` en el backend de Wix (ver dossier técnico de la solución). Marian no tiene que hacer nada en este paso; es código que escribe el técnico.

### Paso 3.3 — Crear una regla en Gmail (opcional pero útil)

Para que los emails del sistema no se mezclen con otros:

1. Abre Gmail con la cuenta gestion@.
2. Haz clic en el icono de engranaje ⚙️ → **"Ver todos los ajustes"**.
3. Pestaña **"Filtros y direcciones bloqueadas"** → **"Crear un nuevo filtro"**.
4. En **"De"**, escribe: `sistema@marianmadrid.es`
5. Haz clic en **"Crear filtro"**.
6. Marca: **"Aplicar la etiqueta"** → crea una etiqueta llamada `EXPORTS SISTEMA`.
7. Marca también: **"No marcar nunca como spam"**.
8. Haz clic en **"Crear filtro"**.

> **Fase 3 completada.** ✅

---

## FASE 4 — PROBAR TODO EL CIRCUITO COMPLETO

**Tiempo estimado:** 30 minutos
**Qué vas a hacer:** Simular un día completo para verificar que el circuito Wix → email → Power Automate → SharePoint funciona.

### Paso 4.1 — Probar el Cierre Z

1. Espera a que el sistema Wix genere el Cierre Z nocturno (a las 01:20).
2. Por la mañana, abre Gmail (gestion@).
3. Busca un email con asunto `[MM-EXPORT] CIERRE_Z`.
4. ¿Está? → Bien. El sistema Wix está enviando correctamente.
5. Abre Power Automate → **"Mis flujos"** → **"Cierre Z a SharePoint"** → **"Historial de ejecuciones"**.
6. ¿Aparece una ejecución con ✅? → El robot funcionó.
7. Ve a SharePoint → `1_VENTAS` → `Cierres_Z` → `2027` → (mes actual).
8. ¿Está el archivo CSV? → **Circuito completo funcionando.** ✅

### Paso 4.2 — Probar una factura de gasto manual

1. Busca cualquier factura de proveedor que tengas en papel o email.
2. Hazle una foto o descarga el PDF.
3. Desde tu email personal o hola@, reenvía esa factura a **gestion@marianmadrid.es** con:
   - Asunto: `[GASTO] 2027-02 Factura prueba`
   - Adjunto: la foto o PDF
4. Espera 2-3 minutos.
5. Ve a SharePoint → `2_GASTOS` → `2027` → `02_Febrero`.
6. ¿Está el archivo? → **Flujo de gastos funcionando.** ✅

### Paso 4.3 — Probar el extracto bancario

1. Entra en la banca online de Ibercaja.
2. Descarga el extracto del mes anterior en PDF.
3. Súbelo manualmente a SharePoint → `3_BANCO` → `2027`.
4. Nómbralo: `2027-01_Extracto_Ibercaja.pdf`

> **Nota:** El extracto bancario es lo único que Marian sube manualmente. No se puede automatizar porque Ibercaja no tiene API abierta.

### Paso 4.4 — Checklist de prueba completa

| Prueba | ¿Funcionó? |
| :--- | :--- |
| Cierre Z llega por email a gestion@ | ☐ Sí / ☐ No |
| Power Automate detecta el email | ☐ Sí / ☐ No |
| Archivo se guarda en SharePoint automáticamente | ☐ Sí / ☐ No |
| Factura de gasto reenviada se archiva sola | ☐ Sí / ☐ No |
| Extracto bancario subido manualmente | ☐ Sí / ☐ No |

> **Si todo está en "Sí": Fase 4 completada.** ✅
> **Si algo está en "No":** Ve a la sección "Solución de problemas".

---

## FASE 5 — RUTINA DE MARIAN (LO QUE HACES CADA MES)

**Tiempo estimado:** 15-20 minutos al mes
**Qué vas a hacer:** Solo dos cosas: guardar facturas y descargar el extracto bancario.

### 5.1 Rutina diaria (0 minutos)

**No haces nada.** El sistema Wix genera el Cierre Z automáticamente cada noche. Power Automate lo guarda en SharePoint automáticamente. Tú no tocas nada.

### 5.2 Rutina cuando llega una factura de proveedor (2 minutos por factura)

1. Te llega una factura de L'Oréal, Davines, Ibercaja, Endesa, el alquiler...
2. Si es **papel**: hazle una foto con el móvil.
3. Si es **email/PDF**: descárgalo.
4. Reenvía el archivo a **gestion@marianmadrid.es** con asunto:
   ```
   [GASTO] 2027-02 Factura Loreal productos color
   ```
5. El robot lo guarda solo en SharePoint → `2_GASTOS/2027/02_Febrero/`.
6. **Listo.** No tienes que abrir SharePoint ni buscar carpetas.

### 5.3 Rutina mensual: extracto bancario (3 minutos, día 1-5)

1. Entra en la banca online de Ibercaja.
2. Descarga el extracto del mes anterior en PDF.
3. Ve a SharePoint → `3_BANCO` → `2027`.
4. Arrastra el PDF ahí.
5. Renómbralo: `2027-01_Extracto_Ibercaja.pdf`.
6. **Listo.**

### 5.4 Rutina mensual: verificar que todo llegó (2 minutos, día 3)

1. Abre SharePoint → `1_VENTAS` → `Cierres_Z` → `2027` → (mes anterior).
2. Cuenta los archivos. Debería haber uno por cada día que abriste el salón.
3. Si falta alguno, revisa el historial de Power Automate o contacta al Agente Digitalizador.

### 5.5 Resumen del esfuerzo mensual

| Tarea | Tiempo | Frecuencia |
| :--- | :--- | :--- |
| Reenviar facturas de proveedores | ~10 min | Según llegan (2-4 al mes) |
| Descargar extracto bancario | ~3 min | 1 vez al mes |
| Verificar Cierres Z | ~2 min | 1 vez al mes |
| **TOTAL** | **~15-20 min/mes** | |

---

## FASE 6 — ENTREGA TRIMESTRAL AL GESTOR

**Tiempo estimado:** 10 minutos por trimestre
**Qué vas a hacer:** Verificar que el paquete trimestral está completo y darle acceso al gestor.

### 6.1 Invitar al gestor a SharePoint (solo la primera vez)

1. Ve a SharePoint → `MarianMadrid Documentacion`.
2. Haz clic en **"Compartir"** (arriba a la derecha).
3. Escribe el email del gestor.
4. En permisos, selecciona **"Puede ver"** (solo lectura). **NO** selecciones "Puede editar".
5. Haz clic en **"Compartir"**.
6. El gestor recibirá un email con un enlace para acceder.

> **Regla:** El gestor solo necesita acceso de **lectura**. Nunca le des permiso de edición. Él descarga los archivos y los organiza en su propio sistema contable.

### 6.2 Preparar el paquete trimestral (día 10-15 del mes post-trimestre)

| Trimestre | Meses incluidos | Fecha de preparación | Fecha límite de presentación |
| :--- | :--- | :--- | :--- |
| T1 | Enero, Febrero, Marzo | 10-15 de abril | 20 de abril |
| T2 | Abril, Mayo, Junio | 10-15 de julio | 20 de julio |
| T3 | Julio, Agosto, Septiembre | 10-15 de octubre | 20 de octubre |
| T4 | Octubre, Noviembre, Diciembre | 10-15 de enero | 20 de enero |

**Pasos:**

1. Ve a SharePoint → `6_ENTREGA_GESTOR` → `2027` → `T1_Enero_Marzo` (o el trimestre que toque).
2. Crea una carpeta llamada `Paquete_T1_2027`.
3. Copia (no muevas, **copia**) los siguientes archivos:

| Qué copiar | De dónde | Cuántos archivos |
| :--- | :--- | :--- |
| Cierres Z del trimestre | `1_VENTAS/Cierres_Z/2027/01_Enero/` + `02_Febrero/` + `03_Marzo/` | ~90 archivos |
| Movimientos de caja | `1_VENTAS/Movimientos/2027/` | ~90 archivos |
| Ventas y reservas | `1_VENTAS/Reservas/2027/` | 3 archivos (uno por mes) |
| Facturas de gastos | `2_GASTOS/2027/01_Enero/` + `02_Febrero/` + `03_Marzo/` | Variable |
| Extractos bancarios | `3_BANCO/2027/` | 3 archivos |
| Fichajes del personal | `4_PERSONAL/Fichajes/2027/` | 3 archivos |
| Inventario | `5_INVENTARIO/2027/` | 3 archivos |

4. Envía un email al gestor:
   ```
   Asunto: Paquete T1 2027 disponible en SharePoint
   
   Hola [nombre del gestor],
   
   El paquete del primer trimestre de 2027 está disponible en:
   [enlace a la carpeta Paquete_T1_2027 en SharePoint]
   
   Incluye:
   - Cierres Z diarios (enero a marzo)
   - Movimientos de caja
   - Ventas y reservas
   - Facturas de gastos
   - Extractos bancarios
   - Fichajes del personal
   - Movimientos de inventario
   
   Cualquier duda, dime.
   
   Marian
   ```

### 6.3 Checklist trimestral

```
☐ ¿Los Cierres Z están todos los días del trimestre? (~90 archivos)
☐ ¿He guardado todas las facturas de gastos?
☐ ¿He descargado los 3 extractos bancarios?
☐ ¿Los fichajes de Alba y Andrea están completos?
☐ ¿He copiado todo a 6_ENTREGA_GESTOR?
☐ ¿He enviado el email al gestor con el enlace?
```

> **Fase 6 completada.** ✅

---

## FASE 7 — USAR COPILOT PARA ANALIZAR (OPCIONAL)

**Tiempo estimado:** 10 minutos al mes (día 25)
**Qué vas a hacer:** Usar la IA de Microsoft para analizar la rentabilidad del salón.

### 7.1 Abrir el archivo de ventas en Excel Online

1. Ve a SharePoint → `1_VENTAS` → `Reservas` → `2027`.
2. Abre el archivo de ventas del mes con **Excel Online** (haz clic → "Abrir en Excel Online").

### 7.2 Usar Copilot

1. En la barra superior de Excel, busca el icono de **Copilot** (un icono brillante con forma de estrella).
2. Haz clic.
3. Escribe en lenguaje natural lo que quieres saber. Ejemplos:

| Pregunta para Copilot | Qué te responde |
| :--- | :--- |
| `¿Cuál fue el día con más ingresos este mes?` | Te dice la fecha y el importe |
| `¿Qué servicio se reservó más veces?` | Te dice el servicio más popular |
| `Compara los ingresos de este mes con el mes anterior` | Te da la variación porcentual |
| `¿Cuánto se cobró por Bizum vs. tarjeta vs. efectivo?` | Te desglosa por método de pago |
| `Genera un resumen de 5 puntos para Marian` | Te hace un resumen ejecutivo |

> **Nota:** Copilot está incluido en tu licencia M365 Business Standard del Kit Digital. No cuesta nada extra.

### 7.3 Ejemplo de prompt completo

```
Analiza la tabla de ventas de enero 2027. Dime:
1. Total de ingresos del mes
2. Día con más facturación
3. Servicio más reservado
4. Comparación con diciembre 2026
5. Método de pago más usado
Presenta los resultados en una lista clara y sencilla.
```

---

## SOLUCIÓN DE PROBLEMAS COMUNES

### Problema 1: "El flujo de Power Automate no se ejecuta"

| Causa posible | Solución |
| :--- | :--- |
| El asunto del email no coincide exactamente | Verifica que el asunto sea exactamente `[MM-EXPORT] CIERRE_Z` (con corchetes, mayúsculas y guión bajo). Power Automate es sensible a mayúsculas/minúsculas en el filtro. |
| El email no tiene adjunto | El flujo solo se activa si el email tiene adjunto. Verifica que el sistema Wix adjunta el CSV. |
| El flujo está desactivado | Ve a "Mis flujos" → comprueba que el círculo está verde. Si está gris, haz clic → "Activar". |
| El buzón gestion@ no recibe emails | Verifica que gestion@ funciona enviando un email de prueba. |

### Problema 2: "El archivo se guarda en la carpeta equivocada"

| Causa posible | Solución |
| :--- | :--- |
| La ruta de SharePoint en el flujo está mal configurada | Abre el flujo → paso "Crear archivo" → verifica que la carpeta destino es la correcta. |
| La carpeta no existe en SharePoint | Ve a SharePoint y crea la carpeta manualmente. Power Automate no crea carpetas automáticamente. |

### Problema 3: "No veo SharePoint en mi portal de Microsoft 365"

| Causa posible | Solución |
| :--- | :--- |
| La licencia M365 no incluye SharePoint | Verifica en portal.office.com → Administrador → Facturación → que tienes "Microsoft 365 Business Standard". Si tienes otra licencia, contacta al Agente Digitalizador. |
| Estás entrando con la cuenta equivocada | Asegúrate de iniciar sesión con **marian@marianmadrid.es**, no con una cuenta personal de Microsoft. |

### Problema 4: "El gestor no puede acceder a SharePoint"

| Causa posible | Solución |
| :--- | :--- |
| No se ha compartido el sitio con el gestor | Ve a SharePoint → "Compartir" → añade el email del gestor con permiso "Puede ver". |
| El gestor no tiene cuenta Microsoft | El gestor puede acceder con cualquier cuenta de email. SharePoint le enviará un código de verificación por email. |
| El permiso es de edición y no debería | Cambia el permiso a "Puede ver" (solo lectura). |

### Problema 5: "Quiero cambiar la estructura de carpetas"

Puedes hacerlo en cualquier momento:
1. Ve a SharePoint → navega a la carpeta.
2. Haz clic en los tres puntos (⋯) → "Cambiar nombre".
3. **Cuidado:** Si cambias el nombre de una carpeta que Power Automate usa como destino, tendrás que actualizar el flujo de Power Automate para apuntar a la nueva ruta.

### Problema 6: "Power Automate me pide una licencia Premium"

| Causa posible | Solución |
| :--- | :--- |
| Estás usando un conector Premium (HTTP, AI Builder, etc.) | **No uses conectores Premium.** Los flujos de esta guía solo usan conectores estándar (Office 365 Outlook y SharePoint), que están incluidos en M365 Business Standard. Si Power Automate te pide licencia Premium, revisa que no hayas seleccionado un conector equivocado. |

---

## RESUMEN VISUAL: EL CIRCUITO COMPLETO

```
┌─────────────────────────────────────────────────────────────────────┐
│  CADA NOCHE (01:20) — TÚ NO HACES NADA                             │
│                                                                     │
│  Wix genera Cierre Z → envía email a gestion@ → Power Automate     │
│  lo detecta → lo guarda en SharePoint → 1_VENTAS/Cierres_Z/2027/  │
│                                                                     │
│  ✅ Automático. 0 minutos para Marian.                              │
├─────────────────────────────────────────────────────────────────────┤
│  CADA SEMANA (lunes 06:00) — TÚ NO HACES NADA                     │
│                                                                     │
│  Wix genera fichajes de Alba y Andrea → email → Power Automate     │
│  → SharePoint → 4_PERSONAL/Fichajes/2027/                          │
│                                                                     │
│  ✅ Automático. 0 minutos para Marian.                              │
├─────────────────────────────────────────────────────────────────────┤
│  CADA DÍA 2 DEL MES — TÚ NO HACES NADA                             │
│                                                                     │
│  Wix genera ventas del mes anterior → email → Power Automate       │
│  → SharePoint → 1_VENTAS/Reservas/2027/                            │
│                                                                     │
│  ✅ Automático. 0 minutos para Marian.                              │
├─────────────────────────────────────────────────────────────────────┤
│  CUANDO LLEGA UNA FACTURA — TÚ REENVÍAS UN EMAIL (2 min)          │
│                                                                     │
│  Marian recibe factura → la reenvía a gestion@ con asunto          │
│  [GASTO] → Power Automate la guarda → 2_GASTOS/2027/MM/           │
│                                                                     │
│  ⚡ Semi-automático. 2 minutos para Marian.                        │
├─────────────────────────────────────────────────────────────────────┤
│  DÍA 1-5 DE CADA MES — TÚ DESCARGAS EL EXTRACTO (3 min)           │
│                                                                     │
│  Marian entra en Ibercaja → descarga PDF → lo sube a               │
│  SharePoint → 3_BANCO/2027/                                        │
│                                                                     │
│  ✋ Manual. 3 minutos para Marian.                                  │
├─────────────────────────────────────────────────────────────────────┤
│  DÍA 10-15 POST-TRIMESTRE — TÚ VERIFICAS Y ENVÍAS (10 min)        │
│                                                                     │
│  Marian verifica que todo está → copia a 6_ENTREGA_GESTOR/         │
│  → envía email al gestor con el enlace                             │
│                                                                     │
│  ✋ Manual. 10 minutos para Marian.                                 │
├─────────────────────────────────────────────────────────────────────┤
│  DÍA 25 DE CADA MES — TÚ ANALIZAS CON COPILOT (10 min)            │
│                                                                     │
│  Marian abre Excel → Copilot → pregunta → obtiene análisis         │
│                                                                     │
│  ✋ Manual. 10 minutos para Marian.                                 │
└─────────────────────────────────────────────────────────────────────┘

TOTAL TIEMPO DE MARIAN: ~20 minutos al mes + 10 minutos por trimestre

---

## ANEXO: GLOSARIO PARA MARIAN

| Término | Qué significa en lenguaje sencillo |
| :--- | :--- |
| **SharePoint** | Un "armario digital" en internet donde guardas archivos. Es como OneDrive pero para empresas. |
| **Power Automate** | Un "robot" que hace tareas repetitivas por ti. Como un asistente que trabaja 24 horas. |
| **Flujo** | Una tarea que el robot hace. Ejemplo: "Cuando llegue un email, guarda el adjunto en SharePoint." |
| **Desencadenador** | La señal que activa al robot. Ejemplo: "Cuando llegue un email de sistema@..." |
| **Conector** | El "enchufe" que conecta Power Automate con otro servicio (Outlook, SharePoint, Excel). |
| **Conector estándar** | Un enchufe gratuito incluido en tu licencia. |
| **Conector Premium** | Un enchufe de pago. NO lo necesitas para esta solución. |
| **Biblioteca de documentos** | La "estantería" dentro de SharePoint donde están las carpetas. |
| **Copilot** | La inteligencia artificial de Microsoft. Le preguntas en lenguaje normal y te responde. |
| **CSV** | Un archivo de texto con datos en columnas. Como un Excel simplificado. |
| **Cierre Z** | El resumen de todo lo que cobraste en un día. Lo genera el sistema automáticamente. |
| **Append-only** | Que no se puede borrar ni modificar. Como un libro de actas: solo se añaden páginas nuevas. |
| **M365 Business Standard** | Tu licencia de Microsoft 365 del Kit Digital. Incluye Outlook, SharePoint, Power Automate, Excel, Copilot. |

---

## CIERRE DE LA GUÍA

Esta guía implementa la **Capa 3 completa** de Marian Madrid usando **exclusivamente herramientas incluidas en la licencia M365 Business Standard del Kit Digital** (SharePoint, Power Automate con conectores estándar, Excel Online, Outlook, Copilot).

**No requiere:**
- Licencias adicionales de pago.
- Conectores Premium de Power Automate.
- Conocimientos de programación.
- Intervención del Agente Digitalizador (salvo la activación inicial del módulo de exportación en Wix).

**Requiere de Marian:**
- ~20 minutos al mes (reenviar facturas + descargar extracto bancario).
- ~10 minutos por trimestre (verificar y enviar paquete al gestor).
- ~10 minutos al mes (opcional, análisis con Copilot).

**El resultado:** El gestor recibe cada trimestre un paquete completo, ordenado y trazable con toda la documentación fiscal, contable y laboral que necesita para presentar los modelos tributarios. Marian no tiene que pensar en contabilidad. El sistema lo hace por ella.

---

*Guía generada el 6 de febrero de 2027. Basada en la solución técnica Capa 3 diseñada para Marian Madrid Peluquería y Estética, conforme a la Biblia SSOT v10.0, el PTD Kit Digital y la normativa fiscal/laboral española vigente.*

##ANEXO FLUJOS CAPA 3

# ANÁLISIS INTEGRAL DE PROCESOS, SUBPROCESOS Y TRASLADO A CAPA 3
## Marian Madrid Peluquería y Estética · marianmadrid.es

**Versión:** 1.0 · **Fecha:** 6 de noviembre de 2026
**Fuentes:** Biblia SSOT v10.0, Dossier Técnico Consolidado, PTD Kit Digital, Anexo Biblia por Wix, Anexo Biblia Migración, Directrices Desarrollo Código

---

## ÍNDICE

1. [Mapa General de Procesos del Sitio Wix](#1)
2. [Detalle de Procesos, Subprocesos y Datos Generados](#2)
3. [Matriz de Traslado SSOT → Capa 3](#3)
4. [Mecanismos Técnicos de Traslado](#4)
5. [Cumplimiento Normativo del Traslado](#5)
6. [Resumen Ejecutivo del Flujo Completo](#6)

---

## 1. MAPA GENERAL DE PROCESOS DEL SITIO WIX

El sitio `marianmadrid.es` gestiona **12 procesos de negocio** a través de tres capas tecnológicas superpuestas:

| Capa tecnológica | Componentes | Procesos que gestiona |
| :--- | :--- | :--- |
| **Wix Apps nativas** | Bookings V2, Stores V1, eCommerce, Members, Invoices V1, Gift Cards, Forms & Payments, Blog | Reservas, catálogo público, checkout, identidad de clientes, facturación nativa, tarjetas regalo, formularios, contenido SEO |
| **Backend personalizado (Velo)** | 22 módulos backend, 13 colecciones CMS NATIVE, 12 crons, 8 webhooks, 18 webMethods | Caja fiscal Veri*Factu, cierre Z, inventario espejo, fichajes laborales, reservas duales, agregación fiscal, paquetes para gestoría |
| **Integraciones externas** | Resend, OpenAI, IONOS, M365 (SharePoint/Power Automate/OneDrive) | Email transaccional, IA conversacional, DNS/correo y custodia documental Capa 3; pagos online mediante Wix Payments (servicio nativo) |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROCESOS DEL SITIO WIX (SSOT)                           │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────────────┤
│ P1       │ P2       │ P3       │ P4       │ P5       │ P6                   │
│ RESERVAS │ VENTA    │ CAJA     │ FACTURA- │ INVEN-   │ HORARIO              │
│ Y CITAS  │ ONLINE   │ FÍSICA   │ CIÓN     │ TARIO    │ LABORAL              │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────────┤
│ P7       │ P8       │ P9       │ P10      │ P11      │ P12                  │
│ CLIENTES │ GASTOS   │ CIERRE Z │ PAGOS    │ MARKETING│ COMUNICACIONES       │
│ Y CRM    │ Y PROVEE │ DIARIO   │ Y COBROS │ Y FIDEL. │ Y EMAIL              │
│          │ DORES    │          │          │          │                      │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────────────────┘
```

---

## 2. DETALLE DE PROCESOS, SUBPROCESOS Y DATOS GENERADOS

### P1 — RESERVAS Y CITAS

**Gestionado por:** Wix Bookings V2 (SSOT de slots y reservas nativas) + backend personalizado (`bookingSaga.js`, `bookingCore.js`, `staff.js`, `reservas.web.js`, `citasManager.web.js`) + colección CMS `CitasF2`.

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P1.1** Consulta de catálogo público | `reservas.web.js` → `getServiceBySlugOrId` (Permiso `Anyone`). Lee `ServiciosCatalogo` por `slug` o `serviceId`. Resuelve datos de Bookings V2 (precio, duración, imagen, recomendaciones, complementos). | `serviceId`, `slug`, `title`, `description`, `price`, `totalDuration`, `mainMedia`, `recomendaciones`, `addonId[]`, `categoryId` | `ServiciosCatalogo` (lectura) + `ComplementosCatalogo` (lectura) |
| **P1.2** Consulta de disponibilidad | `reservas.web.js` → `getAvailableDays` consulta `listAvailabilityTimeSlots` (Time Slots V2) con `timeZone: "Europe/Madrid"`, `locationType: "BUSINESS"`. `DAYS_CACHE` conserva únicamente claves de días disponibles; `getAvailableSlots` y `getCertifiedDualSlots` vuelven a consultar Wix para los slots. El DTO de cliente aplica el intervalo de inicio configurado de 30 minutos. No se persisten inventarios de slots ni parejas duales. | Días disponibles; slots visibles en el DTO, `resourceId` y `scheduleId` | `ControlOperativo` (`DAYS_CACHE`, solo fechas) + respuesta DTO al frontend; sin caché de slots |
| **P1.3** Resolución de profesional | `reservas.web.js` → `resolveStaffForSlot`. Si el cliente elige profesional → usa ese `resourceId`. Si no → `staff.js` asigna el profesional con menos horas reservadas ese día (desempate por rotación). | `resourceId` asignado, `scheduleId`, `staffName` | Respuesta DTO + `MapaStaff` (lectura) |
| **P1.4** Creación de reserva simple | `citasManager.web.js` → `processDualBooking` (tipo SIMPLE). Revalida slot en servidor. `bookingCore.js` ejecuta `createBooking` (Bookings Writer V2) con `timezone: "Europe/Madrid"`, `locationType: "OWNER_BUSINESS"`, `resource._id`, `location._id`. Inserta en `CitasF2`. | `bookingId` (GUID Wix), `bookingType: "SIMPLE"`, `bookingStatus: "PENDING"`, `paymentStatus: "NOT_PAID"`, `serviceId`, `resourceId`, `slotStart`, `slotEnd`, `totalAmount`, `traceId` (UUID v4), `dateYmd` | `CitasF2` (insert) + Wix Bookings V2 (reserva nativa) |
| **P1.5** Creación de reserva dual (F1+F2) | `bookingSaga.js` orquesta dos llamadas independientes a `createBooking` vinculadas por `pairToken` (UUID v4). F1: fase de aplicación (importe total). F2: fase de lavado/peinado (`totalAmount = 0`, metadata `noFee: true`, `selectedPaymentOption: OFFLINE`). El Writer F2 se invoca sin opciones de bypass y conserva la validación nativa de disponibilidad y de opción de pago de Wix. Mutex `SLOT_LOCK` en `ControlOperativo` como coordinación adicional, sin sustituir la validación nativa. | `pairToken`, `bookingId` F1, `bookingId` F2, `bookingType: "DUAL_F1"` / `"DUAL_F2"`, `totalAmount` (F1: importe total, F2: 0), `slotStart` F2 = `slotStart` F1 + `phase1Duration` + `exposureDuration`, `traceId` | `CitasF2` (2 inserts) + `ControlOperativo` (`SLOT_LOCK`) + Wix Bookings V2 (2 reservas nativas) |
| **P1.6** Saga de compensación (fallo F2) | Si la creación de F2 o su persistencia fallan → `cancelBooking` sobre F1. Registro en `ControlOperativo`. Job `runPendingCompensationsJob` reintenta cada 30 min. | `controlType: "SYSTEM_FLAG"`, `alertType: "COMPENSATION_PENDING"`, `pairToken`, `bookingId` F1 cancelada, `traceId` | `ControlOperativo` (insert) + Wix Bookings V2 (cancelación F1) |
| **P1.7** Confirmación por pago online | Webhook `order_payment_status_updated` → `events.js` deduplica por `eventId` en `ControlOperativo`. Actualiza `CitasF2`. Inserta en `MovimientosCaja` con `sequenceNumber` monótono desde `CajaActual.CAJA_PRINCIPAL.sequenceCounters`. | `paymentStatus: "PAID"`, `bookingStatus: "CONFIRMED"`, `transactionId`, `sequenceNumber`, `numSerieFactura`, `hash` (SHA-256), `previousRecordHash`, `taxBase`, `taxAmount`, `tipoImpositivo`, `channelType: "ONLINE"`, `movementType: "COBRO"`, `traceId` | `CitasF2` (update) + `MovimientosCaja` (insert append-only) + `ControlOperativo` (`WEBHOOK_EVENT`) |
| **P1.8** Reprogramación de reserva | `citasManager.web.js` → `rescheduleExistingBooking` / `rescheduleDualBookings` (Permiso `SiteMember`). Evento backend `booking_rescheduled`. Regeneración de `pairToken` si dual. | `bookingId`, nuevo `slotStart`/`slotEnd`, nuevo `resourceId` (si cambia), `traceId` | `CitasF2` (update controlado) + Wix Bookings V2 |
| **P1.9** Cancelación de reserva | Webhook `booking_canceled` → `events.js` deduplica. Actualiza `CitasF2`. Registro rectificativo en `MovimientosCaja` (`movementType: "DEVOLUCION"`). Devolución de stock si aplica en `MovimientosInventario`. | `bookingStatus: "CANCELED"`, `paymentStatus: "REFUNDED"`, `movementType: "DEVOLUCION"`, `hash` encadenado, `previousInvoiceId`, `tipoRectificativa`, `traceId` | `CitasF2` (update) + `MovimientosCaja` (insert append-only) + `MovimientosInventario` (si aplica) + `ControlOperativo` |
| **P1.10** No-show | Registro manual por staff vía `citasManager.web.js`. Actualización de `CitasF2`. | `bookingStatus: "NO_SHOW"`, `traceId` | `CitasF2` (update controlado) |
| **P1.11** Eventos backend Bookings (5 handlers) | `events.js` registra handlers Velo para `booking_created`, `booking_updated`, `booking_confirmed`, `booking_canceled` y `booking_rescheduled`. Wix los entrega como eventos backend gestionados por la plataforma; la deduplicación `eventId` se persiste en `ControlOperativo` (`WEBHOOK_EVENT`, nombre histórico del tipo de control). | `eventId`, `bookingId`, payload del evento, `dedupeKey`, `traceId` | `ControlOperativo` (`WEBHOOK_EVENT`, append-only) + `CitasF2` (según evento) |

**Reprogramación dual — implementación integrada en `main` mediante PR #176; publicación Wix no verificada en esta auditoría:**
- Identidad idempotente estable SHA-256 a partir de `pairToken`, booking IDs, servicios, recurso objetivo y slots destino; `traceId` no forma parte de la identidad. `operationId` UUID opcional permite distinguir una nueva intención.
- Journal versionado en `ControlOperativo` con estados `IN_PROGRESS`, `F1_IN_PROGRESS`, `F1_DONE`, `F2_IN_PROGRESS`, `F2_DONE`, `CMS_PROJECTED`, `COMPLETED` y `REPAIR_REQUIRED`.
- Heartbeat de los locks originales y destino durante la operación; la liberación espera a que termine cualquier renovación en curso.
- La proyección CMS es idempotente: acepta que el slot ya esté en destino, actualiza solo si sigue en el slot original y falla si detecta una modificación externa inesperada.
- Ante un resultado nativo F1/F2 incierto o fallo de F2, no se ejecuta rollback especulativo. Se registra `REPAIR_REQUIRED` y se abre incidencia.
- **Pendiente:** reconciliación automática del journal no terminal mediante Bookings Reader V2 y prueba real de concurrencia en Wix Preview. Hasta entonces, un reintento no terminal se bloquea y requiere reparación; no se reejecuta el Writer a ciegas.
- La actualización del journal usa `@wix/data` `items.bulkPatch`, marcado como Developer Preview: [documentación oficial](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-patch-data-items?apiView=SDK). No publicar esta ampliación hasta validar ese contrato en Wix Preview.

---

### P2 — VENTA ONLINE (TIENDA)

**Gestionado por:** Wix Stores Catalog V1 (SSOT de productos) + Wix eCommerce (checkout y pedidos) + backend personalizado (`inventario.web.js`, `events.js`) + colecciones `InventarioStockVenta`, `MovimientosInventario`.

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P2.1** Catálogo de productos | Wix Stores V1 gestiona productos, variantes y colecciones. `InventarioStockVenta` mantiene snapshot espejo del stock. | `productId`, `variantId`, `sku`, `name`, `price`, `stockOnHand`, `stockReserved`, `stockAvailable`, `tipoImpositivo`, `taxIncluded`, `wixProductId`, `wixVariantId`, `traceId` | `InventarioStockVenta` (lectura/escritura controlada) + `Stores/Products`, `Stores/Variants` (WIX_APP, solo lectura) |
| **P2.2** Carrito y checkout | Wix eCommerce Cart V2. El cliente añade productos, selecciona Click&Collect, paga mediante el checkout nativo de Wix Payments. | `cartId`, `lineItems[]` (`productId`, `variantId`, `quantity`, `price`, `taxRate`), `totalAmount`, `currency: "EUR"` | Wix eCommerce (nativo) |
| **P2.3** Confirmación de pago | Webhook `order_payment_status_updated` → `events.js` deduplica. Inserta en `MovimientosCaja`. | `orderId`, `transactionId`, `sequenceNumber`, `numSerieFactura`, `amount`, `taxBase`, `taxAmount`, `tipoImpositivo`, `paymentMethod` (clasificación canónica; `WIX_PAYMENTS` para el cobro online), `channelType: "ONLINE"`, `movementType: "COBRO"`, `hash`, `previousRecordHash`, `traceId` | `MovimientosCaja` (insert append-only) + `ControlOperativo` (`WEBHOOK_EVENT`) |
| **P2.4** Registro de pedido | Webhook `order_created`. Registro de intención de compra. | `orderId`, `paymentStatus: "PENDING_PAYMENT"`, `lineItems[]`, `traceId` | `CitasF2` o registro interno + `Stores/Orders` (WIX_APP) |
| **P2.5** Descuento de stock | El checkout nativo de Wix Stores descuenta stock automáticamente. `MovimientosInventario` registra la salida con `movementToken` idempotente. | `movementToken`, `movementType: "VENTA"`, `sku`, `quantityDelta`, `stockBefore`, `stockAfter`, `orderId`, `lineItemId`, `traceId` | `MovimientosInventario` (insert append-only) + `InventarioStockVenta` (update `stockOnHand`) |
| **P2.6** Devolución online | Webhook `order_refund_updated`. Solo si `sideEffects.restock.lineItems` está presente → registro de devolución de stock. | `refundId`, `movementType: "DEVOLUCION"`, `quantityDelta` (positivo), `stockBefore`, `stockAfter`, `reason`, `orderId`, `lineItemId`, `traceId` | `MovimientosInventario` (insert append-only) + `MovimientosCaja` (insert `DEVOLUCION`) + `InventarioStockVenta` (update) |
| **P2.7** Conciliación de inventario | `inventario.web.js` → `getInventoryDashboard`. Compara `InventarioStockVenta` con datos de `Stores/InventoryItems`. Alertas de discrepancia en `ControlOperativo`. | `stockOnHand` vs. stock Wix, `needsWixReconciliation`, `lastSyncAt`, `alertType`, `traceId` | `InventarioStockVenta` + `ControlOperativo` (`SYSTEM_FLAG`) |

---

### P3 — CAJA FÍSICA Y TESORERÍA

**Gestionado por:** Backend personalizado (`cajas.web.js`, `data.js`) + colecciones `MovimientosCaja`, `CajaActual`, `HistoricoCierresZ`.

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P3.1** Apertura de caja | `CajaActual` (`CAJA_PRINCIPAL`) se inicializa al inicio de jornada. `isOpen: true`, `openedAt`, `openedBy`, `openingAmount` (fondo inicial). | `singletonKey: "CAJA_PRINCIPAL"`, `isOpen`, `openedAt`, `openedBy`, `openingAmount`, `operationDate`, `traceId` | `CajaActual` (update) |
| **P3.2** Cobro presencial (efectivo/tarjeta/Bizum) | `cajas.web.js` → `registerManualTransaction` (Permiso `SiteMember`, rol ADMIN o GESTION). Inserta en `MovimientosCaja` con `channelType: "PRESENCIAL"`. Actualiza `CajaActual`. Asigna `sequenceNumber` desde `CajaActual.CAJA_PRINCIPAL.sequenceCounters`. Genera `hash` SHA-256 encadenado. | `sequenceNumber`, `numSerieFactura`, `fechaExpedicionFactura`, `movementType: "COBRO"`, `channelType: "PRESENCIAL"`, `paymentMethod` (EFECTIVO/TARJETA/BIZUM), `amount`, `taxBase`, `taxAmount`, `tipoImpositivo`, `hash`, `previousRecordHash`, `transactionId`, `staffResourceId`, `operationDescription`, `traceId` | `MovimientosCaja` (insert append-only) + `CajaActual` (update saldos) |
| **P3.3** Devolución presencial | `registerManualTransaction` con `movementType: "DEVOLUCION"`. Registro rectificativo con `previousInvoiceId` y `tipoRectificativa`. | `movementType: "DEVOLUCION"`, `previousInvoiceId`, `tipoRectificativa`, `correctionReason`, `hash` encadenado, `traceId` | `MovimientosCaja` (insert append-only) |
| **P3.4** Ajuste de caja | `registerManualTransaction` con `movementType: "AJUSTE"`. Requiere `operationDescription` obligatoria. | `movementType: "AJUSTE"`, `amount`, `operationDescription`, `traceId` | `MovimientosCaja` (insert append-only) |
| **P3.5** Aportación / Retiro | `movementType: "APORTACION"` o `"RETIRO"`. Operaciones no comerciales. | `movementType`, `amount`, `operationDescription`, `traceId` | `MovimientosCaja` (insert append-only) |
| **P3.6** Pago a proveedor desde caja | `movementType: "PAGO_PROVEEDOR"`. Vinculación con `DatosFiscales` del proveedor. | `movementType: "PAGO_PROVEEDOR"`, `NIFDestinatario`, `thirdPartyLegalName`, `amount`, `taxBase`, `taxAmount`, `traceId` | `MovimientosCaja` (insert append-only) |
| **P3.7** Arqueo parcial (Recuento X) | `cajas.web.js` → `registerXCount`. Compara `expectedCash` vs `countedCash`. Registra `difference`. | `expectedCash`, `countedCash`, `difference`, `differenceReason`, `traceId` | `CajaActual` (update) |
| **P3.8** Estado de caja en tiempo real | `cajas.web.js` → `getCashierState`. Lectura de `CajaActual`. | `isOpen`, `cashAmount`, `salesCount`, `refundCount`, `paymentCount`, `totalInAmount`, `totalOutAmount`, `lastMovementAt` | `CajaActual` (lectura) |

---

### P4 — FACTURACIÓN Y FISCALIDAD (Veri*Factu)

**Gestionado por:** Backend personalizado (`fiscalAggregator.web.js`, `fiscalDocuments.web.js`, `data.js`) + colecciones `MovimientosCaja`, `LibroAsientosContablesDetalle`, `DatosFiscales` + Wix Invoices V1 (nativo, separado del ledger propio).

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P4.1** Emisión de factura simplificada | Cada `COBRO` en `MovimientosCaja` genera automáticamente un `numSerieFactura` correlativo. Tipo `F2` (simplificada) o `F1` (completa si hay datos del destinatario). | `numSerieFactura`, `tipoFactura` (F1/F2), `fechaExpedicionFactura`, `NIFEmisor`, `NIFDestinatario` (si F1), `taxBase`, `taxAmount`, `tipoImpositivo`, `amount`, `hash`, `traceId` | `MovimientosCaja` (campo del registro) |
| **P4.2** Cadena de hashes Veri*Factu | Cada registro en `MovimientosCaja` genera `hash = SHA256(previousRecordHash + numSerieFactura + amount + timestamp)`. Cadena inmutable. | `hash`, `previousRecordHash`, `hashAlgorithm`, `generationTimestamp`, `sequenceNumber` | `MovimientosCaja` (campos del registro) |
| **P4.3** QR de verificación | Generación de `verificationQR` por cada factura simplificada. | `verificationQR` (URL) | `MovimientosCaja` (campo del registro) |
| **P4.4** Factura rectificativa | Registro con `tipoRectificativa` (R1-R5), `previousInvoiceId`, `correctionAmount`, `correctionReason`. | `tipoRectificativa`, `previousInvoiceId`, `correctionAmount`, `correctionReason`, `hash` encadenado | `MovimientosCaja` (insert append-only) |
| **P4.5** Libro registro de facturas expedidas | `fiscalAggregator.web.js` → `getLibroRegistroFacturasExpedidas` (Permiso `Admin`). Query calculada sobre `MovimientosCaja` filtrando `movementType: "COBRO"`. | `sequenceNumber`, `numSerieFactura`, `fechaExpedicionFactura`, `taxBase`, `taxAmount`, `tipoImpositivo`, `amount`, `NIFDestinatario` (si aplica) | Query sobre `MovimientosCaja` |
| **P4.6** Libro registro de facturas recibidas | Query calculada sobre `MovimientosCaja` filtrando `movementType: "PAGO_PROVEEDOR"`. | `sequenceNumber`, `numSerieFactura`, `NIFEmisor`, `thirdPartyLegalName`, `taxBase`, `taxAmount`, `amount` | Query sobre `MovimientosCaja` |
| **P4.7** Resumen trimestral de impuestos | `fiscalAggregator.web.js` → `getQuarterlyTaxSummary`. Agrega IVA repercutido y soportado por trimestre. | `fiscalPeriod` (YYYY-Tn), `totalTaxBase`, `totalTaxAmount`, desglose por `tipoImpositivo`, IVA repercutido, IVA soportado, resultado | Query sobre `MovimientosCaja` |
| **P4.8** Asientos contables (PGC) | `LibroAsientosContablesDetalle` registra partida doble. `accountCode` (6 dígitos), `debitAmount`, `creditAmount`. Invariante: `SUM(debit) === SUM(credit)` por `entryId`. | `entryId`, `entryDate`, `fiscalPeriod`, `accountCode`, `concept`, `debitAmount`, `creditAmount`, `recordHash`, `previousRecordHash`, `sourceMovementId`, `traceId` | `LibroAsientosContablesDetalle` (insert append-only) |
| **P4.9** Configuración fiscal del sistema | `DatosFiscales` con `recordType: "CONFIG_SISTEMA"`. Singleton `CONFIG_SISTEMA_FISCAL` con parámetros Veri*Factu. | `taxId` (NIF emisor), `legalName`, `taxRegime`, `verifactuEnabled`, `verifactuVersion`, `fechaInicioVerifactu` | `DatosFiscales` (singleton protegido) |
| **P4.10** Wix Invoices V1 (nativo) | Facturación nativa de Wix. **Separada** del ledger propio Veri*Factu. No se usa como fuente de verdad fiscal. | Facturas nativas Wix (formato Wix) | Wix Invoices V1 (app nativa) |

---

### P5 — INVENTARIO

**Gestionado por:** Backend personalizado (`inventario.web.js`) + Wix Stores V1 (stock comercial nativo) + colecciones `InventarioStockVenta`, `MovimientosInventario`.

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P5.1** Entrada de stock (proveedor) | Registro manual por ADMIN/GESTION. `movementType: "ENTRADA_STOCK"`. | `movementToken`, `movementType: "ENTRADA_STOCK"`, `sku`, `productName`, `quantityDelta` (positivo), `stockBefore`, `stockAfter`, `reason`, `referenceId` (factura proveedor), `traceId` | `MovimientosInventario` (insert append-only) + `InventarioStockVenta` (update `stockOnHand`) |
| **P5.2** Reserva de stock (venta online) | El checkout de Wix Stores reserva stock. `stockReserved` se incrementa. | `stockReserved` (incremento), `wixProductId`, `wixVariantId`, `traceId` | `InventarioStockVenta` (update) |
| **P5.3** Salida de stock (venta confirmada) | Webhook `order_payment_status_updated` → `movementType: "VENTA"`. Idempotencia por `movementToken`. | `movementToken`, `movementType: "VENTA"`, `sku`, `quantityDelta` (negativo), `stockBefore`, `stockAfter`, `orderId`, `lineItemId`, `traceId` | `MovimientosInventario` (insert append-only) + `InventarioStockVenta` (update) |
| **P5.4** Devolución al stock | Webhook `order_refund_updated` con `sideEffects.restock`. `movementType: "DEVOLUCION"`. | `movementToken`, `movementType: "DEVOLUCION"`, `quantityDelta` (positivo), `refundId`, `reason`, `traceId` | `MovimientosInventario` (insert append-only) + `InventarioStockVenta` (update) |
| **P5.5** Ajuste por merma/rotura | Registro manual por ADMIN. `movementType: "AJUSTE"`. `reason` obligatorio. | `movementToken`, `movementType: "AJUSTE"`, `quantityDelta`, `reason` (obligatorio), `traceId` | `MovimientosInventario` (insert append-only) + `InventarioStockVenta` (update) |
| **P5.6** Recuento mensual | Registro manual. Comparación `stockOnHand` teórico vs. contado. | `sku`, `stockOnHand` (teórico), `stockOnHand` (contado), `difference`, `reason`, `traceId` | `InventarioStockVenta` (update tras ajuste) + `MovimientosInventario` (AJUSTE si hay diferencia) |
| **P5.7** Dashboard de inventario | `inventario.web.js` → `getInventoryDashboard`. Vista consolidada de stock, alertas de stock bajo. | `stockOnHand`, `stockAvailable`, `stockMinimo`, `reorderPoint`, `needsWixReconciliation` | `InventarioStockVenta` (lectura) |

---

### P6 — HORARIO LABORAL

**Gestionado por:** Backend personalizado (`horario.web.js`) + colección `RegistrosHorariosStaff`.

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P6.1** Fichaje de entrada | `horario.web.js` → `registrarFichaje` (Permiso `SiteMember`). El sistema identifica al personal por `memberId` autenticado → resuelve `resourceId` en `MapaStaff`. | `resourceId`, `memberId`, `staffName`, `clockEventType: "ENTRADA"`, `recordedAt` (timestamp), `recordType`, `registeredByMemberId`, `deviceIpAddress`, `dayKey`, `monthKey`, `traceId` | `RegistrosHorariosStaff` (insert append-only) |
| **P6.2** Fichaje de salida | `clockEventType: "SALIDA"`. | Mismos campos que P6.1 con `clockEventType: "SALIDA"` | `RegistrosHorariosStaff` (insert append-only) |
| **P6.3** Pausa inicio / Pausa fin | `clockEventType: "PAUSA_INICIO"` / `"PAUSA_FIN"`. | Mismos campos con tipo de pausa | `RegistrosHorariosStaff` (insert append-only) |
| **P6.4** Ajuste de registro | `clockEventType: "AJUSTE"`. `notes` **obligatorio** (validado por hook `beforeInsert`). `adjustmentReason`, `signature`. | `clockEventType: "AJUSTE"`, `notes` (obligatorio), `adjustmentReason`, `signature`, `registeredBy`, `registeredByMemberId`, `traceId` | `RegistrosHorariosStaff` (insert append-only) |
| **P6.5** Estado de jornada actual | `horario.web.js` → `getEstadoJornada`. Lectura del último fichaje del día para el personal autenticado. | `clockEventType` (último), `recordedAt`, `staffName` | `RegistrosHorariosStaff` (lectura) |
| **P6.6** Cálculo de horas trabajadas | `horario.web.js` → `calcularHorasTrabajadas`. Agrega fichajes por `resourceId` y `dayKey`/`monthKey`. | `resourceId`, `dayKey`, `monthKey`, total horas, total pausas | Query sobre `RegistrosHorariosStaff` |

---

### P7 — CLIENTES Y CRM

**Gestionado por:** Wix Members (identidad) + Wix CRM (fichas) + Wix Data (Ficha Técnica Clienta) + backend (RBAC).

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P7.1** Alta de cliente | Wix Members nativo. Registro en `Members/FullData`, `Members/PrivateMembersData`. | `memberId`, `email`, `firstName`, `lastName`, `phone`, `createdAt` | `Members/FullData` (WIX_APP) |
| **P7.2** Ficha Técnica Clienta | Wix CRM + Wix Data. Fórmula de color, alergias, historial de tratamientos, preferencias, notas. | Fórmula de color, alergias, historial, preferencias, notas, fecha última actualización | Wix CRM / Wix Data (app nativa) |
| **P7.3** Consentimiento y RGPD | Consent Mode v2 en web. Checkbox desmarcado por defecto. | `consentMarketing`, `consentDataProcessing`, `consentTimestamp` | Wix (nativo) |
| **P7.4** Programa de fidelización | Wix Fidelización: Bronze (0-200 pts), Silver (201-500 pts), Gold (>500 pts). Canje por add-ons. | Puntos acumulados, nivel, canjes | Wix Fidelización (app nativa) |
| **P7.5** Identidad y asignación de personal | `MapaStaff` conserva el mapeo de respaldo `staffMemberId` (Bookings) ↔ `resourceId`/`scheduleId`; el rol de acceso procede de `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID` en `internalConfig.js`. | `staffMemberId`, `resourceId`, `scheduleId`, `active`; campos históricos `memberId`, `rolBookings`, `rolWebsite` no gobiernan RBAC | `MapaStaff` (NATIVE #13) |

---

### P8 — GASTOS Y PROVEEDORES

**Gestionado por:** Parcialmente backend (`MovimientosCaja` con `movementType: "PAGO_PROVEEDOR"`) + `DatosFiscales` (maestro de terceros). La recepción y escaneo de facturas de proveedores es **manual** (Marian) y se gestiona en Capa 3.

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P8.1** Alta de proveedor | `DatosFiscales` con `recordType: "TERCERO"`, `thirdPartyType: "PROVEEDOR"`. | `taxId` (NIF proveedor), `legalName`, `commercialName`, `address`, `postalCode`, `province`, `email`, `phone`, `taxRegime` | `DatosFiscales` (insert) |
| **P8.2** Pago a proveedor desde caja | `registerManualTransaction` con `movementType: "PAGO_PROVEEDOR"`. | `movementType: "PAGO_PROVEEDOR"`, `NIFDestinatario`, `thirdPartyLegalName`, `amount`, `taxBase`, `taxAmount`, `tipoImpositivo`, `operationDescription`, `traceId` | `MovimientosCaja` (insert append-only) |
| **P8.3** Recepción de factura de proveedor | **Manual.** Marian recibe factura (papel/email/PDF). No se registra en Wix. Se traslada a Capa 3 por reenvío de email. | Factura PDF/imagen (documento externo) | **Capa 3** → `2_GASTOS/` |
| **P8.4** Conciliación del gasto | El gestor cruza facturas de proveedores con extractos bancarios y movimientos de caja. | Conciliación (la hace el gestor fuera del sistema Wix) | **Capa 3** → gestor |

---

### P9 — CIERRE Z DIARIO

**Gestionado por:** Backend personalizado (`crons.js` → `verifyNightlyZClosing`) + colección `HistoricoCierresZ`.

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P9.1** Agregación de transacciones del día | Cron `verifyNightlyZClosing` (01:20 AM, `Europe/Madrid`). Consulta todos los `MovimientosCaja` del día (`closeDate`). | Total por `movementType`, total por `paymentMethod`, total por `channelType` | Query sobre `MovimientosCaja` |
| **P9.2** Verificación de cadena SHA-256 | Recorre la cadena de `hash` / `previousRecordHash` del día. Verifica continuidad e integridad. | `isIntegrityVerified` (boolean), `startRecordHash`, `endRecordHash`, `startSequence`, `endSequence` | `HistoricoCierresZ` (campo del cierre) |
| **P9.3** Consolidación en HistoricoCierresZ | Inserta documento inmutable con totales por medio de pago, resumen impositivo y firma criptográfica. | `closeDate`, `fiscalPeriod`, `fiscalYear`, `recordDomain`, `closedBy`, `closedAt`, `totalCash`, `totalCard`, `totalBizum`, `totalOnline`, `totalTaxBase`, `totalTaxAmount`, `totalRefunds`, `totalOperations`, `totalAdjustments`, `totalTips`, `startTicketNumber`, `endTicketNumber`, `closingHash`, `closingSignature`, `closingSignatureStatus`, `closingStatus`, `closingType`, `closingSource`, `closingSchemaVersion`, `snapshotJSON`, `taxTypeBreakdown`, `movementTypeBreakdown`, `totalesMedioPago`, `verifiedAt`, `approverUser`, `traceId` | `HistoricoCierresZ` (insert append-only) |
| **P9.4** Alerta de Cierre Z faltante | Si a las 08:00 no hay Cierre Z del día anterior → alerta. | `alertType`, `message`, `severity`, `traceId` | `ControlOperativo` (`SYSTEM_FLAG`) + email a Marian |

---

### P10 — PAGOS Y COBROS

**Gestionado por:** Wix Payments (proveedor de pagos nativo) + Wix eCommerce.

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P10.1** Cobro online con tarjeta | Wix Payments procesa el pago en el checkout nativo; Wix eCommerce registra la orden y el evento de pago. | `transactionId`, `paymentMethod` nativo/canónico, `amount`, `orderId` | `MovimientosCaja` (insert append-only) |
| **P10.2** Métodos de pago digitales alternativos | Solo se consideran los métodos que Wix Payments muestre habilitados para esta cuenta y país. No se declara Bizum disponible en Wix Payments sin verificación expresa en el panel. | Método nativo confirmado, `transactionId`, `amount` | `MovimientosCaja` (insert append-only) |
| **P10.3** Cobro en efectivo | Registro manual en caja. | `paymentMethod: "EFECTIVO"`, `amount`, `channelType: "PRESENCIAL"` | `MovimientosCaja` |
| **P10.4** Depósito de reserva | La fianza, si se aprueba, se cobra mediante el checkout nativo de Wix Payments. El umbral y el importe siguen pendientes de resolución documental/ADR. | `depositAmount`, `depositType`, `transactionId` | Wix Bookings + Wix eCommerce / Wix Payments |
| **P10.5** Reembolso | Webhook `order_refund_updated`. Registro rectificativo. | `refundId`, `movementType: "DEVOLUCION"`, `amount` (negativo o rectificativo) | `MovimientosCaja` (insert append-only) |
| **P10.6** Informes de pagos y payouts | Wix Payments ofrece gestión centralizada de pagos, payouts, reembolsos y contracargos. Formato y descarga de informes para Capa 3 pendientes de verificar; no se atribuye reporte automático a AEAT. | Informe/registro disponible en el panel de Wix Payments → **Capa 3**, tras verificar exportación y alcance. |

---

### P11 — MARKETING Y FIDELIZACIÓN

**Gestionado por:** Wix Blog, Wix Automations, Wix Groups, Wix Pro Gallery, Google Business Profile.

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P11.1** Blog SEO | Publicación de artículos en Wix Blog. | `Blog/Posts`, `Blog/Categories`, `Blog/Tags` | WIX_APP (solo lectura) |
| **P11.2** Automatizaciones de email | Wix Automations: win-back 90 días, abandono carrito, cumpleaños, recordatorio 24h. | Emails enviados, aperturas, clics | Wix Automations (nativo) |
| **P11.3** Programa de fidelización | Niveles Bronze/Silver/Gold. Canje de puntos por add-ons. | Puntos, nivel, canjes | Wix Fidelización (nativo) |
| **P11.4** Galería antes/después | Wix Pro Gallery sincronizada con Instagram. | Imágenes, metadatos | Wix Pro Gallery (nativo) |

> **Nota:** Los procesos de marketing y fidelización **no generan datos fiscales ni contables**. No se trasladan a Capa 3. Son relevantes solo para analítica de negocio.

---

### P12 — COMUNICACIONES Y EMAIL

**Gestionado por:** Resend (email transaccional desde backend) + IONOS (DNS/correo corporativo) + M365 (buzón marian@).

| Subproceso | Descripción técnica | Datos generados | Colección / Destino SSOT |
| :--- | :--- | :--- | :--- |
| **P12.1** Email transaccional (Resend) | Backend envía confirmaciones de reserva, recordatorios, alertas vía Resend API. `RESEND_API_KEY` en Secrets Manager. | Email de confirmación, recordatorio, alerta | Resend (log externo) |
| **P12.2** Correo corporativo (IONOS) | 5 buzones: `marian@`, `hola@`, `gestion@`, `alba@`, `andrea@`. MX en IONOS. SPF/DKIM/DMARC activos. | Emails entrantes/salientes | IONOS (servidor de correo) |
| **P12.3** Export a Capa 3 por email | Backend genera CSV → Resend → `gestion@marianmadrid.es` → Power Automate → SharePoint. | CSV con datos estructurados + email con asunto `[MM-EXPORT] TIPO FECHA` | **Capa 3** (SharePoint) |
| **P12.4** Alertas de sistema | `systemHealthCheck` (cron 07:00). Verifica CMS, Secrets Manager, continuidad del ledger. | `alertType`, `message`, `severity`, `traceId` | `ControlOperativo` (`SYSTEM_FLAG`) + email a Marian |

---

## 3. MATRIZ DE TRASLADO SSOT → CAPA 3

### 3.1 Principio rector del traslado

> **Wix CMS es la autoridad transaccional (SSOT). Capa 3 (SharePoint) es el repositorio documental de evidencia para el gestor. Capa 3 NUNCA es fuente de verdad. Solo recibe copias de datos ya validados y consolidados en el SSOT.**

### 3.2 Matriz completa: Dato generado → Carpeta Capa 3 → Mecanismo de traslado

| Proceso origen | Dato / Documento generado | Colección SSOT origen | Carpeta Capa 3 destino | Mecanismo de traslado | Frecuencia | Quién interviene |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P9** Cierre Z | Cierre Z diario (totales, desglose por método de pago, IVA, hash, firma) | `HistoricoCierresZ` | `1_VENTAS/Cierres_Z/AAAA/MM/` | **Automático:** Cron `verifyNightlyZClosing` → export CSV → Resend → `gestion@` → Power Automate → SharePoint | Diario (01:20) | Sistema (0 min Marian) |
| **P3** Caja física | Movimientos de caja del día (cada cobro, devolución, ajuste, con hash y secuencia) | `MovimientosCaja` | `1_VENTAS/Movimientos/AAAA/` | **Automático:** Cron `exportDailyMovements` (03:00) → CSV → Resend → Power Automate → SharePoint | Diario (03:00) | Sistema (0 min Marian) |
| **P10** Pagos | Informe de transacciones y payouts de Wix Payments | Wix Payments (proveedor nativo Wix) | `1_VENTAS/WIX_PAYMENTS/AAAA/` | **Semi-automático pendiente de validar:** descarga desde el panel Wix Payments y archivo en SharePoint; no se presume envío automático por email ni formato concreto. | Mensual | Marian (~2 min, estimación por confirmar) |
| **P1** Reservas | Ventas y reservas del mes (servicios realizados, importes, estados, métodos de pago) | `CitasF2` | `1_VENTAS/Reservas/AAAA/` | **Automático:** Cron `exportMonthlyVentas` (día 2, 06:00) → CSV → Resend → Power Automate → SharePoint | Mensual (día 2) | Sistema (0 min Marian) |
| **P2** Venta online | Pedidos online del mes (productos, importes, IVA, estado) | `Stores/Orders` (WIX_APP) + `MovimientosCaja` | `1_VENTAS/Tienda_Online/AAAA/` | **Automático:** Incluido en `exportMonthlyVentas` o export separado | Mensual (día 2) | Sistema (0 min Marian) |
| **P5** Inventario | Movimientos de inventario del mes (entradas, salidas, ajustes, devoluciones) | `MovimientosInventario` | `5_INVENTARIO/AAAA/` | **Automático:** Cron `exportMonthlyInventario` (día 3, 06:00) → CSV → Resend → Power Automate → SharePoint | Mensual (día 3) | Sistema (0 min Marian) |
| **P6** Horario laboral | Fichajes de la semana (entradas, salidas, pausas, ajustes por trabajadora) | `RegistrosHorariosStaff` | `4_PERSONAL/Fichajes/AAAA/` | **Automático:** Cron `exportWeeklyFichajes` (lunes 06:00) → CSV → Resend → Power Automate → SharePoint | Semanal (lunes) | Sistema (0 min Marian) |
| **P6** Horario laboral | Resumen mensual de horas por trabajadora | Agregación de `RegistrosHorariosStaff` | `4_PERSONAL/Resumen_Mensual/AAAA/` | **Automático:** Generado a partir del CSV semanal consolidado | Mensual (día 1) | Sistema (0 min Marian) |
| **P8** Gastos | Facturas de proveedores (productos, alquiler, luz, gestoría, etc.) | **No existe en Wix.** Documento externo. | `2_GASTOS/AAAA/MM/` | **Manual:** Marian reenvía email con asunto `[GASTO] AAAA-MM Descripción` + adjunto → Power Automate → SharePoint. O sube directamente a SharePoint. | Según llegan (~2-4/mes) | Marian (~2 min por factura) |
| **P3** Banco | Extracto bancario mensual (Ibercaja) | **No existe en Wix.** Documento externo. | `3_BANCO/AAAA/` | **Manual:** Marian descarga PDF de banca online → sube a SharePoint | Mensual (día 1-5) | Marian (~3 min) |
| **P4** Fiscal | Libro registro de facturas expedidas (anual, para Modelo 390) | Query sobre `MovimientosCaja` | `6_ENTREGA_GESTOR/AAAA/Anual/` | **Automático:** Generado por `fiscalAggregator.web.js` → export anual → email → Power Automate → SharePoint. O el gestor lo descarga del paquete trimestral. | Anual | Sistema + Gestor |
| **P4** Fiscal | Resumen trimestral de IVA (para Modelo 303) | Query sobre `MovimientosCaja` | `6_ENTREGA_GESTOR/AAAA/Tn/` | **Automático:** PA-07 (Power Automate) consolida el día 10 post-trimestre | Trimestral | Sistema (0 min Marian) |
| **P4** Fiscal | Paquete documental para gestoría | `fiscalDocuments.web.js` → `createManagerPackageVersion` | `6_ENTREGA_GESTOR/AAAA/Tn/` | **Automático:** PA-07 consolida todos los archivos del trimestre en carpeta de entrega | Trimestral (día 10-15) | Sistema + Marian (verificación ~10 min) |

### 3.3 Resumen visual del traslado

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          WIX CMS (SSOT)                                        │
│                                                                                 │
│  MovimientosCaja ──────────────────────────────────────────────────────────┐    │
│  HistoricoCierresZ ────────────────────────────────────────────────────────┤    │
│  CitasF2 ──────────────────────────────────────────────────────────────────┤    │
│  RegistrosHorariosStaff ───────────────────────────────────────────────────┤    │
│  MovimientosInventario ────────────────────────────────────────────────────┤    │
│  InventarioStockVenta ─────────────────────────────────────────────────────┤    │
│  DatosFiscales ────────────────────────────────────────────────────────────┤    │
│  LibroAsientosContablesDetalle ────────────────────────────────────────────┤    │
│  Stores/Orders (WIX_APP) ──────────────────────────────────────────────────┤    │
│  Members/FullData (WIX_APP) ───────────────────────────────────────────────┤    │
│                                                                              │    │
│  Wix Payments (transacciones/payouts; exportación por verificar) ────────────┤    │
│  Ibercaja (extracto externo) ──────────────────────────────────────────────┤    │
│  Facturas proveedores (documentos externos) ───────────────────────────────┤    │
└──────────────────────────────────────────────────────────────────────────────┘    │
                                   │                                                │
                    ┌──────────────┴──────────────┐                                │
                    │  MECANISMO DE TRASLADO      │                                │
                    │                              │                                │
                    │  AUTOMÁTICO (90%):           │                                │
                    │  Cron Wix → CSV → Resend     │                                │
                    │  → email gestion@            │                                │
                    │  → Power Automate            │                                │
                    │  → SharePoint               │                                │
                    │                              │                                │
                    │  MANUAL (10%):              │                                │
                    │  Marian reenvía email       │                                │
                    │  o sube a SharePoint        │                                │
                    └──────────────┬──────────────┘                                │
                                   │                                                │
                                   ▼                                                │
┌─────────────────────────────────────────────────────────────────────────────────┐│
│                    CAPA 3 — SHAREPOINT (MarianMadrid_Documentacion)             ││
│                                                                                  ││
│  🟢 1_VENTAS/ ← Cierres Z, Movimientos, Reservas, Tienda Online, Wix Payments         ││
│  🔴 2_GASTOS/ ← Facturas de proveedores (Marian)                                ││
│  🔵 3_BANCO/  ← Extractos bancarios (Marian)                                    ││
│  🟡 4_PERSONAL/ ← Fichajes, Resumen horas                                      ││
│  📦 5_INVENTARIO/ ← Movimientos de stock                                        ││
│  📦 6_ENTREGA_GESTOR/ ← Paquete trimestral consolidado                          ││
│  📁 9_DOCUMENTOS_NEGOCIO/ ← Contratos, seguros, licencias                       ││
└──────────────────────────────────────────────────────────────────────────────────┘│
                                   │                                                 │
                                   ▼                                                 │
┌──────────────────────────────────────────────────────────────────────────────────┐│
│                         GESTOR / CONTABLE                                        ││
│  Accede a SharePoint (solo lectura) → Descarga paquete → Organiza en su         ││
│  sistema contable (A3/Sage/Holded/Contasol) → Presenta modelos AEAT            ││
└──────────────────────────────────────────────────────────────────────────────────┘│
```

---

## 4. MECANISMOS TÉCNICOS DE TRASLADO

### 4.1 Flujo automático: Cron Wix → Resend → Power Automate → SharePoint

Este es el mecanismo principal. Ya diseñado en respuestas previas (Anexo Capa 3 del Dossier). Se detalla aquí la correspondencia exacta entre cada export y el dato SSOT que lo alimenta:

| Export (Cron Wix) | Asunto del email | Datos SSOT incluidos en el CSV | Frecuencia | Carpeta SharePoint destino |
| :--- | :--- | :--- | :--- | :--- |
| `verifyNightlyZClosing` + export | `[MM-EXPORT] CIERRE_Z AAAA-MM-DD` | `zNumber`, `closeDate`, `totalCash`, `totalCard`, `totalBizum`, `totalOnline`, `totalTaxBase`, `totalTaxAmount`, `totalRefunds`, `closingHash`, `isIntegrityVerified` | Diario 01:20 | `1_VENTAS/Cierres_Z/` |
| `exportDailyMovements` | `[MM-EXPORT] MOVIMIENTOS_CAJA AAAA-MM-DD` | `sequenceNumber`, `numSerieFactura`, `fechaExpedicionFactura`, `movementType`, `channelType`, `paymentMethod`, `amount`, `taxBase`, `taxAmount`, `tipoImpositivo`, `hash`, `transactionId`, `traceId` | Diario 03:00 | `1_VENTAS/Movimientos/` |
| `exportWeeklyFichajes` | `[MM-EXPORT] FICHAJES_SEMANAL AAAA-Snn` | `resourceId`, `staffName`, `clockEventType`, `recordedAt`, `recordType`, `notes`, `traceId` | Lunes 06:00 | `4_PERSONAL/Fichajes/` |
| `exportMonthlyVentas` | `[MM-EXPORT] VENTAS_MENSUAL AAAA-MM` | `dateYmd`, `bookingId`, `bookingType`, `bookingStatus`, `paymentStatus`, `serviceId`, `resourceId`, `totalAmount`, `channelType`, `traceId` | Día 2, 06:00 | `1_VENTAS/Reservas/` |
| `exportMonthlyInventario` | `[MM-EXPORT] INVENTARIO_MENSUAL AAAA-MM` | `movementToken`, `movementType`, `sku`, `productName`, `quantityDelta`, `stockBefore`, `stockAfter`, `reason`, `traceId` | Día 3, 06:00 | `5_INVENTARIO/` |

### 4.2 Flujo manual: Marian → email [GASTO] → Power Automate → SharePoint

Para facturas de proveedores que no existen en el SSOT Wix:

1. Marian recibe factura (papel, email, PDF).
2. Reenvía a `gestion@marianmadrid.es` con asunto `[GASTO] AAAA-MM Descripción`.
3. Power Automate detecta el email, extrae el adjunto, lo guarda en `2_GASTOS/AAAA/MM/`.
4. El gestor categoriza el gasto (base imponible, IVA soportado, deducible) en su sistema contable.

### 4.3 Flujo manual: Extracto bancario

1. Marian entra en banca online de Ibercaja.
2. Descarga extracto del mes anterior en PDF.
3. Lo sube a `3_BANCO/AAAA/` en SharePoint.
4. Nombre: `AAAA-MM_Extracto_Ibercaja.pdf`.

### 4.4 Flujo trimestral: Consolidación para el gestor

1. **Día 10 post-trimestre:** Power Automate (PA-07) consolida todos los archivos del trimestre en `6_ENTREGA_GESTOR/AAAA/Tn/`.
2. Genera Excel resumen con hojas: VENTAS, GASTOS, IVA, PERSONAL, CHECKLIST.
3. Envía email a Marian y al gestor con enlace SharePoint.
4. **Día 15:** Marian verifica el checklist (~10 min). Si falta algo, lo busca y lo sube.
5. **Día 20:** El gestor presenta Modelo 303 y Modelo 130 ante la AEAT.

### 4.5 Datos que NO se trasladan a Capa 3

| Dato | Motivo de exclusión |
| :--- | :--- |
| PII de clientes (nombre, email, teléfono, dirección) | RGPD: minimización. El gestor no necesita datos de clientes para la contabilidad. Solo importes. |
| Datos de tarjetas de crédito | PCI-DSS. Prohibido por SSOT §8. Wix Payments procesa los datos de tarjeta durante el checkout; el CMS no almacena PAN ni CVV. Nunca llegan al CMS. |
| Hashes Veri*Factu completos en el DTO frontend | Seguridad. Solo se incluyen en el CSV de export para el gestor, no en la UI. |
| Cuentas contables PGC en el DTO frontend | Seguridad. Solo en el CSV de export. |
| Márgenes comerciales y notas privadas | Confidencialidad. No se trasladan al gestor salvo que Marian lo autorice explícitamente. |
| Datos de marketing (clics, aperturas, tráfico web) | No son relevantes para la contabilidad ni la fiscalidad. |
| Fórmulas de color y fichas técnicas de clientas | Datos operativos del salón. No tienen relevancia fiscal ni contable. |

---

## 5. CUMPLIMIENTO NORMATIVO DEL TRASLADO

### 5.1 Matriz normativa aplicada al traslado

| Norma | Requisito | Cómo lo cumple el traslado a Capa 3 |
| :--- | :--- | :--- |
| **Ley 11/2021 (Veri*Factu)** | Inalterabilidad, trazabilidad, sin borrados | Los CSV exportados incluyen `hash`, `previousRecordHash`, `sequenceNumber`, `numSerieFactura`. La cadena SHA-256 se preserva íntegra en el export. SharePoint aplica versionado (500 versiones) y retención 6 años. |
| **RD 1007/2023** | Huella SHA-256, secuencia monótona, QR | El CSV de `MovimientosCaja` incluye todos los campos Veri*Factu. El Cierre Z incluye `closingHash` e `isIntegrityVerified`. |
| **RD 1619/2012** | Facturas correlativas, series rectificativas | `numSerieFactura` correlativo presente en cada movimiento exportado. `tipoRectificativa` y `previousInvoiceId` en devoluciones. |
| **Ley 37/1992 (IVA)** | Desglose base/cuota por tipo impositivo | Cada CSV incluye `taxBase`, `taxAmount`, `tipoImpositivo`. El gestor puede calcular el Modelo 303 directamente. |
| **PGC (RD 1514/2007)** | Libro diario, partida doble | `LibroAsientosContablesDetalle` se exporta (si se activa el escritor). El gestor genera los asientos en su sistema a partir de `MovimientosCaja`. |
| **RD 8/2019** | Registro horario inalterable, conservación 4 años | Fichajes exportados semanalmente con `clockEventType`, `recordedAt`, `staffName`. Retención 6 años en SharePoint (supera los 4 legales). |
| **RGPD / LOPDGDD** | Minimización PII, cifrado, acceso restringido | Los CSV de export **nunca** incluyen PII de clientes. SharePoint cifra con AES-256. Gestor accede en solo lectura. Alba y Andrea sin acceso. Datos en servidores UE. |
| **LGT 58/2003** | Conservación 4 años (fiscal) | Retención SharePoint: 6 años. |
| **Código de Comercio art. 30** | Conservación 6 años (mercantil) | Retención SharePoint: 6 años. Versionado 500 versiones. |
| **RD 253/2025 (Bizum)** | Obligación y sujeto obligado a validar con AEAT/asesoría. | El Cierre Z conserva `totalBizum` cuando se registra; no se presume reporte automático de Wix Payments. Los informes de pagos/payouts se archivan solo tras verificar el formato disponible en el panel. |
| **LSSI-CE** | Transparencia de precios | No aplica directamente al traslado. Los textos legales están en el sitio web. |

### 5.2 Trazabilidad end-to-end del dato

Cada dato que llega a Capa 3 conserva su `traceId` (UUID v4) desde el momento de su generación en el SSOT hasta su archivo en SharePoint. Esto permite:

1. **Auditoría fiscal:** Ante requerimiento de la AEAT, se puede rastrear cualquier `numSerieFactura` desde el CSV en SharePoint hasta el registro original en `MovimientosCaja` en el CMS Wix, verificando el `hash` y el `previousRecordHash`.
2. **Auditoría laboral:** Ante Inspección de Trabajo, se puede rastrear cualquier fichaje desde el CSV en SharePoint hasta el registro original en `RegistrosHorariosStaff`.
3. **Conciliación bancaria:** El gestor cruza el extracto bancario con los movimientos de caja del CSV, usando `transactionId` como clave de conciliación.

### 5.3 Test de estrés: acceso en caso de inspección

Según PTD Kit Digital §13 (25 escenarios, 96% resiliencia):

| Escenario | Tiempo de acceso a la documentación |
| :--- | :--- |
| AEAT requiere ventas de enero-febrero | <15 minutos (CSVs en SharePoint `1_VENTAS/`) |
| Inspección de Trabajo requiere registro horario | <2 minutos (CSVs en `4_PERSONAL/`) |
| AEAT requiere libro registro de facturas | <15 minutos (CSV consolidado o regeneración desde `MovimientosCaja`) |
| Gestor necesita paquete trimestral | Ya consolidado en `6_ENTREGA_GESTOR/` |

---

## 6. RESUMEN EJECUTIVO DEL FLUJO COMPLETO

### 6.1 Cifras clave

| Métrica | Valor |
| :--- | :--- |
| Procesos de negocio gestionados por el sitio Wix | **12** |
| Subprocesos totales identificados | **~65** |
| Colecciones CMS NATIVE que generan datos trasladables | **9** de 13 (las 4 restantes son de control/configuración) |
| Crons de exportación a Capa 3 | **5** (Cierre Z, Movimientos, Fichajes, Ventas, Inventario) |
| Flujos Power Automate | **7** (5 automáticos + 1 gastos Marian + 1 consolidación trimestral) |
| Datos trasladados automáticamente (sin intervención de Marian) | **~90%** |
| Datos trasladados manualmente por Marian | **~10%** (facturas de gastos + extracto bancario) |
| Tiempo mensual de Marian para Capa 3 | **~15-20 minutos** |
| Tiempo trimestral de Marian para entrega al gestor | **~10 minutos** |
| Normativas cubiertas por el traslado | **11** (Veri*Factu, IVA, PGC, RD 8/2019, RGPD, LGT, C.Comercio, RD 253/2025, LSSI-CE, RD 1619/2012, Ley 11/2021) |

### 6.2 Lo que NO se traslada (y por qué)

| Dato del SSOT | No se traslada porque... |
| :--- | :--- |
| PII de clientes (nombres, emails, teléfonos) | RGPD: minimización. El gestor solo necesita importes, no identidades de clientes. |
| Datos de tarjetas (PAN, CVV, caducidad) | PCI-DSS. Nunca llegan al CMS. Wix Payments procesa los datos de tarjeta durante el checkout; el CMS no almacena PAN ni CVV. |
| Fórmulas de color, alergias, historial de clientas | Datos operativos del salón. Sin relevancia fiscal. |
| Datos de marketing (clics, aperturas, tráfico) | Sin relevancia contable ni fiscal. |
| Hashes y cuentas contables en la UI del frontend | Seguridad. Solo en el CSV de export, no en la interfaz. |
| Registros de `ControlOperativo` (locks, rate limits, dedupe) | Datos técnicos internos. Sin relevancia fiscal ni contable. |
| Configuración de servicios (`ServiciosCatalogo`, `ComplementosCatalogo`) | Datos maestros del catálogo. El gestor no los necesita. Solo los importes de las ventas. |

### 6.3 Conclusión

El sitio Wix de Marian Madrid genera datos en **12 procesos de negocio** con aproximadamente **65 subprocesos**. De todos ellos, **9 colecciones CMS NATIVE** producen datos con relevancia fiscal, contable, laboral o de tesorería que deben trasladarse a la Capa 3 externa.

El traslado se realiza mediante un **patrón email estructurado** (Cron Wix → CSV → Resend → `gestion@` → Power Automate → SharePoint) que cubre el **90% de los datos de forma automática**, sin intervención de Marian. El **10% restante** (facturas de proveedores y extracto bancario) requiere una intervención mínima de Marian (~15-20 minutos al mes).

El gestor recibe cada trimestre un **paquete consolidado** en SharePoint con todos los documentos necesarios para presentar los modelos tributarios (303, 130, 390, 100, 347) y cumplir con las obligaciones contables (PGC), laborales (RD 8/2019) y de protección de datos (RGPD).

**Marian no necesita saber contabilidad. El sistema recopila. Power Automate archiva. El gestor organiza. Marian atiende clientas.**

---

*Documento generado el 6 de noviembre de 2026. Basado en la Biblia SSOT v10.0, el Dossier Técnico Consolidado, el PTD Kit Digital, el Anexo Biblia por Wix, el Anexo Biblia Migración, las Directrices de Desarrollo de Código y la normativa fiscal/laboral española vigente.*


### Cierre del dossier


---

# ANEXO DE VIGENCIA — 2026-11-09: Wix Stores Catalog V3 e Invoices

Este anexo actualiza las referencias históricas de este dossier que indican Catalog V1 activo o prohíben V3. Se basa en lectura directa del sitio publicado y en la solicitud explícita de migración del responsable del proyecto.

## Wix Stores — decisión vigente para Marian Madrid

- **Verificado en sitio publicado:** Catalog Versioning API devuelve V3_CATALOG. La API V3 devuelve 30 inventory items en una única ubicación en la lectura del 09-11-2026.
- **Decisión de arquitectura:** Catalog V3 es la versión canónica para este sitio. El código que siga usando Products/Inventory V1 no es compatible con el catálogo real y debe migrarse antes de habilitar el módulo de inventario.
- La decisión aplica a Marian Madrid, no constituye una declaración de compatibilidad App Market multi-site. Si el código se convierte en app distribuible, habrá que soportar V1 y V3 mediante detección de versión, conforme a la documentación oficial de Wix.
- El PR #216 contiene la implementación propuesta. Mientras permanezca abierto/no fusionado, el código desplegado no se considera migrado.
- La migración no reescribe MovimientosInventario ni otros ledgers. La fila QA existente en InventarioStockVenta no identifica ningún producto/variante V3; no se utiliza como correspondencia. Los 30 inventory items no se convierten automáticamente en maestros CMS porque faltan los datos fiscales y de reservas validados por producto.
- V3 modela inventario por variante y ubicación. Hasta disponer de asignación de ubicación en el contrato de negocio, una variante con más de un inventory item debe fallar de forma cerrada; nunca se elige ubicación arbitrariamente.

## Wix Invoices — decisión vigente

- GetSiteContext identifica la aplicación Wix Invoices instalada como versión V1.
- No se ha verificado una Invoices API V2 habilitada para este sitio. La nueva API Get Paid Invoices se documenta bajo el SDK @wix/get-paid y rutas API v4; no debe confundirse la versión de ruta REST con la versión de la aplicación Wix.
- La documentación oficial indica que Get Paid Invoices se despliega gradualmente y que sitios aún no migrados reciben HTTP 428. En el sitio, GET de invoices-settings responde 200, pero POST /invoices/v4/invoices/query responde 428 INVOICES_API_UNAVAILABLE; por tanto, el CRUD nuevo no está habilitado.
- Se conserva el flujo actual. No se conecta un segundo emisor ni se cambia numeración/series/ledger fiscal hasta que Wix habilite la API vigente y exista ADR específica de coexistencia/migración.

## Fuentes oficiales

- Catalog V3 introduction: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/introduction
- Catalog Versioning: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-versioning/get-catalog-version
- Inventory Items V3: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/inventory-items-v3/introduction
- Products V3: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/introduction
- Invoices settings: https://dev.wix.com/docs/api-reference/business-management/get-paid/invoices/invoices-settings/get-invoices-settings

**Estado:** CI offline verde (run 168, commit 77d63d2: 47 suites/442 tests/0 fallos); pendiente validación del SDK V3 en Wix Local Editor, QA de flujos y despliegue autorizado. Invoices: bloqueado por disponibilidad de la API V4 en el sitio.

## Scopes SDK V3 requeridos

- Catalog Versioning: SCOPE.STORES.CATALOG_READ_LIMITED.
- Query Inventory Items V3: SCOPE.STORES.INVENTORY_ITEM_READ.
- Products V3 Get Product: SCOPE.STORES.PRODUCT_READ.
- Bulk Increment/Decrement Inventory Items V3: SCOPE.STORES.INVENTORY_ITEM_WRITE.

La concesión efectiva de estos scopes en el entorno Velo del sitio sigue pendiente de comprobación en Wix Local Editor; auth.elevate no sustituye la concesión de scopes.
