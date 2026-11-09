# Marian Madrid — Wix Editor + Velo

Repositorio canónico del sitio **Marian Madrid Peluquería y Estética** (\`www.marianmadrid.es\`), destinado a QA, pruebas previas y simulacros controlados antes de cambios en el sitio real. El proyecto se construye sobre Wix y sus Wix Apps nativas, con Microsoft 365 como capa documental externa.

## Arquitectura y fuente de verdad

- **Wix** es el centro operativo: Bookings, Stores/eCommerce, Payments, CRM, POS/Owner y Automations, según disponibilidad real del plan, país y configuración.
- **Velo** se limita a lógica imprescindible cuya necesidad esté demostrada y que Wix no cubra. La reserva dual F1–gap–F2 es el caso propio identificado; debe conservar revalidación, mismo profesional, idempotencia y compensación.
- **Microsoft 365** aporta archivo documental mediante SharePoint y, si la licencia lo permite sin coste adicional, Power Automate. Flujo previsto unidireccional Wix backend → Power Automate → SharePoint.
- No se incorporan proveedores, middleware ni servicios de pago/fiscalidad/email/IA externos por defecto. Cualquier excepción requiere justificar necesidad, alternativas, coste total y aprobación expresa.
- No duplicar en CMS propio funciones que Wix ya gestione suficientemente. Antes de retirar módulos o datos, auditar consumidores, históricos, automatizaciones y rollback.

## Documentos raíz

1. [Directrices de arquitectura, desarrollo y QA](DIRECTRICES_DESARROLLO_CODIGO.txt): reglas obligatorias y límites.
2. [Dossier técnico consolidado](DOSSIER%20TÉCNICO%20CONSOLIDADO.md): arquitectura, contratos, módulos, CMS y estado técnico verificado.
3. [Flujos end-to-end Capa 3](DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md): diseño documental Wix–M365 y despliegue pendiente.
4. [Estado actual del proyecto](docs/PROJECT-STATUS.md): estado verificado, bloqueos y prioridades.

El código, la configuración viva de Wix, los contratos oficiales de las APIs y las pruebas ejecutadas tienen prioridad sobre afirmaciones históricas de los documentos. Registrar siempre fecha, rama/SHA y evidencia. El estado de implementación y los bloqueos se mantienen en [docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md).

## Entorno de desarrollo

- Proyecto Wix Editor clásico con Velo y Wix CLI for Sites.
- Node.js mínimo: **24.22.1**, conforme a la documentación de Wix CLI for Sites consultada.
- Instalar dependencias con \`npm ci\`; usar Wix CLI for Sites para gestionar paquetes Wix.
- No editar manualmente artefactos generados por Wix CLI.
- Comandos de validación disponibles: \`npm run lint\`, \`npm test\`, \`npm run test:layer1\`, \`npm run test:layer2\`.

## GitHub Actions y rutas de trabajo

- Los workflows usan runners alojados por GitHub (\`ubuntu-latest\`) y \`actions/checkout\` descarga el commit del evento dentro del workspace del runner.
- La ruta operativa debe obtenerse dinámicamente con \`\${{ github.workspace }}\` o mediante rutas relativas al repositorio. No codificar rutas absolutas del equipo local ni rutas internas fijas del runner.
- La ruta local \`C:\Users\nacho\marianmadridz\` pertenece únicamente al clon de desarrollo en Windows. No es accesible desde GitHub-hosted runners y no se debe pasar al workflow.
- En un run observado, GitHub situó este repositorio en \`/home/runner/work/marianmadridz/marianmadridz\`. Es una ruta de ejecución del runner, no una ruta contractual: puede cambiar según el runner y el contexto.
- El workflow \`.github/workflows/backend-offline-quality.yml\` ejecuta QA offline (Layer 1/2, regresión, contratos SDK y ESLint). **No inicia Wix Preview, Wix Publish ni otros despliegues.**
- El workflow comprueba que la raíz Git del checkout coincide con \`$GITHUB_WORKSPACE\`.

## Criterio de validación

Distinguir siempre:
- **Pruebas offline:** mocks y fixtures; no prueban Wix runtime.
- **QA/Preview:** Wix Preview se inicia y valida manualmente por el propietario, fuera de GitHub Actions.
- **E2E real:** flujo completo ejecutado en navegador/runtime, con sus integraciones reales y resultado comprobado.

CI verde no equivale a E2E ni a publicación. No afirmar que una función está operativa sin evidencia.

## Seguridad, Preview y publicación

- **Wix Preview:** ejecución exclusivamente manual por el propietario mediante Wix Editor o Wix CLI for Sites.
- **Wix Publish:** publicación exclusivamente manual y autorizada por el propietario mediante Wix Editor o Wix CLI for Sites.
- **GitHub Actions no contiene workflows de Wix Preview ni Wix Publish.** Los cambios en \`main\` no deben iniciar despliegues Wix; GitHub Actions conserva únicamente las comprobaciones de calidad automatizadas.
- Antes de publicar, ejecutar las pruebas offline pertinentes, revisar la sincronización del código y de la versión UI del Editor y confirmar el destino Wix.
- No tocar producción ni CMS de producción fuera del proceso manual controlado y sin autorización explícita.
- No crear reservas, pagos, devoluciones, movimientos económicos, emails ni automatizaciones activas sin autorización.
- No solicitar ni exponer secretos. No sortear controles de seguridad.
- No borrar código, colecciones o campos sin auditoría de consumidores, impacto, histórico y rollback.

## Documentación oficial

- [Wix CLI for Sites: configuración](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites)
- [Estructura del repositorio Wix](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/git-hub-repository-file-structure)
- [Paquetes npm con Wix CLI](https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/packages/work-with-npm-packages-with-the-wix-cli)
- [Comandos Wix CLI for Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands)
