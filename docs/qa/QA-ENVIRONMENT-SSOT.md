> **DIRECTRIZ VIGENTE DEL PROPIETARIO — 2026-11-20:** el sitio completo es un entorno de desarrollo y pruebas sin actividad real; todos los registros son sintéticos y se autoriza su uso para simulacros completos, persistencia, depuración y validación funcional. Los registros sintéticos se retirarán mediante reset preproducción controlado antes del uso real. La autorización funcional no acredita por sí sola que APIs, permisos o writers estén habilitados ni elimina controles de seguridad, normativa legal o contratos oficiales. La directriz completa y su jerarquía de autoridad constan en [Directriz del propietario — desarrollo, pruebas y objetivos finales](../PROJECT-OWNER-DIRECTIVE-2026-11-20.md).

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


## Addendum 2026-11-20 — ejecución persistente TPV

El propietario confirma expresamente que todos los registros contables/fiscales actuales son sintéticos y editables y que el sitio se reseteará antes del despliegue real. Se autoriza el test-run TPV persistente sobre `CajaActual` y `MovimientosCaja`, limitado por marcador `TPV_QA_SYNTHETIC`, prefijo `SIMULATED_TPV_*` y `testRunId` del backend. La implementación exige ADMIN y bloquea operaciones desde la vista publicada (wixWindowFrontend.viewMode distinto de Preview). La prueba debe ejecutarse en Preview con Sandbox CMS habilitado. No se autorizan efectos en Wix Apps, pagos, firma fiscal, AEAT, comunicaciones ni hardware. Los ledgers ajenos al test-run permanecen protegidos. El reset integral y la restauración de append-only son obligatorios antes del despliegue.


**Edición controlada:** el dato lógico editable reside en `payloadFiscal.qaRecord`. El hook `MovimientosCaja_beforeUpdate` protege identidad, testRunId, tipo lógico y secuencia; recalcula los campos derivados y la huella SHA-256 QA al guardar. No se editan manualmente los marcadores ni la cadena fiscal.


## Addendum vigente — directriz global de desarrollo y simulacros (2026-11-20)

La declaración del propietario cubre el sitio completo y no solo TPV. Todos los registros existentes y futuros de QA son sintéticos; se autorizan simulacros completos y persistentes con registros para verificar funcionalidad y depurar. Antes del uso real se realizará reset controlado y verificable de datos sintéticos. Esta instrucción supersede cualquier limitación documental anterior que impida genéricamente crear registros sintéticos o completar simulacros. Se mantienen gates legales, seguridad, autorización backend, aislamiento de efectos externos y uso de APIs oficiales. El detalle vinculante está en [Directriz del propietario](../PROJECT-OWNER-DIRECTIVE-2026-11-20.md).

**Evidencia:** declaración expresa del propietario. No acredita por sí sola el aislamiento de automatizaciones, pasarelas, notificaciones ni el entorno Sandbox/Preview. Runtime/E2E podrá avanzar tras comprobar y controlar esos efectos para el flujo concreto; no se bloquea de forma genérica la prueba funcional si existe un método sintético/offline seguro.


## Addendum de seguridad P0 — 2026-11-20

La afirmación histórica de que el control frontend `wixWindowFrontend.viewMode !== "Preview"` bloquea las escrituras desde Published no constituye una autorización backend. Un WebMethod puede invocarse directamente y no debe confiar en un valor de vista suministrado o comprobado en frontend.

Hasta que se demuestre mediante contrato oficial y pruebas runtime una frontera backend que garantice el almacén Sandbox en cada invocación, el TPV QA persistente queda deshabilitado en configuración canónica:

- `TPV_QA_RUNTIME_POLICY.ENABLED=false`.
- `assertTpvQaEnabled()` rechaza con `TPV_QA_DISABLED_UNTIL_SANDBOX_ISOLATION`.
- El controlador HTML no anuncia `environment=SANDBOX` y rechaza las operaciones `CASHIER_STATE` / `QA_*`.
- El loader offline puede activar la política exclusivamente dentro de pruebas Node; no cambia el archivo canónico ni el runtime Wix.
- Pagos reales, writers fiscales/contables/laborales, notificaciones y hardware permanecen deshabilitados.

Esta decisión prevalece sobre la instrucción anterior de ejecutar el flujo persistente en Preview hasta que se demuestre el aislamiento. No se modifican CMS ni el singleton `CajaActual`. Para reactivar QA persistente se requiere prueba positiva desde Preview y negativa desde Published, con verificación antes/después de las colecciones LIVE.


## Consolidación vigente — 2026-11-20

Esta sección es el estado operativo vigente y **supersede** los addenda históricos anteriores cuando exista contradicción, en particular la autorización histórica de persistencia TPV desde Preview de la sección "Addendum 2026-11-20 — ejecución persistente TPV".

