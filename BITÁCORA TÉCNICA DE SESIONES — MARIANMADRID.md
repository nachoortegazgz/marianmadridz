# BITÁCORA TÉCNICA DE SESIONES — Marian Madrid

**Función:** registro acumulativo de decisiones, cambios, verificaciones, bloqueos y siguiente paso. Actualizar al cierre de cada sesión técnica.  
**Repositorio canónico:** https://github.com/nachoortegazgz/marianmadridz  
**Fuente consultiva principal:** `DOSSIER TÉCNICO CONSOLIDADO— marianmadrid.md` en la raíz del repositorio. Esta bitácora registra hechos operativos; no sustituye ni reescribe el dossier/SSOT.  
**Regla de seguridad:** no afirmar publicación en Wix ni funcionamiento E2E sin evidencia de Wix Preview/QA o del sitio publicado. El usuario indica tomar como baseline de trabajo los cambios hasta la PR #26; esto no equivale por sí solo a una verificación independiente de despliegue Wix.

---

## Sesión 2026-11-01 — Página de servicio 2 y continuidad del proyecto

### Estado de partida verificado
- Repositorio canónico: `nachoortegazgz/marianmadridz`.
- PR #24, referencias canónicas de documentación: fusionada.
- PR #25, corrección del contrato de `@wix/data` `bulkPatch`: fusionada el 2026-11-01. Merge commit registrado por GitHub: `2bd5863655ec9b41d333cd668ff61ed891fe668b`.
- PR #26, bootstrap aislado del workflow de manifiesto Velo: fusionada el 2026-11-01. Merge commit registrado por GitHub: `17219d90b7625c1e3761a1e5900ed2d79ee2f5c1`.
- GitHub Actions del commit de la PR #25 (`a2a50e9f0b404a3664ab5105a31d40a45077ad5a`): los cuatro jobs terminaron en éxito: instalación limpia + ESLint, regresión backend offline, Windows Node.js 24.22.1 y Windows Node.js 26.12.1. Run: https://github.com/nachoortegazgz/marianmadridz/actions/runs/41254899961.
- El árbol actual de `main` fue consultado en esta sesión. Se confirmó que `src/backend/dataAccess.js` contiene el adaptador fluido `bulkPatch(...).setField()/incrementField().run()`.
- **Pendiente confirmado:** `src/velo.dependencies.json` no existe en el árbol de `main` consultado. Por tanto, no se puede afirmar que la regla Wix `@wix/cli/no-invalid-backend-import` esté activa; la documentación de sesión anterior indica que permanece deshabilitada.
- El workflow de manifiesto debe generar el archivo con Wix CLI; no crear el manifiesto manualmente.

