# Preparación para pruebas online — 2026-11-20

## 1. Objetivo y estado

Preparar una ruta reproducible para comprobar online la versión integrada en Wix, sin publicar el sitio ni ejecutar operaciones transaccionales.

**Main verificado:** commit 20a6813f221006eeda8c96fa3393800dd738127b.  
**CI offline de main:** PASS (regresión, capas 1 y 2, contratos SDK, ESLint).  
**Gitleaks de main:** PASS.  
**PR actual:** #509, selección explícita de source remote para Wix Preview; pendiente de CI.  
**Hito online:** NO ALCANZADO. Todavía no existe URL de Preview confirmada ni informe Playwright PASS.

## 2. Evidencia verificada

- Site ID canónico: 188bed94-177c-4bc9-a9f0-35080d874f3e.
- UI version: 15941.
- Wix CLI for Sites 1.2.14 instalado correctamente en GitHub Actions.
- Node.js 24.22.1.
- El secreto CLI_API_KEY existe y autentica correctamente la cuenta Wix.
- La ayuda real de Wix CLI 1.2.14 muestra el flag: --source <local|remote>.
- El comando interactivo llegó a seleccionar "Latest commit from the default branch".
- Wix respondió después con HTTP 404 y código PUBLISH_PIPELINE_TASK_NOT_FOUND para el deployment ID 50062c24-e0ce-43f0-b137-a316e038822a.
- Request ID Wix: 1795210056.90712984612811479.
- No se obtuvo URL wix.to.
- No se ejecutó wix publish, no se modificó CMS, no se enviaron formularios y no se crearon registros.

El estado Draft del Site Context y la disponibilidad de una URL pública no bastan por sí solos para demostrar que existe una tarea de despliegue Preview válida. La respuesta 404 demuestra que Wix no pudo resolver la tarea asociada al deployment ID utilizado en ese intento. La causa exacta del estado del pipeline sigue pendiente de confirmación por Wix.

## 3. Cambios implementados en main

- PR #503: contratos y dossier inicial de preparación online.
- PR #504: workflow de Preview y smoke Playwright de solo lectura.
- PR #505: timeout y revisión de la interacción CLI.
- PR #506: prueba de ejecución no interactiva; descartada después porque la CLI Velo requiere raw TTY.
- PR #507 y #508: diagnóstico del TTY y automatización temporal; el driver PTY se retira en PR #509 tras descubrir el flag oficial --source remote.

### Workflow

.github/workflows/wix-tpv-preview.yml:

- Ejecución manual opt-in, con create_preview=false por defecto.
- Ejecución automática tras éxito del workflow Backend offline quality gates en main.
- Checkout exclusivo de main y validación del Site ID/UI version.
- Requiere CLI_API_KEY y npm ci.
- Instala Wix CLI for Sites 1.2.14.
- Usa explícitamente npm run wix preview -- --source remote para seleccionar el origen remoto sin interacción TTY.
- Nunca ejecuta wix publish.
- Si Wix devuelve una URL wix.to, ejecuta el smoke Playwright.
- Timeout de 10 minutos para el comando Preview.

### Smoke Playwright

scripts/wix-preview-smoke.mjs:

- Playwright 1.65.1 instalado globalmente en el runner, fuera de las dependencias runtime del sitio.
- Rechaza hosts que no pertenezcan a infraestructura Wix Preview.
- Bloquea métodos HTTP distintos de GET, HEAD y OPTIONS.
- Bloquea además rutas dinámicas conocidas: _api, _functions, _serverless, api y graphql.
- No pulsa botones, no rellena campos y no envía formularios.
- Comprueba HTTP del documento principal, body renderizado y host final.
- Registra únicamente contadores y hosts; no almacena texto de errores que pudiera contener datos personales.
- No certifica lógica de negocio, HTTP Functions, permisos ni aislamiento de datos.

Playwright no se añade a package.json ni package-lock.json: permanece aislado del runtime Wix.

## 4. Límites de seguridad y alcance

Wix documenta que el Preview CLI:
- No es un Test Site ni aparece en Release Manager.
- Utiliza las versiones LIVE de las HTTP Functions.
- No sirve para probar cambios de HTTP Functions.
- Requiere que el sitio haya sido publicado previamente.

El smoke no ejecuta operaciones de negocio. Aunque bloquea métodos no seguros y rutas API conocidas, no constituye una garantía universal contra efectos secundarios implementados incorrectamente en endpoints GET. Por eso no se hacen pruebas de formularios, sesiones autenticadas, reservas, TPV ni datos de negocio.

**Prohibido en este hito:**
- Publicar para desbloquear Preview sin autorización específica.
- Crear, modificar o cancelar reservas.
- Ventas, pagos, devoluciones, tickets, facturas o cierres TPV.
- Fichajes, ledgers contables/fiscales o escrituras CMS.
- Mutaciones en Wix Apps.
- Pruebas de permisos por rol usando el Preview Admin.

## 5. Condiciones para declarar el hito online

1. PR #509 supera CI offline y Gitleaks.
2. Main integra el flag --source remote.
3. Wix CLI devuelve una URL Preview válida para el commit de main.
4. Playwright ejecuta el smoke y el informe termina PASS.
5. Se verifica que no hubo publicación ni interacciones/transacciones.
6. El informe de Actions conserva el resultado, SHA y host del Preview.

Si Wix vuelve a devolver PUBLISH_PIPELINE_TASK_NOT_FOUND, el bloqueo será de la infraestructura/estado de despliegue de Wix, no del código del smoke. No se intentará publicar automáticamente. Se requerirá confirmar con Wix la tarea de despliegue o utilizar Preview del Editor/local como alternativa de UI.

## 6. Siguiente actuación

- Integrar PR #509 solo tras CI PASS.
- Dejar que el workflow de main pruebe una vez el source remote explícito.
- Si el Preview se crea, ejecutar y revisar el informe Playwright.
- Si Wix devuelve el mismo 404, detener reintentos automáticos y documentar el bloqueo externo. No publicar el sitio para sortearlo.
- Para pruebas transaccionales reales, preparar un sitio Wix independiente con Apps y datos sintéticos, sin usar el Preview CLI como si fuera una base de datos aislada.

**Release:** NO-GO para publicación y operaciones transaccionales.  
**Online smoke:** pendiente de URL Preview y ejecución Playwright verificadas.
