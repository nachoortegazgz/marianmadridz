# Preparación para pruebas online — 2026-11-20

## 1. Objetivo y estado

Preparar el repositorio para validar el sitio Wix mediante Preview y, posteriormente, automatización de navegador, sin modificar CMS ni activar operaciones externas.

**Estado:** preparación parcial implementada; pruebas online no ejecutadas.  
**Baseline:** main tras PR #502, commit `03f5cb34d3a5c3e3cf3c27ef934940db3d85f5a1`.  
**Rama de preparación:** `qa/online-test-readiness-2026-11-20`.

## 2. Evidencia del entorno

- Wix Site Context devuelve Marian Madrid, Editor clásico, Velo habilitado y estado **Draft**.
- `wix.config.json` identifica el Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e` y UI version `15941`.
- `package.json` ofrece `wix dev`; el workflow de Preview instala Wix CLI for Sites `1.2.14`, Node `24.22.1`, ejecuta `npm ci` y exige `CLI_API_KEY`.
- El workflow `.github/workflows/wix-tpv-preview.yml` solo se ejecuta manualmente, exige `main`, tiene `create_preview=false` por defecto y no contiene publicación.
- El workflow declara que la creación de Wix Preview requiere que el sitio se haya publicado al menos una vez. El Site Context actual figura Draft; por tanto, la creación de Preview vía ese workflow está bloqueada hasta resolver ese prerrequisito de Wix.
- No hay Playwright ni `@playwright/test` en el manifiesto npm actual ni en el lockfile. El dossier técnico menciona Vitest, pero el runner real configurado es Node.js `node:test` mediante `run-all.mjs`; no se atribuye cobertura a Vitest sin evidencia.

## 3. Cambios preparados en esta rama

Se añade `src/backend/tests/wix.preview.workflow.contract.test.mjs`, descubierto automáticamente por el runner canónico `npm test`. La suite protege estos contratos:

1. Preview solo manual y desactivado por defecto.
2. Restricción a la rama `main` y Site ID canónico.
3. Credencial Wix CLI requerida, instalación npm reproducible y versiones fijadas.
4. Ejecución exclusiva de `wix preview`, sin publicación.
5. No declarar Playwright instalado hasta que manifiesto y lockfile estén sincronizados.

No se modifica `package.json`, `package-lock.json`, `wix.lock`, código de negocio, configuración CMS, datos, permisos ni secretos.

## 4. Por qué Playwright no se instala todavía

Añadir únicamente `@playwright/test` al manifiesto sin generar el lockfile mediante npm sería una modificación incompleta y rompería la reproducibilidad de `npm ci`. Tampoco se introduce una instalación dinámica no bloqueada dentro de GitHub Actions. La incorporación debe hacerse en un workspace con Node `24.22.1`, registry npm accesible y checkout sincronizado:

- `npm install --save-dev --save-exact @playwright/test`
- verificar el diff de `package.json` y `package-lock.json`
- `npm ci`
- `npx playwright install --with-deps chromium` en el runner de CI
- suite inicial de navegación/lecturas con URL de Preview configurada como variable/secret y sin credenciales de producción.

La versión debe fijarse exactamente y validarse con CI; no se introduce una versión inventada en este cambio.

## 5. Gates antes de E2E online

### Gate A — Wix Preview
- Resolver el prerrequisito de publicación inicial del sitio o utilizar el Preview de Editor que Wix habilite para el estado Draft.
- Confirmar que `CLI_API_KEY` existe en GitHub y tiene solo el permiso Wix CLI for Sites - Git Integration y acceso al sitio correcto.
- Ejecutar el workflow manualmente con `create_preview=true` únicamente cuando el prerrequisito esté satisfecho.
- Guardar URL, SHA de código y hora del Preview; confirmar que corresponde al commit probado.

### Gate B — seguridad de ejecución
- Preview no demuestra aislamiento absoluto: revisar el comportamiento de HTTP functions y colecciones de Wix Apps.
- Mantener los tests iniciales en lectura/navegación. No crear reservas, ventas, pagos, devoluciones, facturas, fichajes ni cierres.
- Confirmar que automatizaciones con efectos de correo/notificación no se disparan en las rutas probadas.
- No usar el rol Admin que Preview asigna para certificar permisos de miembros, profesionales o visitantes.

### Gate C — E2E Playwright
- Incorporar Playwright con lock reproducible.
- Configurar URL de prueba por variable protegida, nunca hardcodeada.
- Ejecutar smoke de carga, consola, errores de red, navegación, formularios no enviados y widgets HTML.
- No automatizar submits ni mutaciones hasta disponer de un sitio Wix independiente y fixtures sintéticas controladas.
- Subir reportes/trazas como artefactos privados con retención corta; excluir cookies, tokens y datos personales.

### Gate D — integración transaccional
Requiere sitio Wix independiente con las Apps necesarias, usuarios sintéticos, CMS y permisos preparados. Solo entonces se diseñarán E2E para reservas, TPV y ledger; concurrencia/idempotencia deben verificarse contra runtime y no mediante mocks.

## 6. Riesgos y decisiones

- **P0:** no probar mutaciones de Wix Apps en Preview del sitio actual; sus colecciones pueden ser LIVE.
- **P0:** no activar pagos, fiscalidad, fichaje ni ledgers reales.
- **P1:** el Preview Admin no acredita autorización efectiva por rol.
- **P1:** no publicar para desbloquear Preview sin evaluación de release y autorización específica.
- **P2:** Playwright no está instalado; no se declara E2E browser coverage.
- Los workflows offline siguen siendo gates de código, no evidencia de runtime.

## 7. Validación y despliegue

La suite nueva se debe validar en GitHub Actions antes de integrar. En esta sesión no se ejecutó el runner local, Wix CLI, Preview ni navegador. No se han realizado escrituras Wix ni publicación.

**Criterio de aceptación de esta fase:** PR con CI backend offline y Gitleaks en SUCCESS; suite contractual nueva incluida en `npm test`. Esto solo valida la protección del workflow, no las pruebas online.

**Estado de release:** NO-GO para publicación y para operaciones transaccionales online.
