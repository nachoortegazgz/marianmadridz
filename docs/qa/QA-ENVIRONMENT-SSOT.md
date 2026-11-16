> **ACLARACIÓN DE CONFLICTO — 2026-11-16:** El registro `QA-2026-11-15-TEMP-MUTABILITY` documenta una autorización de QA para update/remove de determinados ledgers sintéticos, pero entra en conflicto con el invariante arquitectónico vigente del proyecto: los ledgers append-only son inmutables y las correcciones se realizan mediante nuevos registros rectificativos trazables. No se puede tratar esa autorización documental como habilitación técnica ni como permiso para modificar/borrar ledgers. Hasta que el propietario resuelva expresamente la contradicción en las directrices maestras, prevalece el invariante de integridad: mantener fail-closed, sin bypasses globales, sin update/remove de ledgers ni de `TPV_QA_*`; las operaciones CAS tipadas de locks efímeros en `ControlOperativo` siguen siendo un mecanismo separado y limitado. `bulkUpdate` continúa deshabilitado. La identidad del Site ID en runtime Wix sigue sin acreditarse y bloquea las escrituras TPV desde Preview.

---

# SSOT — entorno QA único de Marian Madrid

**Vigente desde:** 2026-11-14 · **Autoridad:** decisión expresa del propietario.

- **Sitio QA único y oficial:** `188bed94-177c-4bc9-a9f0-35080d874f3e` — `https://www.marianmadrid.es/`.
- **Finalidad:** entorno QA del ecosistema Marian Madrid para pruebas previas al despliegue real. No existe un segundo sitio QA ni un QA externo designado.
- **Actividad:** el propietario confirma que nunca ha existido actividad real y que actualmente no existe.
- **Datos:** todos los registros existentes y nuevos utilizados en QA son sintéticos.
- **Cliente sintético canónico:** Nacho Pitt — `nacho.pitt@example.test`.
- **Pagos:** pasarela desconectada. No se realizan cobros, capturas, reembolsos ni operaciones bancarias reales.
- **Fiscalidad y comunicaciones:** el propietario declara desactivados Veri*Factu, AEAT, emisión/transmisión fiscal, email, SMS, WhatsApp, campañas y comunicaciones a clientes. No obstante, la auditoría read-only Wix del 2026-11-14 detecta 7 automatizaciones preinstaladas ACTIVE con acciones de email/notificación y bloqueos de modificación. Por tanto, el estado efectivo de aislamiento de comunicaciones NO está acreditado; mantener Runtime/E2E que pueda dispararlas bloqueado hasta resolverlo.
- **Mutabilidad temporal QA (decisión del propietario, 2026-11-15):** queda suspendida temporalmente la regla append-only para facilitar el desarrollo y la corrección de datos sintéticos. Se autoriza preparar y habilitar operaciones controladas de lectura/corrección y update/remove sobre colecciones de dominio QA, sujetas a allowlist explícita y autorización backend de ADMIN. Esta excepción no autoriza permisos públicos, acceso anónimo, cambios en colecciones nativas WIX_APP por acceso directo, ni operaciones con efectos externos. La activación técnica en código/CMS se considera pendiente hasta verificar colección, esquema, permisos, consumidores y pruebas.
- **Colecciones en alcance inicial de revisión:** `MovimientosCaja`, `LibroAsientosContablesDetalle`, `RegistrosHorariosStaff`, `HistoricoCierresZ`, `PaquetesGestoria` y los tipos mutables de `ControlOperativo`. `MovimientosInventario` no existe como colección propia en el CMS live; el stock corresponde a Wix Stores/Catalog y no se creará un ledger paralelo. `ControlOperativo/WEBHOOK_EVENT` queda excluido de update/remove porque gobierna deduplicación y replay de webhooks.
- **Datos existentes:** solo se podrán corregir o eliminar registros confirmados como sintéticos del sitio QA, con respaldo/export previo, alcance explícito, registro de auditoría y mecanismo de reversión. No se presume que todo registro de cualquier colección sea descartable.
- **Reintroducción preproducción (obligatoria):** antes del primer despliegue real deben restablecerse append-only e inmutabilidad de ledgers, rectificaciones trazables, permisos mínimos, controles de acceso, validación de identidad/autorización backend, idempotencia, integridad/hash, auditoría y bloqueos de mutación/borrado. La retirada temporal debe constar como riesgo abierto hasta cerrar esta tarea.
- **Acceso de desarrollo:** el propietario declara ser el único usuario con acceso al desarrollo del sitio QA. Esta declaración no sustituye las comprobaciones de autorización backend de los WebMethods.
- **Seguridad:** el estado Wix `Published` y el dominio personalizado son metadatos de publicación; no cambian la clasificación funcional del sitio como QA ni acreditan actividad real. Toda operación de prueba debe seguir siendo sintética y no producir efectos externos.
- **No usar:** identificadores de sitios anteriores, sitios auxiliares o entornos de terceros como destino alternativo de QA. Las designaciones anteriores quedan supersedidas y no son operativas.

