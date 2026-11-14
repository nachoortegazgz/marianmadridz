## Estado de ingeniería — reconciliación 2026-11-14

- `main` baseline: `79b6238fe4c23206bb8e81327191ab48425e3a0d` (PR #351 integrada).
- PR #351 dejó incompleta la recuperación de validadores compartidos; PR #352 restaura contratos y añade pruebas, pendiente de CI.
- CMS live: 41 colecciones (12 NATIVE / 29 WIX_APP), 980 campos. No existen live `DatosFiscales`, `InventarioStockVenta` ni `MovimientosInventario`.
- `QA_RECORD_MUTATIONS_ENABLED=true`: solo fase QA; producción bloqueada. No se ha publicado esta tanda.
- No hay release Wix vinculado al SHA de Git ni certificación E2E runtime. Capa 3 no está operativa certificada.

Evidencia: [reconciliación de baseline 2026-11-14](docs/qa/2026-11-14-baseline-reconciliation.md).

---

# Estado operativo — actualización 2026-11-14

**Gobierno del proyecto:** el usuario/propietario es la SSOT de negocio, prioridades y autorizaciones. Durante desarrollo y QA están en pausa append-only y las prohibiciones genéricas de editar/eliminar registros (individuales y masivas) hasta nueva instrucción expresa del usuario para preparar el despliegue. Se mantienen autenticación, autorización, permisos y validaciones. La política documental no certifica por sí sola que todos los guards del runtime Wix hayan sido retirados.

**Estado Git verificado:** main=`79b6238fe4c23206bb8e81327191ab48425e3a0d` (PR #351 integrada). PR #352 recupera los validadores que PR #351 retiró accidentalmente; está pendiente de CI y revisión. No hay release Wix que vincule el runtime con el SHA de Git.
# Marian Madrid — Wix Editor + Velo

> **Contexto de plataforma:** el sitio principal consta como Published en el último contexto Wix documentado; eso no acredita que ejecute el SHA actual de Git. El sitio QA independiente está en Draft, pero su aislamiento y paridad CMS no están certificados. El inventario live vigente es 41 colecciones (12 NATIVE, 29 WIX_APP).

Repositorio canónico del sitio **Marian Madrid Peluquería y Estética** (`www.marianmadrid.es`). El repositorio contiene código, documentación y pruebas QA.

## Vigencia operativa — fase de desarrollo y QA (2026-11-14)

**Autoridad:** el usuario/propietario es la SSOT de negocio, requisitos, prioridades, criterios de aceptación y autorizaciones. Las instrucciones expresas posteriores del usuario prevalecen sobre decisiones y restricciones documentales anteriores. La documentación oficial de Wix y de las integraciones gobierna únicamente los contratos y límites técnicos de la plataforma.

**Mutabilidad CMS durante QA:** append-only e inmutabilidad están temporalmente en pausa. Se habilitan update y remove individuales y masivos para todas las colecciones CMS propias del proyecto, incluidas las históricamente tratadas como ledgers. Las operaciones masivas deben identificar explícitamente los registros por ID. No se habilitan escrituras en colecciones propiedad de Wix Apps ni se eluden autenticación, autorización/RBAC, permisos, validaciones de esquema, integridad técnica, secretos o límites de plataforma. La inserción mantiene su allowlist; los writers fiscales/contables/laborales, pagos, reembolsos, comunicaciones y efectos externos conservan sus gates funcionales independientes.

**Restauración:** esta política no se revierte automáticamente. Solo el usuario puede ordenar la restauración de append-only y de las restricciones de mutación para preparar el despliegue. No publicar a producción basándose únicamente en esta excepción de QA.

**Estado Git/Wix:** PR #344, PR #345 y PR #346 están integrados en main; HEAD actual b19a8f676d7be157d457588f6acf5332c2a34d32; merge del código QA PR #346: b68e4e048ce5fc1c022fc6ffc2643d5983972107. CI de PR #346: Layer 1 23 suites/296 pruebas, Layer 2 18 suites/246 pruebas, regresión completa 68 suites/627 pruebas; SDK contracts, ESLint y Gitleaks correctos. El usuario declara que la versión base anterior está publicada en Wix; la ampliación de mutaciones QA está integrada en Git pero aún no publicada en Wix. No se dispone de release Wix vinculado a SHA.

**CMS maestro:** MapaStaff revisión 36, 42 campos y 5 registros (3 STAFF, 1 TERCERO, 1 GESTORIA). DatosFiscales permanece como colección legacy con un placeholder QA; su retirada requiere verificar runtime y consumidores tras publicar el backend migrado.

---

## Arquitectura y fuente de verdad

- **Wix** es el centro operativo: Bookings, Stores/eCommerce, Payments, CRM, POS/Owner y Automations, según disponibilidad real del plan, país y configuración.
- **Velo** se limita a lógica imprescindible cuya necesidad esté demostrada y que Wix no cubra. La reserva dual F1–gap–F2 es el caso propio identificado; debe conservar revalidación, mismo profesional, idempotencia y compensación.
- **Microsoft 365** aporta archivo documental mediante SharePoint y, si la licencia lo permite sin coste adicional, Power Automate. Flujo previsto unidireccional Wix backend → Power Automate → SharePoint.
- No se incorporan proveedores, middleware ni servicios de pago/fiscalidad/email/IA externos por defecto. Cualquier excepción requiere justificar necesidad, alternativas, coste total y aprobación expresa.
- No duplicar en CMS propio funciones que Wix ya gestione suficientemente. Antes de retirar módulos o datos, auditar consumidores, históricos, automatizaciones y rollback.

## Documentos raíz

0. [Diccionario de datos CMS](DICCIONARIO_DATOS_CMS.md): esquema físico live de las 12 colecciones NATIVE, inventario de las 29 WIX_APP, keyfields, etiquetas CMS, nomenclatura, glosario, relaciones y límites de uso.

1. [Estado vigente consolidado y checklist](ESTADO_ACTUAL_PROYECTO.md): autoridad de continuidad a 2026-11-14; incluye HEAD, estado Wix live, inventario CMS, contrato CitasF2, bloqueos y checklist priorizado.

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

Última consolidación: 2026-11-14; ver addendum superior para el corte live y el estado de la rama. `ESTADO_ACTUAL_PROYECTO.md` es el punto de entrada vigente. `docs/PROJECT-STATUS.md` conserva el estado histórico previo y debe leerse con el addendum de vigencia que remite al documento raíz.
