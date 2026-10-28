# Marian Madrid — Wix Editor + Velo

Repositorio canónico de código del sitio **Marian Madrid Peluquería y Estética**. Las ramas de trabajo no se publican automáticamente en Wix ni equivalen a producción.

## Requisitos

- Git y Node.js compatible con la versión del Wix CLI para Sites instalada.
- npm.
- Acceso al repositorio y sesión autenticada en Wix.

## Preparación local

1. Clona el repositorio y entra en la raíz.
2. Instala las dependencias del proyecto con `npm install`.
3. Comprueba la cuenta activa con `wix whoami`.
4. Ejecuta `npm run dev` para abrir el Editor local asociado al sitio configurado en `wix.config.json`.

No se ejecuta `wix sync-types` en `postinstall`: ese comando falló con el CLI disponible y no debe bloquear la instalación. La sincronización de tipos debe realizarse mediante el flujo compatible con la versión instalada del Wix CLI para Sites.

## Validación

- `npm run lint`: análisis estático.
- `npm test`: todas las suites offline registradas por el runner canónico.
- `npm run test:layer1`: contratos de reservas, disponibilidad y concurrencia.
- `npm run test:layer2`: flujos operativos, datos y fiscalidad.

Las pruebas offline usan mocks del entorno Wix; **no prueban** CMS, Bookings ni pagos reales.

## Preview y publicación

1. Ejecuta lint y pruebas, y resuelve todos los fallos.
2. Abre el Editor local con `npm run dev` y valida los cambios en el sitio correcto.
3. Usa Preview cuando el flujo de Wix lo permita y verifica reservas, logs y datos.
4. Publica solo el commit validado, seleccionando conscientemente el origen en Wix CLI for Sites.
5. Tras publicar, verifica el dominio y el flujo real de reservas.

No se debe publicar una rama de auditoría sin validar ni asumir que GitHub y el sitio publicado están sincronizados.

## Documentación oficial

- [Configurar Git Integration y Wix CLI](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites)
- [Comandos del Wix CLI para Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands)
- [Acerca de Git Integration y Wix CLI](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/about-git-integration-wix-cli-for-sites)