**Estado de evidencia:** la finalidad QA, ausencia de actividad real, datos sintéticos, identidad del cliente de prueba y pasarela desconectada son declaraciones expresas del propietario. El contexto Wix confirma el Site ID, URL, estado Published y aplicaciones instaladas. La consulta oficial Wix Automations V2 confirma 150 automatizaciones: 7 ACTIVE y 143 INACTIVE; las 7 activas son preinstaladas y están bloqueadas por settings.readonly o settings.disableStatusChange, varias con acciones de email/notificación. No se ha demostrado neutralización runtime de esos efectos. Por ello, la declaración de comunicaciones desactivadas no se considera técnicamente verificada y Runtime/E2E permanece bloqueado.

**Regla de precedencia:** este documento es la referencia única de identidad y clasificación del entorno. Si otra documentación identifica un QA distinto, denomina este sitio producción o propone un QA externo, esa referencia queda supersedida por esta SSOT. Los informes históricos conservan su valor como evidencia de lo que se observó en su fecha, pero no definen el entorno vigente.

---


## Alineación técnica de fixtures offline — CERRADA

PR #379 integrada en main mediante squash commit 27348a20bfb913fde43761d4c92dd46526a5e470.

- QA_TEST_SITE_ID apunta al Site ID QA único.
- El primer cliente fixture es Nacho Pitt; el correo de la fixture es nacho.pitt@example.test, dominio reservado de pruebas. La dirección real designada por el propietario no se utiliza en fixtures ejecutables.
- TPV, PSP y manager-email-sink validan el Site ID canónico exacto y fallan cerrados ante el identificador supersedido.
- CI sobre el HEAD de PR: Layer 1 24/307 PASS; Layer 2 19/252 PASS; regresión 70/644 PASS; contratos SDK, ESLint y Secret scanning PASS.
- Alcance: mocks in-memory/offline. No valida Wix Runtime/E2E ni modifica el sitio Wix.

## Bloqueo vigente — automatizaciones Wix activas

La consulta read-only de Wix Automations V2 devolvió 150 automatizaciones: 7 ACTIVE, 143 INACTIVE, 0 archivadas. Las siete activas son preinstaladas y todas están bloqueadas por settings.readonly o settings.disableStatusChange. Varias ejecutan acciones de email/notificación. No se modificó ninguna.

Ver auditoría read-only de automatizaciones en docs/audits/2026-11-14-qa-automations-isolation.md. Los flujos que puedan disparar esos triggers quedan bloqueados para Runtime/E2E hasta neutralización soportada por Wix/proveedor y nueva lectura de verificación. No sortear locks ni desinstalar apps a ciegas.


## Decisión vigente — mutabilidad temporal de datos QA (2026-11-15)

Por instrucción expresa del propietario, la restricción append-only queda suspendida temporalmente en el entorno QA para acelerar el desarrollo y permitir correcciones de datos sintéticos. Esta decisión supersede, exclusivamente para QA y desde esta fecha, las reglas anteriores que prohibían toda corrección/update/remove de ledgers.

La decisión no elimina la obligación de:
- mantener las operaciones de mutación exclusivamente en backend y autorizadas para ADMIN;
- aplicar allowlist por colección y validar Site ID QA exacto;
- preservar permisos CMS privados y no abrir acceso anónimo/público;
- realizar backup/export previo, registrar auditoría y definir rollback;
- mantener desactivados pagos, comunicaciones, emisión/transmisión fiscal y efectos externos;
- no modificar directamente colecciones nativas WIX_APP fuera de sus APIs oficiales.

**Tarea preproducción obligatoria:** reintroducir y probar las garantías de append-only, inmutabilidad, rectificación mediante nuevos registros, permisos mínimos, autorización backend, idempotencia, hash/trazabilidad y bloqueo de update/remove. No se autoriza despliegue real mientras esta tarea esté abierta.

**Estado de implementación:** decisión SSOT registrada en esta rama; no implica que los bloqueos ya hayan sido retirados del código ni que se hayan cambiado permisos live de Wix. La implementación requiere revisión técnica y validación por colección.

## Revalidación de automatizaciones — 2026-11-16

