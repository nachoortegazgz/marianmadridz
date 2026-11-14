> **Addendum de seguridad vigente — 2026-11-14:** el histórico TEC-037 que describía una pausa global de append-only queda supersedido para la ejecución actual. La ventana global de mutabilidad está cerrada en la rama QA; los ledgers permanecen inmutables. La inspección Wix de esta sesión devuelve producción como Published y no resuelve el Site ID QA; no ejecutar escrituras Wix ni E2E sobre producción. Prevalecen PLAN_ACCION_QA.md, DIRECTRICES_DESARROLLO_CODIGO.md y TEC-038 de docs/DECISION-LOG.md.

## Addendum vigente — baseline 2026-11-14 (prevalece sobre bloques históricos)

- Git `main` al inicio de esta reconciliación: `79b6238fe4c23206bb8e81327191ab48425e3a0d`, merge de PR #351.
- Git `main` actual tras PR #355 (documentación): `331c572b9fbba4eaff9bf53a894e6c2377a13c22`; último baseline de código/configuración: `fde9466552b6819980475a682dc06395b57487f0`.
- PR #352 (validadores) integrada; CI PASS en `609ccc948da3e63d3fd8aa20f5e64c7649770660` (run #1054).
- PR #353 (retirada de inventario personalizado) integrada; CI PASS en `cdf07b5088977c4f51c231aa517b8ed607b25269` (run #1059).
- PR #354 (política CMS residual) integrada como `fde9466552b6819980475a682dc06395b57487f0`; CI PASS en `28a11a690f0a99926921332618b6af670d45814c` (run #1068) y Gitleaks PASS (run #492).
- Ninguna de estas intervenciones ha publicado ni desplegado código en Wix.
- Wix GetSiteContext: producción `Editor` + Velo + Stores Catalog V3 + Invoices V1; QA `Editor` + Velo + Stores Catalog V3 + Invoices V2. GetSiteContext no expone código Velo; sincronización Editor↔Git pendiente.
- PR #351 dejó una regresión en `src/backend/validation.js`: eliminó exports aún consumidos por `data.js`. La recuperación está en PR #352; CI completo PASS sobre el SHA `609ccc948da3e63d3fd8aa20f5e64c7649770660` (run #1054); commits posteriores en esta PR son solo documentación.
- CMS live: **41 colecciones (12 NATIVE, 29 WIX_APP), 980 campos**. `MapaStaff` revisión 105 / 56 campos. `DatosFiscales`, `InventarioStockVenta` y `MovimientosInventario` no existen en el inventario live del corte; GET individual 404 / `WDE0025`.
- Wix Stores Catalog V3 es la autoridad del stock comercial. La capa custom de inventario está retirada; las referencias a sus colecciones, exports o writers son históricas y no autorizan su recreación.
- `QA_RECORD_MUTATIONS_ENABLED=true` sigue activa durante QA por instrucción del propietario. Es un bloqueo para producción; no se ha restaurado ni publicado.
- No existe evidencia de release que vincule el runtime Wix publicado con el SHA actual de Git. No se declara validación E2E ni despliegue.
- SharePoint / Power Automate Capa 3 sigue siendo diseño documental, no integración operativa certificada.

Detalle y evidencias: [reconciliación de baseline y recuperación de validadores](docs/qa/2026-11-14-baseline-reconciliation.md).

---

## Vigencia operativa — fase de desarrollo y QA (2026-11-14)

**Autoridad:** el usuario/propietario es la SSOT de negocio, requisitos, prioridades, criterios de aceptación y autorizaciones. Las instrucciones expresas posteriores del usuario prevalecen sobre decisiones y restricciones documentales anteriores. La documentación oficial de Wix y de las integraciones gobierna únicamente los contratos y límites técnicos de la plataforma.

**Mutabilidad CMS durante QA:** append-only e inmutabilidad están temporalmente en pausa. Se habilitan update y remove individuales y masivos para todas las colecciones CMS propias del proyecto, incluidas las históricamente tratadas como ledgers. Las operaciones masivas deben identificar explícitamente los registros por ID. No se habilitan escrituras en colecciones propiedad de Wix Apps ni se eluden autenticación, autorización/RBAC, permisos, validaciones de esquema, integridad técnica, secretos o límites de plataforma. La inserción mantiene su allowlist; los writers fiscales/contables/laborales, pagos, reembolsos, comunicaciones y efectos externos conservan sus gates funcionales independientes.

**Restauración:** esta política no se revierte automáticamente. Solo el usuario puede ordenar la restauración de append-only y de las restricciones de mutación para preparar el despliegue. No publicar a producción basándose únicamente en esta excepción de QA.

**Estado Git/Wix:** PR #344–#351 están integradas en main; HEAD al inicio de la reconciliación `79b6238fe4c23206bb8e81327191ab48425e3a0d`. PR #351 introdujo una regresión al retirar validadores aún consumidos; su recuperación está en PR #352 y CI queda pendiente. La publicación del sitio está declarada/verificada como estado del sitio, pero no existe release ID que vincule runtime y SHA. No se ha publicado esta tanda.

**CMS maestro:** MapaStaff revisión live 105, 56 campos físicos. Inventario live: 41 colecciones (12 NATIVE, 29 WIX_APP), 980 campos. `DatosFiscales`, `InventarioStockVenta` y `MovimientosInventario` no existen en este corte (404 / WDE0025); sus menciones en este documento son históricas salvo nueva evidencia.

---

> **HISTÓRICO — superado por el addendum vigente:** el siguiente bloque describe un corte anterior de CMS y TEC-033. El esquema live actual se encuentra en `DICCIONARIO_DATOS_CMS.md` §§2–3; la política de QA vigente es TEC-037 (`QA_RECORD_MUTATIONS_ENABLED=true`).

## Registro histórico — estado live y limpieza QA (superado por el addendum vigente)

