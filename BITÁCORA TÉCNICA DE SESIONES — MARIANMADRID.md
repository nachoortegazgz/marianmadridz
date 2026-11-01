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
