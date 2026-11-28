# Wix Preview: sesión autenticada para Playwright

## Generar storageState en el equipo del usuario

El archivo contiene cookies y almacenamiento de sesión. Es una credencial: no lo subas al repositorio, no lo adjuntes a incidencias ni lo pegues en el chat.

Requisitos: Node.js 24 y npm.

```powershell
npm install --global playwright@1.65.1
$env:PLAYWRIGHT_MODULE_ROOT = (npm root -g)
playwright install chromium
node scripts/generate-storage-state.js
```

Se abre Chromium visible. Completa manualmente el login Wix y comprueba que el Preview de Marian Madrid está autenticado y visible. Pulsa Enter en la terminal. Se guarda en `.local/wix-preview-storage-state.json`, excluido de Git. Si necesitas otro Preview URL, define `$env:WIX_PREVIEW_URL = "https://..."` antes de ejecutar.

## Crear el secreto GitHub

Copia el Base64 directamente al portapapeles, sin imprimirlo:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".local/wix-preview-storage-state.json")) | Set-Clipboard
```

GitHub → `nachoortegazgz/marianmadridz` → Settings → Secrets and variables → Actions → New repository secret. Nombre exacto: `WIX_STORAGE_STATE_B64`. Pega el portapapeles y guarda. Después elimina el portapapeles y el archivo local cuando no necesites regenerarlo. Si se sospecha exposición, revoca las sesiones Wix y rota el secreto.

El workflow no imprime ni publica el storageState. Solo sube el informe de navegación, con retención de 3 días.

## Lanzamiento

Actions → **Wix TPV Preview (authenticated browser)** → Run workflow → rama `main`; deja activadas `create_preview` y `authenticated_browser`. Requiere el secreto ya existente `CLI_API_KEY`. Genera Preview; no publica el sitio.

## Alcance y siguiente paso para webMethods

Esta fase prepara la sesión Playwright y verifica la navegación autenticada. **Todavía no invoca webMethods de negocio.** El alias Velo `backend/tpv/tpvCaja.web` no es un módulo ES importable desde la consola del navegador: Velo resuelve ese import al compilar código frontend del sitio. Por tanto, `import('backend/...')` desde `page.evaluate()` no es una vía válida.

Para ejecutar `abrirSesionCaja`, `registrarMovimientoCaja` y `generarTicketX` sin exponer una API pública, el siguiente cambio debe incorporar un módulo frontend Velo de prueba, cargado por la página TPV y protegido por los permisos existentes de cada webMethod. Playwright interactuará con ese frontend ya compilado. No se crea HTTP Function pública ni se debilitan permisos o gates. Hasta incorporar ese puente y obtener JSON más `_id` persistido, runtime permanece en 0/3.

La caja abierta es un estado operativo, no un impedimento técnico ni una causa raíz. Su cierre exige invocar el webMethod real desde un contexto frontend autenticado.
