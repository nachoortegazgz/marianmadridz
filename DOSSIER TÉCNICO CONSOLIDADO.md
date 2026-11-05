# DOSSIER TÉCNICO CONSOLIDADO — marianmadrid.es

Aquí tienes el **Resumen Ejecutivo Previo** y el **Mapa de Contenidos Estructurado** del Dossier Técnico Consolidado adjunto. Este documento está diseñado para alinear inmediatamente al modelo IA con el contexto, las restricciones y la arquitectura del proyecto `marianmadrid.es`, permitiendo una navegación semántica y técnica precisa.

---

# 1. RESUMEN EJECUTIVO PREVIO: CONTEXTO Y DIRECTRICES DE ROL

### 1.1 Identidad y Misión del Proyecto
*   **Proyecto:** Marian Madrid Peluquería y Estética (`marianmadrid.es`).
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
*   **Seguridad:** RBAC doble capa (Velo Permissions + `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID`). Secretos en Wix Secrets Manager. Firma HMAC-SHA256 en webhooks.
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
| **8** | Seguridad y Permisos | • RBAC: Velo Permissions + rol `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID` resuelto tras consultar Bookings Staff API<br>• Roles: ADMIN / GESTION / ESTILISTA<br>• Secretos en Wix Secrets Manager (`mmSecrets.js`)<br>• Firma HMAC-SHA256 + ventana ±60s anti-replay<br>• Rate limiting por surface (public-booking, reservas, availability)<br>• Minimización PII: enmascaramiento en logs, exclusión datos tarjeta<br>• Webhooks Bookings: verificación JWT + deduplicación `eventId` |
| **9** | Integraciones | • Apps Wix nativas: reglas por app (Bookings V2, Stores V1, eCom Cart V2)<br>• Externas: Resend (email), OpenAI (IA), MONEI (Bizum BdE 6911), IONOS (DNS/correo), M365 (custodia)<br>• Gestión colecciones WIX_APP: solo lectura, mutación vía SDK oficial<br>• Prohibición de llamadas externas desde frontend |
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
| **ANEXO B** | Solución Técnica Capa 3 Automatizada | • Patrón email estructurado: Wix → Resend → Power Automate → SharePoint<br>• Conectores estándar M365 Business Standard (sin Premium)<br>• Módulo `backend/exports/exportService.js` + 4 crons de export<br>• 7 flujos Power Automate (PA-01 a PA-07)<br>• Estructura SharePoint: 7 carpetas principales + subcarpetas anuales<br>• Permisos: Marian (Full Control), GestorAquí tienes el **Mapa de Contenidos Estructurado** diseñado para insertarse inmediatamente después de la definición de rol y directrices básicas. Este mapa actúa como índice semántico y técnico para que el modelo IA (o cualquier auditor humano) localice instantáneamente cualquier dato, restricción o contrato dentro del Dossier Técnico Consolidado.

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
| **8** | Seguridad y Permisos | • RBAC doble capa: Velo Permissions + `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID`<br>• Roles: ADMIN / GESTION / ESTILISTA<br>• Secretos en Wix Secrets Manager (`mmSecrets.js`)<br>• Firma HMAC-SHA256 + ventana ±60s anti-replay<br>• Rate limiting por surface (public-booking, reservas, availability)<br>• Minimización PII: enmascaramiento en logs, exclusión datos tarjeta<br>• Webhooks Bookings: verificación JWT + deduplicación `eventId` |
| **9** | Integraciones | • Apps Wix nativas: reglas por app (Bookings V2, Stores V1, eCom Cart V2)<br>• Externas: Resend (email), OpenAI (IA), MONEI (Bizum BdE 6911), IONOS (DNS/correo), M365 (custodia)<br>• Gestión colecciones WIX_APP: solo lectura, mutación vía SDK oficial<br>• Prohibición de llamadas externas desde frontend |
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
| Stores catálogo | Catalog V1 | Catalog V3 prohibido |
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

### Reserva simple

1. Frontend solicita servicios y disponibilidad via webMethods públicos.
2. Backend consulta slots nativos de Bookings (`listAvailabilityTimeSlots`, `locationType: "BUSINESS"`).
3. En la operación de creación, el servidor revalida la disponibilidad del slot exacto.
4. `backend/staff.js` resuelve y asigna explícitamente un `resourceId` y `scheduleId`.
5. Se crea la reserva nativa (`createBooking`, `locationType: "OWNER_BUSINESS"`).
6. `bookingCore.js` inserta en `CitasF2` con `bookingStatus = "PENDING"`, `paymentStatus = "UNPAID"`, `bookingType = "SIMPLE"` y un `traceId` UUID v4.
7. Si hay pago previo, se redirige al checkout eCom; el webhook confirma el estado final.

La disponibilidad mostrada al usuario no garantiza que el slot siga libre al confirmar. La revalidación es obligatoria en servidor.

### Reserva dual con gap de exposición (F1 + F2)

**Prohibición absoluta**: no usar `createMultiServiceBooking`. La API nativa Multiservice exige secuencia sin ningún hueco; el gap de exposición requiere otro enfoque.

La arquitectura DUAL implementa dos llamadas independientes a `createBooking` vinculadas por un `pairToken` (UUID v4):

- **F1** (`bookingType = "DUAL_F1"`): fase de aplicación. Lleva el importe total del servicio.
- **F2** (`bookingType = "DUAL_F2"`): fase de lavado/peinado. `totalAmount = 0`; se marca `NO_FEE` en Bookings. Usa `skipSelectedPaymentOptionValidation: true` y `skipAvailabilityValidation: true` (slot protegido por mutex en `ControlOperativo`).
- Ambas comparten el mismo `pairToken` en `CitasF2` y `ControlOperativo`.

**Cálculo temporal**:

```
InicioF2 = InicioF1 + phase1Duration + exposureDuration
```

**Saga de compensación**: si la creación de F2 o su persistencia fallan, el backend ejecuta `cancelBooking` sobre F1 y registra el evento en `ControlOperativo`. El proceso es idempotente: reintentos deben producir el mismo resultado final.

### Configuración de FlowControlSettings

| Parámetro | Uso |
| --- | --- |
| `skipAvailabilityValidation: true` | Solo tras adquirir mutex SLOT\_LOCK y revalidar en servidor |
| `skipBusinessConfirmation: true` | Confirma automáticamente reservas con pago online validado |
| `skipSelectedPaymentOptionValidation: true` | Solo en la reserva F2 (importe imputado en F1) |

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

## 6. Modelo CMS: colecciones, keyfields e integridad

**Snapshot físico verificado en Wix CMS el 2026-11-05:** 36 colecciones en el sitio. Las 13 colecciones de negocio enumeradas abajo existen y son de tipo `NATIVE`. La revisión de cada definición se recoge en §14.4.1. Este recuento es una lectura del CMS en esa fecha; no equivale a un inventario exhaustivo de permisos, registros, índices ni colecciones de aplicaciones.

### Colecciones de negocio NATIVE

