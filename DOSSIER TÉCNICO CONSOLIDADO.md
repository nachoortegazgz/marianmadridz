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
| Resend | Helper de envío en `fiscalDocuments.web.js` | Despacho a gestoría bloqueado por `ACCOUNTANT_SEND_ENABLED=false`; no existe el pipeline de exports Capa 3. Transporte de exports pendiente de ADR |
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

Según `DIRECTRICES_DESARROLLO_CODIGO.txt`:

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
`assertValidEnum(value, enumObject, fieldName)`, `assertCitasF2(item)`, `assertDatosFiscales(item)`, `assertControlOperativo(item)`, `assertRegistrosHorariosStaff(item)`, `isValidNifOrEuVat(taxId)`. No existe validator ni writer de nuevas filas `MovimientosInventario`.

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