**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`. **Rama de código:** `chore/temporary-append-only-mutation-window`. Este estado supersede los inventarios y addenda anteriores que contradigan estos datos.

### CMS verificado tras los cambios

- Inventario live: **42 colecciones** (13 `NATIVE`, 29 `WIX_APP`). `CajaActual` es `NATIVE`, revisión **64**, con **59 campos personalizados + 4 de sistema (63 físicos)**.
- El esquema completo y los tipos de los 59 campos están en `DICCIONARIO_DATOS_CMS.md` §3.1.
- Política temporal de lectura: `itemRead=ANYONE` en las 13 colecciones NATIVE, con los permisos de escritura conservados. Las 29 colecciones WIX_APP mantienen la política fijada por Wix Apps; 23 permiten ANYONE y 6 mantienen restricciones de aplicación.
- Riesgo P1 explícitamente aceptado por el responsable durante desarrollo: la lectura pública puede exponer datos personales, fiscales, contables, laborales y de pagos. No introducir datos reales sensibles. Revertir restricciones antes de despliegue. `operationDate`, `openingAmount`, `voucherAmount` e `isOpen` no existen en el esquema actual.
- Estado del singleton: el último readback anterior a esta edición documentaba `CAJA_PRINCIPAL` cerrado y sin sesión abierta. El elemento no se ha releído en esta actualización; el estado y los saldos actuales quedan pendientes de readback.
- Índice único `CajaActual_singletonKey_unique`: ACTIVE. Índice anterior `cashRegisterStatus_operationDate`: ya no aparece en el inventario final. Índice corregido `cashRegisterStatus_operationDateHour`: ACTIVE en el readback final.
- `MovimientosCaja`: revisión 78, 0 elementos; no modificada. `LibroAsientosContablesDetalle`: 0. `RegistrosHorariosStaff`: revisión 11, 0 tras limpieza. `HistoricoCierresZ`: 0. `PaquetesGestoria`: 0. `ControlOperativo`: 3 elementos. `MovimientosInventario` no figura en el inventario live de 42 colecciones; la fila histórica que lo describía como colección presente queda pendiente de reconciliación documental.

### Registros sintéticos eliminados

Se eliminaron únicamente dos filas de `RegistrosHorariosStaff`, tras releerlas y comprobar simultáneamente `meta.synthetic=true`, `meta.doNotImportToProduction=true`, `resourceId=QA_STAFF_ONLY`, `staffName=QA EMPLEADO FICTICIO` y notas que declaran que no acreditan jornada real:

- `1a4341a6-47be-490c-91a6-d04c8728e186` — `QA_LIVECMS_20261023_2000_TIME01_EXIT`.
- `f325c0c8-35ba-4efc-ac45-a409ab439e61` — `QA_LIVECMS_20261023_2000_TIME01_ENTRY`.

La eliminación se hizo por ID individual con condición de `traceId`; readback posterior: 0 filas restantes. Un barrido read-only de las 13 colecciones NATIVE no detectó otros candidatos con `meta.synthetic`, `doNotImportToProduction`, `runId/traceId` QA o `recordSource=SMOKE_TEST`. No se borró ningún fichaje real, movimiento de caja, asiento contable, cierre Z, paquete de gestoría ni registro de `ControlOperativo`. No se cambiaron permisos CMS ni se activaron writers.

### Ventana temporal TEC-033

**HISTÓRICO — TEC-033, sustituida por TEC-037.** El siguiente detalle describe la excepción inicial, limitada a update/remove individuales de determinados ledgers, y ya no representa la política vigente. La política actual está definida por `QA_RECORD_MUTATIONS_ENABLED=true`: update/remove individual y masivo en colecciones CMS propias, incluidos registros históricamente append-only. Las operaciones masivas requieren IDs explícitos. No se reactivan gates de inserción, writers fiscales/contables/laborales ni efectos externos.

La instrucción antigua de desactivar la ventana antes de fusionar o publicar queda sustituida: la política temporal está integrada en main para la fase de QA. Solo el usuario ordenará su restauración antes del despliegue. La publicación Wix de esta ampliación sigue pendiente.

### Alineación backend y estado pendiente

En esta rama, `cajas.web.js` y sus fixtures usan `operationDateHour`, `bizumAmount` y los cuatro campos `opening*Amount`; se ha retirado la comprobación redundante de `isOpen`. El DTO expone los cuatro saldos iniciales. **No existe todavía un WebMethod de apertura de sesión que persista esos cuatro importes**; por tanto permanecen null y la funcionalidad de apertura/saldos iniciales no está validada end-to-end. La proyección actual no se considera completa para `otherAmount` hasta probar su clasificación y conciliación desde `MovimientosCaja`.

No se ha ejecutado CI completo, Wix Local Editor ni E2E en runtime. No se ha publicado ni desplegado esta rama. La mutación CMS de este corte no equivale a publicar código Wix.

---
# DOSSIER TÉCNICO CONSOLIDADO — Marian Madrid

**Revisión documental:** 2026-11-10  
**Repositorio canónico:** `nachoortegazgz/marianmadridz`  
**Baseline de código revisado:** `main` · `c046a975d0ca3d45e83aa2dbab07e278e02edaae`  
**Sitio:** https://www.marianmadrid.es/

## Cómo interpretar este dossier

> **Decisiones vinculantes aprobadas el 2026-11-10 — prevalecen sobre cualquier descripción histórica de este dossier:** (1) señal/anticipo de 15 EUR solo para servicios con precio estrictamente superior a 100 EUR; se descuenta del precio del servicio y no es un recargo; fiscalmente debe tratarse como pago anticipado hasta que asesoría determine otra calificación; (2) cancelación/reprogramación gratuita con al menos 24 h y devolución íntegra si cancela el negocio; no se activa retención automática por cancelación tardía/no-show hasta revisión jurídica de proporcionalidad; (3) utilizar depósitos nativos de Wix Bookings por servicio siempre que cubran el caso; no crear un motor de depósitos propio sin demostrar una limitación nativa; (4) Wix Stores Catalog V3 y las herramientas nativas Wix son la única autoridad de stock; no generar proyecciones, reservas, deducciones, reposiciones ni movimientos de inventario personalizados; los históricos personalizados existentes se preservan, sin nuevas escrituras, hasta decidir su archivo; (5) ledger fiscal/contable registra hechos económicos, no cantidades de stock; (6) no activar depósitos en producción hasta resolver P0 fiscal (factura/IVA/ledger de anticipos y rectificaciones); no activar automatizaciones que contacten clientes ni realizar cobros, reservas, escrituras de stock/CMS o publicación durante QA.


Este documento describe la arquitectura, contratos de dominio, colecciones, módulos y reglas técnicas del sistema. No sustituye los resultados de CI, las auditorías live ni la validación de Wix runtime.

- El código y sus consumidores definen lo implementado.
- Las pruebas offline acreditan solo los contratos cubiertos por mocks/fixtures.
- Las consultas REST live acreditan las respuestas nativas consultadas, no los WebMethods Velo.
- El estado de publicación del HEAD de `main` no está verificado.
- No convertir requisitos, propuestas ni diseños objetivo en capacidades operativas.

## Estado técnico vigente — resumen

| Dominio | Estado a 2026-11-09 |
|---|---|
| Wix Bookings | Bookings V2 en código; smoke REST nativa PASS; E2E de WebMethods y saga pendiente |
| Wix eCommerce | Cart V2 en código y contratos SDK en CI; E2E de checkout/pago pendiente |
| Wix Stores | Catalog V3 activo en el sitio (`V3_CATALOG`); adapter en código; import SDK/scopes en Velo pendientes |
| Fiscal | **NO APTO para activar remisión VERI*FACTU**; ver auditoría específica |
| Registro horario | Código parcial; runtime y validación legal/operativa pendientes |
| Capa 3 M365 | Diseño documental; exportaciones y flujos no implantados/verificados |
| Toolchain | ESLint 8 EOL y manifiesto Velo ausente; bloqueo documentado en Directrices |

El smoke live de 2026-11-09 confirmó 24 productos Stores V3, 30 inventory items en una ubicación, 70 servicios Bookings y disponibilidad de un slot de cita. Fue una prueba de solo lectura. El detalle, límites y operaciones no ejecutadas constan en [docs/qa/2026-11-09-runtime-smoke-production.md](docs/qa/2026-11-09-runtime-smoke-production.md).

---

## 1. Identidad y contexto del proyecto

Marian Madrid Peluquería y Estética es un salón físico en Zaragoza. El ecosistema digital se construye sobre Wix Editor/Velo y Wix Apps nativas; el backend y CMS propios cubren únicamente necesidades no resueltas por las capacidades nativas. La existencia de módulos de caja, control horario o inventario no equivale a certificación legal ni a E2E publicado.

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
| Editor y hosting | Wix Editor Classic (cloud, SSL/HTTPS automático) |
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
| Stores catálogo | Catalog V3 | V3_CATALOG confirmado por API live; adaptador V3 presente en código. Import SDK y scopes efectivos en Velo pendientes |
| eCommerce | `@wix/ecom` Cart V2 | Contratos SDK verificados en CI; checkout/pago E2E Wix pendiente |
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
- **Ledgers inmutables**: `MovimientosCaja`, `LibroAsientosContablesDetalle` y `RegistrosHorariosStaff` son ledgers operativos append-only. `MovimientosInventario` queda como histórico legacy append-only: se conserva sin mutaciones, pero no recibe nuevas escrituras y no gobierna stock. NOTA: Permitir edicion de ledgers mientras dure el proceso de desarrollo del sitio web.
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
| `backend/securityEngine.js` | Criptografía: SHA-256 y HMAC |
| `backend/staff.js` | Resolución y filtrado de personal |
| `backend/booking/bookingCore.js` | Primitivas: locks, persistencia y elevación |
| `backend/booking/bookingSaga.js` | Orquestador transaccional (Simple + Dual F1+F2) |
| `backend/reservas.web.js` | Consulta pública de disponibilidad y catálogo |
| `backend/citasManager.web.js` | Gestión de reservas duales, pagos y reprogramación |
| `backend/cajas.web.js` | Ledger fiscal Veri\*Factu, caja y cierre Z |
| `backend/inventario.web.js` | **RETIRADO Y FUSIONADO EN PR #238**; sin writer ni WebMethods custom de inventario |
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

Los servicios pueden ser del tipo `APPOINTMENT`, `CLASS` y `COURSE`. La arquitectura distingue dos flujos de reserva según si el servicio tiene o no fases con gap de exposición.

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

### Validación nativa del Writer

Las llamadas de la saga dual no envían opciones de bypass. Wix conserva la comprobación de disponibilidad y la validación de la opción de pago para F1 y F2.

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

El CMS propio tiene **13 colecciones NATIVE** activas. Las 20 colecciones `WIX_APP` son de estricta lectura. Las 8 colecciones retiradas están bloqueadas; cualquier acceso a ellas lanza `FISCAL_VIOLATION`.

### Colecciones NATIVE (autoridad del negocio)

| Colección | Tipo | Rol |
| --- | --- | --- |
| `DatosFiscales` | MASTER mutable | Maestro de terceros + singleton `CONFIG_SISTEMA` Veri\*Factu |
| `CajaActual` | SINGLETON mutable | Proyección de la sesión operativa, resumen de última operación, acumulados por medio de pago y saldo en tiempo real del efectivo físico |
| `MovimientosCaja` | LEDGER append-only | Registro fiscal inalterable (Veri\*Factu) |
| `CitasF2` | LEDGER con updates controlados | Proyección interna de reservas |
| `LibroAsientosContablesDetalle` | LEDGER append-only | Contabilidad de doble partida (PGC) |
| `HistoricoCierresZ` | LEDGER append-only | Cierre Z diario de caja |
| `ServiciosCatalogo` | CATALOG mutable | Maestro de servicios, duraciones, precios e impuestos |
| `ComplementosCatalogo` | CATALOG mutable | Maestro de add-ons y suplementos |
| `MapaStaff` | MASTER mutable | Identidad del personal y correlación de IDs |
| `RegistrosHorariosStaff` | LEDGER append-only | Fichajes laborales (RD 8/2019) |
| `ControlOperativo` | CONTROL mixto | Locks, deduplicación webhooks, rate limiting |
| `InventarioStockVenta` | LEGACY / no SSOT | Proyección custom retirada; no crear ni actualizar maestros |
| `MovimientosInventario` | LEGACY / append-only histórico | No insertar nuevos movimientos; preservar filas existentes |

### Protecciones append-only (backend/data.js)

Los hooks `beforeUpdate` y `beforeRemove` en `MovimientosCaja`, `LibroAsientosContablesDetalle`, `RegistrosHorariosStaff` y `MovimientosInventario` interceptan cualquier intento de modificación y retornan `FISCAL_VIOLATION`. La corrección se realiza siempre insertando un nuevo registro rectificativo que enlaza al original.

### Invariantes de integridad obligatorias

- **MovimientosCaja**: `taxBase + taxAmount ≈ amount` (redondeo a 2 decimales con `_roundMoney()`). Cadena SHA-256: `hash = SHA256(previousRecordHash + numSerieFactura + amount + timestamp)`.
- **ServiciosCatalogo**: `totalDuration === phase1Duration + exposureDuration + phase2Duration`.
- **InventarioStockVenta (legacy)**: la antigua invariante `stockAvailable === stockOnHand - stockReserved` ya no se mantiene ni se usa para decisiones comerciales; Wix Stores Catalog V3 es la autoridad.
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
| `LEDGER_IDEMPOTENCY` | Claim durable de idempotencia de movimientos de caja; excluido de la purga de IDEMPOTENCY a 24 h. |
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

`RESCHEDULE_JOURNAL_STATE` es una máquina de estados propia de `dualRescheduleJournal.js`; no se mezcla con `CONTROL_STATUS`. El journal se persiste como payload de `ControlOperativo` y conserva sus transiciones específicas.

### Addons — nomenclatura crítica

- `addonId`: campo singular en `ComplementosCatalogo` (PK de cada complemento). `addOnIds` es el array de transporte a Bookings.

## 8. Seguridad, identidad y permisos

### Permisos de Web Modules

El backend contiene módulos `.web.js` y no contiene módulos `.jsw`. Cada exportación invocable declara su permiso con `webMethod(Permissions...)`; la autorización de negocio se comprueba de nuevo en backend. El manifiesto `permissions.json` no forma parte del modelo de autorización del sitio y se ha retirado. Wix documenta `.jsw` como formato anterior y recomienda Web Modules `.web.js` con permisos por método. Referencias oficiales: [Web Modules](https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/backend-code/web-modules/about-web-modules) y [Permisos](https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/backend-code/web-modules/about-web-modules#permissions).

### Modelo de autorización RBAC

La seguridad opera en dos capas superpuestas:

1. **Barrera de plataforma (Velo Permissions)**: el decorador del webMethod (`Permissions.Anyone`, `Permissions.SiteMember`, `Permissions.Admin`) aplica el primer filtro de red.
2. **Control de roles de negocio (RBAC SSOT)**: `backend/security.js` resuelve la identidad mediante Wix Members + Bookings Staff Members API y asigna el rol desde `STAFF.WEBSITE_ROLE_BY_RESOURCE_ID` (internalConfig.js).

`MapaStaff` no es la autoridad RBAC vigente. Se utiliza como mapeo de identidad `staffMemberId` → `resourceId`/`scheduleId` para proyecciones de eventos nativos cuando el payload Wix no aporta esos identificadores; la resolución exige una única fila activa y GUID válidos.

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

1. Los handlers de `backend/events.js` son eventos backend Velo gestionados por Wix. La plataforma verifica y decodifica la entrega y proporciona al handler el objeto de evento. El módulo no recibe JWT sin procesar ni expone un endpoint HTTP; la verificación manual de JWT corresponde a endpoints autoalojados.
2. Extraer `eventId` del payload.
3. Verificar idempotencia en `ControlOperativo` (`controlType = "WEBHOOK_EVENT"`) antes de cualquier mutación.
4. Si `eventId` ya existe, abortar sin error (procesamiento idempotente).

## 9. Integraciones Wix y externas

### Apps Wix nativas instaladas

| App | Rol | Restricción |
| --- | --- | --- |
| Wix Bookings | SSOT de servicios, slots, recursos y reservas | Solo API V2; V1 prohibida |
| Wix Stores | SSOT de catálogo público y stock comercial | Catalog V3; usar adapter V3. No mezclar contratos V1/V3 |
| Wix eCommerce | SSOT de checkout, pedidos y webhooks de pago | Cart V2; verificar checkout y webhooks en E2E Wix |
| Wix Members | Identidad autenticada de clientes y personal | `@wix/members` |
| Wix Invoices V1 | Facturación nativa Wix | Separado del ledger propio Veri\*Factu |
| Wix Gift Cards | Gestión de tarjetas regalo | Integración nativa |

Las colecciones `WIX_APP` son de **estricta lectura**. Prohibido ejecutar `wixData.insert()`, `wixData.update()` o `wixData.remove()` sobre ellas. Toda mutación debe hacerse vía SDK oficial de la App.

### Reglas críticas por app

**Bookings**: la disponibilidad mostrada al usuario no garantiza que el slot siga libre. Revalidar siempre en servidor. `resource.id` y `scheduleId` deben pasarse explícitamente al crear reservas.

**Orders Settings Wix (lectura live 2026-11-10):** `inventoryUpdateTrigger = ON_ORDER_PAID`, `createInvoice = false`. La deducción de stock está configurada para el momento del pago. No se ha cambiado esta configuración.

**Bookings Services V2 (lectura live 2026-11-10):** 94 servicios: 70 `FIXED`, 24 `NO_FEE`, 0 `VARIED`; 7 servicios visibles superan 100 EUR; 0 tienen `payment.options.deposit = true`. Los siete IDs/precios están en el ADR. No se han actualizado servicios.

**Stores Catalog V3**: versión del catálogo confirmada por Catalog Versioning API (`V3_CATALOG`). Wix Stores y sus funciones nativas son la única autoridad de stock. La arquitectura objetivo elimina el adapter y las escrituras personalizadas de inventario; `backend/inventario.web.js`, sus proyecciones y el panel asociado quedan en retirada controlada. No crear maestros CMS ni nuevos movimientos de inventario. Los registros históricos existentes se preservan sin mutación. El checkout nativo debe validar automáticamente disponibilidad y deducir stock; E2E de venta, cancelación y devolución/restock en Wix QA sigue pendiente.

**eCommerce / Cart V2**: el código y los contratos SDK de carrito están alineados con V2. La confirmación de una reserva y el estado del pago conservan autoridades separadas: no inferir confirmación de Bookings únicamente por la existencia de un pedido o carrito.

### Integraciones externas

| Integración | Patrón | Notas |
| --- | --- | --- |
| Resend | Helper de envío en `fiscalDocuments.web.js` | Dirección email de gestoría habilitada para pruebas durante periodo de desarrollo del sitio web: el buzón de pruebas controlado por el propietario (dato no versionado). Despacho a gestoría bloqueado por `ACCOUNTANT_SEND_ENABLED=false`; no existe el pipeline de exports Capa 3. Transporte de exports pendiente de ADR |
| OpenAI API | `fetch()` backend con secreto en Wix Secrets | Timeout `AbortController` ≤ 9 s; respuesta fallback si JSON malformado |
| Wix Payments | Proveedor de pagos nativo de Wix; gestiona pagos, payouts, reembolsos y contracargos desde su panel. | Métodos disponibles según país y configuración de la cuenta; confirmar en el panel del sitio. |
| IONOS | DNS/correo corporativo (infraestructura externa) | No forma parte de la lógica transaccional |
| Microsoft 365 | Destino documental propuesto: SharePoint / Power Automate | Tenant, biblioteca, permisos y flujos no auditados; Capa 3 no está implantada ni verificada |

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

`processDualBooking` declara `Permissions.SiteMember` y exige `memberId` y `contactId` obtenidos de la sesión Wix antes de ejecutar la saga. El frontend no puede atribuir una reserva a una identidad suministrada en el payload.

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
4. Si Wix procesa una devolución con reposición: Wix Stores aplica el efecto de stock nativo; no insertar un movimiento paralelo en `MovimientosInventario`. El ledger fiscal/contable registra por separado la rectificación económica.

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

Validaciones `beforeInsert` / `beforeUpdate` por colección. Wix entrega `itemId` a `beforeRemove`; cuando la regla depende del tipo o estado persistido, el hook consulta el registro por ID con lectura fuerte.

- **MovimientosCaja**: presencia de `hash`, `schemaVersion`, `traceId`; cuadre `taxBase + taxAmount ≈ amount`.
- **CitasF2**: enums válidos via `assertValidEnum()`, `traceId` presente, coherencia `pairToken` en duales. `beforeRemove` bloqueado.
- **ServiciosCatalogo**: unicidad `serviceId`/`sku`/`slug`; `totalDuration === phase1Duration + exposureDuration + phase2Duration`; `tipoImpositivo` en enum AEAT.
- **MapaStaff**: no tiene hook CMS activo. El lector de eventos filtra por `staffMemberId` + `active`, rechaza cero o múltiples coincidencias y valida `resourceId`/`scheduleId` como GUID. No es fuente de roles RBAC.
- **RegistrosHorariosStaff**: `clockEventType` válido; `notes` obligatorio cuando `recordType === "AJUSTE"`.
- **ControlOperativo**: `beforeInsert` y `beforeUpdate` ejecutan `assertControlOperativo`. `beforeUpdate` recupera el registro por `_id` con lectura fuerte, fusiona el cambio parcial, impide cambiar `controlType` y protege los tipos inmutables. `beforeRemove` recibe `itemId`, recupera el registro y bloquea `WEBHOOK_EVENT`. Los escritores de parches atómicos validan sus invariantes antes de mutar.
- **InventarioStockVenta (legacy)**: no hay writers ni hooks de mantenimiento; la colección queda sin escrituras nuevas.
- **MovimientosInventario (legacy)**: la colección se conserva y los hooks `beforeUpdate`/`beforeRemove` impiden alterar históricos; no hay nuevos writers.
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
| `cleanExpiredDualCache` | `20 * * * *` | Reservas | Purga registros `DUAL_CACHE` expirados; el flujo actual no genera snapshots de disponibilidad dual. |
| `runPendingCompensationsJob` | `30 * * * *` | Sagas | Reintenta cancelación de F1 cuando F2 falló. |
| `cleanExpiredDaysCache` | `0 1 * * *` | Disponibilidad | Invalida caché de días disponibles. |
| `verifyNightlyZClosing` | `20 1 * * *` | Fiscal | Cierre Z automático: agrega `MovimientosCaja`, valida cadena SHA-256 y consolida en `HistoricoCierresZ`. |
| `systemHealthCheck` | `0 7 * * *` | Operativo | Verifica CMS, Secrets Manager y continuidad del ledger fiscal. |
| `cleanAuditLogs` | `0 2 * * 0` | Auditoría | Aplica retención sobre logs técnicos caducados. |

**Caché y locks de disponibilidad (contrato vigente):**
- `DAYS_CACHE` almacena solo fechas/días disponibles (TTL de 5 minutos); no contiene listas de slots.
- `reservas.web.js` no conserva slots F1/F2 ni combinaciones en memoria o `ControlOperativo`. Cada solicitud de disponibilidad obtiene los slots de Wix Bookings V2 y construye el subconjunto que se devuelve al cliente.
- `DUAL_CACHE` se mantiene para purgar registros expirados que aún puedan existir; el flujo actual no genera nuevas filas.
- `SLOT_LOCK` utiliza `version` numérica y `lockToken` opaco. Renovación, recuperación y liberación aplican `bulkPatchItems` con condición de versión. La liberación marca el lease expirado; `cleanExpiredLocks` elimina únicamente registros que sigan expirados al ejecutar el borrado.
- El heartbeat de la saga propaga la versión más reciente para la liberación final. La reprogramación dual conserva versión y token de cada lock adquirido. Los locks coordinan procesos del backend; no sustituyen la validación nativa de disponibilidad de Wix Bookings.

**Reglas invariables:**
- Los jobs **nunca escriben directamente** en colecciones *append-only*; invocan servicios que pasan por `backend/data.js`.
- Las tareas de sincronización externa no confirmadas (p. ej. M365 bidireccional) permanecen **deshabilitadas** hasta ADR específico.
- Todo job genera y propaga un `traceId` UUID v4.

### 11.2 Eventos backend de Bookings V2

Eventos backend Velo gestionados por Wix y procesados por `backend/events.js`:

| Evento | Propósito |
| :--- | :--- |
| `booking_created` | Persistencia inicial en `CitasF2` con `bookingStatus = PENDING`. |
| `booking_updated` | Actualización de `slotStart`, `slotEnd`, `resourceId`. |
| `booking_confirmed` | Transición a `CONFIRMED` tras validación de pago. |
| `booking_canceled` | Transición a `CANCELED` + asiento rectificativo en `MovimientosCaja`. |
| `booking_rescheduled` | Regeneración de `pairToken` si aplica y reasignación de slot. |

**Procesamiento seguro:**
1. Wix entrega al handler Velo el objeto de evento después de verificar y decodificar la entrega firmada.
2. Se extrae `eventId` del payload.
3. Se consulta `ControlOperativo` (`controlType = "WEBHOOK_EVENT"`, `dedupeKey = eventId`). Si ya existe, se aborta sin error.
4. Se inserta el registro inmutable de deduplicación y se ejecuta la mutación de dominio.
5. Toda mutación propaga `traceId` y se enmascara PII en logs.

### 11.3 Eventos de eCommerce

| Evento | Propósito |
| :--- | :--- |
| `order_payment_status_updated` | Confirma pago y actualiza `CitasF2.paymentStatus = PAID`. |
| `order_created` | Registra intención de compra con `PENDING_PAYMENT`. |
| `order_refund_updated` | Dispara asiento rectificativo y devolución de stock si `sideEffects.restock.lineItems` está presente. |

**Regla crítica:** los webhooks de eCommerce son **independientes** de la versión de catálogo (V1/V3). No cambian entre migraciones.

### 11.4 Eventos pendientes de activación (Catalog V3)

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

### 12.6 Reglas de calidad "Estándar de calidad" (v1.0)

Según `docs/engineering/DEVELOPMENT-STANDARDS.md`:

- **Cero alias** en código productivo (ni en tests).
- **Cero rutas histórico silenciosas**: fallback de lectura permitido solo con `warn` trazable y plan de migración con fecha `review-by`.
- **Cero APIs `@retirado` vivas**.
- **Cero símbolos exportados sin consumidor verificable** en `src/`.
- **Cero contratos zombis** (parámetros ignorados, enums sin transición).
- **Regla anti-regresión:** ninguna eliminación sin `grep` de consumidores en `src/` y suite verde posterior.

---

## 13. NORMATIVA APLICABLE Y ESTADO DE EVIDENCIA

La presencia de controles técnicos no equivale a conformidad normativa. No declarar el sistema «cumple» ni activar funcionalidades fiscales/laborales por la sola existencia de código o tests offline.

### 13.1 Fiscal y Veri*Factu

| Ámbito | Evidencia en código | Estado |
|---|---|---|
| Inalterabilidad / trazabilidad | Writers y hooks append-only para ledgers; rectificaciones mediante nuevos registros | Implementación en código; eficacia runtime y CMS pendiente de validación |
| Huella fiscal | Hay hashes internos y encadenamiento en writers | **No acreditan conformidad AEAT**. La auditoría detecta divergencias entre los builders actuales y los campos/orden oficiales de la huella |
| Remisión VERI*FACTU | No se localiza cliente SOAP 1.1, serialización XML XSD AEAT, certificado ni procesamiento de respuesta síncrona | **NO APTO para activar remisión VERI*FACTU** |
| QR de verificación | Hay generación de QR/URL en el código | No acredita que el registro haya sido remitido ni aceptado por AEAT |
| Wix Invoices | App V1 instalada; la consulta de la API nueva de invoices devolvió `428 INVOICES_API_UNAVAILABLE` en la auditoría | No asumir que Wix Invoices emite ni que sustituye el SIF propio |

Referencia obligatoria: [Auditoría de preparación VERI*FACTU](docs/qa/2026-11-09-verifactu-readiness-audit.md). No recalcular ni modificar históricos. Cualquier corrección afecta únicamente a nuevos registros tras ADR, revisión fiscal y pruebas.

### 13.2 Contabilidad

| Ámbito | Evidencia | Estado |
|---|---|---|
| Libro de asientos | Existe writer append-only con validación de partida doble, hash-chain e idempotencia | Código presente; automatización de mapeos bloqueada hasta aprobación del PGC y reglas de contabilización |
| Facturas recibidas y pagos bancarios | No deben representarse como movimientos de caja física | Mapeo automático no habilitado |

### 13.3 Registro de jornada

| Ámbito | Evidencia | Estado |
|---|---|---|
| Registro y rectificación | Writer/hooks append-only para registros de jornada y ajustes trazables | Código presente; firma de históricos, retención efectiva, permisos y E2E requieren validación |
| Cumplimiento laboral | La existencia de una colección o export no demuestra por sí sola cumplimiento del art. 34.9 ET | Pendiente de revisión legal y operativa |

### 13.4 Privacidad, consumo y comunicaciones

| Ámbito | Evidencia | Estado |
|---|---|---|
| RGPD / LOPDGDD | Controles de minimización y enmascaramiento en backend/logs | No es auditoría RGPD; faltan revisar bases jurídicas, consentimientos, retención, encargados y ejercicio de derechos |
| Cookies / Consent Mode | Hay referencias de implementación en documentación y código | No certificado; requiere inspección de banner, bloqueo previo y configuración real |
| LSSI-CE / consumo | Hay páginas y textos legales en el repositorio | Contenido, vigencia y coherencia con checkout/cancelación requieren revisión legal |

### 13.5 Estado consolidado

| Área | Estado |
|---|---|
| Veri*Factu / remisión AEAT | **NO APTO — remisión no implementada y huella pendiente de corrección** |
| Ledger de caja | Writers y controles en código; runtime y conciliación con fuentes de pago pendientes |
| Contabilidad PGC | Writer disponible; reglas/mapeos automáticos no aprobados |
| Registro horario | Implementación parcial; validación runtime/legal pendiente |
| RGPD / cookies | Controles técnicos parciales; auditoría de cumplimiento pendiente |
| LSSI-CE / consumo | Revisión de textos y flujo real pendiente |

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

### 14.2 Personal y mapeo de identidad (`MapaStaff`)

| Nombre | `resourceId` (Bookings) | `rolBookings` | `rolWebsite` (referencia) |
| :--- | :--- | :--- | :--- |
| Marian Madrid | `e556070a-6d6a-402e-8422-11133033ea76` | `STAFF` | `ADMIN` |
| Andrea Staff | `07f7344f-e7e4-4c53-854b-47fd82ac8d40` | `STAFF` | `ESTILISTA` |
| Alba Staff | `9b905bfd-1a09-485d-9273-a24a20dfe648` | `STAFF` | `ESTILISTA` |

> `rolWebsite` y `rolBookings` de esta tabla son datos de referencia del mapeo. El RBAC efectivo procede de `internalConfig.STAFF.WEBSITE_ROLE_BY_RESOURCE_ID`. `thirdPartyId` permanece vacío hasta vincular fichas fiscales en `DatosFiscales`.

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

**11 colecciones operativas NATIVE de negocio + 2 colecciones legacy de inventario (solo lectura histórica):**
`DatosFiscales`, `CajaActual`, `MovimientosCaja`, `CitasF2`, `LibroAsientosContablesDetalle`, `HistoricoCierresZ`, `ServiciosCatalogo`, `ComplementosCatalogo`, `MapaStaff`, `RegistrosHorariosStaff`, `ControlOperativo`, `InventarioStockVenta`, `MovimientosInventario`.

**20 colecciones `WIX_APP` (solo lectura):**
`Blog/Categories`, `Blog/Posts`, `Blog/Tags`, `Bookings/Schedule`, `Bookings/Services`, `Bookings/Staff`, `CampaignManager/campaigns`, `CampaignManager/userConfig`, `Forms/subscribers03`, `Locations/Locations`, `Marketing/Coupons`, `Members/Badges`, `Members/FullData`, `Members/PrivateMembersData`, `Members/PublicData`, `Stores/Collections`, `Stores/InventoryItems`, `Stores/Orders`, `Stores/Products`, `Stores/Variants`.

**8 colecciones retiradas y bloqueadas** (acceso lanza `FISCAL_VIOLATION`):
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
| `bookingStatus` | `CitasF2` | Estado interno (`PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELED`, `REFUNDED`, `NO_SHOW`). |
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
| `stockOnHand` / `stockReserved` / `stockAvailable` | `InventarioStockVenta` (legacy) | Campos históricos; no autoridad ni proyección mantenida. |
| `movementToken` | `MovimientosInventario` (legacy) | Idempotencia histórica; no insertar nuevos movimientos. |
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
`assertValidEnum(value, enumObject, fieldName)`, `assertCitasF2(item)`, `assertMapaStaffFiscalIdentity(item)`, `assertControlOperativo(item)`, `assertRegistrosHorariosStaff(item)`, `isValidNifOrEuVat(taxId)`. No existe validator ni writer de nuevas filas `MovimientosInventario`.

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
| `MovimientosInventario` (legacy) | Histórico append-only; no nuevos writers ni movimientos. | **Sin nuevas escrituras**. | **Sin nuevas escrituras**. |
| `CitasF2` | Valida enums, `traceId`, coherencia `pairToken`. | Actualizaciones controladas. | **Bloqueado**. |
| `ServiciosCatalogo` | Unicidad `serviceId`/`sku`/`slug`; `totalDuration === phase1 + exposure + phase2`. | Controlado. | Solo ADMIN. |
| `DatosFiscales` | Valida NIF/NIE/CIF/VAT-UE. | Controlado. | Bloqueado para `CONFIG_SISTEMA_FISCAL`. |
| `CajaActual` | Valida `singletonKey = CAJA_PRINCIPAL` (colección `SINGLE_ITEM`). | `sequenceCounters` editable solo por backend bajo bloqueo fiscal global. | **Bloqueado**. |
| `InventarioStockVenta` (legacy) | Sin nuevas altas ni actualizaciones; no crear maestros. | Sin nuevas altas ni actualizaciones. | Sin nuevas operaciones de inventario personalizadas. |
| `ControlOperativo` | Valida identidad y requisitos específicos del tipo. | Recupera registro, fusiona el cambio, protege `controlType` e inmutabilidad y valida el estado resultante. | Recupera por `itemId` y bloquea la eliminación de `WEBHOOK_EVENT`. |
| `MapaStaff` | Sin hook CMS. | Sin hook CMS. | Sin hook CMS. |
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

---

## Capa 3 — referencia y estado de implantación

La arquitectura documental Wix → M365/SharePoint se describe exclusivamente en [DOSSIER FLUJOS END TO END CAPA 3.md](DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md). No mantener copias de guías operativas ni propuestas de exportación en este dossier técnico.

**Estado verificado:** Capa 3 no está implantada en runtime. No existe `src/backend/exports/exportService.js` ni jobs de exportación en `jobs.config`. `fiscalDocuments.web.js` contiene un helper Resend, pero el envío a gestoría está desactivado por `SDK_CONFIG.EMAIL.ACCOUNTANT_SEND_ENABLED=false`; la creación de snapshots está bloqueada hasta completar hash canónico, límites de tamaño y versionado concurrente. La colección `PaquetesGestoria` tiene constancia de creación de esquema en la auditoría de pausa, sin segunda lectura independiente de permisos ni items.

La decisión del transporte de exports (Resend frente a Microsoft Graph/mecanismo Microsoft) requiere ADR y aprobación. PA-01…PA-07, SharePoint, permisos, retención y DLP no se han auditado en el tenant. No afirmar automatización, ahorro de tiempo ni cumplimiento total.

Referencia: [auditoría de implantación Capa 3](docs/audits/2026-11-09-capa3-implementation-state.md).

---

# ✅ CHECKLIST DE NECESIDADES — WEB MARIANMADRID.ES

## Definición funcional de características desde la perspectiva de la propietaria

**Repositorio:** `nachoortegazgz/marianmadridz`
**Perspectiva:** Marian Madrid, propietaria, estilista y autónoma.
**Cambio respecto a la versión anterior:** la columna **“Lo que necesito”** ya no está en lenguaje coloquial, sino como **definición funcional concreta y verificable** de cada característica. El resto de columnas (“Por qué me importa”, “Cómo sabré que funciona”, “Estado”) se mantienen al servicio de la comprobación por parte de la propietaria.

---

### 📖 Glosario mínimo de términos usados en las definiciones

| Término | Definición operativa |
|---|---|
| **Reserva simple** | Cita de un solo bloque continuo: el profesional está ocupado de principio a fin (ej. corte 30 min). |
| **Reserva dual con gap** | Cita formada por **dos o tres fases**: aplicación (profesional ocupado) → **gap de exposición** (profesional libre, sillón ocupado) → acabado (profesional ocupado). El **gap libera la agenda del profesional** para aceptar otra reserva simple o corta. |
| **Gap** | Intervalo entre fases en el que el profesional **no** está ocupado pero el recurso físico (sillón, lavacabezas) sí. |
| **Fianza condicional** | Cobro anticipado obligatorio solo por encima de un umbral de precio; opcional o inexistente por debajo. |
| **Política de cancelación 24 h** | Reembolso automático si la cancelación se produce con ≥24 h de antelación; retención si es posterior. |
| **Canje parcial** | Uso de una tarjeta regalo por importe inferior al saldo, dejando remanente y estado `ACTIVE`. |
| **Registro fiscal inalterable** | Asiento con número correlativo, base, IVA y huella encadenada que no puede editarse ni borrarse tras su emisión. |
| **Consentimiento granular** | Casillas independientes y no premarcadas para finalidades distintas (datos de salud, imagen, cookies). |

---

## A. AGENDA Y OPERATIVA DEL SALÓN

| ID | Lo que necesito (definición funcional) | Por qué me importa | Cómo sabré que funciona | Estado |
|---|---|---|---|---|
| **A-01** | **Reserva online 24/7**: la clienta selecciona servicio, profesional, fecha y hora, y confirma sin intervención del salón, en cualquier franja horaria. | Atender el teléfono con las manos llenas de tinte resta concentración y calidad. | Entro como clienta a las 22:00 y completo una reserva sin ayuda de nadie. | |
| **A-02** | **Reserva dual con gap de tiempo**: servicio dividido en fases (aplicación / exposición / acabado) donde la fase de exposición **libera la agenda del profesional** manteniendo ocupado el recurso físico. | Si la agenda me bloquea 90 minutos seguidos por unas mechas, pierdo la mitad de la facturación del día. | Reservo un tinte largo y, durante su gap, el sistema me permite meter un corte de caballero o un secado sin conflicto. | |
| **A-03** | **Configuración por servicio de las fases**: cada servicio define duración total, minutos de aplicación, minutos de exposición (gap) y minutos de acabado, y el backend los lee para calcular disponibilidad. | No es lo mismo un corte de 30 min que unas babylights de 90; si el sistema no distingue, o me sobra agenda o me falta. | La ficha de cada servicio muestra sus tres fases y coinciden con lo que hago en el tocador. | |
| **A-04** | **Catálogo de servicios cortos compatibles con el gap**: servicios simples (corte express, secado, manicura) reservables **durante** la fase de exposición de una reserva dual. | El gap del tinte es dinero que hoy se pierde; con servicios cortos complementarios se factura. | Reservo tinte + corte simultáneo desde dos dispositivos y ambas citas quedan confirmadas sin conflicto. | |
| **A-05** | **Sincronización bidireccional con Google Calendar del salón**: las citas creadas en la web aparecen en el calendario y los bloqueos del calendario se reflejan en la disponibilidad. | Necesito verlo también desde el móvil mientras estoy fuera o de camino al salón. | El calendario y la web muestran las mismas citas en menos de 1 minuto, en ambos sentidos. | |
| **A-06** | **Panel de estado por cita**: cada cita muestra fase actual (aplicación / gap / acabado), profesional asignado y recurso físico ocupado. | No quiero que una compañera pregunte “¿esta lleva tinte?” delante de la clienta. | En el panel del salón cada cita muestra su fase y su profesional en tiempo real. | |

---

## B. CAJA Y DINERO

| ID | Lo que necesito (definición funcional) | Por qué me importa | Cómo sabré que funciona | Estado |
|---|---|---|---|---|
| **B-01** | **Fianza condicional por umbral de precio**: servicios > 30-40 € exigen señal obligatoria (15 € o 20%) antes de confirmar; servicios ≤ umbral no la exigen. | Bloquear 2 horas para unas mechas de 89 € y que no aparezca es trabajar a pérdidas. | Reservo unas babylights desde fuera: sin pagar la señal, la cita no se confirma; con un corte de 25 €, sí se confirma sin señal. | |
| **B-02** | **Pasarela de pago segura con tarjeta y Bizum** integrada en el flujo de reserva (Wix Pay / Redsys / Stripe). | Si el pago es complicado, la clienta abandona y pierdo la reserva. | Hago una reserva de prueba con tarjeta real en entorno de pruebas y el cobro se confirma. | |
| **B-03** | **Política de cancelación 24 h con reembolso automático**: cancelación ≥24 h antes devuelve la fianza sin intervención manual. | No quiero estar devolviendo dinero a mano ni quedar mal con una clienta puntual. | Cancelo con 30 h de antelación y la devolución se ejecuta sola. | |
| **B-04** | **Retención de fianza por cancelación tardía**: cancelación <24 h retiene la fianza como compensación, registrada como ingreso. | El hueco ya está perdido; la fianza lo cubre. | Cancelo con 2 h de antelación y el sistema no devuelve; queda registrada la retención. | |
| **B-05** | **Descuento de fianza en ticket final**: el importe ya abonado como señal se resta automáticamente del total del servicio al cerrar la cita. | Cobrar dos veces es la vía más rápida a una reclamación. | Al cerrar el ticket de una clienta que pagó fianza, el importe a cobrar ya viene con la fianza restada. | |
| **B-06** | **Tarjeta regalo con código único, firma criptográfica y QR**, canjeable por lectura desde móvil en el salón, con **canje parcial** (saldo remanente) y estado `ACTIVE` → `EXHAUSTED`. | Los bonos en papel se pierden, se duplican y generan discusiones. | Escaneo el QR desde el móvil y el saldo baja; si lo escaneo dos veces seguidas, la segunda no descuenta. | |
| **B-07** | **Detección de bono manipulado o inventado**: firma inválida o saldo alterado rechazados con aviso. | Si alguien puede fabricarse un bono, pierdo dinero y credibilidad. | Pruebo con un código inventado y con un saldo manipulado: ambos se rechazan. | |
| **B-08** | **Registro unificado de cobros** (web, salón, bono, producto) que cuadre con el cierre de caja diario. | Si la caja no cuadra con la web, es imposible saber si el negocio va bien. | El total del cierre de caja coincide con la suma de cobros online + mostrador del día. | |
| **B-09** | **Stock de La Boutique sincronizado con el inventario físico** (fase 1: manual vía app Wix; fase 2: conexión con TPV). | Vender el último sérum online y a la vez en mostrador es una reclamación segura. | Vendo el último producto en el salón y la web deja de permitir la compra en el plazo definido. | |

---

## C. EQUIPO

| ID | Lo que necesito (definición funcional) | Por qué me importa | Cómo sabré que funciona | Estado |
|---|---|---|---|---|
| **C-01** | **Usuarios individuales con roles diferenciados** (propietaria / admin / staff), con permisos por función y acceso restringido a caja y fichas sensibles. | Si todas usamos el mismo usuario, no sé quién ha tocado qué. | Doy de alta a una nueva oficiala con rol limitado y no puede ver la caja ni las fichas médicas. | |
| **C-02** | **Ficha capilar y de salud confidencial** (`ClientHealthAndConsent`): alergias PPD, sensibilidad de cuero cabelludo e historial de fórmulas, solo accesible por admin y personal autorizado; no indexable ni accesible por API pública. | Son datos sensibles; si se filtran, es un problema legal y de confianza. | Intento abrir la ficha con un usuario no autorizado y el sistema lo bloquea. | |
| **C-03** | **Fichaje laboral inmutable append-only** de entrada, salida y pausa, sin posibilidad de edición posterior. | La ley laboral me obliga (RD-ley 8/2019) y en una inspección no puedo demostrar nada si se puede tocar. | Ficho entrada, intento editar el registro y el sistema no me deja. | |
| **C-04** | **Firma HMAC-SHA256 por evento de fichaje y cadena de hashes** que detecta cualquier manipulación. | Si alguien puede cambiar una hora sin dejar rastro, el registro no vale ante Inspección. | Al intentar alterar un fichaje, el sistema lo marca como manipulación y conserva el original. | |

---

## D. EXPERIENCIA DE LA CLIENTA

| ID | Lo que necesito (definición funcional) | Por qué me importa | Cómo sabré que funciona | Estado |
|---|---|---|---|---|
| **D-01** | **Precios con IVA incluido visibles en todo el catálogo** y en el flujo de reserva. | La transparencia evita malentendidos en caja y atrae a quien busca un servicio concreto. | Recorro el catálogo y cada precio indica “IVA incl.”. | |
| **D-02** | **Aviso legal obligatorio en el 100% de respuestas de la IA**: “Presupuesto y diagnóstico orientativos sujetos a valoración capilar previa en tocador”. | La IA es un reclamo, pero no puede prometer un rubio imposible sobre un tinte negro. | Pruebo el asistente varias veces y en todas aparece el aviso legal. | |
| **D-03** | **Cuestionario previo obligatorio** a la IA: longitud del cabello, tratamientos químicos en los últimos 6 meses y necesidad principal, validados antes de llamar a la API. | Sin esos datos, la recomendación es humo y genera expectativas falsas. | Intento usar el asistente sin rellenar los campos y no me deja avanzar. | |
| **D-04** | **Prohibición de garantizar resultados de color sin prueba de mecha** en cabellos teñidos o decolorados, verificada con test de prompt malicioso. | Un “te quedará genial” sin prueba de mecha es una reclamación esperando a ocurrir. | Le pido a la IA un rubio sobre tinte negro y me advierte de la necesidad de prueba de mecha previa. | |
| **D-05** | **Claves de API en `wix-secrets-backend`**, sin exposición en frontend. | Si alguien roba la clave, me llega la factura de OpenAI y no sé por qué. | El asesor técnico confirma que no hay claves en el código de la web visible al navegador. | |
| **D-06** | **Timeout de 9 s con fallback estructurado** en la IA: si tarda o devuelve JSON malformado, la web responde con mensaje alternativo sin colgarse. | Una web que se cuelga espanta a la clienta. | Simulo el fallo o la lentitud y la web responde con “vuelve a intentarlo o llámanos”. | |
| **D-07** | **Área privada de cliente** (Wix Members): registro/login, historial de citas y compras. | La fidelización empieza por que la clienta sienta que tiene su espacio. | Entro con un usuario de prueba y veo mi historial de citas y compras. | |
| **D-08** | **Canales de contacto operativos**: formulario web, Google Maps, teléfonos y WhatsApp directo. | Es la puerta de entrada de mucha gente que aún no se atreve a reservar. | Envío un mensaje desde el formulario y llega; el mapa apunta bien; el botón de WhatsApp abre la conversación. | |

---

## E. HACIENDA Y GESTORÍA

| ID | Lo que necesito (definición funcional) | Por qué me importa | Cómo sabré que funciona | Estado |
|---|---|---|---|---|
| **E-01** | **Registro fiscal inalterable por cada venta** (reserva, bono, producto) con número correlativo sin saltos, fecha, base imponible e IVA desglosado. | La ley antifraude (Veri*factu, RD 1007/2023) ya no permite cobros sin trazabilidad. | Saco el listado del trimestre y todos los números son seguidos, sin huecos. | |
| **E-02** | **Bloqueo de edición y borrado** de facturas emitidas. | Si se puede tocar, no vale ante Hacienda. | Intento editar una factura ya emitida y el sistema no me deja. | |
| **E-03** | **Cálculo exacto de IVA 21% al céntimo** en cada servicio, sin desviaciones por redondeo. | El asesor no debe tener que corregir ni un céntimo. | Sumo base + IVA de varias facturas y cuadra exactamente con el total. | |
| **E-04** | **Cadena de hashes SHA-256 (`hashChain`) entre registros fiscales**: cada asiento contiene la huella del anterior. | Es lo que garantiza que el libro es inalterable de verdad. | El asesor técnico confirma la cadena y que un cambio en una factura la rompe. | |
| **E-05** | **QR AEAT en facturas simplificadas** apuntando al endpoint oficial `ValidarQR`. | Es el mecanismo que Hacienda está exigiendo para validar. | El QR se lee con el móvil y lleva a la web oficial con los datos correctos. | |
| **E-06** | **Exportación CSV/Excel normalizada**: delimitador `;`, decimal `,`, UTF-8 BOM, columnas Fecha / Nº Factura / Concepto / Base / % IVA / Cuota / Total / Método de pago. | Si mi asesor tiene que picar los datos a mano, me cobra más y se pierde tiempo. | El asesor importa el archivo en A3 o Contasol sin retoques, con tildes correctas y columnas en su sitio. | |
| **E-07** | **Fila de totales al céntimo** al final del CSV, coincidente con el detalle. | Es la prueba de que no se ha colado nada. | La suma de bases, IVAs y totales del detalle coincide exactamente con la fila de totales. | |
| **E-08** | **NIF del emisor y, si procede, del destinatario** en cada factura. | Es obligatorio y evita rechazos y preguntas. | Reviso una factura mía y una con NIF de clienta y ambas salen completas. | |

---

## F. PROTECCIÓN DE DATOS Y NORMATIVA

| ID | Lo que necesito (definición funcional) | Por qué me importa | Cómo sabré que funciona | Estado |
|---|---|---|---|---|
| **F-01** | **Consentimiento expreso, separado y no premarcado para datos de salud capilar**, con registro de fecha, hora e IP. | Son datos sensibles según el RGPD; sin consentimiento claro, hay sanción. | La casilla de salud es independiente, no viene marcada y queda registrada con fecha e IP. | |
| **F-02** | **Consentimiento específico y revocable para uso de imagen** (“antes y después”), separado del de salud, con registro de fecha e IP. | Publicar una foto sin permiso es una reclamación segura. | La casilla de imagen es distinta, no premarcada, queda constancia y puedo retirar el consentimiento. | |
| **F-03** | **Banner de cookies AEPD con dos botones al mismo nivel** (“Aceptar todas” / “Rechazar todas”) y bloqueo de Meta Pixel, Google Analytics y TikTok Pixel hasta consentimiento. | La AEPD exige que rechazar sea tan fácil como aceptar; si no, sanción. | Entro con navegador limpio y hasta que pulso un botón, los píxeles no cargan. | |
| **F-04** | **Minimización de datos**: solo campos necesarios para cada finalidad en formularios y fichas. | El RGPD exige minimización; más datos = más riesgo. | Repaso formularios y fichas y no hay campos “por si acaso”. | |
| **F-05** | **Procedimiento operativo para ejercer derechos de acceso, rectificación y supresión**. | Es un derecho de la clienta y una obligación mía. | Simulo una solicitud y hay un procedimiento claro para atenderla. | |
| **F-06** | **Aviso Legal, Política de Privacidad y Política de Cookies visibles y coherentes** con lo que hace la web. | La LSSI-CE me obliga y la coherencia con el banner es imprescindible. | Los tres enlaces son accesibles desde cualquier página y su contenido coincide con el funcionamiento real. | |
| **F-07** | **Cláusula de desistimiento de 14 días con excepción Art. 103** para cosméticos desprecintados en Términos y Condiciones. | Es la excepción legal y hay que decirlo por escrito. | Leo los Términos y aparece la cláusula tal cual, sin ambigüedad. | |

---

## G. CRECIMIENTO DEL NEGOCIO

| ID | Lo que necesito (definición funcional) | Por qué me importa | Cómo sabré que funciona | Estado |
|---|---|---|---|---|
| **G-01** | **Upselling en checkout**: sugerencia de hidratante exprés (+12 €) al reservar Corte de Autor. | El upselling bien hecho sube el ticket medio sin fricción. | Reservo un corte como clienta y me aparece la sugerencia con un clic. | |
| **G-02** | **Venta cruzada con descuento**: champú matizador al 10% al comprar bono de mechas. | Vendo más producto y fidelizo. | Compro un bono y veo la sugerencia del champú con el descuento aplicado. | |
| **G-03** | **Promociones programables en horas valle** (ej. 15% en cortes martes 10-13 h). | Los martes por la mañana están flojos y necesito llenarlos. | Programo una promo y compruebo que en la franja indicada el precio aparece con descuento. | |
| **G-04** | **Recordatorio automático WhatsApp/SMS a las 4-5 semanas** del tinte o corte, con enlace directo a reservar. | La clienta fiel vuelve sola si se le recuerda con cariño. | Tras una cita, recibo el recordatorio en plazo y el enlace funciona. | |
| **G-05** | **Confirmación de cita y recordatorio 24 h antes** con enlace para cancelar o modificar. | Reduce no-shows y descarga el teléfono. | Reservo y recibo ambos mensajes con el enlace operativo. | |
| **G-06** | **Bonos y suscripciones** (4 peinados al mes, bono barba) con redención de sesiones sin duplicar citas. | Es ingreso recurrente y fideliza. | Contrato un bono como clienta y voy gastando sesiones sin duplicar citas. | |
| **G-07** | **Blog e integración de redes** (Instagram, TikTok, Facebook, YouTube) con contenido vivo. | La marca se construye también fuera de la reserva. | Navego por la web y veo contenido actualizado y enlaces a redes. | |

---

## H. TRANQUILIDAD Y CRITERIO FINAL DE ÉXITO

| ID | Lo que necesito (definición funcional) | Por qué me importa | Cómo sabré que funciona | Estado |
|---|---|---|---|---|
| **H-01** | **Operativa diaria completa sin fricción**: reserva dual con gap, fianza, canje de bono por QR y cierre de caja en una sola jornada real. | Si la web me da más trabajo que alivio, no me sirve. | Hago una semana real con el sistema y no echo de menos el papel ni el teléfono. | |
| **H-02** | **Antirregresión**: cada cambio va acompañado de prueba de que lo anterior sigue funcionando. | No quiero que un arreglo de hoy me tumbe la caja de mañana. | Cada cambio llega con prueba documentada de que el flujo previo sigue operativo. | |
| **H-03** | **Documento de estado legible por la propietaria** (`CALIDAD_CERO_DEUDA.md` o equivalente) actualizado tras cada refactor. | Necesito saber en qué punto estamos sin tecnicismos. | Existe el documento, lo entiendo y está actualizado a la última versión. | |
| **H-04** | **Sesión presencial de aceptación** con Marian delante, cubriendo reserva dual, bono por QR y CSV para el asesor. | Quiero verlo funcionar con mis clientas y mis servicios reales, no en teoría. | Hacemos la sesión, probamos los tres flujos y yo doy el visto bueno firmado. | |

---

## 🎯 USO POR PARTE DEL MODELO IA VERIFICADOR

1. **La columna “Lo que necesito” ya es una definición funcional cerrada**: cada fila responde a una característica concreta (reserva dual con gap, fianza condicional, canje parcial, registro fiscal inalterable…). El verificador debe comprobar **esa definición**, no una interpretación libre.
2. **Evidencia obligatoria**: un requisito solo pasa a ✅ si existe prueba verificable (archivo real en `src/`, test ejecutado, archivo CSV revisado por el asesor, acta de sesión). El “estado declarado” en los dossiers **no es evidencia**.
3. **Prioridad para la propietaria**:
   - 🔴 **Antes de abrir al público:** bloques **A, B, C, E, F** completos (reserva dual con gap, fianza, fichaje, fiscalidad y RGPD).
   - 🟡 **Optimización comercial:** bloque **D** y **G-01, G-02, G-04, G-05**.
   - 🟢 **Medio plazo:** **G-03, G-06, G-07**.
4. **Criterio final de apto:** bloques A–F completos + sesión presencial del bloque H + documento de estado legible por Marian (H-03).
5. **Si algo no es verificable**, se marca **⚠️ no comprobable aún** y se escala a revisión humana. Nunca se inventa un ✅.

---

## 📌 Nota sobre el repositorio

Se trabaja sobre **`nachoortegazgz/marianmadridz`**. Los dossiers originales citaban el repositorio con sufijo (`marianmadridXXXXX`) y describían módulos con nombres que el propio dossier reconoce como “solución greenfield no auditada” (`bookingsEngine.web.js`, `aiConsultant.web.js`, `giftCards.web.js`, etc.). Esa lista de nombres **no es prueba** de que existan en el repositorio. La verificación de cada fila debe hacerse contra el árbol real de `src/` (backend y pages), no contra los nombres de los dossiers.


---

## Addendum de estado y decisiones — 2026-11-11

Este addendum actualiza el estado de las áreas que han cambiado desde la revisión histórica del dossier. Para la visión transversal y el plan priorizado, consultar también [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md).

### Reservas nativas y proyección CitasF2

PR #280 incorpora el handler Velo wixBookings_onBookingCreated para proyectar la creación nativa como PENDING o CONFIRMED según el estado recibido. PR #281 protege una carrera: un evento BOOKING_CREATED tardío no debe degradar una proyección ya confirmada. CI offline final documentada: 53 suites / 530 tests, 0 fallos.

La prueba sintética autorizada del 2026-11-11 (booking 213a10f1-9d4e-44ed-b682-a459bd7ed88d) quedó CONFIRMED en Wix, pero no produjo fila CitasF2 ni marcador WEBHOOK_EVENT en dos lecturas posteriores. Causa no determinada; no se ha verificado el SHA de Velo publicado ni hay evidencia runtime suficiente. Preservar reserva y anotación QA; no cancelar, hacer backfill ni crear otra reserva de prueba hasta aislar el fallo.

### Caja y sesión operativa: separación de responsabilidades

Decisión inicial del propietario, 2026-11-11, delimitada por la decisión posterior TEC-032 (2026-11-13):
- `MovimientosCaja` conserva cada ticket/movimiento original como ledger append-only y fuente histórica/fiscal.
- `CajaActual` es un singleton mutable que proyecta el estado de sesión, el resumen de la última operación, los acumulados de sesión por medio de pago y, de forma separada, el saldo del efectivo físico.
- Los cobros presenciales en efectivo, tarjeta y Bizum deben aparecer en la actividad/acumulados de sesión. Tarjeta y Bizum no incrementan el saldo físico.
- `cashAmount`/`expectedCash` solo cambian por movimientos cuyo efecto físico esté definido y validado en backend. ONLINE, transferencias y pagos bancarios no se incorporan a la sesión física por inferencia.
- `LibroAsientosContablesDetalle` consolida hechos económicos según reglas aprobadas; no se crean asientos ni mapeos PGC por efecto de la proyección.

Cada ticket permanece en `MovimientosCaja`; `CajaActual` guarda referencias a los IDs fuente asociados a la última operación y no duplica el histórico. El resumen de última operación incluye, cuando existan en el origen, actor autenticado resuelto en backend, fecha/hora exacta, tipo/descripción, conceptos/unidades validados, importe/desglose, hash, hash anterior, secuencia, timestamp de registro, firma y traceId. Los acumulados mínimos distinguen efectivo, tarjeta y Bizum por importe y número de tickets/cobros.

**Estado:** decisión documental aprobada; implementación pendiente. El esquema físico documentado de `CajaActual` no contiene aún todos los campos del resumen/referencias ni un acumulado Bizum dedicado. `MovimientosCaja.paymentMethod` es singular y `lineItems` carece de contrato interno acreditado: los pagos mixtos y la presentación de unidades permanecen bloqueados hasta definir y probar sus contratos. No se afirma que la PR #284 o el código actual implementen TEC-032; su alcance previo era exclusivamente efectivo físico. No añadir enums ni mapeos PGC por inferencia.

La fila live de CajaActual en estado SIMULACION con apertura marcada en 300 EUR es sintética y no constituye una apertura real ni un saldo físico conciliado. No reescribirla ni borrarla; preservar también anotaciones QA y ledgers históricos.

### ServiciosCatalogo como SSOT declarada

El propietario ha definido ServiciosCatalogo como fuente de verdad de la configuración de servicios que debe sincronizarse con Wix Bookings. El campo name se relaciona con Complementos catálogo para los complementos del servicio; staffMembers identifica el personal elegible para ese servicio.

Este contrato es una declaración de negocio pendiente de verificación en esquemas live, registros, código consumidor/escritor, IDs nativos, eventos y mecanismo de sincronización. No implica que la sincronización esté implementada. La elegibilidad de staff no equivale a disponibilidad temporal: Bookings combina horarios, bloqueos/eventos y reservas. Retirar una asignación de servicio no debe borrar el perfil, los horarios generales ni reservas históricas. Toda sincronización futura debe ser idempotente y preservar referencias canónicas.

### Fiscalidad y DatosFiscales

Se verificaron permisos efectivos PRIVILEGED de DatosFiscales mediante lectura posterior a la configuración. Persiste una discrepancia entre el esquema CMS (campo active) y las listas/validaciones de campos del código. No modificar el contrato hasta reconciliar esquema, consumidores y política de dominio.

El contrato puro AEAT/hash no certifica Veri*Factu ni habilita remisión. La activación continúa bloqueada por la definición del SIF, series, factura/IVA, rectificaciones, XML/XSD, transporte, respuestas, pruebas oficiales y revisión legal.


---

# ADDENDUM DE VIGENCIA — 2026-11-13

Este addendum actualiza el estado técnico operativo y prevalece sobre descripciones históricas de estado, runtime, catálogo, CMS y QA que contradigan sus datos. La arquitectura e invariantes del dossier siguen vigentes.

## Estado de repositorio y Wix

- GitHub `main` consultado: `738eb78faaa48502532c83c3e4b8b53db1144950`.
- Wix Site Context confirma sitio principal Published, Wix Editor, Velo enabled, Europe/Madrid, EUR; el propietario declara que Wix se ha actualizado y publicado.
- No se dispone de release/deployment ID ni evidencia que vincule exactamente el SHA actual de GitHub con el runtime publicado. El estado Published está verificado; la identidad exacta del código desplegado sigue pendiente.
- Existe un sitio Wix QA separado, ID `50b39f33-e753-4331-ab35-b2ed43dc97f7`, en estado Draft. La separación de Site ID está verificada; el aislamiento de automatizaciones, notificaciones, pagos, webhooks, permisos e integraciones no está certificado.
- Wix Stores del sitio principal usa Catalog V3; Wix Invoices usa V1.

## Inventario CMS producción — lectura live 2026-11-13

44 colecciones: 15 NATIVE y 29 WIX_APP. Recuentos actuales de las 15 NATIVE:

| Colección | Elementos | Observación |
|---|---:|---|
| CajaActual | 1 | Sentinel SIMULACION |
| CitasF2 | 1 | Proyección; divergencia P1 con Bookings |
| ComplementosCatalogo | 36 | Catálogo |
| ControlOperativo | 3 | Recuento live actual; sustituye el cero de cortes previos |
| DatosFiscales | 1 | Placeholder; falta CONFIG_SISTEMA |
| HistoricoCierresZ | 0 | Append-only |
| InventarioStockVenta | 1 | Legacy; no SSOT de stock |
| LibroAsientosContablesDetalle | 0 | Append-only; writer deshabilitado |
| MapaStaff | 3 | Correlación staff/recurso |
| MovimientosCaja | 0 | Append-only; writer deshabilitado |
| MovimientosInventario | 1 | Legacy; no nuevas escrituras |
| PaquetesGestoria | 0 | Append-only |
| RegistroIntegracion | 0 | Sin consumidor/writer activo demostrado |
| RegistrosHorariosStaff | 2 | Sintéticos QA sin HMAC; writer deshabilitado |
| ServiciosCatalogo | 95 | 94 servicios + 1 plan |

Las 29 WIX_APP se agrupan en Bookings (3), Blog (3), CampaignManager (2), Forms (1), Locations (1), Marketing (1), Members (4), StoreCatalog (8), Stores (5) y eCommerce (1). Sus IDs completos y nombres están en `ESTADO_ACTUAL_PROYECTO.md`. Son propiedad de Wix Apps y no se mutan desde esta intervención.

## Sitio QA: paridad incompleta

La lectura CMS del sitio QA devuelve 43 colecciones (15 NATIVE, 28 WIX_APP). Las 15 NATIVE existen. Recuentos diferentes respecto a producción: CitasF2 0 frente a 1 y ControlOperativo 0 frente a 3; los otros 13 recuentos coinciden en el corte. QA contiene cuatro colecciones WIX_APP `WixForms/*` adicionales y carece de las cinco colecciones `Stores/*` presentes en producción. No certificar E2E de Store/eCommerce en QA hasta resolver y documentar esa diferencia y auditar efectos externos.

## CitasF2 — contrato y bloqueo

- Revisión 42, 31 campos físicos, 1 item.
- Campos físicos y contrato canónico raíz se mantienen como documentados en la sección de esquema anterior: `bookingId`, `bookingStatus`, `paymentStatus`, `orderId`, `cashMovementId`, `serviceId`, `resourceId`, `scheduleId`, `slotStart`, `slotEnd`, `timeZone`, `traceId`.
- Lectura actual del item: `bookingId=3effa046-5b9d-429b-9f9c-af2f3d6c9994`, `bookingStatus=CONFIRMED`, `paymentStatus=NOT_PAID`, `meta.nativeBookingStatus=CONFIRMED`.
- La última lectura Bookings Reader V2 registrada en el corte QA anterior devolvió la reserva nativa CANCELED / NOT_PAID. Mantener bloqueo P1 hasta repetir la lectura nativa tras la publicación declarada y verificar el handler/evento de cancelación.
- No corregir manualmente la proyección, no borrar reservas y no backfill por inferencia.

## Límites y pendientes no negociables

- Mantener deshabilitados `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED`, `ACCOUNTING_LEDGER_WRITES_ENABLED` y `STAFF_CLOCKING_CONFIG.WRITES_ENABLED`.
- Mantener `ACCOUNTANT_SEND_ENABLED=false`; no activar cobros, reembolsos, ledgers, cierres, fichajes ni exports reales.
- SharePoint / Power Automate Capa 3 no está acreditado como flujo operativo live.
- El commit documental actual `738eb78...` no tiene estados combinados ni workflow runs asociados en la consulta. Los resultados históricos de PR #330 no certifican este HEAD.
- Pendientes P0–P4, lista de colecciones completa, diferencias QA/prod y estado de validación se mantienen centralizados en `ESTADO_ACTUAL_PROYECTO.md`.

### Addendum de arquitectura — TEC-032: proyección de sesión y tickets fuente (2026-11-13)

`MovimientosCaja` sigue siendo el ledger de origen y conserva cada ticket individual sin updates/removes. `CajaActual` no se convierte en un ledger paralelo: contiene una proyección mutable y reconstruible con estado de sesión, responsable de apertura/cierre, resumen de última operación, acumulados por medio de pago y saldo físico separado. El resumen referencia los `_id` originales. Los acumulados y el resumen se actualizan de forma idempotente después de persistir el movimiento fuente.

El proyector debe separar dos dimensiones: (a) actividad económica/pagos presenciales de la sesión, al menos EFECTIVO/TARJETA/BIZUM; (b) delta físico de efectivo, solo cuando el movimiento lo declare de forma canónica y validada. El actor se resuelve en backend; los timestamps y huellas se toman del movimiento original. No se aceptan valores de identidad, dirección física ni totales autoritativos desde el frontend.

No se ha implementado ni validado este contrato en runtime en esta actualización. Requiere migración CMS compatible, validación centralizada, revisión de todos los consumidores, lock/idempotencia, pruebas unitarias/integración/concurrencia/reconstrucción y QA Wix aislado. Los escritores fiscales/contables siguen fail-closed.

### Estado histórico de código CajaActual / TEC-032 (2026-11-13)

> El análisis de esquema de este addendum corresponde a un corte anterior. El CMS live actual es revisión 64 y dispone de los 59 campos descritos en `DICCIONARIO_DATOS_CMS.md` §3.1. La existencia de columnas nuevas no acredita que el código de esta rama las persista o consuma.

La rama `fix/caja-actual-last-operation-projection` adapta parcialmente los flujos:
- El escritor manual exige canal explícito (con inferencia ONLINE limitada a `VENTA_ONLINE`/`WIX_PAYMENTS`) y resuelve el actor presencial desde `getMyStaffContext()`, sin confiar en `resourceId` del frontend.
- La proyección incluye cobros presenciales EFECTIVO/TARJETA/BIZUM solo si existe sesión abierta con `openedAt`; no crea sesión implícitamente. `cashAmount/netAmount` siguen siendo efectivo físico; `cardAmount` y `bizumAmount` son acumulados netos de tarjeta y Bizum.
- El DTO de lectura deriva acumulados y tickets por medio desde `MovimientosCaja`, y entrega la última operación con ID fuente, actor, instante y campos de huella/traza. El panel de ZONA MARIAN muestra el detalle.
- El cierre Z manual resuelve y guarda `closedBy` desde backend.

**No equivale a implementación completa:** el esquema CMS revisión 64 no persiste aún `lastMovementId` ni un objeto `lastOperation`; la referencia se devuelve en lectura. No hay WebMethod de apertura validado que persista los cuatro importes iniciales. `lineItems` y pagos mixtos siguen sin contrato. No se han activado escritores en esta intervención documental. El esquema CMS live fue editado fuera de este cambio y se ha releído en revisión 64.


## Addendum — ventana temporal de edición/borrado append-only (2026-11-14)

La rama `chore/temporary-append-only-mutation-window` incorpora una excepción temporal de desarrollo para permitir update/remove individual en los ledgers y snapshots append-only identificados por el repositorio: `MovimientosCaja`, `LibroAsientosContablesDetalle`, `RegistrosHorariosStaff`, `MovimientosInventario`, `HistoricoCierresZ`, `PaquetesGestoria` y `ControlOperativo/WEBHOOK_EVENT`.

La SSOT de esta ventana es `APPEND_ONLY_MUTATION_WINDOW` en `src/backend/internalConfig.js`. Los hooks `data.js` y la política de escritura `dataAccessPolicy.js` consultan la misma decisión. La validación de nuevas inserciones permanece activa. No se habilitan operaciones bulk. Las reglas de autorización y permisos CMS continúan aplicándose independientemente de los hooks.

**Estado:** habilitada solo en la rama de trabajo; no publicada en Wix ni aplicada a permisos o datos live. La excepción no es una dispensa legal y no debe emplearse para alterar o borrar registros reales sujetos a obligaciones de conservación.

**Gate de despliegue:** antes de cualquier publicación productiva hay que restaurar `APPEND_ONLY_MUTATION_WINDOW.ENABLED=false`, quitar los ledgers de las allowlists de update/remove, recuperar las pruebas de bloqueo, ejecutar CI y validar el bloqueo efectivo en Wix Local Editor. No considerar esta rama apta para producción mientras la ventana esté abierta.


## Addendum — maestros MASTER DatosFiscales y MapaStaff (2026-11-14)

La lectura posterior a la mutación de Wix Data API confirma `DatosFiscales` revisión 19 y `MapaStaff` revisión 24. `DatosFiscales` incorpora `commercialName`, `postalCode`, `province`, `schemaVersion` y `traceId`; `fechaInicioVerifactu` es `DATE`. `MapaStaff` incorpora `traceId`. Los registros existentes se releen tras la mutación: 1 placeholder fiscal QA y 3 mapeos de staff. El placeholder permanece separado del emisor; los tres mapeos conservan roles y referencias de identidad, con `thirdPartyId` vacío.

El código de `main` alinea los hooks/validator de `DatosFiscales` con un `CONFIG_SISTEMA` que puede mantener pendientes los campos fiscales no acreditados, reserva el ID `CONFIG_SISTEMA_FISCAL`, exige `schemaVersion=1` y `traceId`, y evita que `eventLog.js` rellene `legalName` desde el nombre comercial. El writer de terceros persiste `schemaVersion` y `traceId`.

No se ha creado todavía el singleton `CONFIG_SISTEMA`: falta verificar taxId, legalName y taxRegime con documentación fiscal/gestoría, y el código requiere sincronización/publicación Wix antes de insertar ese registro. Veri*Factu y los writers fiscales permanecen desactivados.

**Compatibilidad pendiente:** `MapaStaff` conserva `staffMemberId`, `scheduleId`, `active`, `sourceSystem` y su relación con `ServiciosCatalogo`; el fallback actual de `events.js` consume staffMemberId/active/scheduleId. No eliminarlos hasta sustituir ese consumidor y aprobar el ADR de `active`. La unicidad memberId/resourceId solo está verificada en el snapshot, no garantizada frente a concurrencia. Campos heredados de DatosFiscales se mantienen donde contienen datos QA o tienen consumidores. No se han borrado colecciones 12–16 por falta de IDs/nombres inequívocos.

## Addendum — consolidación live MapaStaff / GESTORIA (2026-11-14)

**Autoridad del propietario:** los datos históricos y registros existentes son sintéticos de pruebas y el sitio no tiene actividad real. Se mantiene temporalmente la ventana de mutabilidad append-only autorizada hasta nueva instrucción expresa. Los gates de escritores fiscales/contables siguen fail-closed; no se ha habilitado facturación, cobros, fichajes reales ni automatizaciones externas.

**CMS live verificado:** `MapaStaff` revisión 36, 42 campos, 5 registros. Se añadieron al esquema los campos fiscales y de contacto de `DatosFiscales`, además de `recordType` y `active`. Los tres registros staff mantienen sus IDs y roles, se clasifican como `STAFF` y `active=true`. La fila QA fiscal se copió a `MapaStaff` con el mismo ID y `recordType=TERCERO`. Se creó `GESTORIA` `NachoGest` con dirección `Calle Burgos 25`, teléfono `666724634` y email `nachoortegazgz@gmail.com`; no se le asigna identidad Wix ni rol. No existe `CONFIG_SISTEMA`.

**Seguridad:** lectura `MapaStaff=PRIVILEGED`; insert/update/remove=`CMS_EDITOR`. La capa `dataAccess.js` utiliza `auth.elevate` en consultas y escrituras backend. El frontend no accede directamente al CMS. El WebMethod de destinatarios incorpora `phone` y `address` como campos adicionales del DTO.

**Código en rama** `feat/consolidate-fiscal-master-mapastaff-v2`: `internalConfig.js`, `validation.js`, `data.js`, `dataAccessPolicy.js`, `eventLog.js`, `fiscalAggregator.web.js`, `fiscalDocuments.web.js`, `events.js` y tests asociados alineados con el maestro mixto. `events.js` filtra explícitamente `recordType=STAFF`, para evitar que la gestoría se interprete como recurso de Bookings. RBAC sigue dependiendo de Wix Members/Bookings y `internalConfig.STAFF.WEBSITE_ROLE_BY_RESOURCE_ID`; MapaStaff no gobierna permisos.

**Compatibilidad y secuencia de retirada:** `DatosFiscales` permanece temporalmente con su placeholder QA porque el runtime Wix publicado todavía puede ejecutar código anterior. Eliminarla antes de publicar el backend migrado produciría fallos en consultas y hooks. La retirada se ejecutará solo después de CI, revisión del diff, despliegue autorizado y pruebas read-after-write de los WebMethods y hooks. No se ha publicado código Wix ni se ha eliminado la colección en este corte.---

## Addendum de autoridad y fase QA — 2026-11-14

### Jerarquía de autoridad y SSOT

1. **USUARIO / PROPIETARIO DEL PROYECTO — SSOT de negocio y gobierno.** El usuario es la única fuente de verdad para objetivos, requisitos, prioridades, criterios de aceptación, decisiones funcionales y autorizaciones del proyecto. Sus instrucciones expresas prevalecen sobre cualquier regla, restricción, supuesto o estado histórico de esta documentación. Las decisiones relevantes se registran en el Decision Log para trazabilidad; el registro no sustituye ni limita la autoridad del usuario.
2. **Documentación oficial vigente de Wix y de cada integración — autoridad técnica.** Define contratos, APIs, permisos, límites y comportamiento de plataforma. Se aplica para ejecutar la decisión del usuario de forma técnicamente válida; si una limitación oficial impide cumplirla, se informa y se propone alternativa, sin cambiar unilateralmente el requisito.
3. **Decisiones expresas del usuario registradas en el repositorio.** Son la memoria documental de las decisiones vigentes. Si un registro antiguo contradice una instrucción posterior, prevalece la instrucción posterior del usuario.
4. **Dossier Técnico Consolidado, Dossier de Flujos, Directrices, Necesidades Web, diccionario CMS y estado del proyecto.** Son documentación derivada y subordinada a los niveles anteriores. No pueden crear autorizaciones, bloqueos o requisitos nuevos por inferencia.
5. **Código, configuración Wix, CMS y pruebas.** Acreditan el estado implementado, no la autoridad para redefinir requisitos. Las diferencias entre lo solicitado, documentado e implementado se registran como discrepancias verificables.

### Política temporal de desarrollo y pruebas

**Vigencia:** fase actual de desarrollo, depuración y QA, hasta que el usuario ordene expresamente habilitar las protecciones para el despliegue.

- Queda **en pausa la política append-only** durante esta fase. Ninguna colección o registro se considerará intocable únicamente por estar etiquetado como ledger, histórico, fiscal, contable, laboral, documental o append-only.
- Queda **en pausa toda prohibición genérica de edición o eliminación de registros**, tanto individual como masiva, cuando la única causa del bloqueo sea la inmutabilidad/append-only o una restricción temporal de QA. La edición y eliminación forman parte de las operaciones permitidas durante las pruebas.
- No se exigirán registros rectificativos como única vía de corrección durante esta fase de QA. Esa regla se reconsiderará cuando el usuario habilite expresamente las protecciones previas al despliegue.
- Se mantienen las validaciones de esquema y tipos, la autenticación, autorización y permisos de acceso, la protección de secretos, la separación de capas, los controles de seguridad no relacionados con la inmutabilidad y la trazabilidad técnica de las pruebas. Esta pausa no autoriza accesos anónimos ni saltarse controles de identidad.
- No se habilitan por esta decisión writers fiscales, contables, laborales, pagos, devoluciones, comunicaciones ni automatizaciones externas que tengan gates funcionales independientes. Esos gates solo se modificarán por instrucción expresa o por una decisión técnica aprobada por el usuario.
- La pausa es temporal y **no se revierte automáticamente**. Solo el usuario puede ordenar la restauración y habilitación de las protecciones para despliegue. Antes de una publicación productiva, el estado de las protecciones debe revisarse con el usuario y quedar expresamente autorizado.

### Estado de implementación y publicación

El usuario declara que el código está integrado y publicado en Wix. Esta declaración se registra como **declaración del propietario**. En la consulta de GitHub de este corte, el PR #344 (feat/consolidate-fiscal-master-mapastaff-v2) figura fusionado el 2026-11-14 mediante el merge commit f3b1311eead05282e47f538afd506fe49e227141, que es el HEAD actual de main. La integración del cambio en Git está verificada. El usuario declara además que el código está publicado en Wix; no se dispone de un identificador de publicación Wix que vincule el runtime con ese SHA concreto.

**Nota de ejecución:** este addendum modifica la autoridad documental y la política de trabajo. No demuestra por sí mismo que todos los hooks, WebMethods, políticas de escritura o permisos CMS del runtime Wix hayan sido modificados para permitir todas las operaciones de edición y eliminación. Esa correspondencia debe verificarse en código y en Wix antes de afirmar que la pausa está aplicada técnicamente de extremo a extremo.

## Vigencia operativa — fase de desarrollo y QA (2026-11-14)

**Autoridad:** el usuario/propietario es la SSOT de negocio, requisitos, prioridades, criterios de aceptación y autorizaciones. Las instrucciones expresas posteriores del usuario prevalecen sobre decisiones y restricciones documentales anteriores. La documentación oficial de Wix y de las integraciones gobierna únicamente los contratos y límites técnicos de la plataforma.

**Mutabilidad CMS durante QA:** append-only e inmutabilidad están temporalmente en pausa. Se habilitan update y remove individuales y masivos para todas las colecciones CMS propias del proyecto, incluidas las históricamente tratadas como ledgers. Las operaciones masivas deben identificar explícitamente los registros por ID. No se habilitan escrituras en colecciones propiedad de Wix Apps ni se eluden autenticación, autorización/RBAC, permisos, validaciones de esquema, integridad técnica, secretos o límites de plataforma. La inserción mantiene su allowlist; los writers fiscales/contables/laborales, pagos, reembolsos, comunicaciones y efectos externos conservan sus gates funcionales independientes.

**Restauración:** esta política no se revierte automáticamente. Solo el usuario puede ordenar la restauración de append-only y de las restricciones de mutación para preparar el despliegue. No publicar a producción basándose únicamente en esta excepción de QA.

**Estado Git/Wix:** PR #344–#351 están integradas en main; HEAD al inicio de la reconciliación `79b6238fe4c23206bb8e81327191ab48425e3a0d`. PR #351 introdujo una regresión al retirar validadores aún consumidos; su recuperación está en PR #352 y CI queda pendiente. La publicación del sitio está declarada/verificada como estado del sitio, pero no existe release ID que vincule runtime y SHA. No se ha publicado esta tanda.

**CMS maestro:** MapaStaff revisión live 105, 56 campos físicos. Inventario live: 41 colecciones (12 NATIVE, 29 WIX_APP), 980 campos. `DatosFiscales`, `InventarioStockVenta` y `MovimientosInventario` no existen en este corte (404 / WDE0025); sus menciones en este documento son históricas salvo nueva evidencia.

---

## Addendum de vigencia técnica — 2026-11-14

Los requisitos de negocio se conservan; los estados históricos no acreditan funcionamiento actual. Prevalece [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md) para el estado real de código, CMS y QA.

El esquema live de `CajaActual` está en revisión 64 y contiene 59 campos personalizados + 4 campos de sistema (63 físicos): sesión/apertura, último ticket y conceptos, precios/impuestos, pago, trazabilidad y acumulados. `cashRegisterStatus` es el único estado de sesión; `operationDateHour:DATETIME` y los cuatro campos `opening*Amount` están definidos. Tipos y dependencias: `DICCIONARIO_DATOS_CMS.md` §3.1. El último readback previo documentaba el singleton cerrado, con saldos iniciales null y saldos actuales a cero; este estado no se ha vuelto a comprobar en el corte de revisión 64. La presencia de esos campos en CMS no acredita su persistencia desde backend: sigue pendiente el WebMethod seguro de apertura y la validación E2E de apertura, ticket, conceptos, pagos y referencias. El permiso live `read=ANYONE` está pendiente de revisión de seguridad.

TEC-033 permite pruebas controladas de registros sintéticos en una rama de desarrollo. Se han eliminado dos fichajes QA explícitamente sintéticos; no se han borrado datos reales ni activado writers. El sitio Published no es un entorno de E2E aislado. **Desfase de despliegue:** el runtime Published no está acreditado con este contrato ni con esta rama. El backend/DTO actualizado existe solo en Git; no se ha desplegado. Aunque Wix Data no aplica el esquema como validación estricta de cada payload, el comportamiento del código publicado frente al esquema nuevo no se ha probado. No ejecutar operaciones de caja en live hasta completar CI, validación en QA aislado y despliegue autorizado.

## Aviso de vigencia — 2026-11-11

Este documento recoge necesidades y criterios de aceptación de negocio. Las etiquetas históricas "declarado", "implementado" o "verificado" no equivalen a evidencia vigente. Para saber qué existe realmente, qué está cubierto por mocks y qué requiere Wix Runtime, consultar [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md) y la evidencia de cada prueba. El sitio Wix está actualmente **Published** y no debe tratarse como entorno QA aislado. No ejecutar pruebas que generen reservas, pagos, comunicaciones o datos de cliente sobre ese sitio.

---

# HOJA DE CUMPLIMIENTO — WEB MARIANMADRID.ES

**Documento consolidado de requisitos, necesidades y criterios de aceptación**

**Proyecto:** Sitio web marianmadrid.es — Marian Madrid Peluquería y Estética
**Titular:** Marian Madrid (Propietaria y Directora)
**Desarrollador:** Nacho Ortega (Arquitectura Wix & Velo)
**Repositorio de referencia:** nachoortegazgz/marianmadridz
**Entorno:** Wix Editor Classic / Velo (Node.js)
**Fecha de revisión:** 09-11-2026
**Estado:** Requisitos conservados; estados actualizados con inspección de `main` `cad48c04` y consultas Wix read-only. Las pruebas runtime siguen pendientes.


> **Criterio de estados (revisión 09-11-2026):** «Verificado» requiere evidencia en código, API nativa o prueba identificada. Una app Wix instalada no acredita una personalización propia. Las consultas REST/CMS de esta revisión fueron de solo lectura; no equivalen a ejecución de WebMethods, E2E ni publicación del HEAD.

---

## 1. Resumen ejecutivo

El sitio web no debe ser un escaparate estático. Debe ser una **herramienta de gestión profesional** que:

1. Gestión profesional de las reservas online de servicios de peluquería y estética simples y duales con gap de tiempo entre sus fases que libere al profesional en la agenda de reservas, permitiendole aceptar otros servicios en ese hueco de tiempo entre fases.
2. Permita solapar servicios durante tiempos muertos (ejemplo: gap de tiempo entre fases para exposición de tintes).
3. Posibilidad de activar y detallar cantidad de la fianza en reservas online para protejer reservas online contra citas fantasma.
4. Cumpla estrictamente con la normativa fiscal española (Veri*factu / RD 1007/2023), laboral (RD-ley 8/2019) y de protección de datos (RGPD / AEPD).
5. Automatice la coordinación con la gestoría (exportación CSV/Excel normalizada).
6. Ofrezca una experiencia de cliente profesional, fiable y coherente con la marca.

---

## 2. Requisitos funcionales por área

### 2.1. Motor de reservas inteligente (Prioridad 🔴 Crítica)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-01 | Reserva online 24/7 | La clienta debe poder reservar sin depender del teléfono. | Flujo completo de selección de servicio, fecha, hora y confirmación funcional en producción. | PARCIAL; Wix Bookings devuelve servicios y disponibilidad en lectura. No se ha ejecutado creación de reserva, confirmación ni checkout E2E. |
| RF-02 | Tiempos fraccionados / solapables | Un servicio con fases (ej. Babylights: 150 min configurados en CMS/Bookings al 09-11-2026) debe dividirse en fases: aplicación (staff ocupado), exposición (staff liberado, sillón ocupado), lavado/peinado (staff ocupado). | El algoritmo de disponibilidad libera la agenda durante la fase de exposición para permitir cortes rápidos o servicios cortos simultáneos. | VERIFICADO EN CÓDIGO; `reservas.web.js` y saga dual presentes. Lectura Wix: 94/94 servicios CMS↔Bookings y 24/24 vínculos F2 coherentes. E2E runtime pendiente. |
| RF-03 | Configuración de fases por servicio | Cada servicio debe permitir configurar: duración total, minutos de aplicación, minutos de exposición, minutos de acabado. | Campos personalizados en Wix Bookings operativos y leídos correctamente por el backend. | PARCIAL; campos de fases en CMS y servicios nativos conciliados en lectura. Falta probar configuración/edición desde Wix y runtime. |
| RF-04 | Servicios cortos compatibles/complementos | Debe existir catálogo de complementos (ejemplo: secado, manicura) reservables durante la fase de exposición. | Verificado en pruebas: reserva simultánea de tinte + corte sin conflicto de agenda. | PENDIENTE; el catálogo de complementos aparece en código, pero no se ha ejecutado la reserva simultánea de servicios en Wix QA. |
| RF-05 | Sincronización con Google Calendar | La agenda debe sincronizarse con el calendario del salón. | Wix Bookings configurado con sincronización activa. | PENDIENTE DE VERIFICAR; Wix Bookings está instalado, pero no se ha comprobado la sincronización Google Calendar en la configuración del sitio. |

### 2.2. Fianza online / Anti no-shows (Prioridad 🔴 Crítica)

> **Decisión de negocio 2026-11-10:** señal/anticipo fijo de 15 € únicamente para servicios cuyo precio sea estrictamente superior a 100 €; 100 € exactos no activa el anticipo. Se descuenta del precio total. Política ordinaria: cancelación con ≥24 h → devolución íntegra del anticipo o reprogramación sin coste; reprogramación con ≥24 h → transferir íntegro el anticipo a la nueva cita; si cancela el negocio → devolución íntegra. Para menos de 24 h o inasistencia, revisión manual caso por caso; sin retención ni devolución automática hasta aprobar condiciones claras y proporcionadas. Preferencia técnica: depósito nativo Wix Bookings; no crear un motor propio. **Bloqueo P0:** al ser un anticipo, IVA se devenga al cobro (LIVA art. 75.Dos) y debe documentarse con factura (RD 1619/2012 art. 2.1). No activar hasta cerrar Veri*Factu/SIF, ledger del anticipo, saldo y rectificación de devoluciones (issue #209).


| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-06 | Anticipo fijo de reserva para servicios > 100 € | Cobro de un anticipo fijo de 15 € en la reserva para servicios cuyo precio sea estrictamente superior a 100 €. | Servicios ≤100 €: sin anticipo obligatorio. Servicios >100 €: anticipo de 15 €, aplicado al precio total; saldo restante en el salón. | POLÍTICA APROBADA (2026-11-10); NO CONFIGURAR — BLOQUEO P0 FISCAL. 7 servicios visibles elegibles, 0 depósitos activos. No activar hasta demostrar factura/IVA del anticipo, ledger, aplicación del saldo y rectificación de devoluciones bajo SIF/Veri*Factu (issue #209). Wix nativo es preferente; no crear writer propio. |

**Auditoría de servicios y depósitos nativos (Wix REST read-only, 2026-11-10):** 94/94 servicios consultados; 70 `FIXED`, 24 `NO_FEE` (auxiliares F2 ocultos), 0 `VARIED`; 0 depósitos activos. Siete servicios visibles superan 100 EUR; sus IDs, precios y configuración actual están en `docs/adr/2026-11-10-deposit-and-native-inventory.md`. Todos muestran `online=true` e `inPerson=true`; no se detecta `requireManualApproval=true`. No se ha modificado ningún servicio.

| RF-07 | Pasarela de pago segura | Integración mediante Wix Payments, proveedor de pagos nativo de Wix. Los métodos concretos se limitan a los que estén disponibles y habilitados para España y esta cuenta. | Pago procesado por Wix Payments y confirmación recibida mediante el flujo nativo de Wix eCommerce/webhook. | Declarado por el propietario; activación y métodos de la cuenta pendientes de comprobación en el panel. |
| RF-08 | Política de cancelación | Cancelación con ≥24 h: devolución íntegra del anticipo o reprogramación sin coste. Reprogramación con ≥24 h: transferir el anticipo íntegro a la nueva cita. Si cancela el negocio: devolución íntegra. Menos de 24 h/no-show: revisión manual, sin retención ni devolución automática hasta revisión jurídica. | Política Wix Bookings 1440 minutos; devolución/traslado del anticipo y webhook deben probarse en QA. | PARCIAL; 1440 minutos aparece en la política nativa. No se ha probado refund ni webhook E2E. No activar retención automática. |
| RF-09 | Aplicación de la fianza al saldo | El depósito nativo pagado online forma parte del precio del servicio; el cliente abona únicamente el saldo pendiente en persona. | Wix Bookings muestra depósito y saldo pendiente coherentes; el pago inicial y el saldo no duplican ingresos ni IVA. | NATIVO SOPORTADO POR WIX; configuración por servicio y conciliación fiscal/ledger pendientes de QA. No implementar un segundo cobro/descuento personalizado. |

### 2.3. Asistente de IA capilar (Prioridad 🟡 Media)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-10 | Asesoramiento IA | Interfaz interactiva que orienta sobre servicios según facciones, tipo de cabello y necesidades. | Respuesta generada y mostrada al usuario. | NO OPERATIVO; `aiAgent.web.js` devuelve `AI_PROVIDER_NOT_CONFIGURED` y no genera respuestas. |
| RF-11 | Aviso legal obligatorio | Disclaimer visible: "Presupuesto y diagnóstico orientativos sujetos a valoración capilar previa en tocador". | Texto presente en toda respuesta de la IA. | NO OPERATIVO; al no existir respuesta IA activa, no se puede acreditar el aviso legal en cada respuesta. |
| RF-12 | Cuestionario previo obligatorio | Antes de responder, la IA debe recoger: (1) longitud del cabello, (2) tratamientos químicos previos en últimos 6 meses, (3) necesidad principal. | Los 3 campos son obligatorios y se validan antes de llamar a la API. | NO IMPLEMENTADO/NO VERIFICADO; no hay proveedor IA activo ni cuestionario ejecutable en el flujo actual. |
| RF-13 | Prohibición de garantizar resultados | La IA no puede garantizar resultados de color sobre cabellos teñidos previamente sin prueba de mecha. | System prompt con regla no negociable; verificado con test de prompt malicioso. | NO OPERATIVO; no hay proveedor ni system prompt activo que aplique esta regla. |
| RF-14 | Protección de API key | La clave de OpenAI/Claude debe almacenarse en `wix-secrets-backend`, nunca expuesta en cliente. | Verificado: `getSecret("OPENAI_API_KEY")` usado en backend. | NO OPERATIVO; no hay llamada a proveedor IA activa. No se acredita uso de una clave en este flujo. |
| RF-15 | Timeout y fallback | Si la IA tarda > 9 s o devuelve JSON malformado, debe haber respuesta de fallback sin congelar la página. | `AbortController` a 9 s y try/catch de deserialización implementados. | NO OPERATIVO; el backend falla cerrado con `AI_PROVIDER_NOT_CONFIGURED`; no existe respuesta IA de fallback. |

### 2.4. Tarjetas regalo con QR (Prioridad 🟡 Media)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-16 | Emisión de tarjeta regalo | Generación de código único y registro en base de datos (`GiftCards`). | Campos: `cardCode`, `signature`, `initialBalance`, `currentBalance`, `status`. | NO IMPLEMENTADO EN CÓDIGO PROPIO. Wix Gift Cards nativo tiene 1 producto configurado y 0 tarjetas emitidas; no existe `giftCards.web.js` ni writer propio. |
| RF-17 | Firma HMAC-SHA256 | Cada tarjeta debe llevar firma criptográfica infalsificable. | `crypto.createHmac('sha256', secret)` aplicado sobre código + importe. | NO IMPLEMENTADO EN CÓDIGO PROPIO; no se encuentra firma HMAC de tarjetas regalo en `src/`. |
| RF-18 | Generación de QR | El voucher descargable debe incluir código QR único. | Paquete `qrcode` instalado y QR generado en backend. | NO IMPLEMENTADO EN CÓDIGO PROPIO; no se encuentra generador QR propio ni flujo de voucher personalizado. Función nativa pendiente de verificación. |
| RF-19 | Escáner en salón | Página privada `/admin-scanner` protegida por rol para escanear QR desde móvil. | Solo admin/equipo autorizado puede acceder. | NO IMPLEMENTADO; no existe página/controlador `/admin-scanner` en `src/`. |
| RF-20 | Canje con saldo parcial | Al escanear, leer saldo, descontar importe y actualizar estado (`ACTIVE` → `EXHAUSTED`). | Verificado: saldo insuficiente rechazado; saldo parcial actualizado. | NO IMPLEMENTADO EN CÓDIGO PROPIO; no se encuentra writer de saldo parcial/canje de tarjetas regalo. |
| RF-21 | Prevención de fraude/duplicidad | Sanitización de código (`trim().toUpperCase()`) y comprobación atómica de saldo. | Test de manipulación de saldo con firma inválida → rechazado. | NO IMPLEMENTADO EN CÓDIGO PROPIO; no se acredita control atómico ni test de saldo de tarjetas regalo. |
| RF-22 | Envío por email con diseño | Emisión automática por email con diseño elegante del salón. | PENDIENTE DE VERIFICAR EN WIX GIFT CARDS; la app está instalada y existe un producto, pero no se han emitido tarjetas ni probado email. |

### 2.5. Comercio electrónico / La Boutique (Prioridad 🟡 Media)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-23 | Catálogo de productos | Venta de cosmética/capilar con precios y stock. | Wix Stores configurado. | VERIFICADO NATIVO EN LECTURA; Wix Stores Catalog V3 responde, con 24 productos visibles. Checkout E2E pendiente. |
| RF-24 | Gestión y sincronización de stock | Stock y disponibilidad comercial gestionados exclusivamente en Wix Stores Catalog V3 y sus herramientas nativas (panel/app Wix). | El checkout nativo deduce stock al pago; cancelaciones previas a fulfillment restock en Wix si procede; reembolsos solo reponen unidades devueltas y vendibles. Sin proyecciones ni movimientos custom. | MÓDULO CUSTOM RETIRADO EN PR #238; 30/30 inventory items con tracking en una ubicación; Orders Settings `ON_ORDER_PAID`. QA de checkout/cancelación/refund nativo pendiente. |
| RF-25 | Upselling en checkout | Sugerir tratamiento hidratante exprés (+12 €) al reservar Corte de Autor; champú matizador con 10% dto. al comprar bono de mechas. | ⚠️ No declarado en código — **requiere verificación/implementación** |
| RF-26 | Derecho de desistimiento 14 días | Excepción del Art. 103 para cosméticos desprecintados debe estar explícita en Términos y Condiciones. | ⚠️ No declarado — **requiere verificación** |

### 2.6. Fidelización y recurrencia (Prioridad 🟢 Baja)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-27 | Recordatorio WhatsApp/SMS | Mensaje automático a las 4-5 semanas de tinte/corte con enlace de reserva. | ⚠️ No declarado — **requiere implementación** |
| RF-28 | Confirmación y recordatorio 24 h | Mensaje automático de confirmación de cita y recordatorio 24 h antes con enlace para cancelar/modificar. | ⚠️ No declarado — **requiere implementación** |
| RF-29 | Promociones flash horas valle | Programar descuentos dinámicos (ej. 15% cortes martes 10:00-13:00). | ⚠️ No declarado — **requiere implementación** |
| RF-30 | Bonos/suscripciones | Bono de 4 peinados mensuales, bono barba, etc. | ⚠️ No declarado — **requiere implementación** |

### 2.7. Área de usuario y contenido (Prioridad 🟡 Media)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-31 | Registro/login de clientes | Área privada para gestionar perfil, historial de citas y compras. | Wix Members configurado. | APP NATIVA INSTALADA; Wix Members Area. Rutas, permisos y flujo completo de perfil/reservas/compras pendientes de E2E. |
| RF-32 | Blog y contenido social | Integración con Instagram, TikTok, Facebook, YouTube y sección de noticias/consejos. | Wix Blog está instalado y existe la página `/blog`; la integración con redes sociales no está verificada. |
| RF-33 | Formulario de contacto + mapa | Formulario web, Google Maps, teléfonos y WhatsApp directos. | Wix Forms v4: 4 formularios activos. Contacto actualiza CRM; caja manual, X y fichaje no tienen trigger backend. Wix Automations v2: 0 workflows activos y 0 borradores para envíos de formularios. Ubicación de formularios pendiente de verificar en Editor. |
| RF-34 | Catálogo de servicios estructurado | Clasificación por categorías (Básicos & Luxury, Babylights, Corte de Autor, Ritual Barba, Pack Madre e Hija) con precios claros. | VERIFICADO EN LECTURA PARCIAL; CMS y Wix Bookings contienen 94 servicios, 70 visibles y 24 ocultos. La presentación por categorías y precios en la UI publicada requiere revisión visual. |

---

## 3. Requisitos legales y normativos (Prioridad 🔴 Crítica)

### 3.1. Fiscal — Veri*factu / RD 1007/2023 (Ley Antifraude)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RL-01 | Registro de facturación simplificada inalterable | Toda venta web y cada anticipo cobrado (incluida señal de reserva) debe generar la factura/registro fiscal correspondiente, con serie, fecha, base imponible e IVA desglosado. | Serie correlativa sin saltos; anticipo y saldo vinculados sin duplicidad; rectificaciones trazables. | P0 NO VERIFICADO: el SIF/Veri*Factu no está listo; no declarar conformidad ni activar anticipos hasta cerrar issue #209. |
| RL-02 | IVA 21% desglosado | Servicios de peluquería y cosmética tributan al 21%. Precios mostrados con IVA incluido. | Verificado matemáticamente: Babylights 89 € → Base 73,55 € + IVA 15,45 €; Corte 39 € → Base 32,23 € + IVA 6,77 €; etc. Cero desviación por redondeo. | ✅ Declarado |
| RL-03 | Cadena de hashes SHA-256 | Cada movimiento fiscal contiene la huella del anterior (hashChain) para garantizar no alteración. | `previousRecordHash` enlazado; `hash` canónico en caja; `recordHash` en contabilidad. | ✅ Declarado (matriz CMS) |
| RL-04 | Endpoint AEAT ValidarQR | Integración con `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR`. | ⚠️ Declarado en versión inicial; **verificar implementación real** | 🟡 Pendiente verificar |
| RL-05 | Exportación CSV/Excel para gestoría | Archivo normalizado con columnas: Fecha, Nº Factura, Concepto, Base Imponible, % IVA, Cuota IVA, Total, Método Pago. | Delimitador `;`, decimal con `,`, UTF-8 BOM (`\uFEFF`), compatible con A3ASESOR, Contasol, Sage. | NO IMPLEMENTADO; no existe `accountingExport.web.js`, `exportService.js` ni job de exportación CSV/Excel/SharePoint en el árbol actual. |
| RL-06 | Verificación de cuadre | Fila de totales con suma de bases, cuotas y totales. | Verificado: suma exacta al céntimo. | ✅ Declarado |
| RL-07 | NIF emisor/destinatario | Cada factura incluye NIF del salón y NIF/datos del cliente si los solicita. | Campos `NIFEmisor`, `NIFDestinatario` en colección. | ✅ Declarado |

### 3.2. Laboral — Registro de jornada RD-ley 8/2019

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RL-08 | Fichaje inmutable | Registro de entrada, salida y pausa sellado criptográficamente. | Firma HMAC-SHA256 por evento; registros append-only. | PARCIAL; código de jornada en backend, pero el formulario nativo no acredita conexión con el writer y ZONA STAFF mantiene fichaje deshabilitado. E2E runtime pendiente. |
| RL-09 | No manipulación posterior | Ante inspección de trabajo, los datos no pueden haber sido alterados. | Hash chain + registro de `previousRecordHash`. | ✅ Declarado |
| RL-10 | Registro horario staff | Colección `RegistrosHorariosStaff` con `resourceId`, `memberId`, `recordedAt`, `clockEventType`, `traceId`. | PARCIAL/BLOQUEADO; `FORM REGISTRO HORARIO` está activo, pero su `upsertContact` tiene mapping vacío y no invoca el ledger. Wix Automations v2 no devuelve workflows de envío de formularios. ZONA STAFF mantiene flags desactivados; writer/permisos/E2E pendientes. |

### 3.3. RGPD / AEPD — Protección de datos

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RL-11 | Ficha técnica capilar y de salud | Base de datos privada (`ClientHealthAndConsent`) con alergias PPD, sensibilidad cuero cabelludo, historial de fórmulas. | Permisos `Admin Only`; no indexable por Google; no accesible por API pública. | ✅ Declarado (`gdprHealth.web.js`) |
| RL-12 | Consentimiento expreso datos de salud | Casilla independiente, no premarcada, para tratamiento de datos de salud/bienestar. | Registro con fecha, hora e IP. | ✅ Declarado |
| RL-13 | Consentimiento de imagen | Casilla separada para autorizar publicación de fotos "antes y después" en web y redes. | Registro con fecha, hora e IP; revocable. | ✅ Declarado |
| RL-14 | Banner cookies AEPD | Panel con dos botones al mismo nivel: "Aceptar todas" y "Rechazar todas"; configuración granular. | Bloqueo de Meta Pixel, Google Analytics y TikTok Pixel hasta consentimiento. | PENDIENTE DE VERIFICAR CONFIGURACIÓN NATIVA; `masterPage.js` no implementa banner ni bloqueo de scripts. Debe revisarse Consent Manager y comportamiento real en el sitio publicado. |
| RL-15 | Minimización de datos | Solo recoger datos necesarios para la finalidad. | ✅ Declarado |
| RL-16 | Derecho de acceso/rectificación/supresión | La clienta debe poder ejercer sus derechos. | ⚠️ No declarado explícitamente — **requiere verificación** |

### 3.4. Consumo — LSSI-CE y TRLGDCU

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RL-17 | Aviso Legal | Enlace visible en web. | ⚠️ Declarado como "marco legal básico"; **verificar contenido actualizado** | 🟡 Pendiente |
| RL-18 | Política de Privacidad | Enlace visible en web. | ⚠️ **Verificar contenido actualizado** | 🟡 Pendiente |
| RL-19 | Política de Cookies | Enlace visible y coherente con el banner. | ⚠️ **Verificar contenido actualizado** | 🟡 Pendiente |
| RL-20 | Términos y Condiciones de compra | Debe incluir derecho de desistimiento 14 días y excepción Art. 103 para cosméticos desprecintados. | ⚠️ No declarado — **requiere implementación** | 🟡 Pendiente |
| RL-21 | Precios con IVA incluido | Todo precio mostrado al consumidor debe indicar "IVA incl.". | ✅ Declarado en frontend (`reserva-online.js`) | PENDIENTE DE VERIFICAR; no existe controlador `reserva-online.js` en `src/pages/`. La lectura CMS/Bookings devuelve importes, pero no demuestra que la UI publicada indique «IVA incl.» en todos los precios. |

---

## 4. Requisitos técnicos y de calidad

### 4.1. Arquitectura y seguridad

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RT-01 | Web Modules Velo | Los módulos invocables desde frontend usan `.web.js`, `webMethod` y permisos por función. | Todos los módulos backend invocables usan el contrato `.web.js` vigente. | ✅ Declarado |
| RT-02 | Permisos por función | Público: `Permissions.Anyone` (catálogo, disponibilidad, IA). Sensible: `Permissions.Admin` (exportación fiscal, canje bonos, fichas salud). | Verificado en código declarado. | ✅ Declarado |
| RT-03 | Secretos en `wix-secrets-backend` | Claves API y HMAC nunca en cliente. | `getSecret()` usado en backend. | ✅ Declarado |
| RT-04 | `suppressAuth: true` en operaciones admin | Inserciones/consultas administrativas protegidas. | Aplicado en `wixData.insert/query/update` sensibles. | ✅ Declarado |
| RT-05 | `consistentRead: true` | En consultas críticas para erradicar inconsistencias de lectura. | ⚠️ Declarado en dossier inicial; **verificar en código real** | 🟡 Pendiente |
| RT-06 | Extractor polimórfico de precio | Soportar `service.price` como número, objeto `{ amount }` o `service.payment.rate`. | `extractServicePrice()` implementado. | NO IMPLEMENTADO COMO SE ESPECIFICA; `extractServicePrice()` no existe en `src/`. El DTO de reservas convierte `price` con `Number(...)`; no se ha acreditado compatibilidad polimórfica con `{ amount }` o `payment.rate`. |
| RT-07 | Timeout IA | `AbortController` a 9 s. | ⚠️ Declarado en auditoría; **verificar en código real** | NO OPERATIVO; no hay proveedor IA configurado, por lo que no se ejecuta llamada con timeout. |
| RT-08 | Fallback IA | Respuesta estructurada si falla el parseo JSON. | Objeto fallback con claves esperadas. | NO OPERATIVO; no se acredita fallback de respuesta IA porque el proveedor está deshabilitado y el backend falla cerrado. |
| RT-09 | Prevención race condition gift cards | Sanitización + comprobación atómica de saldo. | Test de doble lectura rápida → segunda rechazada. | NO IMPLEMENTADO EN CÓDIGO PROPIO; no hay módulo Gift Cards ni saldo propio sobre el que verificar concurrencia. |
| RT-10 | CSV UTF-8 BOM + `;` + decimal `,` | Compatibilidad con Excel Windows y software contable español. | Cuando se implemente: delimitador `;`, decimal `,`, UTF-8 BOM y pruebas de compatibilidad. | NO IMPLEMENTADO; no existe `accountingExport.web.js` ni serializador CSV de gestoría. |

### 4.2. Persistencia (Wix Data Collections)

| ID | Requisito | Descripción | Estado de verificación |
|---|---|---|---|
| RT-11 | `Bookings/Services` | Catálogo nativo Wix Bookings. | ✅ Declarado |
| RT-12 | `PaidTransactions` | Libro inalterable de auditoría Ley Antifraude. | ✅ Declarado |
| RT-13 | `GiftCards` | Registro de bonos, firmas y saldos. | NO IMPLEMENTADO EN CÓDIGO PROPIO; la app Wix Gift Cards está instalada, pero no existe colección/writer propio `GiftCards` en `src/`. |
| RT-14 | `ClientHealthAndConsent` | Fichas médicas capilares confidenciales. | ✅ Declarado |
| RT-15 | `CitasF2` | Reservas con fases duales y estados; depósito gestionado por Wix Bookings nativo. | La colección no es autoridad del cobro del depósito. Conciliación de pago/depósito pendiente de QA. |
| RT-16 | `MovimientosCaja` | Movimientos fiscales con hash chain. | ✅ Declarado (matriz CMS) |
| RT-17 | `MapaStaff` | Maestro mixto consultivo: STAFF, GESTORIA, TERCERO y CONFIG_SISTEMA; NIF, régimen y Veri*factu. | Migrado live; retirada de DatosFiscales pendiente de despliegue backend |
| RT-18 | `HistoricoCierresZ` | Cierres con totales, hashes y firmas. | ✅ Declarado (matriz CMS) |
| RT-19 | `LibroAsientosContablesDetalle` | Asientos contables con debe/haber. | ✅ Declarado (matriz CMS) |
| RT-20 | `InventarioStockVenta` | Proyección personalizada de stock (LEGACY, no SSOT). | Módulo y writers retirados y fusionados en PR #238; no crear/actualizar maestros. Datos existentes preservados; CI offline verde, QA Wix runtime pendiente. |
| RT-21 | `MovimientosInventario` | Histórico de movimientos personalizado (LEGACY append-only, no SSOT de stock). | No generar nuevos movimientos de stock. Hooks append-only preservan filas existentes sin editar ni borrar; su archivo/retención requiere decisión separada. |
| RT-22 | `ControlOperativo` | Control de reintentos, alertas, deduplicación. | ✅ Declarado (matriz CMS) |
| RT-23 | `RegistrosHorariosStaff` | Fichajes con firma y trazabilidad. | ✅ Declarado (matriz CMS) |
| RT-24 | `MapaStaff` | Relación staff-recursos-servicios. | ✅ Declarado (matriz CMS) |

### 4.3. Calidad y testing

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RT-25 | Parseo de módulos | Todos los módulos deben validar sintácticamente. | 32/32 módulos validados. | CI OFFLINE VERDE en PR #232, run #42671109488: 50 suites, 479 tests, 0 fallos; SDK contracts y ESLint SUCCESS. No equivale a runtime Wix. |
| RT-26 | Integridad de importaciones | Todas las importaciones resueltas. | 524 importaciones verificadas sin errores. | ✅ Declarado — **verificar tras refactor** |
| RT-27 | Test desglose IVA | Conciliación exacta al céntimo en todos los servicios. | 5/5 servicios verificados con 0,00 € desviación. | ✅ Declarado |
| RT-28 | Test criptografía gift cards | Firma HMAC válida; manipulación rechazada. | Test de alteración de saldo → firma inválida. | NO IMPLEMENTADO/NO VERIFICADO; no hay HMAC de Gift Cards propio ni test de manipulación de saldo. |
| RT-29 | Test filtro seguridad IA | Prompt malicioso no altera comportamiento. | Redirección a catálogo oficial. | NO OPERATIVO; proveedor IA no configurado. Los tests offline no acreditan un asistente activo. |
| RT-30 | Tests antirregresión | Detección de 5 riesgos graves subsanados: precio NaN, JSON IA, race condition gift cards, CSV incompatible, RGPD sin control de roles. | PENDIENTE DE RECONCILIAR; los cinco riesgos enumerados son históricos y no están demostrados individualmente por el estado actual de CI. |

---

## 5. Criterios de aceptación globales

El sitio se considerará **APTO PARA PRODUCCIÓN** cuando se cumplan **TODOS** los siguientes:

1. **Verificación real del repositorio:** El desarrollador debe entregar el árbol completo de `src/` (`tree src` o `find src -maxdepth 3`) y demostrar que los módulos declarados existen y contienen la lógica descrita, testada, funcional y fiable. **La solución debe ser honesta, profesional, real y testada para despliegue publico. No se aceptan soluciones greenfield ni nombres inventados.**

2. **Correspondencia módulo ↔ requisito:** Cada módulo del repositorio debe mapearse a los requisitos RF/RL/RT de esta hoja.

3. **Tests ejecutados sobre código real:** Los tests de IVA, HMAC, IA y antirregresión deben ejecutarse contra el código del repositorio, no contra versiones ideales.

4. **Cumplimiento legal verificado:**
   - Facturación simplificada inalterable con serie correlativa.
   - Cadena de hashes SHA-256 operativa.
   - Exportación CSV/Excel compatible con A3/Contasol/Sage.
   - Banner cookies AEPD con dos botones al mismo nivel.
   - Consentimiento imagen y salud registrado con fecha/IP.
   - Registro de jornada con firma HMAC y append-only.

5. **Operativa del salón validada en sesión de pruebas presencial:**
   - Reserva con tinte + corte simultáneo sin conflicto.
   - Escaneo de bono regalo desde móvil.
   - Descarga de CSV para gestoría y validación por el asesor.
   - Flujo de fianza con pago real (entorno de pruebas).

6. **Calidad técnica documentada:** El dossier de calidad debe reflejar el estado real tras cada intervención.

7. **Aprobación de la propietaria:** Marian Madrid debe confirmar que la operativa en pantalla es "tan cómoda como tener las tijeras en la mano".

---

ADDENDUM DE ESTADO Y CRITERIOS DE ACEPTACIÓN — 2026-11-13

Este addendum actualiza el estado de implementación y aceptación. Los requisitos funcionales y legales del documento siguen describiendo necesidades de negocio; un estado histórico “declarado” o un nombre de módulo no demuestra que la función esté operativa en Wix Runtime.

## Estado del ecosistema

- Repositorio canónico: `nachoortegazgz/marianmadridz`; HEAD de `main` consultado: `738eb78faaa48502532c83c3e4b8b53db1144950`.
- El sitio principal Wix está Published y Velo enabled. El propietario declara que ha actualizado y publicado Wix. No se ha acreditado técnicamente que el runtime publicado corresponda exactamente a ese SHA.
- Existe un sitio Wix QA independiente, Draft, Site ID `50b39f33-e753-4331-ab35-b2ed43dc97f7`; no se debe tratar como QA E2E certificado hasta verificar automatizaciones, notificaciones, pagos, webhooks, permisos e integraciones.
- CMS producción: 44 colecciones (15 NATIVE, 29 WIX_APP). CMS QA: 43 (15 NATIVE, 28 WIX_APP), con paridad incompleta de colecciones Wix App.
- Wix Stores producción utiliza Catalog V3; Wix Invoices V1.

## Criterio de clasificación obligatorio

Cada requisito RF/RL/RT debe clasificarse en una de estas categorías, con evidencia y fecha:
1. **Implementado en código:** existe código identificable; no implica runtime operativo.
2. **Verificado en CI:** suite y commit exactos, resultado y workflow identificados.
3. **Verificado en Wix Preview/QA:** sitio, versión, caso y resultado reproducible.
4. **Verificado en producción:** caso real autorizado y evidencia del resultado.
5. **Declarado/documentado:** figura en documentación o configuración, pero no ha superado una prueba ejecutada.
6. **No implementado / pendiente / no aplicable:** justificarlo; no inferir cumplimiento.

No marcar como cumplido un requisito legal o de negocio únicamente por existir una colección, un campo, un módulo o una prueba mock.

## Bloqueos y criterios de aceptación vigentes

- Reserva/proyección: CitasF2 contiene 1 item `CONFIRMED / NOT_PAID`; la última lectura Bookings Reader V2 registrada para el mismo bookingId era `CANCELED / NOT_PAID`. Mantener P1 hasta reconciliar la lectura nativa y la proyección tras la publicación declarada.
- Fiscal/contable/laboral: writers permanecen deshabilitados. `MapaStaff` conserva el tercero placeholder QA; falta `CONFIG_SISTEMA`. `DatosFiscales` permanece temporalmente por compatibilidad hasta publicar el backend migrado. No emitir, cobrar, exportar ni escribir ledgers hasta aprobación de asesoría y QA runtime.
- Capa 3: SharePoint / Power Automate no están acreditados como flujo operativo live.
- Inventario: Wix Stores Catalog V3 es la autoridad operativa; colecciones legacy personalizadas no deben convertirse en fuente de stock.
- Entorno QA: existe un segundo sitio Wix Draft, pero no tiene paridad completa de CMS Apps y su aislamiento externo no está certificado.
- El detalle de inventario, checklist P0–P4 y evidencia se mantiene en `ESTADO_ACTUAL_PROYECTO.md`.

## Checklist mínimo antes de declarar APTO

- [ ] Mapear cada RF/RL/RT a código, contrato, consumidor y prueba existente.
- [ ] Ejecutar CI sobre el SHA exacto candidato; registrar suites, tests y workflow URLs.
- [ ] Vincular la versión publicada de Wix al SHA o artefacto exacto; no basta el estado Published.
- [ ] Validar en el sitio QA aislamiento de automatizaciones, emails, SMS/WhatsApp, pagos, webhooks y permisos.
- [ ] Cerrar la divergencia Bookings ↔ CitasF2 y validar reservas simples/duales, concurrencia e idempotencia.
- [ ] Validar privacidad, consentimientos, roles y minimización de datos en runtime.
- [ ] Obtener aprobación de asesoría para los procesos fiscales, contables y laborales antes de habilitar escritores.
- [ ] Validar export y archivo Capa 3 end-to-end sin retorno de datos a Capa 1.
- [ ] Obtener aceptación operativa de la propietaria.

---

## Addendum de autoridad y fase QA — 2026-11-14

### Jerarquía de autoridad y SSOT

1. **USUARIO / PROPIETARIO DEL PROYECTO — SSOT de negocio y gobierno.** El usuario es la única fuente de verdad para objetivos, requisitos, prioridades, criterios de aceptación, decisiones funcionales y autorizaciones del proyecto. Sus instrucciones expresas prevalecen sobre cualquier regla, restricción, supuesto o estado histórico de esta documentación. Las decisiones relevantes se registran en el Decision Log para trazabilidad; el registro no sustituye ni limita la autoridad del usuario.
2. **Documentación oficial vigente de Wix y de cada integración — autoridad técnica.** Define contratos, APIs, permisos, límites y comportamiento de plataforma. Se aplica para ejecutar la decisión del usuario de forma técnicamente válida; si una limitación oficial impide cumplirla, se informa y se propone alternativa, sin cambiar unilateralmente el requisito.
3. **Decisiones expresas del usuario registradas en el repositorio.** Son la memoria documental de las decisiones vigentes. Si un registro antiguo contradice una instrucción posterior, prevalece la instrucción posterior del usuario.
4. **Dossier Técnico Consolidado, Dossier de Flujos, Directrices, Necesidades Web, diccionario CMS y estado del proyecto.** Son documentación derivada y subordinada a los niveles anteriores. No pueden crear autorizaciones, bloqueos o requisitos nuevos por inferencia.
5. **Código, configuración Wix, CMS y pruebas.** Acreditan el estado implementado, no la autoridad para redefinir requisitos. Las diferencias entre lo solicitado, documentado e implementado se registran como discrepancias verificables.

### Política temporal de desarrollo y pruebas

**Vigencia:** fase actual de desarrollo, depuración y QA, hasta que el usuario ordene expresamente habilitar las protecciones para el despliegue.

- Queda **en pausa la política append-only** durante esta fase. Ninguna colección o registro se considerará intocable únicamente por estar etiquetado como ledger, histórico, fiscal, contable, laboral, documental o append-only.
- Queda **en pausa toda prohibición genérica de edición o eliminación de registros**, tanto individual como masiva, cuando la única causa del bloqueo sea la inmutabilidad/append-only o una restricción temporal de QA. La edición y eliminación forman parte de las operaciones permitidas durante las pruebas.
- No se exigirán registros rectificativos como única vía de corrección durante esta fase de QA. Esa regla se reconsiderará cuando el usuario habilite expresamente las protecciones previas al despliegue.
- Se mantienen las validaciones de esquema y tipos, la autenticación, autorización y permisos de acceso, la protección de secretos, la separación de capas, los controles de seguridad no relacionados con la inmutabilidad y la trazabilidad técnica de las pruebas. Esta pausa no autoriza accesos anónimos ni saltarse controles de identidad.
- No se habilitan por esta decisión writers fiscales, contables, laborales, pagos, devoluciones, comunicaciones ni automatizaciones externas que tengan gates funcionales independientes. Esos gates solo se modificarán por instrucción expresa o por una decisión técnica aprobada por el usuario.
- La pausa es temporal y **no se revierte automáticamente**. Solo el usuario puede ordenar la restauración y habilitación de las protecciones para despliegue. Antes de una publicación productiva, el estado de las protecciones debe revisarse con el usuario y quedar expresamente autorizado.

### Estado de implementación y publicación

El usuario declara que el código está integrado y publicado en Wix. Esta declaración se registra como **declaración del propietario**. En la consulta de GitHub de este corte, el PR #344 (feat/consolidate-fiscal-master-mapastaff-v2) figura fusionado el 2026-11-14 mediante el merge commit f3b1311eead05282e47f538afd506fe49e227141, que es el HEAD actual de main. La integración del cambio en Git está verificada. El usuario declara además que el código está publicado en Wix; no se dispone de un identificador de publicación Wix que vincule el runtime con ese SHA concreto.

**Nota de ejecución:** este addendum modifica la autoridad documental y la política de trabajo. No demuestra por sí mismo que todos los hooks, WebMethods, políticas de escritura o permisos CMS del runtime Wix hayan sido modificados para permitir todas las operaciones de edición y eliminación. Esa correspondencia debe verificarse en código y en Wix antes de afirmar que la pausa está aplicada técnicamente de extremo a extremo.

## Vigencia operativa — fase de desarrollo y QA (2026-11-14)

**Autoridad:** el usuario/propietario es la SSOT de negocio, requisitos, prioridades, criterios de aceptación y autorizaciones. Las instrucciones expresas posteriores del usuario prevalecen sobre decisiones y restricciones documentales anteriores. La documentación oficial de Wix y de las integraciones gobierna únicamente los contratos y límites técnicos de la plataforma.

**Mutabilidad CMS durante QA:** append-only e inmutabilidad están temporalmente en pausa. Se habilitan update y remove individuales y masivos para todas las colecciones CMS propias del proyecto, incluidas las históricamente tratadas como ledgers. Las operaciones masivas deben identificar explícitamente los registros por ID. No se habilitan escrituras en colecciones propiedad de Wix Apps ni se eluden autenticación, autorización/RBAC, permisos, validaciones de esquema, integridad técnica, secretos o límites de plataforma. La inserción mantiene su allowlist; los writers fiscales/contables/laborales, pagos, reembolsos, comunicaciones y efectos externos conservan sus gates funcionales independientes.

**Restauración:** esta política no se revierte automáticamente. Solo el usuario puede ordenar la restauración de append-only y de las restricciones de mutación para preparar el despliegue. No publicar a producción basándose únicamente en esta excepción de QA.

**Estado Git/Wix:** PR #344–#351 están integradas en main; HEAD al inicio de la reconciliación `79b6238fe4c23206bb8e81327191ab48425e3a0d`. PR #351 introdujo una regresión al retirar validadores aún consumidos; su recuperación está en PR #352 y CI queda pendiente. La publicación del sitio está declarada/verificada como estado del sitio, pero no existe release ID que vincule runtime y SHA. No se ha publicado esta tanda.

**CMS maestro:** MapaStaff revisión live 105, 56 campos físicos. Inventario live: 41 colecciones (12 NATIVE, 29 WIX_APP), 980 campos. `DatosFiscales`, `InventarioStockVenta` y `MovimientosInventario` no existen en este corte (404 / WDE0025); sus menciones en este documento son históricas salvo nueva evidencia.

---

## Addendum obligatorio — estado QA/CMS (2026-11-14)

**HISTÓRICO — TEC-033, sustituida por TEC-037.** Ya no se limita la mutación a update/remove individuales ni se mantiene bulk bloqueado. La política QA actual habilita update/remove individual y masivo en colecciones CMS propias, incluidos ledgers; los IDs deben ser explícitos. Se mantienen la autenticación, autorización, permisos, validaciones, allowlist de inserción y gates funcionales de writers/efectos externos. Solo el usuario ordenará restaurar append-only antes del despliegue.

`CajaActual` live está en revisión 64: 59 campos personalizados + 4 campos de sistema (63 físicos), con datos de sesión, apertura, ticket/conceptos, importes/impuestos, pago, trazabilidad y saldos por medio. `cashRegisterStatus` es el único estado de sesión; `isOpen` no existe en el esquema. El permiso CMS `read=ANYONE` requiere revisión de seguridad antes de almacenar datos reales de cliente. No existe todavía WebMethod de apertura para persistir los saldos iniciales. El esquema y las dependencias por campo están en [DICCIONARIO_DATOS_CMS.md](DICCIONARIO_DATOS_CMS.md) §3.1; el estado de pruebas y despliegue está en [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md). **Desfase de despliegue:** el runtime Published no está acreditado con este contrato ni con esta rama. El backend/DTO actualizado existe solo en Git; no se ha desplegado. Aunque Wix Data no aplica el esquema como validación estricta de cada payload, el comportamiento del código publicado frente al esquema nuevo no se ha probado. No ejecutar operaciones de caja en live hasta completar CI, validación en QA aislado y despliegue autorizado.

DIRECTRICES DE ARQUITECTURA, DESARROLLO Y QA
Proyecto: Marian Madrid — www.marianmadrid.es
Repositorio: nachoortegazgz/marianmadridz
Revision: 2026-11-09

1. AUTORIDAD Y FUENTES

1.1. Orden de autoridad
1) SSOT. Documentacion oficial vigente de Wix, Wix Apps y SDKs integrados. Comprueba que consultas la version correcta recomendada y actualizada de cada documento.
2) Referencia. Dossier Tecnico Consolidado y Dossier de Flujos End-to-End.
3) Este documento.
4) Necesidades Web y criterios de aceptacion.

1.2. Resolucion de contradicciones
- El contrato oficial del proveedor prevalece sobre comentarios o ejemplos internos.
- El codigo ejecutable y sus pruebas describen el comportamiento implementado.
- El dossier debe reflejar el comportamiento comprobado, no definir contratos distintos.
- Cada decision debe registrar la opcion elegida y su razon tecnica. No mantener instrucciones incompatibles.

2. INVARIANTES DE ARQUITECTURA

- Wix CMS es la fuente de verdad transaccional.
- SharePoint custodia evidencia documental y no gobierna transacciones.
- La Capa 3 no modifica ni dirige datos de la Capa 1.
- El frontend presenta y recoge datos; la logica de negocio reside en backend y WebMethods.
- Las constantes compartidas se centralizan en internalConfig.js.
- Las validaciones puras se centralizan en validation.js.
- La autenticacion, autorizacion y permisos se comprueban en backend.
- Los secretos nunca se incluyen en frontend, DTOs ni logs.
- Los eventos, webhooks y procesos asincronos son idempotentes.
- Los ledgers fiscales, contables y laborales son append-only. Las rectificaciones se registran como nuevos documentos trazables.
- No se realizan escrituras de prueba en datos reales del CMS.

3. CONTRATOS WIX ADOPTADOS

3.1. Web Modules
- Los modulos de acceso frontend usan archivos .web.js.
- Cada WebMethod declara su permiso mediante webMethod(Permissions.Anyone), Permissions.SiteMember o Permissions.Admin, segun el caso de uso.
- La autorizacion de negocio se vuelve a comprobar dentro del backend.
- processDualBooking exige Permissions.SiteMember y resuelve memberId/contactId desde la sesion Wix.
- No se utiliza permissions.json porque el backend no contiene modulos .jsw. La autorizacion de los modulos .web.js se define en cada WebMethod.

3.2. Backend events
- `events.js` contiene manejadores Velo gestionados por Wix.
- Wix entrega al handler el objeto de evento ya verificado y decodificado.
- Los eventos se procesan como handlers Velo; no se implementa un endpoint HTTP de recepción de webhooks.
- Los handlers de este sitio aceptan objetos de evento y no procesan JWT raw.
- La verificacion manual de JWT pertenece a endpoints HTTP autoalojados; este proyecto no implementa esa ruta.
- La entrega puede repetirse o llegar fuera de orden. La deduplicacion se realiza mediante eventId y ControlOperativo.WEBHOOK_EVENT.

3.3. Wix Bookings V2
- La disponibilidad usa timeZone.
- La creacion de reservas usa timezone.
- Los objetos Writer usan resource._id y location._id conforme al contrato SDK adoptado.
- La saga dual crea dos reservas independientes F1/F2 con pairToken y SLOT_LOCK.
- El Writer conserva las validaciones nativas de disponibilidad y opcion de pago. No se habilitan bypasses en la saga dual.
- No se utiliza createMultiServiceBooking para el servicio con gap de exposicion.
- rescheduleBooking recibe bookingId, slot y options; revision pertenece a options.

4. CMS Y VALIDACION

4.1. ControlOperativo
- beforeInsert normaliza y ejecuta assertControlOperativo.
- beforeUpdate recupera el registro persistido mediante lectura fuerte, fusiona la modificacion, impide cambiar controlType, protege tipos inmutables y valida el resultado completo.
- beforeRemove recibe itemId; recupera el registro y bloquea la eliminacion de WEBHOOK_EVENT.
- Toda operacion de parche atomico valida sus invariantes en el writer antes de ejecutar el cambio y usa condiciones de version cuando corresponda.
- WEBHOOK_EVENT es inmutable.
- SLOT_LOCK exige resourceId GUID y expiresAt valido.
- WEBHOOK_EVENT exige eventId.
- Todos los controles exigen controlType, dedupeKey y traceId.

4.2. ServiciosCatalogo
- En servicios duales, totalDuration es la suma exacta de phase1Duration, exposureDuration y phase2Duration.
- Si totalDuration no se informa y las fases suman un valor positivo, el hook calcula el total.
- Si se informa un total distinto, la escritura se rechaza.
- Las duraciones deben ser valores numericos finitos no negativos.

4.3. MapaStaff
- MapaStaff es un maestro mixto consultivo con recordType obligatorio: STAFF, GESTORIA, TERCERO o CONFIG_SISTEMA.
- STAFF conserva la correlacion staffMemberId -> resourceId/scheduleId; los lectores deben filtrar recordType=STAFF y active=true.
- GESTORIA almacena datos de contacto y gestion; no es usuario del sitio, no tiene memberId/resourceId ni roles.
- TERCERO y CONFIG_SISTEMA conservan el contrato fiscal; CONFIG_SISTEMA no se crea por inferencia.
- MapaStaff no es autoridad RBAC. security.js resuelve roles mediante Wix Members, Bookings Staff Members API e internalConfig.STAFF.WEBSITE_ROLE_BY_RESOURCE_ID.
- La lectura CMS es PRIVILEGED; las consultas backend pasan por dataAccess elevado. No exponer datos de contacto/fiscales desde frontend ni permisos ANYONE.
- Los hooks CMS y validation.js validan los discriminadores y sus campos especificos.
- DatosFiscales permanece legacy hasta que el backend actualizado se publique y se verifique; eliminarla despues de la comprobacion de consumidores.
4.4. Datos historicos fiscales
- Los documentos fiscales append-only no se reescriben para normalizar nombres de campo.
- Los lectores de `MovimientosCaja`, `ControlOperativo` y `CitasF2` pueden interpretar valores historicos exclusivamente en lectura, con `warn` trazable y fecha `REVIEW-BY`.
- Los campos `ONLINE` de `paymentMethod`, `payloadJson` y `meta.paymentMethod` no se aceptan en escrituras nuevas.
- Toda escritura nueva utiliza `WIX_PAYMENTS`, `payload` y `channelType` como contratos canonicos.
- No se retira un lector historico hasta verificar el contenido CMS y demostrar cero lecturas.

5. SEGURIDAD Y PRIVACIDAD

- No confiar en IDs, roles, permisos, importes ni propiedad enviados por el navegador.
- Validar en backend identidad Wix, propiedad del recurso y rol requerido.
- Aplicar minimo privilegio y usar elevation solo para operaciones de sistema justificadas.
- No exponer hashes fiscales, claves, tokens bearer, PII innecesaria ni notas internas.
- Los tokens de visualizacion son opacos, ligados a una reserva, de un solo uso y con caducidad.
- Los errores publicos no deben permitir enumerar reservas, miembros ni datos fiscales.

6. CONCURRENCIA E IDEMPOTENCIA

- Las reservas simples y duales revalidan disponibilidad en servidor.
- SLOT_LOCK usa version, lockToken y expiracion.
- La saga dual mantiene journal de reprogramacion en ControlOperativo con estados propios del dominio.
- Un resultado incierto de Writer bloquea el reintento ciego y requiere reconciliacion por identidad e idempotencia.
- Los webhooks se deduplican por eventId antes de mutar datos.
- Los claims durables de DEDUPE_KEY y LEDGER_IDEMPOTENCY no se purgan con la retencion corta de IDEMPOTENCY.
- DISPLAY_TOKEN se consume mediante eliminacion condicionada; la garantia de concurrencia debe probarse en Wix QA.

7. TESTING Y CRITERIOS DE ACEPTACION

Cada cambio debe incluir pruebas proporcionales al riesgo:
- Unitarias de validacion y transformacion.
- Contratos de SDK y WebMethods.
- Integracion de acceso CMS y hooks.
- Regresion de reservas, pagos y sagas.
- Idempotencia y concurrencia.
- Seguridad y permisos.
- Pruebas end-to-end en Wix Preview y en sitio publicado cuando proceda.

Los mocks offline no acreditan comportamiento de Wix CMS, permisos efectivos, hooks ni concurrencia real. El informe debe separar:
- Verificado en codigo.
- Verificado en CI.
- Verificado en Wix Preview.
- Verificado en sitio publicado.
- Pendiente de comprobar.

8. CONTROL DE CAMBIOS

1) Identificar HEAD y estado del repositorio.
2) Crear rama de trabajo.
3) Localizar consumidores, contratos y dependencias.
4) Consultar documentacion oficial vigente.
5) Definir comportamiento y pruebas de aceptacion.
6) Implementar el cambio minimo.
7) Ejecutar lint y suites pertinentes.
8) Revisar diff y resultados de CI.
9) Preparar reversibilidad.
10) Abrir PR para revision.
11) Fusionar solo con aprobacion.
12) Desplegar Wix solo con autorizacion expresa y QA aprobado.
13) Verificar el resultado en el entorno destino.

No fusionar ni desplegar con pruebas fallidas, riesgos criticos abiertos o sin estrategia de recuperacion. No modificar workflows de CI sin necesidad demostrada y aprobacion.

9. DECISIONES CONSOLIDADAS DE LA REVISION CAPA 1 — 2026-11-09

- ControlOperativo: validacion completa en insercion y actualizacion; update fusiona el estado persistido y la modificacion; remove recibe itemId y consulta el registro.
- Journal dual: mantiene su enum especifico en booking/dualRescheduleJournal.js; no se mezcla con CONTROL_STATUS.
- MapaStaff: maestro consultivo mixto; solo los registros STAFF participan en la correlacion de eventos nativos; nunca gobierna RBAC.
- Eventos Wix: se consumen como objetos Velo verificados por la plataforma; no se procesa JWT dentro de events.js.
- Permisos: .web.js controla acceso en cada webMethod; no existe manifiesto permissions.json aplicable al backend actual.
- Control types: DEDUPE_KEY y LEDGER_IDEMPOTENCY se conservan porque tienen productores activos y retencion duradera.
- Servicios duales: `totalDuration` debe coincidir exactamente con la suma de las tres fases; si se omite, el hook lo calcula.
- BOOKING_STATUS.UPDATED no existe como estado. CANCELED es la grafia canonica.
- PAYMENT_STATUS.NOT_PAID es el valor persistido; no se utiliza UNPAID en el contrato CMS.
- Los lectores de documentos fiscales y de proyecciones operativas historicas se conservan en modo lectura, con aviso trazable y `REVIEW-BY`; no pueden generar escrituras con valores o nombres anteriores.

10. VALIDACION PENDIENTE EN WIX

La implementacion en GitHub no acredita por si sola el comportamiento del runtime. Antes de fusionar o desplegar deben ejecutarse:
- Hook ControlOperativo_beforeUpdate con heartbeat, renovacion, liberacion y parche parcial.
- Hook ControlOperativo_beforeRemove con WEBHOOK_EVENT y SLOT_LOCK.
- Invocacion anonima y autenticada de processDualBooking.
- Doble consumo simultaneo de DISPLAY_TOKEN.
- Reprogramacion dual: bulkPatch, fencing, heartbeat, expiracion y recuperacion.
- Entrega repetida y desordenada de eventos Bookings/eCommerce.
- Duracion exacta de servicios duales mediante CMS.



11. CHECKPOINT DE VALIDACION GITHUB — 2026-11-09

- Rama: fix/capa1-audit-final-2026-11-09.
- Commit validado: 5dbc3df90fc22f7eb9e4a5359b5dc6f0b3569708.
- GitHub Actions run: 42656024671 — SUCCESS.
- Regresion offline: 50 suites, 477 tests, 0 fallos.
- Contratos SDK: Wix eCommerce Cart V2, Wix Data items.patch/items.bulkPatch y Bookings Reader V2 — SUCCESS.
- ESLint: ejecucion SUCCESS.
- Runtime Wix: pendiente; CI offline no acredita hooks, permisos, concurrencia ni eventos en sitio publicado.
- Workflow CI usa actions/checkout@v5 y actions/setup-node@v5 con Node 24.22.1.

12. BLOQUEO DE HERRAMIENTA DE LINT

- El paquete oficial @wix/eslint-plugin-cli@1.0.2 declara peerDependency eslint ^8.0.0.
- La version instalada eslint@8.25.0 esta fuera de soporte y npm marca tambien dependencias transitivas de esa cadena.
- No se fuerza la instalacion de ESLint 10 ni se ignora la incompatibilidad de peerDependencies: hacerlo ocultaria un contrato no soportado.
- Se conserva el plugin Wix actual hasta disponer de una version compatible mantenida o una sustitucion validada que conserve las reglas necesarias para el proyecto.
- Este bloqueo afecta exclusivamente a la herramienta de desarrollo; no cambia el runtime Wix ni el codigo funcional.
- El criterio de cierre de cero dependencias sin soporte queda pendiente de resolver este bloqueo. No se declara cumplimiento total de ese criterio.

FIN DEL DOCUMENTO


13. DECISIONES VINCULANTES — 2026-11-10

- Wix Stores Catalog V3 y sus herramientas nativas son la única autoridad operativa del inventario comercial.
- Orders Settings live: inventoryUpdateTrigger=ON_ORDER_PAID. Los webhooks de eCommerce no reservan, descuentan, reponen ni proyectan stock en CMS.
- Los handlers eCommerce mantienen idempotencia, ledger fiscal, estado de reservas y reembolsos, pero no realizan escrituras de inventario.
- Excepción temporal de desarrollo TEC-033 (2026-11-14): los hooks append-only permiten update/remove individual en la rama `chore/temporary-append-only-mutation-window`. Esta excepción no se publica; antes del despliegue productivo se restaura ENABLED=false y las allowlists/hooks append-only. No usar sobre datos reales sujetos a conservación legal.
- La capa custom inventario.web.js, sus WebMethods, el panel de staff y los tests de su writer se retiran cuando no quedan consumidores. La retirada requiere CI y QA Wix de venta, cancelación y reembolso.
- Depósito de reserva: 15 EUR solo para servicios >100 EUR; Wix Bookings nativo es primera opción. No configurar hasta resolver discrepancia de contrato REST vs Wix Help sobre inPerson y verificar la capacidad de la cuenta.
- Cancelación/reprogramación gratuita con 24 h; devolución íntegra si cancela el negocio. No retención automática tardía/no-show sin revisión jurídica de proporcionalidad.
- Registro central de decisiones: docs/DECISION-LOG.md y ADR docs/adr/2026-11-10-deposit-and-native-inventory.md.


---

ADDENDUM DE CONTROL DE CAMBIOS, PUBLICACIÓN Y QA — 2026-11-13

Estas directrices prevalecen sobre las instrucciones de QA del addendum 2026-11-11 cuando difieran respecto a la existencia del sitio QA independiente.

## Repositorio y publicación

- GitHub `main` consultado: `738eb78faaa48502532c83c3e4b8b53db1144950`.
- El sitio principal Wix figura Published y Velo enabled; el propietario declara que el sitio se ha actualizado y publicado.
- No se dispone de un release/deployment ID que vincule el runtime publicado con el SHA actual de GitHub. No confundir “sitio Published” con “SHA publicado demostrado”.
- El HEAD documental `738eb78...` no tiene estados combinados ni workflow runs asociados en la consulta. Los resultados de CI de PR #330 son históricos y no certifican automáticamente el HEAD actual.
- Volver al proceso obligatorio rama → cambios delimitados → pruebas → diff → PR → CI/revisión → merge. Los commits documentales directos a main realizados en el corte anterior fueron una desviación de proceso; no repetirla.

## Entorno QA

- Existe un sitio Wix separado: `Marian Madrid QA - Aislado 2026-11`, Site ID `50b39f33-e753-4331-ab35-b2ed43dc97f7`, estado Draft, Wix Editor, Velo enabled.
- El CMS QA tiene 43 colecciones (15 NATIVE, 28 WIX_APP), frente a 44 en producción (15 NATIVE, 29 WIX_APP). QA tiene CitasF2=0 y ControlOperativo=0; producción tiene CitasF2=1 y ControlOperativo=3. QA no dispone de cinco colecciones Stores/* presentes en producción y contiene cuatro colecciones WixForms/* adicionales.
- La separación por Site ID está verificada, pero el aislamiento completo no: auditar automatizaciones, acciones y destinatarios de email/SMS/WhatsApp, pagos, webhooks, integraciones, permisos, Bookings y M365 antes de ejecutar casos E2E.
- La lectura anterior de 18 automatizaciones desactivadas y 10 activas por restricciones corresponde al sitio principal. No extrapolar ese estado al nuevo sitio QA.
- No usar el sitio Published para pruebas con side effects. No disparar automatizaciones readonly/activas ni la herramienta Test Automation sin análisis del efecto.

## Estado CMS y restricciones

- Producción: inventario CMS sujeto a actualización tras TEC-035. MapaStaff revision 36 / 5 registros; DatosFiscales legacy revision 21 / 1 placeholder. Recuentos NATIVE: CajaActual 1; CitasF2 1; ComplementosCatalogo 36; ControlOperativo 3; DatosFiscales 1; HistoricoCierresZ 0; InventarioStockVenta 1; LibroAsientosContablesDetalle 0; MapaStaff 3; MovimientosCaja 0; MovimientosInventario 1; PaquetesGestoria 0; RegistroIntegracion 0; RegistrosHorariosStaff 2; ServiciosCatalogo 95.
- Wix Stores Catalog V3 es la autoridad del inventario comercial; Wix Invoices V1 en producción.
- CitasF2 sigue con una proyección `CONFIRMED / NOT_PAID`; la última lectura nativa Bookings Reader V2 registrada devolvió `CANCELED / NOT_PAID` para el mismo bookingId. No editar manualmente la proyección ni borrar la reserva; resolver mediante handler/evento y reconciliación idempotente demostrada.
- Mantener writers fiscales, contables y laborales deshabilitados; mantener `ACCOUNTANT_SEND_ENABLED=false`. No realizar pagos, reembolsos, movimientos de caja, cierres, asientos, fichajes ni exports reales durante QA.
- SharePoint / Power Automate Capa 3 no está verificado live.

## Regla de evidencia

Todo informe separa explícitamente:
- Verificado por lectura live.
- Declarado por el propietario.
- Verificado en código.
- Verificado en CI (SHA y workflow).
- Verificado en Wix Preview/QA.
- Verificado en producción.
- Inferido o pendiente.

Una publicación solo se certifica como correspondiente al código cuando existe una referencia comprobable del artefacto/SHA desplegado o una verificación equivalente reproducible. No elevar una declaración a verificación.

---

## Addendum de autoridad y fase QA — 2026-11-14

### Jerarquía de autoridad y SSOT

1. **USUARIO / PROPIETARIO DEL PROYECTO — SSOT de negocio y gobierno.** El usuario es la única fuente de verdad para objetivos, requisitos, prioridades, criterios de aceptación, decisiones funcionales y autorizaciones del proyecto. Sus instrucciones expresas prevalecen sobre cualquier regla, restricción, supuesto o estado histórico de esta documentación. Las decisiones relevantes se registran en el Decision Log para trazabilidad; el registro no sustituye ni limita la autoridad del usuario.
2. **Documentación oficial vigente de Wix y de cada integración — autoridad técnica.** Define contratos, APIs, permisos, límites y comportamiento de plataforma. Se aplica para ejecutar la decisión del usuario de forma técnicamente válida; si una limitación oficial impide cumplirla, se informa y se propone alternativa, sin cambiar unilateralmente el requisito.
3. **Decisiones expresas del usuario registradas en el repositorio.** Son la memoria documental de las decisiones vigentes. Si un registro antiguo contradice una instrucción posterior, prevalece la instrucción posterior del usuario.
4. **Dossier Técnico Consolidado, Dossier de Flujos, Directrices, Necesidades Web, diccionario CMS y estado del proyecto.** Son documentación derivada y subordinada a los niveles anteriores. No pueden crear autorizaciones, bloqueos o requisitos nuevos por inferencia.
5. **Código, configuración Wix, CMS y pruebas.** Acreditan el estado implementado, no la autoridad para redefinir requisitos. Las diferencias entre lo solicitado, documentado e implementado se registran como discrepancias verificables.

### Política temporal de desarrollo y pruebas

**Vigencia:** fase actual de desarrollo, depuración y QA, hasta que el usuario ordene expresamente habilitar las protecciones para el despliegue.

- Queda **en pausa la política append-only** durante esta fase. Ninguna colección o registro se considerará intocable únicamente por estar etiquetado como ledger, histórico, fiscal, contable, laboral, documental o append-only.
- Queda **en pausa toda prohibición genérica de edición o eliminación de registros**, tanto individual como masiva, cuando la única causa del bloqueo sea la inmutabilidad/append-only o una restricción temporal de QA. La edición y eliminación forman parte de las operaciones permitidas durante las pruebas.
- No se exigirán registros rectificativos como única vía de corrección durante esta fase de QA. Esa regla se reconsiderará cuando el usuario habilite expresamente las protecciones previas al despliegue.
- Se mantienen las validaciones de esquema y tipos, la autenticación, autorización y permisos de acceso, la protección de secretos, la separación de capas, los controles de seguridad no relacionados con la inmutabilidad y la trazabilidad técnica de las pruebas. Esta pausa no autoriza accesos anónimos ni saltarse controles de identidad.
- No se habilitan por esta decisión writers fiscales, contables, laborales, pagos, devoluciones, comunicaciones ni automatizaciones externas que tengan gates funcionales independientes. Esos gates solo se modificarán por instrucción expresa o por una decisión técnica aprobada por el usuario.
- La pausa es temporal y **no se revierte automáticamente**. Solo el usuario puede ordenar la restauración y habilitación de las protecciones para despliegue. Antes de una publicación productiva, el estado de las protecciones debe revisarse con el usuario y quedar expresamente autorizado.

### Estado de implementación y publicación

El usuario declara que el código está integrado y publicado en Wix. Esta declaración se registra como **declaración del propietario**. En la consulta de GitHub de este corte, el PR #344 (feat/consolidate-fiscal-master-mapastaff-v2) figura fusionado el 2026-11-14 mediante el merge commit f3b1311eead05282e47f538afd506fe49e227141, que es el HEAD actual de main. La integración del cambio en Git está verificada. El usuario declara además que el código está publicado en Wix; no se dispone de un identificador de publicación Wix que vincule el runtime con ese SHA concreto.

**Nota de ejecución:** este addendum modifica la autoridad documental y la política de trabajo. No demuestra por sí mismo que todos los hooks, WebMethods, políticas de escritura o permisos CMS del runtime Wix hayan sido modificados para permitir todas las operaciones de edición y eliminación. Esa correspondencia debe verificarse en código y en Wix antes de afirmar que la pausa está aplicada técnicamente de extremo a extremo.