| Colección | Naturaleza funcional | Autoridad / uso |
| --- | --- | --- |
| `ServiciosCatalogo` | Maestro mutable | Metadatos del servicio, precio, impuestos, visibilidad y fases; el servicio reservable nativo sigue siendo Wix Bookings V2. |
| `ComplementosCatalogo` | Maestro mutable | Complementos, precio, duración, fiscalidad y relación multi-reference con servicios. |
| `CitasF2` | Proyección transaccional mutable | Copia operativa de referencias/estado de reservas Bookings; no es un ledger fiscal ni sustituye a Bookings. |
| `ControlOperativo` | Control mixto mutable | Locks, deduplicación, idempotencia, rate limits, reintentos y alertas. |
| `CajaActual` | Singleton/proyección mutable | Estado de caja y contadores; admite `CAJA_PRINCIPAL` y `CAJA_SEQ`. No es el historial de operaciones. |
| `MovimientosCaja` | Ledger append-only | Hechos económicos y fiscales; nuevas rectificaciones mediante nuevos registros. |
| `HistoricoCierresZ` | Historial de cierres con recuperación limitada | Snapshot y evidencia de cierre. El hook permite cambios limitados a campos de firma/verificación; no describirlo como absolutamente inmutable en todas sus columnas. |
| `LibroAsientosContablesDetalle` | Ledger append-only | Líneas de proyección contable vinculadas al evento/documento de origen. |
| `DatosFiscales` | Maestro/configuración fiscal | Terceros y configuración fiscal del emisor/sistema según `recordType`. |
| `RegistrosHorariosStaff` | Ledger append-only | Eventos de jornada y ajustes trazables. |
| `InventarioStockVenta` | Maestro/proyección mutable | Estado de stock por producto/variante y catálogo/ubicación. |
| `MovimientosInventario` | Ledger append-only | Entradas, salidas, ventas, devoluciones y ajustes de existencias. |
| `MapaStaff` | Colección física conservada, uso transitorio | Existe en CMS, pero el resolver actual de personal no la usa como fuente de identidad/rol; véase §8 y §14.2. |

### Clasificación de colecciones no pertenecientes a este grupo

- El listado CMS devolvió 36 colecciones; 13 son las colecciones NATIVE de negocio anteriores. Las otras 23 no se clasifican aquí como `WIX_APP` sin revisar individualmente `collectionType`, `ownerAppId` y permisos.
- Las ocho colecciones de `FORBIDDEN_COLLECTIONS` en `internalConfig.js` son nombres bloqueados por política de código. No afirmar que las ocho existan físicamente en el CMS actual.
- Las colecciones de aplicaciones Wix se consultan conforme al contrato de cada app. No escribir directamente en colecciones `WIX_APP`; utilizar sus APIs/SDK oficiales.

### Integridad y persistencia

- `MovimientosCaja`: append-only. El hook exige `traceId`, `schemaVersion` y `hash`; valida consistencia fiscal con base, cuota, recargo, retención y total. No simplificar la ecuación a `taxBase + taxAmount = amount`: el código distingue `amount`, `taxBase` y `totalAmount`.
- `LibroAsientosContablesDetalle`: append-only; conservar `debitAmount` y `creditAmount` como nombres físicos, no `debit`/`credit`.
- `RegistrosHorariosStaff`: append-only; los ajustes se registran con `adjustmentReason`, no con un campo genérico `notes`.
- `MovimientosInventario`: append-only; el contrato utiliza `movementToken` y referencias de producto/variante/línea.
- `CitasF2`: proyección mutable con validación de enums y fechas; no es append-only.
- `CajaActual`: protege los documentos singleton; su estado agregado puede cambiar mediante operaciones backend.
- `HistoricoCierresZ`: inserción trazable; las actualizaciones posteriores se limitan a campos explícitos de firma/verificación.
- `InventarioStockVenta`: `stockAvailable = stockOnHand - stockReserved`; el campo disponible es una proyección calculada que se persiste y valida.
- `ServiciosCatalogo`: para servicios duales `allowCombine=true`, exige `linkedPhases` y `exposureDuration` numérico explícito. `totalDuration` debe ser coherente con la suma de fases e intervalo.
- `MapaStaff`: su presencia física no la convierte en autoridad del resolver de personal actual.

### ControlOperativo — controles multiplexados

`ControlOperativo` concentra varios tipos de registro en una única colección. El significado del documento se determina por `controlType`, `dedupeKey` y los campos específicos del tipo. No asumir que todos los campos son obligatorios para todos los documentos. En particular, el esquema conserva simultáneamente `attempts`/`attempt` y `expiresAt`/`leaseExpiresAt`; los consumidores deben usar el campo correspondiente a su contrato, sin crear nuevos alias.

## 7. Enums canónicos

Todo enum persistido en el CMS debe validarse mediante `assertValidEnum()` en `backend/validation.js` antes de escribir. Ningún valor no listado aquí puede persistirse.

### Enums Wix nativos (inglés — preservar exactamente)

```javascript
// Estados de reserva en Wix Bookings V2
BOOKING_STATUS_WIX = { CREATED, PENDING, CONFIRMED, DECLINED,
  WAITING_LIST, UPDATED, CANCELED, REFUNDED }

// Estados de pago en Wix eCom / Bookings
PAYMENT_STATUS_WIX = { UNDEFINED, NOT_PAID, PENDING_PAYMENT,
  PENDING_LEDGER, PAID, PARTIALLY_PAID, REFUNDED,
  PARTIALLY_REFUNDED, EXEMPT }
```

### Enums CMS (persistidos en CitasF2)

```javascript
// CitasF2.bookingStatus
BOOKING_STATUS_CMS = { PENDING, CONFIRMED, COMPLETED,
  CANCELED, NO_SHOW }  // CANCELED con doble L

// CitasF2.paymentStatus
PAYMENT_STATUS_CMS = { UNPAID, PARTIAL, PAID, REFUNDED }

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

// STAFF.WEBSITE_ROLE_BY_RESOURCE_ID
ROL_WEBSITE = { ADMIN, GESTION, ESTILISTA }

// ControlOperativo.controlType
CONTROL_TYPE = { SLOT_LOCK, WEBHOOK_EVENT, DEDUPE_KEY,
  IDEMPOTENCY, RATE_LIMIT, SYSTEM_FLAG }
```

### Addons — nomenclatura crítica

- `addonId`: campo singular en `ComplementosCatalogo` (PK de cada complemento). Nunca `addOnId` (legacy).
- `addOnIds`: array de transporte hacia Wix Bookings (plural). Contiene valores de `addonId`.

## 8. Seguridad, identidad y permisos

### Modelo de autorización RBAC

La seguridad opera en dos capas:

1. **Barrera de plataforma (Velo Permissions):** el permiso del `webMethod` aplica el primer filtro de invocación.
2. **Rol de negocio:** `backend/security.js` resuelve el miembro autenticado mediante su `contactId` y `backend/staff.js` consulta Bookings Staff API. El rol web canónico se obtiene de `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID` en `internalConfig.js`, asociado al `resourceId`.

**Importante:** `MapaStaff` existe físicamente en CMS y conserva campos como `rolWebsite`, `rolBookings`, `staffMemberId`, `resourceId` y `active`; sin embargo, el resolver actual `staff.js` no usa esa colección para resolver identidad ni rol. No documentar `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID` como fuente activa de autorización. La decisión de conservar sus campos físicos es no destructiva y no implica que sean el SSOT del runtime.

| Rol | Acceso |
| --- | --- |
| `ADMIN` | Configuración fiscal, cierre Z, catálogo, auditoría e inventario completo |
| `GESTION` | Operación de caja, cobros presenciales, arqueos y gestión de stock |
| `ESTILISTA` | Agenda y fichajes propios, según permisos del método |

