# Preparación para pruebas online — 2026-11-20

## 1. Objetivo y estado

Preparar y ejecutar un smoke online reproducible del código integrado en Wix, sin publicar ni realizar mutaciones transaccionales.

**Estado de código:** PR #503 integrada en main, commit 78f840f72af276d68110ed29b9294be74e519b72; CI posterior a merge PASS.  
**Preparación de smoke online:** rama qa/online-preview-smoke-2026-11-20; pendiente de CI, credencial Wix y ejecución del Preview.  
**Sitio:** 188bed94-177c-4bc9-a9f0-35080d874f3e, UI version 15941.

## 2. Evidencia y corrección de diagnóstico

- Wix Site Context devuelve el sitio en estado administrativo **Draft**.
- La URL pública https://www.marianmadrid.es/ responde y muestra una versión publicada del sitio. Por tanto, el estado Draft del contexto no demuestra que nunca haya existido una publicación; la precondición histórica de wix preview debe considerarse potencialmente satisfecha y confirmarse ejecutando el comando.
- La documentación oficial de Wix CLI for Sites indica que wix preview requiere que el sitio se haya publicado previamente, permite elegir el código del branch por defecto o local y genera una URL compartible.
- La documentación oficial advierte que el Preview CLI utiliza las versiones LIVE de las HTTP Functions del sitio. No sirve para probar cambios de HTTP Functions.
- Wix recomienda GitHub Actions para automatizar despliegues Preview y exige una API key con permiso Wix CLI for Sites - Git Integration, almacenada como secreto CLI_API_KEY.
- Node.js 24.22.1 o superior es el requisito oficial actual de Wix CLI for Sites. El workflow fija 24.22.1; Wix CLI queda fijado en 1.2.14.

## 3. Cambios preparados

### Workflow

.github/workflows/wix-tpv-preview.yml:

- Mantiene la ejecución manual opt-in con create_preview=false.
- Añade ejecución automática tras finalizar con éxito Backend offline quality gates en main.
- Hace checkout de main y valida Site ID/UI version.
- Exige CLI_API_KEY; no expone el secreto en logs.
- Ejecuta npm ci, instala CLI fijado, autentica y ejecuta únicamente wix preview.
- Nunca ejecuta wix publish.
- Captura la URL de Preview y ejecuta un smoke de navegador de solo lectura.
- Conserva un artefacto JSON de diagnóstico con retención de 3 días.

### Smoke Playwright

scripts/wix-preview-smoke.mjs:

- Usa Playwright Test/Browser versión 1.65.1 instalado globalmente en el runner, fuera de las dependencias runtime del sitio.
- Solo permite hosts de Preview de Wix; rechaza dominios personalizados/live.
- Bloquea en el navegador toda petición HTTP que no sea GET, HEAD u OPTIONS antes de que llegue a la red.
- No pulsa botones, no rellena campos y no envía formularios.
- Comprueba respuesta HTTP del documento principal, carga del body y host final.
- Registra errores JavaScript/console y peticiones bloqueadas como diagnóstico; no certifica lógica de negocio ni backend.

Playwright no se añade a package.json ni a package-lock.json: es tooling aislado del runtime Wix. La versión directa queda fijada en el workflow.

La CLI Wix usa Ink y requiere un terminal en modo raw; la ejecución directa sin TTY falla con 'Raw mode is not supported'. El workflow inspecciona primero los flags de ayuda y, para la ruta interactiva, crea un pseudo-TTY, espera 3 segundos a que se inicialice el selector y envía Enter a la opción predeterminada de latest main. El paso tiene timeout de 10 minutos.

La interacción con el selector de Wix se realiza mediante un driver Python de biblioteca estándar (pty): espera al texto del prompt documentado y envía Enter solo cuando detecta la opción Latest commit from origin/main. Si el selector no aparece en 120 segundos o el comando supera 9 minutos, finaliza sin seleccionar otra fuente.

## 4. Alcance de las pruebas online

**Permitido en este hito:**
- Abrir el Preview generado desde el último commit de main.
- Verificar respuesta del documento, render básico y errores de navegador.
- Capturar diagnóstico sin datos personales.

**Fuera de alcance y bloqueado:**
- Envío de formularios.
- Crear/modificar/cancelar reservas.
- Ventas, pagos, devoluciones, facturas, fichajes o cierres TPV.
- Escrituras CMS o Wix Apps.
- Probar cambios de HTTP Functions mediante el Preview CLI.
- Certificar permisos por rol: el Preview no demuestra el comportamiento de todos los roles.
- Cualquier publicación del sitio.

El Preview CLI no es un Wix Test Site ni garantiza aislamiento de colecciones. Las HTTP Functions se ejecutan en su versión LIVE. No se considera un entorno transaccional aislado.

## 5. Condiciones de aceptación

1. PR de preparación fusionada solo con CI offline y Gitleaks PASS.
2. Workflow Preview ejecutado en main y CLI autenticado correctamente.
3. Wix devuelve URL de Preview correspondiente al commit de main.
4. Smoke Playwright termina PASS y sube el informe.
5. Se confirma que no hubo publicación, formularios enviados ni peticiones no-GET transmitidas.
6. El informe conserva SHA/ejecución y URL del Preview en los logs de Actions.

**Estado del hito:** preparación de código y automatización; el hito online solo se declara alcanzado cuando los puntos 2–5 están verificados.

## 6. Riesgos y límites

- Si CLI_API_KEY falta o carece del permiso Wix CLI for Sites - Git Integration, la creación del Preview falla de forma cerrada.
- Si Wix no reconoce publicación previa, el workflow falla sin publicar.
- Si el CLI cambia su salida y no emite una URL wix.to, el workflow falla en vez de inventar una URL.
- Bloquear POST/PUT/PATCH/DELETE puede impedir que componentes dinámicos terminen de cargar; esto es intencional para priorizar no mutar datos.
- Un smoke PASS no certifica reservas, TPV, HTTP Functions, CMS, permisos, aislamiento Sandbox/LIVE ni Apps nativas.
- Las colecciones de Wix Apps no quedan aisladas por el mero hecho de usar Preview.

## 7. Validación y despliegue

No se han ejecutado mutaciones Wix, no se ha publicado el sitio y no se han creado registros sintéticos. El Preview CLI sube una instantánea de código a Wix para probarla, pero no publica el sitio.

El workflow está diseñado para ejecutarse tras el CI offline exitoso en main; si el secret está configurado y Wix acepta la publicación previa, crea Preview y ejecuta el smoke automáticamente.

**Release:** NO-GO para publicación y para pruebas transaccionales.  
**Online smoke:** pendiente de ejecución real en Wix Preview.
