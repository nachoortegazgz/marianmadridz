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