- TPV QA persistente está deshabilitado en runtime: `TPV_QA_RUNTIME_POLICY.ENABLED=false`.
- Todos los WebMethods TPV protegidos deben ejecutar `assertTpvQaEnabled()` antes de acceder al repositorio. La protección se está reforzando con un contrato automatizado que enumera los métodos publicados.
- El bloqueo no impide pruebas unitarias/offline con datos sintéticos en el harness aislado; esa habilitación no cambia la configuración canónica ni habilita Wix Runtime.
- Wix Site Data Usage API confirmó dos almacenes con uso distinto: LIVE 201 elementos / 264.970 bytes; SANDBOX 107 elementos / 204.766 bytes. Estos datos son un snapshot de uso, no acreditan el contexto de una invocación WebMethod.
- En SANDBOX: `CajaActual=1`, `MovimientosCaja=0`, `TpvSandboxIdentities=0`, `ControlOperativo=0`, `HistoricoCierresZ=0`. El contenido/ID del singleton Sandbox no se ha inspeccionado mediante esta API.
- En LIVE: `CajaActual=1`, `MovimientosCaja=0`, `TpvSandboxIdentities=0`, `ControlOperativo=58`, `HistoricoCierresZ=0`. No se han hecho escrituras ni sincronización Sandbox → Live.
- El singleton CajaActual observado en la consulta CMS read-only anterior tiene marcadores contradictorios con el test-run vigente y no debe reutilizarse, cerrarse ni corregirse como parte de QA.
- Las tres filas `COMPENSATION/PENDING_RECOVERY` permanecen sin tocar y requieren conciliación independiente.
- No hay prueba Wix Preview/Published E2E, ni certificación de aislamiento de invocaciones directas, ni seed de identidades, ni bootstrap de caja.

**Release gate:** NO-GO para TPV persistente, publicación y despliegue productivo. La reactivación exige una señal backend verificable del data plane o un sitio/tenant Sandbox físicamente separado, prueba negativa de invocación desde Published, comparación LIVE antes/después, E2E y reversión probada. No utilizar el contador de uso como sustituto de esa prueba.


## Resultado de contrato backend offline — PR #486

El test contractual que enumera los WebMethods QA protegidos y comprueba el orden guard/repositorio quedó integrado en PR #486, commit `5ef81ff132f4cbff594387a60e4446bc5dada171`. CI del head: 74 suites / 693 tests PASS, Layer 1 335/335, Layer 2 267/267, npm audit 0 vulnerabilidades, SDK contracts, ESLint y secret scanning PASS. Esta evidencia valida el contrato estático/offline; no certifica Wix Runtime ni el aislamiento de Preview/Published. La política canónica sigue `ENABLED=false`.


## PR #488 — cobertura completa de WebMethods TPV

Integrada en `main` (`75c4428fea45795d4337011c389ac909f0aa6e03`). Contrato automatizado clasifica todos los WebMethods exportados TPV revisados: guard backend, solo lectura/validación o writer operativo deshabilitado. CI offline quality gates y secret scanning SUCCESS (runs `44727911850`, `44727911591`); capas 1/2, suite completa, SDK contracts, eCommerce/TPV contracts y ESLint PASS. No acredita Wix Runtime ni data-plane isolation. TPV QA sigue deshabilitado.


### Aclaración de separación entre TPV_QA histórico y TPV_SANDBOX vigente — 2026-11-20

Las secciones anteriores que declaran `TPV_QA_RUNTIME_POLICY.ENABLED=false` describen la ruta legacy `TPV_QA_*` y sus WebMethods con sufijo QA. No deben interpretarse como la configuración actual del TPV Sandbox implementado en `src/backend/tpv/`. El código actual utiliza `TPV_SANDBOX_RUNTIME_POLICY.ENABLED=true`, nombres de WebMethods neutros, marcadores de caja y run ID estático. Esta habilitación de código no equivale a certificación de aislamiento runtime: las escrituras siguen condicionadas al marcador de `CajaActual`, pero es obligatorio probar el data plane por invocación antes de considerar seguro Preview/Published. Mantener los writers externos deshabilitados y NO-GO de publicación hasta la aceptación E2E descrita en el handoff vigente.


---

## Addendum de evidencia Wix — reauditoría read-only 2026-11-21

Este bloque actualiza la evidencia operativa sin cambiar la clasificación funcional del sitio como QA. Prevalece sobre los snapshots anteriores de automatizaciones y uso CMS.

### Contexto y baseline
- GetSiteContext confirma Wix Editor Classic, Velo habilitado y estado Wix **Published**. El propietario mantiene la clasificación funcional del sitio como entorno único QA; Published es metadato y no prueba actividad real ni autoriza efectos externos.
- GitHub `main` HEAD: `e75aec5d28dcb8560fe75dbd04d5eae95957c3d8`. CI post-merge: Backend offline quality gates run `44867151597` SUCCESS y Secret scanning run `44867151605` SUCCESS.
- `main` no está protegida (`protected=false`). No hay required checks acreditados.
- El SHA de código instalado en Wix Editor/Published no está verificado.

