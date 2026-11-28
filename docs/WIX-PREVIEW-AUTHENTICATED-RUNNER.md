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

## Ejecución E2E autenticada

El workflow `Wix TPV Preview (authenticated browser)` crea un Preview sin publicar y ejecuta `scripts/wix-preview-tpv-e2e.mjs` mediante Playwright con la sesión autenticada.

El runner utiliza la interfaz TPV y el puente real del HtmlComponent. Invoca los WebMethods del flujo normal y comprueba:
1. Estado inicial de CajaActual y sesión canónica.
2. Apertura de sesión cuando no existe una sesión abierta, conservando el contexto heredado.
3. Entrada de efectivo.
4. Generación de ticket X.
5. Consulta del ledger antes del cierre y comprobación de `_id`/ `transactionId`.
6. Cierre de sesión, saldo, diferencia cero, proyección final de CajaActual y consulta posterior del ledger y auditoría.

Si ya existe una sesión canónica abierta, la prueba la utiliza y la cierra al finalizar; no cierra una sesión para después intentar reabrirla en el mismo día. La ejecución no cobra, reembolsa ni envía datos a proveedores externos. La única simulación permitida en una prueba de pago es la respuesta de la pasarela.

El informe se publica como artefacto sin cookies ni storageState. Un resultado PASS acredita el flujo de Preview ejecutado y sus consultas post-write; no equivale a producción ni a publicación del sitio.