### Resultado adicional: workflow del manifiesto Velo
- Revisadas las ejecuciones del workflow `Wix Velo dependency manifest` de la rama `feat/wix-cli-manifest-bootstrap-2026-11-01`.
- La autenticación de Wix CLI funciona; `wix install --npm @wix/data` termina indicando que la dependencia se instaló correctamente.
- El paso de generación falla después de la instalación, antes de `Commit only generated Wix metadata`. La ejecución `41256102498` conserva el artefacto de auditoría [wix-velo-manifest-41256102498](https://github.com/nachoortegazgz/marianmadridz/actions/runs/41256102498/artifacts/13063061228).
- El log termina con exit code 1 sin una explicación textual útil tras el spinner. No inferir una causa no demostrada.
- Resultado: el manifiesto **sigue ausente** de `main`; la PR #26 disparó el proceso, pero no resolvió el bloqueo. Siguiente diagnóstico: inspeccionar el artefacto y el workflow CLI, sin añadir metadatos no verificados.

### Incidencia: Página de servicio 2 no muestra el servicio elegido
**Síntoma reportado:** `WIDGET_CONTEXT_FAILED`, con causa `RATE_LIMIT_STORAGE_UNAVAILABLE` en la superficie `reservas`.

**Causa técnica identificada en el repositorio:** el adaptador de acceso a CMS llamaba al `bulkPatch` de `@wix/data` con una firma posicional que no corresponde al contrato fluido del SDK actual. El limitador persistente depende de esa escritura condicional; el fallo de almacenamiento puede impedir que la consulta del servicio termine correctamente.

**Corrección integrada en GitHub mediante PR #25:**
- Adaptación de las modificaciones internas al builder fluido del SDK.
- Traducción de condiciones de igualdad a `items.filter().eq(...)` para pasar la condición a `run()`.
- Mock de regresión actualizado para simular el contrato fluido.
- Se mantiene el limitador persistente y la política fail-closed; no se elimina la protección de seguridad.

**Estado real:** corrección integrada y CI verde. **No se ha demostrado aún** que la página cargue datos en Wix Preview ni en el sitio publicado; queda pendiente una prueba runtime que confirme escritura/lectura en `ControlOperativo` y respuesta correcta de `getServiceBySlugOrId`.

### Cambios no realizados
- No se ha publicado Wix desde esta sesión.
- No se han mutado colecciones CMS, reservas, pagos ni datos de clientes.
- No se ha fusionado ni alterado manualmente el manifiesto Velo.
- No se debe dar por resuelto el síntoma visual hasta completar la prueba runtime.

### Próximos pasos obligatorios (orden)
1. **Completar manifiesto Velo:** revisar las ejecuciones del workflow de la PR #26 y comprobar si alguna generó el archivo; el árbol actual consultado no lo contiene. Reintentar en una rama `feat/**` aislada si procede. No escribirlo manualmente.
2. **Reactivar la regla Wix de imports backend** solo cuando el manifiesto generado exista y el lint real pase.
3. **Validar en Wix Preview/QA** la página Servicio 2: abrir desde un servicio elegido, verificar slug/ID recibido, respuesta de `getServiceBySlugOrId`, persistencia del rate limiter en `ControlOperativo`, renderizado de nombre/precio/duración y ausencia de `WIDGET_CONTEXT_FAILED`.
4. Si falla, registrar el traceId y error backend concreto; no debilitar el limitador ni añadir bypass.
5. Auditar el flujo completo simple/dual y sus identificadores F1/F2 tras resolver la carga del servicio.
6. Actualizar esta bitácora al cierre de la próxima sesión con SHA, PR, CI, pruebas runtime y decisiones.

---

## Plantilla para cada sesión futura

### Sesión AAAA-MM-DD — Título
- **Baseline verificado (rama/SHA):**
- **Objetivo:**
- **Cambios realizados (archivos/PR/commit):**
- **Pruebas ejecutadas y resultados:**
- **Pruebas pendientes / limitaciones:**
- **Decisiones y riesgos:**
- **Siguiente paso exacto:**


## Continuación de sesión 2026-11-01 — PR #28, manifiesto Velo y comprobaciones Wix

### Baseline y sincronización
- PR #28, cambio del comando de instalación: fusionada por GitHub con merge commit `e32a869f22aed97e1e0c253c7ccde47435738525`. El usuario confirma que #28 quedó sincronizada y publicada en Wix Editor.
- Contexto Wix consultado: sitio `Marian Madrid Peluquería y Estética`, ID `188bed94-177c-4bc9-a9f0-35080d874f3e`, URL `https://www.marianmadrid.es/`, estado Published, Editor clásico, Velo habilitado. Wix informa actualización el 2026-11-01 a las 04:35.
- La rama principal avanzó después a `e947850884ab4de5d5c0431f9f79aa140ad66232` por una actualización del dossier. No sobrescribir ni revertir ese cambio ajeno al workflow.

### Diagnóstico reproducible del manifiesto
- Documentación oficial Wix: `wix install [options] <package-name>`; `--npm` es una opción documentada. Referencia: https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands.
- La CLI autenticada en GitHub Actions es Wix CLI `1.2.6`; `wix.config.json` apunta al siteId canónico anterior.
- Run `41273964758` (artefacto `13070531198`) y run `41274060051` (artefacto `13070417036`): `wix install --npm @wix/data` termina con éxito, pero no genera `src/velo.dependencies.json`; la validación falla y el commit automático queda omitido.
- En el árbol temporal tras la instalación aparecen cambios en `dependencies-metadata.json`, `package.json`, `package-lock.json` y `wix.lock`; no aparece el manifiesto. La instalación modifica temporalmente `@wix/data` de `1.0.527` a `^1.0.527`, por lo que no se debe incorporar esa alteración incidental.
- Se creó PR #29 en Draft para registrar la versión/ayuda de CLI, enumerar archivos generados y conservar artefactos sin modificar código de producción: https://github.com/nachoortegazgz/marianmadridz/pull/29.
- CI de backend en el commit de diagnóstico `67107efb6a57cbff7997657909f498c4d8697c97`: 4/4 jobs completados con éxito (instalación limpia/ESLint, regresión offline, Windows Node 24 y Windows Node 26). Esto no valida la generación del manifiesto ni el runtime Wix.
- No crear manualmente `src/velo.dependencies.json` ni reactivar `@wix/cli/no-invalid-backend-import` hasta resolver la discrepancia con el CLI y validar el manifiesto generado por Wix.

### Comprobaciones de solo lectura en el sitio publicado
- Consulta de `ControlOperativo`: 5 registros en total, ninguno con `controlType=RATE_LIMIT` en el momento de la consulta. Esto **no demuestra por sí solo** un fallo del limitador: puede no haberse ejecutado el flujo después de publicar. Sí significa que todavía no se ha observado evidencia de persistencia runtime.
- Consulta de `ServiciosCatalogo`: 95 registros; el catálogo devuelve datos y contiene el servicio de prueba `rayos-v` con `serviceId` válido y `clientHidden=false`.
- No se han creado, actualizado ni eliminado registros CMS. Estas lecturas no ejecutan directamente el webMethod `getServiceBySlugOrId` ni sustituyen la prueba de la página en Preview/producción.

### Siguiente paso exacto
1. Revisar el log completo del run `41274060051` y el artefacto `13070417036` para capturar la versión y ayuda de CLI; determinar por qué la CLI 1.2.6 instala el paquete pero no crea el manifiesto esperado.
2. Mantener PR #29 en Draft hasta que la causa quede identificada y los checks sean coherentes; no fusionar un diagnóstico que siga fallando.
3. Validar la página Servicio 2 en Wix Preview o mediante una prueba runtime autorizada: confirmar lookup de slug/ID, respuesta pública del servicio y escritura/lectura del rate limiter. Registrar traceId/error real si falla.
4. Mantener fail-closed; no añadir bypass ni debilitar el limitador para ocultar `RATE_LIMIT_STORAGE_UNAVAILABLE`.
5. Actualizar esta bitácora al cierre de la siguiente sesión con resultado definitivo, SHA, CI y evidencia runtime.


## Continuación de sesión 2026-11-01 — Verificación posterior a PR #29

### Estado verificado en GitHub
- PR #29 quedó fusionada por GitHub a las 04:53:21 UTC, merge commit `6a8c45728319e0a6faca1dab1ab505dabe07d017`. La PR se fusionó después de haber sido descrita inicialmente como Draft; este registro refleja el estado actual observado.
- `main` sigue sin contener `src/velo.dependencies.json` (consulta de Contents API: 404 para esa ruta). Por tanto, la fusión del workflow diagnóstico **no resolvió** la ausencia del manifiesto.
- Log del run `41274171651`, job `124752854256`: CLI `1.2.6`; `wix install --help` documenta `--npm`; login y `wix install --npm @wix/data` concluyen con éxito. Falla la validación porque el manifiesto no existe. `@wix/data` ya estaba declarado en `package.json` como `1.0.527` antes de la ejecución.
- Documentación oficial: Wix describe el manifiesto como generado automáticamente tras instalar el primer paquete y actualizado por Wix CLI; prohíbe editarlo manualmente. https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/git-hub-repository-file-structure.
- No se puede atribuir la causa a autenticación ni a sintaxis. Sigue sin demostrarse si interviene el estado previo de dependencias, un comportamiento del CLI `1.2.6` o una discrepancia de sincronización. No fabricar el archivo.

### Regresión offline
- Runs `41274162990`, `41274165587`, `41274171605` y `41274174419`: los cuatro jobs de cada ejecución terminaron en éxito (instalación limpia/ESLint, backend offline, Windows Node.js 24.22.1 y 26.12.1).
- Resultado: CI offline verde; no equivale a una prueba runtime del sitio ni del manifiesto.

### Próximas acciones seguras
1. No publicar cambios ni tocar reservas/CMS para investigar el manifiesto.
2. Verificar desde Wix Editor clásico, en la sección de paquetes npm, el estado real de los paquetes del sitio y la sincronización Git asociada. Si el manifiesto no aparece, elegir una prueba de instalación/reinstalación controlada con respaldo y sin publicar, solo después de confirmar impacto y reversibilidad.
3. Mantener deshabilitada la regla `@wix/cli/no-invalid-backend-import` hasta disponer del manifiesto auténtico y pasar lint.
4. Ejecutar prueba E2E en Wix Preview para Servicio 2 y rate limiter persistente. El catálogo CMS tiene datos, pero la prueba del webMethod y la escritura/lectura de `ControlOperativo` siguen pendientes.


## Sesión 2026-11-05 — Cierre verificable de Capa 1 y Capa 2

### Baseline
- Rama principal consultada: `main` @ `1007a35e5a3257a947cd026650637fe0d203fe44` (merge PR #119).
- El dossier consolidado se trata como referencia consultiva; el código, los ADR, la configuración Wix y la evidencia CI/runtime conservan su autoridad.
- Sitio Wix consultado en modo lectura: `188bed94-177c-4bc9-a9f0-35080d874f3e`, Published, Editor clásico, Velo habilitado, Bookings instalado; última actualización informada por Wix: 2026-11-05 07:03.

### Capa 1 y Capa 2 — evidencia automatizada
- PR #118 integró la ruta canónica de calendario `/booking-calendar`, el contrato de navegación desde la página de servicio y las puertas explícitas `test:layer1` y `test:layer2`.
- CI run **41977669571**, job **127080451912**, completado con `success`. El job ejecutó `npm ci`, `npm test`, `npm run test:layer1`, `npm run test:layer2` y `npm run lint`; todos los pasos finalizaron correctamente.
- Capa 1: **189/189** pruebas, 11 suites, 0 fallos.
- Capa 2: **94/94** pruebas, 10 suites, 0 fallos.
- Suite offline completa: **324/324** pruebas, 36 suites, 0 fallos (según resumen del run).
- Node usado por el job: **26.13.0**.
- El checkout del run corresponde al merge ref de PR #118. El árbol de código de ese merge se mantiene en `main`: la comparación entre `7c0012cfd4f9e38634ba21e762f888a7cbfe8499` y `1007a35e5a3257a947cd026650637fe0d203fe44` muestra únicamente cambios en el dossier y la matriz de auditoría; no hay cambios de código entre ambos.
- La prueba `htmlComponents.source-contract` valida los snapshots HTML versionados. No demuestra que el HTML Component actualmente desplegado en Wix coincida con esos snapshots.

### Resultado funcional y límites
- **Capa 1 (contrato frontend/ruta/bridge):** validación automatizada cerrada; ruta confirmada contra la página Wix publicada en la verificación anterior y el contrato de página del repo.
- **Capa 2 (backend/operación):** validación automatizada cerrada mediante mocks y pruebas de contrato; no equivale a una transacción real Bookings/CMS.
- No se ha ejecutado E2E de navegador real en esta sesión. No se ha creado ni cancelado ninguna reserva, no se han realizado pagos, no se han mutado colecciones CMS ni se ha publicado código Wix.
- El estado Published del sitio y la actualización reciente que informa Wix no demuestran que el código de `main` esté sincronizado ni que el flujo completo funcione en runtime.
- La validación de Preview sigue separada: el histórico documenta errores `PUBLISH_PIPELINE_TASK_NOT_FOUND`; no declarar Preview funcional sin una URL y evidencia de ejecución.

### Corrección documental
- El README tenía una contradicción: declaraba Node.js mínimo 26.x.x y, en la preparación local, aceptaba 24.22.1 o superior.
- La documentación oficial vigente de Wix CLI for Sites establece Node.js **24.22.1 o superior**. Se corrige el requisito mínimo; CI puede seguir usando Node 26 como matriz de validación.

### Pendientes que bloquean certificación E2E/publicación
1. Recuperar una ruta de Preview Wix válida y probar los HTML Components reales, no solo sus snapshots.
2. Validar lookup de servicio, rate limiter persistente, navegación calendario, consulta de slots y confirmación de reserva en QA.
3. Ejecutar el flujo simple autorizado con pago presencial, sin cobro online ni emisión fiscal; no ejecutar dual real mientras siga excluido por el propietario.
4. Verificar persistencia Bookings↔`CitasF2`, identidad/recurso, webhooks, cancelación y limpieza de los registros de prueba creados.
5. Mantener sin publicar hasta disponer de Preview/E2E y aprobación explícita del commit.

### Cambios de esta sesión
- Corrección de documentación Node.js en `README.md`.
- Este registro de evidencia y límites. No se modifican módulos de negocio ni configuración Wix.

---

## Sesión 2026-11-06 — Alineación documental de arquitectura y costes

### Objetivo
Reducir contradicciones y ruido documental, alineando los documentos de raíz con la decisión vigente: Wix y sus Wix Apps nativas como centro operativo; Microsoft 365 como capa documental; código Velo e integraciones adicionales solo cuando sean imprescindibles y aprobados.

### Cambios preparados en rama
- `README.md`: arquitectura resumida, mapa de documentos, reglas de validación y límites de publicación.
- `DIRECTRICES VIGENTES DEL PROYECTO.md`: nuevo documento de reglas obligatorias, costes, reservas, M365, seguridad y toma de decisiones.
- `DOSSIER TÉCNICO CONSOLIDADO.md`: consolidación del estado técnico, contratos QA, reservas duales, módulos propios, M365 y evidencia de pruebas; se eliminan planes antiguos presentados como arquitectura vigente.
- `DOSSIER FLUJOS END TO END CAPA 3.md`: simplificación del diseño Wix → Power Automate → SharePoint; se marcan recursos, licencias e integración como pendientes de verificación.

### Rama y commits
- Rama: `docs/alineacion-directrices-2026-11-06`.
- README: `945f130b3e3f167ed23ef69ea2575fafb00b581a`.
- Directrices: `537849a6e55c9614c8876965275f7a0a412ab0e1`.
- Dossier técnico: `1ed072e8bb70beae8512e9866a27ffd32d155935`.
- Flujos Capa 3: `940c041c63a69ba1b3128a084e71a1e6a1d691e3`.

### Límites y estado
- Cambios exclusivamente documentales en una rama de trabajo; no se han fusionado en `main`.
- No se ha modificado código runtime, configuración Wix, CMS, reservas, pagos, producción ni secretos.
- No se ha ejecutado Preview, Publish, despliegue ni prueba E2E.
- SharePoint y Power Automate siguen sin crearse ni probarse.
- No se ha verificado todavía CI para el HEAD final de esta rama.

### Siguiente paso
Revisar el diff de la rama, comprobar consistencia y enlaces, ejecutar validaciones documentales disponibles y abrir PR para revisión. No fusionar ni publicar en Wix sin aprobación.

---

## Sesión 2026-11-06 — Primera poda agresiva de código

### Objetivo
Eliminar integraciones externas opcionales sin consumidores necesarios, módulos duplicados, proyecciones sin lectores, adaptadores legacy y pruebas sintéticas que se presentaban como E2E.

### Cambios preparados en rama de código
- Eliminados el asistente OpenAI y el envío de paquetes por Resend; retirados sus mapeos de secretos junto con SendGrid y Microsoft Graph/Power Automate sin consumidores.
- Eliminados los endpoints custom de tarjetas regalo y sus enums.
- Retirados `inventario.web.js`, `storesCatalog.js`, `storesCatalogMapper.js`, el ledger espejo de inventario, los hooks CMS, las proyecciones de pedidos/reembolsos, el dashboard propio y sus pruebas. Wix Stores queda como fuente de verdad de stock.
- Retirada la proyección PGC a `LibroAsientosContablesDetalle`, sus hooks y validaciones: no tenía lectores activos y duplicaba el registro fiscal de `MovimientosCaja`.
- Eliminados el controlador público de administración sin referencias, el helper QR sin consumidores, el preparador programado de paquetes sin cron y el ranker duplicado de `bookingCore`.
- `fiscalFacsimile.js` movido fuera del backend runtime a fixtures de pruebas.
- Eliminada la auditoría sintética etiquetada como E2E; suites con mocks renombradas como offline.
- CMS físico y datos históricos no eliminados. Los registros reales de secretos en Wix Secrets Manager tampoco se borraron.

### Rama, PR y commit
- Rama: `cleanup/code-prune-2026-11-06`.
- PR #151: https://github.com/nachoortegazgz/marianmadridz/pull/151
- Estado: abierta como draft, no fusionada en `main`.
- Commit: `7f8e7a6b2480dab19c02934da5a33fb32031fa1a`.
- Diff: 40 archivos, 74 adiciones y 6.026 eliminaciones.
- La rama contiene un único commit de limpieza.

### Validación CI
Run #`42166922964`: success.
- `npm ci`: correcto; auditoría npm sin vulnerabilidades.
- Tests offline: 331/331, 33 suites.
- Layer 1: 204/204.
- Layer 2: 105/105.
- ESLint: correcto.

Estas pruebas no acreditan Wix runtime ni E2E real.

### Límites y pendientes
- No se tocó `main`, producción, CMS físico, secretos almacenados, configuración Wix ni datos económicos.
- No se ejecutó Preview, Publish, deploy, reservas, checkout ni pagos.
- `wix.lock` es generado por Wix CLI y no se editó manualmente; regenerarlo localmente si Wix CLI detecta el lock antiguo tras actualizar dependencias.
- Tras fusionar PR #151, revisar las colecciones CMS huérfanas y los secretos almacenados por separado antes de cualquier borrado físico.
