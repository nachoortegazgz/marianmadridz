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


## Continuación de sesión 2026-11-01 — Verificación de CLI y CI

### Evidencia adicional revisada
- Log completo del run de manifiesto [41274171651](https://github.com/nachoortegazgz/marianmadridz/actions/runs/41274171651), job 124752854256: `wix --version` devuelve `1.2.6`; `wix install --help` confirma `--npm` como opción válida. La autenticación y la instalación terminan en éxito; el fallo ocurre únicamente al validar la ausencia de `src/velo.dependencies.json`.
- La configuración apunta al siteId correcto (`188bed94-177c-4bc9-a9f0-35080d874f3e`) y `@wix/data` ya figura en el `package.json` de entrada como `1.0.527`. Tras el comando, Wix CLI cambia metadatos y manifiestos npm, pero no crea el archivo Velo esperado.
- Documentación oficial Wix confirma que `src/velo.dependencies.json` se crea automáticamente al instalar el primer paquete npm, que Wix CLI lo actualiza al instalar paquetes y que no debe editarse manualmente: https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/git-hub-repository-file-structure (apartado `velo.dependencies.json`).
- Conclusión acotada: **la causa exacta aún no está identificada**. Se ha descartado que sea un simple error de sintaxis `--npm` o una autenticación fallida. El log no demuestra si la causa es estado previo del paquete, comportamiento del CLI 1.2.6 o discrepancia de sincronización del sitio; no atribuirla sin una prueba que la distinga.

### CI de backend actualizado
- Revisadas las ejecuciones `41274162990`, `41274165587`, `41274171605` y `41274174419`: las cuatro tienen los cuatro jobs completados con éxito (instalación limpia/ESLint, regresión backend offline, Windows Node.js 24.22.1 y 26.12.1).
- Esto respalda la estabilidad de los tests offline de backend en esos commits, pero no prueba el manifiesto ni la ejecución runtime en Wix.

### Decisión y próximo experimento
- PR #29 permanece en Draft. No se fusiona el workflow de manifiesto mientras su validación falle.
- Próxima comprobación: usar el flujo soportado de Wix Editor/sincronización para comprobar si el manifiesto está presente en el entorno del sitio y si la sincronización lo incorpora al repositorio; si no, aislar en una rama temporal una instalación CLI de paquete que no esté ya declarado, sin publicar el sitio y sin incorporar cambios incidentales de dependencias. No escribir el manifiesto manualmente.
- En paralelo, la página Servicio 2 sigue pendiente de prueba E2E real en Wix Preview/QA. No declarar resuelto `RATE_LIMIT_STORAGE_UNAVAILABLE` por los tests offline.