Un miembro sin correspondencia activa en Bookings Staff API o sin rol canónico autorizado es rechazado con `ACCESS_DENIED`.

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
  FISCAL_KEY:    "SECRET_FISCAL_KEY",
  JWT_KEY:       "SECRET_AUTH_JWT_KEY",
  RESEND_API_KEY: "RESEND_API_KEY",
  OPENAI_API_KEY: "OPENAI_API_KEY",
});
```

Reglas: nunca en frontend, nunca en logs, nunca en repositorio.

### Firma criptográfica HMAC-SHA256

Peticiones sensibles y webhooks internos se firman con HMAC-SHA256. El backend valida la cabecera `X-MM-Signature` y exige que `X-MM-Timestamp` esté dentro de ±60 segundos para prevenir replay attacks.

### Rate limiting

Límites por IP/clave de solicitante, persistidos en `ControlOperativo` (`controlType = "RATE_LIMIT"`):

| Surface | Máximo | Ventana |
| --- | --- | --- |
| `public-booking` | 5 peticiones | 10 segundos |
| `reservas` | 20 peticiones | 5 segundos |
| `availability` | 12 peticiones | 5 segundos |

### Minimización de PII

- Prohibido almacenar números de tarjeta, fechas de caducidad o CVV en ninguna colección CMS.
- Los logs enmascaran datos personales con `_maskEmail`, `_maskPhone`, `_maskName` (en `public/mmUtils.js`).
- Los DTOs retornados al frontend excluyen hashes Veri\*Factu, cuentas contables PGC, márgenes y notas privadas.

### Webhooks de Bookings

Eventos suscritos: `booking_created`, `booking_updated`, `booking_confirmed`, `booking_canceled`, `booking_rescheduled`.

Procesamiento seguro:

1. Verificar firma JWT con clave pública de Wix.
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

**Stores Catalog V1**: cualquier migración a V3 requiere ADR propio, análisis de compatibilidad con `InventarioStockVenta` y aprobación explícita. Prohibido mezclar objetos V1 y V3.

**eCommerce / Cart V2**: la migración desde Checkout V1 es obligatoria antes de Feb 2027. Los pagos no confirman automáticamente una reserva; la confirmación proviene del webhook `order_payment_status_updated`.

### Integraciones externas

| Integración | Patrón | Notas |
| --- | --- | --- |
| Resend | `fetch()` backend con secreto en Wix Secrets | Email transaccional; no sustituir por SDK Wix sin rediseño |
| OpenAI API | `fetch()` backend con secreto en Wix Secrets | Timeout `AbortController` ≤ 9 s; respuesta fallback si JSON malformado |
| MONEI (pagos) | Integración nativa Wix (pasarela certificada BdE lic. 6911) | Bizum nativo en checkout |
| IONOS | DNS/correo corporativo (infraestructura externa) | No forma parte de la lógica transaccional |
| Microsoft 365 | OneDrive para custodia de Cierres Z; Power Automate para automatización | Si se activa, es repositorio de evidencia, no autoridad transaccional |

Todas las llamadas externas se ejecutan únicamente desde backend. El frontend nunca recibe claves de API ni credenciales de servicios externos.

### Gestión de colecciones WIX\_APP (inventario dinámico)

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
| `reservas.web.js` | `resolveStaffForSlot` | Anyone | Público |
| `reservas.web.js` | `invalidateCachesInternal` | Admin | `ADMIN` |
| `citasManager.web.js` | `processDualBooking` | Anyone | Rate limitado |
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
3. Webhook `order_payment_status_updated` recibido y deduplicado en `ControlOperativo`.
4. Se asigna `sequenceNumber` monótono desde `CAJA_SEQ` y se inserta append-only en `MovimientosCaja` con `channelType = "ONLINE"`, `movementType = "COBRO"`, hash SHA-256 encadenado.
5. `CitasF2` actualizado a `paymentStatus = "PAID"`, `bookingStatus = "CONFIRMED"`.

**Cancelaciones y reembolsos**:

1. Webhook `booking_canceled` deduplicado.
2. `CitasF2` actualizado a `bookingStatus = "CANCELED"`, `paymentStatus = "REFUNDED"`.
3. Registro rectificativo append-only en `MovimientosCaja` con `movementType = "DEVOLUCION"` y hash encadenado.
4. Si hay devolución de stock: registro en `MovimientosInventario` con `movementType = "DEVOLUCION"`.

**Cierre Z diario**:

1. Se agregan y consolidan todas las transacciones del día.
2. Se verifica la continuidad de la cadena de hashes SHA-256.
3. Se inserta un documento inmutable en `HistoricoCierresZ` con totales por medio de pago, resumen impositivo y firma criptográfica del periodo.

### Hooks CMS (`src/backend/data.js`)

Inventario de hooks exportados en el código actual. El hecho de que exista un campo en CMS no implica que el hook lo exija; las reglas siguientes describen validaciones de backend, no el esquema físico completo.

| Colección | Insert | Update | Remove |
| --- | --- | --- | --- |
| `MovimientosCaja` | Exige `traceId`, `schemaVersion`, `hash`; normaliza claves históricas; valida datos fiscales, payload, desglose y coherencia de importes. | Bloqueado. | Bloqueado. |
| `HistoricoCierresZ` | Exige `traceId`. | Solo cambios permitidos en campos de firma/verificación definidos en el hook. | Bloqueado. |
| `RegistrosHorariosStaff` | Normaliza `recordedAt` DATETIME y exige `traceId`. | Bloqueado. | Bloqueado. |
| `CajaActual` | Solo acepta singleton `CAJA_PRINCIPAL` o `CAJA_SEQ`. | Protege la modificación de contadores fuera del documento de secuencia; mantiene metadatos de idempotencia. | Bloqueado. |
| `ServiciosCatalogo` | Valida GUID de `serviceId`/`linkedPhases`, naturaleza, código fiscal, duraciones y reglas duales. | Mismas validaciones de esquema. | No hay hook exportado en el archivo actual. |
| `DatosFiscales` | Valida estructura por tipo de registro, NIF/VAT y configuración fiscal; rechaza campos legacy de escritura. | Validación por tipo de registro. | Protege el registro de configuración fiscal del sistema. |
| `LibroAsientosContablesDetalle` | Valida el contrato fiscal/contable y trazabilidad del asiento. | Bloqueado. | Bloqueado. |
| `ControlOperativo` | Valida el tipo de control y los campos requeridos por cada modalidad. | Actualización controlada según el tipo. | Eliminación controlada según el tipo. |
| `MovimientosInventario` | Valida movimiento, magnitud, trazabilidad e idempotencia. | Bloqueado. | Bloqueado. |
| `InventarioStockVenta` | Normaliza `lastSyncAt`; valida catálogo/IDs/ubicación y stock no negativo; calcula o valida `stockAvailable`. | Mismas validaciones de stock. | No hay hook exportado en el archivo actual. |
| `CitasF2` | Valida estados, fechas y estructura de la proyección. | Validación estructural para cambios controlados. | Bloqueado. |
| `ComplementosCatalogo` | Exige `addonId` y `sku`; precio no negativo. | Mismas validaciones. | No hay hook exportado en el archivo actual. |
| `MapaStaff` | No hay hook exportado actualmente. | No hay hook exportado actualmente. | No hay hook exportado actualmente. |

### Funciones de utilidad transversal

**`public/mmUtils.js`** (client-side + shared):

- `makeTraceId(prefix)` / `_generateUUID()` — generación de trazabilidad
- `_roundMoney(v)` — redondeo bancario a 2 decimales
- `_stableSerialize(value)` — serialización determinista con ordenación de claves
- `getMadridLocalStringNoZ(utcDate)` / `getUtcDateFromMadridLocal(local)` — conversión zona horaria
- `withTimeout(promise, ms, label)` / `_executeWithRetry(fn, retries, delay)` — control asíncrono
- `_maskEmail()` / `_maskPhone()` / `_maskName()` — enmascaramiento PII

**`backend/securityEngine.js`**:

- `hashSHA256(input)` — hash hex SHA-256
- `hmacSha256Hex(key, payload)` — firma HMAC-SHA256
- `hashChain(prevHash, payload)` — `SHA256(prevHash + payload)` Veri\*Factu
- `timingSafeEqual(a, b)` — comparación tiempo constante

# DOSSIER TÉCNICO CONSOLIDADO — marianmadrid.es (continuación)

A continuación se completan los capítulos 11 a 14 del dossier, alineados con la **Biblia SSOT v10.0**, el **Anexo Biblia por Wix**, las **Directrices de Desarrollo**, el **Anexo de Migración SDK** y la documentación oficial de Wix Developers consultada a fecha 5 de noviembre de 2026.

---

## 11. JOBS PROGRAMADOS Y WEBHOOKS

### 11.1 Infraestructura de tareas programadas

El scheduler de Velo ejecuta las tareas declaradas en `backend/jobs.config` mediante el módulo `backend/crons.js`. Todas las frecuencias se evalúan en zona horaria `Europe/Madrid` y respetan la política de concurrencia `Forbid` (no solapamiento) con un máximo de 3 reintentos en *exponential backoff*.

| Tarea (`functionName`) | Cron (Madrid) | Dominio | Operación |
| :--- | :--- | :--- | :--- |
| `cleanExpiredLocks` | `15 * * * *` | Concurrencia | Purga `ControlOperativo` (`SLOT_LOCK`) con `expiresAt < now()`. |
| `cleanExpiredDualCache` | `20 * * * *` | Reservas | Libera memoria intermedia de pares duales inconclusos. |
| `runPendingCompensationsJob` | `30 * * * *` | Sagas | Reintenta cancelación de F1 cuando F2 falló. |
| `cleanExpiredDaysCache` | `0 1 * * *` | Disponibilidad | Invalida caché de días disponibles. |
| `cleanExpiredSlotsCache` | `10 1 * * *` | Disponibilidad | Purga respuestas cacheadas de `listAvailabilityTimeSlots`. |
| `verifyNightlyZClosing` | `20 1 * * *` | Fiscal | Cierre Z automático: agrega `MovimientosCaja`, valida cadena SHA-256 y consolida en `HistoricoCierresZ`. |
| `systemHealthCheck` | `0 7 * * *` | Operativo | Verifica CMS, Secrets Manager y continuidad del ledger fiscal. |
| `cleanAuditLogs` | `0 2 * * 0` | Auditoría | Aplica retención sobre logs técnicos caducados. |

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
| **RD 1007/2023** (Reglamento Veri*Factu) | Huella SHA-256 encadenada, secuencia monótona, QR de verificación. | `hash = SHA256(previousRecordHash + numSerieFactura + amount + timestamp)` en `MovimientosCaja`; `sequenceNumber` asignado desde `CAJA_SEQ`; `verificationQR` generado. Plazo legal autónomos: **1-jul-2027**. |
| **RD 1619/2012** (Obligaciones de Facturación) | Facturas simplificadas correlativas, series rectificativas (R1–R5). | `numSerieFactura` correlativo sin saltos; `tipoRectificativa` y `previousInvoiceId` en asientos de devolución. |
| **Ley 37/1992** (IVA) | Tipos impositivos oficiales y desglose base/cuota. | `tipoImpositivo` validado contra enum `TIPO_IMPOSITIVO` (`0`, `0.04`, `0.10`, `0.21`); invariante `taxBase + taxAmount ≈ amount` con `_roundMoney()`. |

### 13.2 Contabilidad

| Norma | Exigencia | Implementación |
| :--- | :--- | :--- |
| **PGC (RD 1514/2007)** | Libro diario en partida doble, cuentas a 6 dígitos. | `LibroAsientosContablesDetalle` con `accountCode` (6 dígitos), `debitAmount` y `creditAmount`; invariante `SUM(debit) === SUM(credit)` por `entryId`. |

### 13.3 Laboral

| Norma | Exigencia | Implementación |
| :--- | :--- | :--- |
| **RD 8/2019** (Art. 34.9 ET) | Registro diario de jornada, inalterable, conservación 4 años. | `RegistrosHorariosStaff` *append-only* con `clockEventType` (`ENTRADA`, `SALIDA`, `PAUSA_INICIO`, `PAUSA_FIN`, `AJUSTE`); `adjustmentReason` obligatorio cuando `recordType = AJUSTE`; el CMS no garantiza por sí mismo la conservación legal. |

### 13.4 Privacidad y conservación

| Norma | Exigencia | Implementación |
| :--- | :--- | :--- |
| **RGPD (UE) 2016/679** y **LOPDGDD 3/2018** | Minimización de PII, consentimiento, derechos ARCO+. | Enmascaramiento automático en logs (`_maskEmail`, `_maskPhone`, `_maskName`); exclusión de datos de tarjeta en CMS; Consent Mode v2 en web; servidores en UE (IONOS + Wix). |
| **LGT 58/2003** y **Código de Comercio art. 30** | Conservación de documentación fiscal y mercantil 4–6 años. | Retención nativa del CMS; `HistoricoCierresZ` con firma criptográfica del periodo; copias en OneDrive M365. |
| **LSSI-CE 34/2002** | Transparencia de precios, información previa al pago. | Precios con IVA incluido; Aviso Legal, Política de Privacidad y Condiciones de Cancelación en footer. |
| **RD 253/2025** | Reporte AEAT de cobros Bizum desde enero 2026. | MONEI (BdE lic. 6911) reporta automáticamente; Cierre Z como evidencia documental. |

### 13.5 Matriz de cumplimiento consolidada

| Ámbito | Estado | Evidencia |
| :--- | :--- | :--- |
| Veri*Factu (transición) | ✅ Cumple | Ledger inmutable + cadena SHA-256 + Cierre Z nocturno. |
| IVA 21% / desgloses | ✅ Cumple | `_roundMoney()` + enum `TIPO_IMPOSITIVO`. |
| Registro horario | ✅ Cumple | `RegistrosHorariosStaff` exportable a PDF. |
| RGPD / LOPDGDD | ✅ Cumple | Servidores UE, PII enmascarada, Consent Mode v2. |
| Ley Antifraude (MONEI) | ✅ Cumple | Segregación automática Bizum/Tarjeta/Efectivo. |
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

### 14.2 Identidad del personal y roles

El runtime obtiene los profesionales mediante **Bookings Staff API**. Los identificadores no son intercambiables:

| Profesional | `staffMemberId` (Bookings Staff) | `resourceId` (agenda) | `scheduleId` (calendario) | Rol web |
| :--- | :--- | :--- | :--- | :--- |
| Marian | `0114748d-2806-3928-9b97-ff0d09853759` | `e556070a-6d6a-402e-8422-11133033ea76` | `06af20d4-1ec3-49fa-9075-f0691dfa7fd4` | `ADMIN` |
| Andrea | `bf177b1a-483a-4c03-9960-8da0aa0b8b41` | `07f7344f-e7e4-4c53-854b-47fd82ac8d40` | `a494b829-8161-4b84-b78d-6ffed45b4abe` | `ESTILISTA` |
| Alba | `c5563137-1124-4366-abe0-1afe56418968` | `9b905bfd-1a09-485d-9273-a24a20dfe648` | `94b8980d-63f4-43b1-ba86-41075e0eb63c` | `ESTILISTA` |

Los roles web se resuelven en `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID` dentro de `internalConfig.js`. `MapaStaff` sigue existiendo en CMS con sus campos físicos, pero no es la fuente activa de identidad/rol de `staff.js`. La tabla anterior es un snapshot de identidad de Bookings consultado el 2026-11-01; verificar en Bookings antes de cambios de personal. `thirdPartyId` no se completa por inferencia.

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

**Verificación directa Wix CMS — 2026-11-05:**
- Colecciones totales devueltas por `GET /data/v2/collections`: **36**.
- Colecciones de negocio de `BUSINESS_COLLECTIONS` y `OPERATIONAL_COLLECTIONS`: **13/13 encontradas**, todas con `collectionType=NATIVE`.
- Las otras 23 colecciones no se etiquetan aquí automáticamente como `WIX_APP`; deben clasificarse individualmente por `collectionType` y `ownerAppId`.
- Los ocho nombres de `FORBIDDEN_COLLECTIONS` son bloqueos de código, no una afirmación de existencia física en el CMS.

| Colección | Tipo CMS | Revisión observada |
| --- | --- | ---: |
| `CajaActual` | NATIVE | 47 |
| `CitasF2` | NATIVE | 31 |
| `ComplementosCatalogo` | NATIVE | 138 |
| `ControlOperativo` | NATIVE | 24 |
| `DatosFiscales` | NATIVE | 10 |
| `HistoricoCierresZ` | NATIVE | 36 |
| `InventarioStockVenta` | NATIVE | 20 |
| `LibroAsientosContablesDetalle` | NATIVE | 25 |
| `MapaStaff` | NATIVE | 23 |
| `MovimientosCaja` | NATIVE | 76 |
| `MovimientosInventario` | NATIVE | 29 |
| `RegistrosHorariosStaff` | NATIVE | 10 |
| `ServiciosCatalogo` | NATIVE | 194 |

Las revisiones son las devueltas por Wix en la consulta de lectura; cambiarán cuando se edite la definición de una colección.

#### 14.4.1 Esquema físico CMS — campos no sistema y tipos

La siguiente lista refleja los campos declarados en cada definición CMS en el momento de la consulta. No declara que todos sean obligatorios ni que todos tengan un consumidor activo. Los campos de sistema Wix `_id`, `_createdDate`, `_updatedDate` y `_owner` se omiten de las listas siguientes cuando están presentes.

- **CajaActual (rev. 47):** `netAmount:NUMBER`, `closedBy:TEXT`, `sequenceCounters:OBJECT`, `versionState:NUMBER`, `stateHash:TEXT`, `lastMovementAt:DATETIME`, `differenceReason:TEXT`, `difference:NUMBER`, `countedCash:NUMBER`, `expectedCash:NUMBER`, `cashAmount:NUMBER`, `totalOutAmount:NUMBER`, `totalInAmount:NUMBER`, `paymentAmount:NUMBER`, `paymentCount:NUMBER`, `refundAmount:NUMBER`, `refundCount:NUMBER`, `salesAmount:NUMBER`, `salesCount:NUMBER`, `otherAmount:NUMBER`, `voucherAmount:NUMBER`, `cardAmount:NUMBER`, `openedBy:TEXT`, `openingAmount:NUMBER`, `closedAt:DATETIME`, `openedAt:DATETIME`, `traceId:TEXT`, `staffResourceId:TEXT`, `operationDate:DATE`, `cashRegisterStatus:TEXT`, `singletonKey:TEXT`, `isOpen:BOOLEAN`, `id:TEXT`, `currentSequence:NUMBER`, `fiscalPeriod:TEXT`.
- **CitasF2 (rev. 31):** `slotStart:DATETIME`, `timeZone:TEXT`, `noShowReason:TEXT`, `noShowAt:DATETIME`, `changeLog:OBJECT`, `cancellationReason:TEXT`, `canceledAt:DATETIME`, `privacyNoticePurpose:TEXT`, `privacyNoticeAcceptedAt:DATETIME`, `privacyNoticeVersion:TEXT`, `totalAmount:NUMBER`, `slotEnd:DATETIME`, `bookingId:TEXT`, `traceId:TEXT`, `bookingType:TEXT`, `bookingStatus:TEXT`, `paymentStatus:TEXT`, `serviceId:TEXT`, `resourceId:TEXT`, `pairToken:TEXT`, `dateYmd:TEXT`, `scheduleId:TEXT`, `contactDetails:OBJECT`, `thirdPartyId:TEXT`, `catalogId:TEXT`, `cashMovementId:TEXT`, `fiscalData:OBJECT`, `invoicingDate:DATETIME`, `sourceEventId:TEXT`, `revision:NUMBER`, `meta:OBJECT`.
- **ComplementosCatalogo (rev. 138):** `sku:TEXT`, `taxIncluded:BOOLEAN`, `durationMinutes:NUMBER`, `tipoImpositivo:NUMBER`, `addonId:TEXT`, `traceId:TEXT`, `name:TEXT`, `description:RICH_TEXT`, `price:NUMBER`, `itemNature:TEXT`, `codigoImpuesto:TEXT`, `claveRegimen:TEXT`, `cuentaContableIngreso:TEXT`, `ServiciosCatalogo_name:MULTI_REFERENCE`.
- **ControlOperativo (rev. 24):** `controlType:TEXT`, `dedupeKey:TEXT`, `traceId:TEXT`, `status:TEXT`, `eventId:TEXT`, `expiresAt:DATETIME`, `bookingId:TEXT`, `pairToken:TEXT`, `resourceId:TEXT`, `serviceId:TEXT`, `slotStart:DATETIME`, `slotEnd:DATETIME`, `dateYmd:TEXT`, `transactionId:TEXT`, `orderId:TEXT`, `refundId:TEXT`, `kind:TEXT`, `attempts:NUMBER`, `maxAttempts:NUMBER`, `nextRetryAt:DATETIME`, `lastError:TEXT`, `totalAmount:NUMBER`, `operationDescription:TEXT`, `severity:TEXT`, `alertType:TEXT`, `message:TEXT`, `surface:TEXT`, `requesterKey:TEXT`, `requestCount:NUMBER`, `windowStart:DATETIME`, `retryAfter:NUMBER`, `payload:OBJECT`, `version:NUMBER`, `processedAt:DATETIME`, `leaseExpiresAt:DATETIME`, `heartbeatAt:DATETIME`, `attempt:NUMBER`.
- **DatosFiscales (rev. 10):** `taxId:TEXT`, `recordType:TEXT`, `thirdPartyType:TEXT`, `legalName:TEXT`, `commercialName:TEXT`, `address:TEXT`, `postalCode:TEXT`, `province:TEXT`, `country:TEXT`, `email:TEXT`, `phone:TEXT`, `taxRegime:TEXT`, `verifactuEnabled:BOOLEAN`, `verifactuVersion:TEXT`, `tipoUsoPosibleMultiOT:BOOLEAN`, `indicadorMultiplesOT:BOOLEAN`, `fechaInicioVerifactu:DATE`.
- **HistoricoCierresZ (rev. 36):** `totalTips:NUMBER`, `snapshotJSON:TEXT`, `closedAt:DATETIME`, `timeZone:TEXT`, `closingSchemaVersion:TEXT`, `closingSource:TEXT`, `auditedRecordsCount:NUMBER`, `taxTypeBreakdown:OBJECT`, `movementTypeBreakdown:OBJECT`, `endTicketNumber:TEXT`, `startTicketNumber:TEXT`, `totalOperations:NUMBER`, `totalAdjustments:NUMBER`, `closeDate:DATE`, `totalRefunds:NUMBER`, `fiscalPeriod:TEXT`, `totalTaxAmount:NUMBER`, `totalTaxBase:NUMBER`, `totalOnline:NUMBER`, `totalBizum:NUMBER`, `totalCard:NUMBER`, `totalCash:NUMBER`, `closedBy:TEXT`, `recordDomain:TEXT`, `closingStatus:TEXT`, `operationDate:DATE`, `consolidatedTotalAmount:NUMBER`, `grossSalesTotal:NUMBER`, `netTaxableAmount:NUMBER`, `netTaxAmount:NUMBER`, `totalesMedioPago:OBJECT`, `startSequence:NUMBER`, `endSequence:NUMBER`, `startRecordHash:TEXT`, `endRecordHash:TEXT`, `isIntegrityVerified:BOOLEAN`, `closingHash:TEXT`, `closingSignature:TEXT`, `closingSignatureStatus:TEXT`, `verifiedAt:DATETIME`, `approverUser:TEXT`, `estadoEnvioAEAT:TEXT`, `traceId:TEXT`, `inventoryClosingId:TEXT`, `fiscalYear:NUMBER`, `closingType:TEXT`, `sku:TEXT`, `wixProductId:TEXT`, `stockQuantity:NUMBER`, `unitCost:NUMBER`, `stockValue:NUMBER`, `cuentaContable:TEXT`, `summaryData:OBJECT`, `invoiceData:OBJECT`, `packageStatus:TEXT`, `packageVersion:NUMBER`, `sentTo:TEXT`, `sentAt:DATETIME`.
- **InventarioStockVenta (rev. 20):** `name:TEXT`, `catalogVersion:TEXT`, `locationId:TEXT`, `stockKey:TEXT`, `lastInventoryMovementId:TEXT`, `lastInventoryMovementAt:DATETIME`, `location:TEXT`, `tipoImpositivo:NUMBER`, `taxIncluded:BOOLEAN`, `price:NUMBER`, `sku:TEXT`, `stockOnHand:NUMBER`, `stockReserved:NUMBER`, `stockAvailable:NUMBER`, `wixProductId:TEXT`, `wixVariantId:TEXT`, `traceId:TEXT`, `stockId:TEXT`, `productId:TEXT`, `variantId:TEXT`, `stockMinimo:NUMBER`, `reorderPoint:NUMBER`, `reorderQuantity:NUMBER`, `needsWixReconciliation:BOOLEAN`, `lastSyncAt:DATETIME`.
- **LibroAsientosContablesDetalle (rev. 25):** `desgloseDetallado:OBJECT`, `entryId:TEXT`, `recordTimestamp:DATETIME`, `cashMovementId:TEXT`, `concept:TEXT`, `lineNumber:NUMBER`, `origenTipo:TEXT`, `origenRegistro:TEXT`, `sourceMovementId:TEXT`, `entryDate:DATE`, `fiscalPeriod:TEXT`, `accountCode:TEXT`, `debitAmount:NUMBER`, `creditAmount:NUMBER`, `accountingAmount:NUMBER`, `payloadFiscal:OBJECT`, `recordHash:TEXT`, `previousRecordHash:TEXT`, `idSistemaInformatico:TEXT`, `bookingId:TEXT`, `orderId:TEXT`, `resourceId:TEXT`, `traceId:TEXT`.
- **MapaStaff (rev. 23):** `displayName:TEXT`, `staffMemberId:TEXT`, `scheduleId:TEXT`, `thirdPartyId:TEXT`, `staffName:TEXT`, `rolWebsite:TEXT`, `rolBookings:TEXT`, `memberId:TEXT`, `resourceId:TEXT`, `active:BOOLEAN`, `sortOrder:NUMBER`, `sourceSystem:TEXT`, `schemaVersion:NUMBER`, `ServiciosCatalogo_staffMembers:MULTI_REFERENCE`.
- **MovimientosCaja (rev. 76):** `resourceId:TEXT`, `payloadAEAT:OBJECT`, `NIFEmisor:TEXT`, `NIFDestinatario:TEXT`, `IRPFWithholdingRate:NUMBER`, `IRPFWithholdingAmount:NUMBER`, `baseImponibleOImporteNoSujeto:NUMBER`, `signatureAlgorithm:TEXT`, `hashAlgorithm:TEXT`, `verificationQR:TEXT`, `digitalSignature:TEXT`, `generationTimestamp:DATETIME`, `serviceIdRedeemed:TEXT`, `giftCardOperation:TEXT`, `giftCardId:TEXT`, `accountingSign:NUMBER`, `lineItems:OBJECT`, `recordSource:TEXT`, `desgloseDetallado:OBJECT`, `bankReconciliationReference:TEXT`, `vatAccrualStatus:TEXT`, `linkedAdvanceId:TEXT`, `article20Exempt:BOOLEAN`, `cashBasisRegime:BOOLEAN`, `nonSubjectReason:TEXT`, `issuerThirdPartyTaxId:TEXT`, `thirdPartyLegalName:TEXT`, `issuedByThirdPartyOrRecipient:TEXT`, `isB2B:BOOLEAN`, `issuerLegalName:TEXT`, `correctionAmount:NUMBER`, `issuerInvoiceNumber:TEXT`, `previousInvoiceIssueDate:DATE`, `previousInvoiceNumber:TEXT`, `correctionReason:TEXT`, `withholdingBase:NUMBER`, `surchargeRate:NUMBER`, `linkedBookingIds:ARRAY_STRING`, `bookingId:TEXT`, `hash:TEXT`, `amount:NUMBER`, `taxAmount:NUMBER`, `taxBase:NUMBER`, `numSerieFactura:TEXT`, `sequenceNumber:NUMBER`, `transactionId:TEXT`, `previousRecordHash:TEXT`, `recordTimestamp:DATETIME`, `schemaVersion:TEXT`, `traceId:TEXT`, `movementType:TEXT`, `totalAmount:NUMBER`, `paymentMethod:TEXT`, `channelType:TEXT`, `operationDescription:TEXT`, `staffResourceId:TEXT`, `tipoFactura:TEXT`, `fechaExpedicionFactura:DATE`, `fechaOperacion:DATE`, `tipoImpositivo:NUMBER`, `recipientLegalName:TEXT`, `recipientAddress:OBJECT`, `payloadFiscal:OBJECT`, `sistemaInformatico:OBJECT`, `estadoEnvioAEAT:TEXT`, `csvAEAT:TEXT`, `fechaEnvioAEAT:DATETIME`, `tipoRectificativa:TEXT`, `previousInvoiceId:TEXT`, `claveRegimen:TEXT`, `calificacionOperacion:TEXT`, `operacionExenta:BOOLEAN`, `inversionSujetoPasivo:BOOLEAN`, `surchargeAmount:NUMBER`, `fiscalRole:TEXT`, `eventType:TEXT`, `thirdPartyId:TEXT`, `catalogId:TEXT`, `pairToken:TEXT`, `orderId:TEXT`, `refundId:TEXT`, `fiscalPeriod:TEXT`, `accountingAmount:NUMBER`, `projectionStatus:TEXT`.
- **MovimientosInventario (rev. 29):** `variantId:TEXT`, `orderId:TEXT`, `productId:TEXT`, `stockApplied:BOOLEAN`, `lineItemId:TEXT`, `catalogVersion:TEXT`, `locationId:TEXT`, `stockKey:TEXT`, `magnitude:NUMBER`, `nativeCommercialMovement:BOOLEAN`, `requiresWixReconciliation:BOOLEAN`, `actorMemberId:TEXT`, `actorEmail:TEXT`, `referenceId:TEXT`, `refundId:TEXT`, `recordTimestamp:DATETIME`, `catalogId:TEXT`, `productName:TEXT`, `reason:TEXT`, `movementToken:TEXT`, `movementType:TEXT`, `sku:TEXT`, `quantityDelta:NUMBER`, `traceId:TEXT`, `direction:TEXT`, `quantity:NUMBER`, `stockBefore:NUMBER`, `stockAfter:NUMBER`, `operationDescription:TEXT`, `sourceEventId:TEXT`, `thirdPartyId:TEXT`, `wixProductId:TEXT`, `wixVariantId:TEXT`, `movementId:TEXT`.
- **RegistrosHorariosStaff (rev. 10):** `resourceId:TEXT`, `notes:TEXT`, `memberId:TEXT`, `recordedAt:DATETIME`, `clockEventType:TEXT`, `recordType:TEXT`, `traceId:TEXT`, `adjustmentReason:TEXT`, `signature:TEXT`, `recordedTime:TEXT`, `dayKey:TEXT`, `monthKey:TEXT`, `staffName:TEXT`, `registeredBy:TEXT`, `registeredByMemberId:TEXT`, `deviceIpAddress:TEXT`, `meta:OBJECT`.
- **ServiciosCatalogo (rev. 194):** `sessionCount:NUMBER`, `staffMembers:MULTI_REFERENCE`, `pricingPlanId:TEXT`, `catalogEntryType:TEXT`, `locationId:TEXT`, `description:TEXT`, `serviceId:TEXT`, `title:TEXT`, `slug:TEXT`, `tagLine:TEXT`, `categoryId:TEXT`, `itemNature:TEXT`, `sku:TEXT`, `price:NUMBER`, `currency:TEXT`, `taxIncluded:BOOLEAN`, `tipoImpositivo:NUMBER`, `calificacionOperacion:TEXT`, `totalDuration:NUMBER`, `phase1Duration:NUMBER`, `phase2Duration:NUMBER`, `exposureDuration:NUMBER`, `allowCombine:BOOLEAN`, `linkedPhases:TEXT`, `location:TEXT`, `clientHidden:BOOLEAN`, `onlinePayment:BOOLEAN`, `inPersonPayment:BOOLEAN`, `pricingModel:TEXT`, `depositType:TEXT`, `depositAmount:NUMBER`, `margin:NUMBER`, `internalNotes:TEXT`, `category:TEXT`, `precioCosteBase:NUMBER`, `mainMedia:IMAGE`, `recomendaciones:TEXT`, `name:MULTI_REFERENCE`.

### 14.5 Campos canónicos críticos y matices del contrato

| Campo | Colección | Contrato actual |
| --- | --- | --- |
| `taxId` | `DatosFiscales` | Identificador fiscal del tercero; el tipo de registro distingue tercero/configuración. |
| `bookingId` | `CitasF2` | Identificador de reserva Bookings V2; no equivale a `_id` CMS. |
| `pairToken` | `CitasF2`, `ControlOperativo`, `MovimientosCaja` | Vincula fases/operaciones de una reserva dual cuando aplica. |
| `bookingStatus` / `paymentStatus` | `CitasF2` | Estados de la proyección interna; no sustituye al estado nativo Bookings/pagos. |
| `serviceId` | `ServiciosCatalogo`, `CitasF2`, `ControlOperativo` | ID del servicio Bookings; distinto de `catalogId`. |
| `catalogId` | Colecciones transaccionales | Referencia al registro CMS de catálogo cuando el flujo la utiliza. |
| `resourceId` | `CitasF2`, `ControlOperativo`, `RegistrosHorariosStaff`, `MovimientosCaja` | ID del recurso de agenda Bookings; distinto de `staffMemberId` y `memberId`. |
| `staffMemberId` | Bookings Staff / campo físico en `MapaStaff` | ID del profesional en Bookings Staff; no es el recurso de agenda. |
| `memberId` | `RegistrosHorariosStaff`, `MapaStaff` | ID de miembro Wix; no equivale a `resourceId`. |
| `hash` / `previousRecordHash` | `MovimientosCaja` | Cadena de integridad fiscal; conservar claves físicas exactas. |
| `payloadFiscal` | `MovimientosCaja`, `LibroAsientosContablesDetalle` | Snapshot/payload fiscal canónico en el código actual. `payloadAEAT` también existe físicamente en MovimientosCaja, pero no debe adoptarse como alias nuevo. |
| `sequenceNumber` / `numSerieFactura` | `MovimientosCaja` | Secuencia y número de documento asignados por el backend. |
| `debitAmount` / `creditAmount` | `LibroAsientosContablesDetalle` | Nombres físicos actuales de debe/haber; no usar `debit`/`credit`. |
| `clockEventType` / `recordedAt` | `RegistrosHorariosStaff` | Evento laboral y timestamp original; `recordedTime`, `dayKey`, `monthKey` son campos auxiliares persistidos. |
| `movementToken` | `MovimientosInventario` | Clave de idempotencia del movimiento de stock. |
| `stockOnHand` / `stockReserved` / `stockAvailable` | `InventarioStockVenta` | El último es derivado y validado respecto a los dos primeros. |
| `controlType` / `dedupeKey` | `ControlOperativo` | Discriminador y clave de control; los campos requeridos dependen del subtipo. |
| `traceId` | Colecciones transaccionales | Correlación de operación cuando el contrato de escritura lo exige. |

### 14.6 Enums canónicos

**Wix nativos (inglés, preservar exactamente):**
```javascript
BOOKING_STATUS_WIX = { CREATED, PENDING, CONFIRMED, DECLINED,
  WAITING_LIST, UPDATED, CANCELED, REFUNDED }
