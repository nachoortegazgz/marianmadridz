# Marian Madrid — Wix Editor + Velo

Repositorio canónico del sitio **Marian Madrid Peluquería y Estética** (`www.marianmadrid.es`) creado como QA para pruebas previas y simulacros previos a despliegue del sitio real en produccion. El proyecto se construye sobre Wix y sus Wix Apps nativas, con Microsoft 365 como capa documental externa.

## Arquitectura y fuente de verdad

- **Wix** es el centro operativo: Bookings, Stores/eCommerce, Payments, CRM, POS/Owner y Automations, según disponibilidad real del plan, país y configuración.
- **Velo** se limita a lógica imprescindible que Wix no cubra. La reserva dual F1–gap–F2 es el caso propio identificado; debe conservar revalidación, mismo profesional, idempotencia y compensación.
- **Microsoft 365** aporta archivo documental mediante SharePoint y, si la licencia lo permite sin coste adicional, Power Automate. Flujo previsto unidireccional Wix backend → Power Automate → SharePoint.
- No se incorporan proveedores, middleware ni servicios de pago/fiscalidad/email/IA externos por defecto. Cualquier excepción requiere justificar necesidad, alternativas, coste total y aprobación expresa.
- No duplicar en CMS propio funciones que Wix ya gestione suficientemente. Antes de retirar módulos o datos, auditar consumidores, históricos, automatizaciones y rollback.

## Documentos raíz

1. [Directrices vigentes del proyecto](DIRECTRICES%20VIGENTES%20DEL%20PROYECTO.md): reglas obligatorias y límites.
2. [Dossier técnico consolidado](DOSSIER%20TÉCNICO%20CONSOLIDADO.md): arquitectura, contratos, módulos, CMS y estado técnico verificado.
3. [Flujos end-to-end Capa 3](DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md): diseño documental Wix–M365 y despliegue pendiente.
4. [Bitácora técnica](BIT%C3%81CORA%20T%C3%89CNICA%20DE%20SESIONES%20%E2%80%94%20MARIANMADRID.md): decisiones y evidencias por sesión.

El código, la configuración viva de Wix, los contratos oficiales de las APIs y las pruebas ejecutadas tienen prioridad sobre afirmaciones históricas de los documentos. Registrar siempre fecha, rama/SHA y evidencia.

## Entorno de desarrollo

- Proyecto Wix Editor clásico con Velo y Wix CLI for Sites.
- Node.js mínimo: **24.22.1**, conforme a la documentación de Wix CLI for Sites consultada.
- Instalar dependencias con `npm ci`; usar Wix CLI for Sites para gestionar paquetes Wix.
- No editar manualmente artefactos generados por Wix CLI.
- Comandos de validación disponibles: `npm run lint`, `npm test`, `npm run test:layer1`, `npm run test:layer2`.

## Criterio de validación

Distinguir siempre:
- **Pruebas offline:** mocks y fixtures; no prueban Wix runtime.
- **QA/Preview:** evidencia de ejecución en el entorno Wix de pruebas.
- **E2E real:** flujo completo ejecutado en navegador/runtime, con sus integraciones reales y resultado comprobado.

CI verde no equivale a E2E ni a publicación. No afirmar que una función está operativa sin evidencia.

## Seguridad y operaciones

- No publicar, ejecutar Wix Preview ni desplegar cambios; estas acciones las realiza manualmente el propietario.
- No tocar producción ni CMS de producción sin autorización explícita.
- No crear reservas, pagos, devoluciones, movimientos económicos, emails ni automatizaciones activas sin autorización.
- No solicitar ni exponer secretos. No sortear controles de seguridad.
- No borrar código, colecciones o campos sin auditoría de consumidores, impacto, histórico y rollback.

## Documentación oficial

- [Wix CLI for Sites: configuración](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites)
- [Estructura del repositorio Wix](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/git-hub-repository-file-structure)
- [Paquetes npm con Wix CLI](https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/packages/work-with-npm-packages-with-the-wix-cli)
- [Comandos Wix CLI for Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands)
