# Marian Madrid — Wix Editor + Velo

Repositorio canónico del sitio **Marian Madrid Peluquería y Estética** (`www.marianmadrid.es`). El repositorio contiene código, documentación y pruebas QA. **Corte 2026-11-13 20:51 CET:** PR #330 fusionada sobre el baseline funcional `3df4b4cf174d80dfd22406bbd758b2eddd7aaa44`; tras los cinco commits documentales, HEAD de main `8b3155afcd1f51b404b48d547f86eb98aac2019f`; sitio Wix Published; no está acreditado que el HEAD de main esté publicado ni que el sitio principal sea QA aislado. CitasF2 tiene 31 campos físicos, revisión live 42 y un item; la reserva nativa asociada está CANCELED mientras la proyección sigue CONFIRMED (bloqueo P1). El estado y checklist vigentes están en `ESTADO_ACTUAL_PROYECTO.md`.

## Arquitectura y fuente de verdad

- **Wix** es el centro operativo: Bookings, Stores/eCommerce, Payments, CRM, POS/Owner y Automations, según disponibilidad real del plan, país y configuración.
- **Velo** se limita a lógica imprescindible cuya necesidad esté demostrada y que Wix no cubra. La reserva dual F1–gap–F2 es el caso propio identificado; debe conservar revalidación, mismo profesional, idempotencia y compensación.
- **Microsoft 365** aporta archivo documental mediante SharePoint y, si la licencia lo permite sin coste adicional, Power Automate. Flujo previsto unidireccional Wix backend → Power Automate → SharePoint.
- No se incorporan proveedores, middleware ni servicios de pago/fiscalidad/email/IA externos por defecto. Cualquier excepción requiere justificar necesidad, alternativas, coste total y aprobación expresa.
- No duplicar en CMS propio funciones que Wix ya gestione suficientemente. Antes de retirar módulos o datos, auditar consumidores, históricos, automatizaciones y rollback.

## Documentos raíz

1. [Estado vigente consolidado y checklist](ESTADO_ACTUAL_PROYECTO.md): autoridad de continuidad a 2026-11-13; incluye HEAD, estado Wix live, inventario CMS, contrato CitasF2, bloqueos y checklist priorizado.

2. [Auditoría y migración CitasF2](docs/qa/2026-11-13-citasf2-keyfields.md): esquema físico, campos canónicos, poda de campos huérfanos y estado de sincronización.

3. [Adaptaciones temporales para QA](docs/qa/2026-11-13-site-qa-environment.md): permisos CMS, reserva sintética, automatizaciones, simuladores y límites de aislamiento.

4. [Auditoría de persistencia CMS](docs/qa/2026-11-13-custom-cms-registration-audit.md): inventario NATIVE/WIX_APP y estado de persistencia por dominio.

5. [Referencia maestra QA del 11-11](docs/qa/2026-11-11-qa-master-reference.md): evidencia histórica de aislamiento y restricciones previas.

4. [Directrices de arquitectura, desarrollo y QA](DIRECTRICES_DESARROLLO_CODIGO.txt): reglas obligatorias y límites.
5. [Dossier técnico consolidado](DOSSIER%20TÉCNICO%20CONSOLIDADO.md): arquitectura, contratos, módulos, CMS y estado técnico verificado.
6. [Flujos end-to-end Capa 3](DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md): diseño documental Wix–M365 y despliegue pendiente.
7. [Estado actual del proyecto](docs/PROJECT-STATUS.md): estado verificado, bloqueos y prioridades.

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

## Documentación

- [Reconciliación del informe técnico de bugs (2026-11-12)](docs/audits/2026-11-12-report-bugs-reconciliation.md)

- [Registro de decisiones de negocio y arquitectura](docs/DECISION-LOG.md)
- [ADR — Depósitos y gestión nativa de inventario](docs/adr/2026-11-10-deposit-and-native-inventory.md)
- [QA — Retirada de inventario personalizado](docs/qa/2026-11-10-native-inventory-retirement.md) oficial

- [Wix CLI for Sites: configuración](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites)
- [Estructura del repositorio Wix](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/git-hub-repository-file-structure)
- [Paquetes npm con Wix CLI](https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/packages/work-with-npm-packages-with-the-wix-cli)
- [Comandos Wix CLI for Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands)


## Última actualización documental

Última consolidación: 2026-11-13 20:51 CET. `ESTADO_ACTUAL_PROYECTO.md` es el punto de entrada vigente. `docs/PROJECT-STATUS.md` conserva el estado histórico previo y debe leerse con el addendum de vigencia que remite al documento raíz.