La consulta Wix Automations V2 filtrada por `configuration.status = ACTIVE` y la lectura individual de cada ID confirman **8 automatizaciones activas**:
- 7 preinstaladas, todas bloqueadas para cambio de estado (`disableStatusChange=true`); 2 además readonly.
- 1 automatización adicional creada por una app: `Creación de TPV física personalizada` (ID `961f911d-8386-4e20-843e-cdf4595c24e8`), programada diariamente a las 01:45 y ejecutando la acción `Delegate to AI Custom Agent` con task ID `d56d7590-7eb7-4e4f-94ac-2ca9fa465fcf`.

El contenido de esa tarea IA y sus integraciones no son visibles en la configuración consultada. No se modificó ni desactivó por desconocerse su finalidad. Queda como riesgo abierto `BLOCKED_UNKNOWN_AUTOMATION_SIDE_EFFECTS` hasta inspeccionar tarea e integraciones en Agent Maker. Por tanto, la declaración de comunicaciones y efectos externos desactivados sigue sin acreditación técnica suficiente y Runtime/E2E permanece bloqueado.

Detalle y evidencia: `docs/audits/2026-11-14-qa-automations-isolation.md` (addendum 2026-11-16).


## Revisión operativa y CMS read-only — 2026-11-16 23:09 Europe/Madrid

**Estado del sitio:** GetSiteContext confirma el Site ID canónico, Wix Editor (Classic; tipo devuelto `Editor`), Velo habilitado y estado `Draft`. El propietario confirma que el sitio está despublicado y que la pasarela de pagos está desconectada. El estado Draft corrobora que no está publicado; la desconexión del proveedor de pagos continúa siendo declaración del propietario y no se ha inspeccionado independientemente en el Dashboard.

**Automatizaciones:** una nueva consulta Wix Automations V2 filtrada por `configuration.status=ACTIVE`, seguida de Get Automation individual, confirma 7/7 activas, todas PREINSTALLED y con `disableStatusChange=true`; dos también tienen `readonly=true`. La automatización de TPV personalizada (ID `961f911d-8386-4e20-843e-cdf4595c24e8`) está ahora `INACTIVE`, revisión 4, confirmada mediante Get Automation independiente. No se modificó desde esta sesión. Su tarea IA `d56d7590-7eb7-4e4f-94ac-2ca9fa465fcf` sigue sin inspección; al estar la automatización INACTIVE no es elegible para nuevos disparos de su trigger programado. Las siete preinstaladas conservan sus locks y sus posibles comunicaciones; evitar eventos de tarjeta guardada, notificación de Agent Maker/Aria, alta/confirmación de miembros, suscripción, aviso de límite CMS y reset de contraseña.

**CMS TPV:** las nueve colecciones `TPV_QA_*` existen. Se verificaron sus campos y permisos: `insert/update/remove/read=ADMIN` en todas. Las nueve tienen un índice único sobre `idempotencyKey` en estado `ACTIVE`. Los nueve recuentos de elementos son cero. En `ControlOperativo` hay 58 registros, pero no existen registros `TPV_QA_SESSION_LOCK` ni `TPV_QA_REFUND_LOCK`. La capa `backend/dataAccess.js` usa `auth.elevate`; la política y los tests del repositorio limitan las colecciones QA a inserciones y reservan los cambios CAS para locks tipados. No se cambió ningún permiso, índice, colección ni elemento CMS.

**Resultado:** lectura estrictamente read-only. No se insertaron ventas, sesiones, pagos simulados, devoluciones, movimientos ni cierres. El Preview de Wix no se ha generado. La cuota CMS ya está verificada; la siguiente fase será Preview con carga, autorización y lecturas, seguida de una prueba de persistencia sintética limitada en SANDBOX tras confirmar el contexto Preview. No se escribirán datos por REST directamente en LIVE ni se harán cargas masivas.

Evidencia ampliada: `docs/audits/2026-11-16-tpv-qa-cms-readonly-verification.md`.


### Cuotas CMS y separación LIVE/SANDBOX — 2026-11-16 23:09 Europe/Madrid

Get Site Data Usage con `consistentRead=true` confirma: límite de almacenamiento 10 GiB; límite de elementos 4.000 por entorno; 21 colecciones de un máximo de 1.000; LIVE 201 elementos / 265.822 bytes; SANDBOX 0 elementos / 0 bytes. Las nueve colecciones `TPV_QA_*` tienen 0 elementos tanto en LIVE como en SANDBOX. LIVE representa aproximadamente el 5,03 % del límite de elementos, por lo que no hay proximidad al umbral de cuota. Wix documenta que SANDBOX es la copia separada usada por el Editor y Preview, que el límite de elementos es independiente por entorno y que el almacenamiento se comparte. En consecuencia, una prueba de persistencia TPV controlada deberá ejecutarse desde Wix Preview para escribir solo en SANDBOX; no insertar directamente por REST en LIVE. No se harán cargas masivas.