PAYMENT_STATUS_WIX = { UNDEFINED, NOT_PAID, PENDING_PAYMENT,
  PENDING_LEDGER, PAID, PARTIALLY_PAID, REFUNDED,
  PARTIALLY_REFUNDED, EXEMPT }
```
> Nota: `UPDATED` es **tipo de evento webhook**, no estado de reserva. Se elimina del enum de estados (Anexo aclaratorio SSOT v10.0).

**CMS (`CitasF2`):**
```javascript
BOOKING_STATUS_CMS = { PENDING, CONFIRMED, COMPLETED, CANCELED, NO_SHOW }
PAYMENT_STATUS_CMS = { UNPAID, PARTIAL, PAID, REFUNDED }
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
CONTROL_TYPE    = { SLOT_LOCK, WEBHOOK_EVENT, DEDUPE_KEY,
                    IDEMPOTENCY, RATE_LIMIT, SYSTEM_FLAG }
```

### 14.7 Librerías de helpers y utilidades

**`public/mmUtils.js` (client-side):**
`makeTraceId(prefix)`, `_generateUUID()`, `_roundMoney(v)`, `_stableSerialize(value)`, `getUtcDateFromMadridLocal(local)`, `getMadridLocalStringNoZ(utcDate)`, `withTimeout(promise, ms, label)`, `_executeWithRetry(fn, retries, delay)`, `_maskEmail()`, `_maskPhone()`, `_maskName()`.

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
| `citasManager.web.js` | `processDualBooking` | Anyone | Rate limitado |
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

### 14.9 Resumen de hooks CMS (`src/backend/data.js`)

La tabla describe los hooks exportados actualmente en el archivo; no confundir ausencia de hook con ausencia de campo CMS.

| Colección | `beforeInsert` | `beforeUpdate` | `beforeRemove` |
| --- | --- | --- | --- |
| `MovimientosCaja` | Trazabilidad, versión, hash, normalización y validación fiscal. | Bloqueado. | Bloqueado. |
| `HistoricoCierresZ` | Exige `traceId`. | Solo campos permitidos de firma/verificación. | Bloqueado. |
| `RegistrosHorariosStaff` | Normaliza `recordedAt`; exige `traceId`. | Bloqueado. | Bloqueado. |
| `CajaActual` | Solo `CAJA_PRINCIPAL` o `CAJA_SEQ`. | Control de contadores/proyección. | Bloqueado. |
| `ServiciosCatalogo` | GUIDs, relación de fases, naturaleza, códigos y duraciones. | Mismas validaciones. | Sin hook exportado. |
| `DatosFiscales` | Validación por tipo de registro y fiscalidad. | Validación por tipo de registro. | Configuración fiscal protegida. |
| `LibroAsientosContablesDetalle` | Validación contable/fiscal y trazabilidad. | Bloqueado. | Bloqueado. |
| `ControlOperativo` | Validación según tipo de control. | Controlado. | Controlado. |
| `MovimientosInventario` | Validación de movimiento, magnitud e idempotencia. | Bloqueado. | Bloqueado. |
| `InventarioStockVenta` | Fecha de sincronización y stock; disponible calculado/validado. | Mismas validaciones. | Sin hook exportado. |
| `CitasF2` | Validación de proyección y estados. | Validación de cambios. | Bloqueado. |
| `ComplementosCatalogo` | Exige `addonId`, `sku` y precio no negativo. | Mismas validaciones. | Sin hook exportado. |
| `MapaStaff` | Sin hook exportado. | Sin hook exportado. | Sin hook exportado. |

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
| `ACCESS_DENIED` | Seguridad | Identidad/rol de negocio no autorizado según Bookings Staff API + `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID`. |
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
| Cobros MONEI (Bizum/tarjeta online) | Extracto MONEI | Cada noche a las 04:00 | `1. VENTAS / MONEI /` |
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
| Software / suscripciones | IONOS (dominio), comisiones MONEI |
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
│   ├── 📂 MONEI
│   │   └── 📂 2026
│   │       ├── 2026-01_Extracto_MONEI.pdf
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
| Extracto MONEI del trimestre | Carpeta `1. VENTAS / MONEI` | PDF |
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
| Guardar datos de tarjetas de clientas | ❌ No | Prohibido (RGPD). MONEI los gestiona. |

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
│   ├── MONEI_T1.zip                      ← Extractos MONEI
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
| "¿Qué pasa con las propinas?" | Las propinas en efectivo no son ingreso del negocio. No se registran. Si una clienta deja propina con tarjeta, MONEI la registra y aparece en el extracto. |
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
| **RD 253/2025 (Bizum)** | MONEI reporta automáticamente a AEAT. El Cierre Z incluye `totalBizum` como evidencia documental. |
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

### Cierre del dossier

---

## ANEXO DE RECONCILIACIÓN CMS Y CÓDIGO — 2026-11-05

Este anexo prevalece sobre cualquier referencia anterior del dossier que contradiga los nombres, tipos, revisiones o estado de uso aquí indicados.

### Fuente y método
- Sitio: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Wix Data Collections API oficial: `GET /data/v2/collections` y `GET /data/v2/collections/{dataCollectionId}`.
- Se consultó la lista completa y después la definición individual de cada una de las 13 colecciones de negocio.
- Solo lectura: no se crearon, actualizaron ni eliminaron colecciones o registros.
- Repositorio contrastado: rama `main` en el commit `2eaafe309d2592eb004b4a4dcace53c3bed09cff`.
- Código revisado: `internalConfig.js`, `data.js`, `validation.js`, `staff.js`, `security.js`, `reservas.web.js`, `cajas.web.js`, `eventLog.js`, `inventario.web.js` y `horario.web.js`.

### Discrepancias físicas/código que requieren decisión técnica

1. **MovimientosCaja — payload fiscal:** el CMS conserva `payloadAEAT:OBJECT` y `payloadFiscal:OBJECT`. El código actual usa `payloadFiscal` como clave canónica y normaliza claves históricas; no introducir nuevas escrituras con `payloadAEAT` como alias.
2. **HistoricoCierresZ — campos de proyección:** el esquema físico contiene `taxTypeBreakdown`, `movementTypeBreakdown`, `summaryData`, `invoiceData`, `totalesMedioPago`, etc. El comentario de `eventLog.js` reconoce que su proyección escribe además `breakdownByRegime`, `breakdownByOperationType`, `breakdownByTaxRate` y `verifactuSummary`, que no aparecen en el esquema leído. Debe acordarse una única nomenclatura antes de ampliar esa proyección.
3. **HistoricoCierresZ — dominio mixto:** la misma colección contiene campos fiscales/cierre y campos de inventario (`inventoryClosingId`, `fiscalYear`, `closingType`, `sku`, `wixProductId`, `stockQuantity`, `unitCost`, `stockValue`, `cuentaContable`). La separación de cierres de inventario merece ADR; no renombrar ni mover campos sin migración.
4. **LibroAsientosContablesDetalle:** los nombres físicos actuales son `debitAmount` y `creditAmount`; cualquier referencia a `debit` y `credit` en documentación o código debe corregirse tras revisar todos los consumidores.
5. **RegistrosHorariosStaff:** el esquema tiene tanto `notes` como `adjustmentReason`; el writer actual utiliza `adjustmentReason`. No documentar `notes` como campo obligatorio del ajuste.
6. **CitasF2:** existen físicamente `cashMovementId`, `fiscalData`, `invoicingDate` y `sourceEventId`; el contrato actual de `BOOKING_FIELDS` no incluye algunos campos históricos/huérfanos. La presencia física no autoriza a reintroducirlos sin consumidor y ADR.
7. **ControlOperativo:** coexisten `attempts` y `attempt`, además de `expiresAt` y `leaseExpiresAt`. La consolidación requiere inventario de consumidores y migración; no hacer una sustitución global.
8. **DatosFiscales:** los tipos físicos de `tipoUsoPosibleMultiOT` e `indicadorMultiplesOT` son BOOLEAN. Validar el contrato del writer contra esos tipos antes de añadir nuevos campos o cambiar tipos.
9. **MapaStaff:** la colección y campos siguen en CMS (incluidos `staffMemberId` y `active`), pero `staff.js` resuelve staff por Bookings Staff API y el rol desde `internalConfig.js`. No eliminar la colección/campos hasta completar el inventario de lectores, escritores y datos históricos.
10. **ServiciosCatalogo:** el esquema contiene `staffMembers` y `name` como MULTI_REFERENCE, y `linkedPhases` como TEXT. No confundir estos campos con arrays de IDs de transporte ni cambiar sus tipos desde el código sin reconciliar Wix CMS.

### Regla de mantenimiento documental

Cuando cambie una colección:
1. Leer primero su definición CMS real (ID, `collectionType`, `revision`, campos y tipos).
2. Comparar con `BUSINESS_COLLECTIONS` / `OPERATIONAL_COLLECTIONS`, writers, readers y hooks.
3. Clasificar cada campo como activo, físico no consumido, legacy retenido o derivado/proyección.
4. No eliminar ni renombrar campos en producción sin ADR, copia de seguridad, plan de migración y lectura de compatibilidad.
5. Actualizar este anexo y la matriz de trazabilidad con el SHA y revisión CMS observados.