### Wix Automations — nuevo inventario vigente
Consulta Automations V2 read-only del 2026-11-21:
- 159 automatizaciones consultadas.
- 8 con estado ACTIVE confirmado individualmente mediante Get Automation.
- 7 son PREINSTALLED y todas tienen `settings.disableStatusChange=true`. Incluyen seis acciones de correo y una notificación de plataforma; no sortear sus locks ni desinstalar apps para neutralizarlas.
- Una es de origen APPLICATION: `Configuración de control laboral`, ID `6e80b403-4903-4c5a-bfb7-d3b40ed014be`, revisión 4, ACTIVE. Trigger programado `wix_automations-scheduled_trigger`, `startDate=2026-11-21T05:00:00+01:00`; acción `agent_maker-delegate_to_llm`, taskId `83527028-12e2-4462-9baf-4e2ec25db63c`. La acción está marcada permanent/read-only; el estado no está bloqueado (`disableStatusChange=false`). No se ha inspeccionado el contenido de la tarea ni el historial de ejecución; no se ejecutó ni modificó.
- Los E2E que puedan disparar automatizaciones, registros de miembros, tarjetas, reservas, emails o notificaciones siguen bloqueados hasta conocer y contener sus efectos. No declarar neutralizadas las comunicaciones.

### CMS LIVE/SANDBOX — Site Data Usage API
Consulta oficial con `consistentRead=true`, 2026-11-21:
- LIVE: 203 elementos / 266.227 bytes.
- SANDBOX: 109 elementos / 206.023 bytes.
- 13 colecciones NATIVE y 29 WIX_APP en el inventario CMS (42 en total).
- CajaActual: 1 LIVE / 1 SANDBOX.
- MovimientosCaja: 2 LIVE / 2 SANDBOX.
- TpvSandboxIdentities: 0 / 0.
- ControlOperativo: 58 LIVE / 0 SANDBOX.
- CitasF2: 6 / 6; ServiciosCatalogo: 95 / 95; MapaStaff: 5 / 5.
- El API de uso no expone IDs ni contenido de elementos y no acredita qué data plane utiliza una invocación WebMethod. Los dos elementos de MovimientosCaja SANDBOX no se han inspeccionado desde el Editor. No sincronizar Sandbox → Online.

### Caja y movimientos LIVE
La lectura CMS Management API read-only devuelve CajaActual ABIERTA, apertura 300 EUR, cashAmount/expectedCash 320 EUR, countedCash 0 EUR, difference 0 EUR, snapshotSource `MOVIMIENTOS_CAJA_RECONCILIADOS`, traceId `0`, lastOperationType `RECONCILIATION_CORRECTION`. No cumple el marcador Sandbox del TPV.
MovimientosCaja LIVE contiene dos filas (25 EUR CARD y 20 EUR CASH, traceId `0`) sin los marcadores/campos de ledger sintético que espera el repositorio TPV. La aritmética 300 + 20 = 320 y 25 de tarjeta = 45 de tickets coincide con el smoke parcial, pero no certifica el contrato de ledger. No modificar estos registros.
ControlOperativo mantiene tres registros FISCAL_LEDGER/PENDING_RECOVERY con attempts=0; uno informa ORIGINAL_ORDER_LEDGER_MISSING. No reintentar ni borrar.

### TPV y accesibilidad
- TpvSandboxIdentities está vacía en LIVE y SANDBOX; el código exige seis identidades sintéticas presembradas.
- Scan full-site `aae3b411-81ff-4309-a767-6301164cb483`: PARTIALLY_COMPLETED; 121 páginas descubiertas, 0 procesadas, 121 fallidas con `ANALYSIS_FAILED`, 0 findings. Todas las URLs enumeradas usan el host wixsite.com. No declarar accesibilidad validada; diagnosticar el origen antes de otro scan.
- Scan anterior del 11/11 terminó PARTIALLY_COMPLETED con 122 páginas descubiertas, 0 procesadas y 122 fallidas.

### Decisión de seguridad
La autorización de simulacros sintéticos no permite disparar automatizaciones desconocidas ni efectos externos. Mantener NO-GO para E2E persistente hasta inspeccionar la tarea LLM, revisar automatizaciones de email/notificación, demostrar el data plane Preview/Sandbox y conciliar CajaActual/MovimientosCaja. No tocar históricos ni compensaciones.


### SEO — Google Search Console
Get Site Readiness devolvió `READY` el 2026-11-21. Es una señal de conexión/verificación del sitio; no certifica indexación ni rendimiento. No se modificó configuración SEO.
