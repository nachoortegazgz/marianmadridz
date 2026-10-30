# Marian Madrid — Wix Editor + Velo

Repositorio canónico de código del sitio **Marian Madrid Peluquería y Estética**. Las ramas de trabajo no se publican automáticamente en Wix ni equivalen a producción.

## Requisitos

- Git.
- Node.js **v24.22.1 o superior** (requisito oficial actual de Wix CLI for Sites).
- npm.
- Acceso SSH al repositorio y cuenta Wix con permisos sobre el sitio.

## Preparación local

1. Clona el repositorio conectado al sitio y entra en su raíz (la que contiene `wix.config.json`).
2. Comprueba que `node -v` devuelve `v24.22.1` o superior.
3. Instala Wix CLI for Sites globalmente: `npm install -g @wix/cli`.
4. Instala las dependencias del proyecto con `npm install`.
5. Inicia sesión con `wix login` si es necesario y comprueba la cuenta con `wix whoami`.
6. Comprueba `git status --short` antes de modificar dependencias.
7. Ejecuta `npm run dev` para abrir el Editor local asociado al `siteId` de `wix.config.json`.

No se ejecuta `wix sync-types` en `postinstall`: ese comando falló con el CLI disponible y no debe bloquear la instalación. No mezclar el Wix CLI genérico para Apps/Headless con **Wix CLI for Sites**, que es el correspondiente a este Wix Editor clásico.

## Dependencias npm de Wix

Las dependencias instaladas para el sitio se gestionan con Wix CLI for Sites (`wix install`, `wix update`, `wix uninstall`), no editando manualmente los artefactos generados. Wix crea `src/velo.dependencies.json` al instalar el primer paquete npm y lo actualiza automáticamente al instalar paquetes con Wix CLI; no editarlo a mano. El CLI también actualiza los archivos de dependencias del sitio.

Para resolver dependencias ausentes del lock, ejecutar desde la raíz del proyecto, una por una, `wix install @wix/stores` y `wix install @wix/site-pricing-plans`. Revisar inmediatamente `git diff -- package.json wix.lock src/velo.dependencies.json`: conservar las versiones compatibles fijadas en `package.json` y detenerse si el CLI propone una actualización no aprobada. No publicar en esta fase.

## Validación

- `npm run lint`: análisis estático.
- `npm test`: todas las suites offline registradas por el runner canónico.
- `npm run test:layer1`: contratos de reservas, disponibilidad y concurrencia.
- `npm run test:layer2`: flujos operativos, datos y fiscalidad.

Las pruebas offline usan mocks del entorno Wix; **no prueban** CMS, Bookings ni pagos reales.

## Limitación temporal de ESLint

La regla `@wix/cli/no-invalid-backend-import` está desactivada temporalmente porque el plugin falla al cargar cuando falta el manifiesto generado `src/velo.dependencies.json`. **Esto no valida los imports de backend**: antes de retirar esta excepción hay que regenerar el manifiesto con el Wix CLI for Sites compatible con el Editor clásico y volver a ejecutar lint. No publicar mientras siga pendiente.

## Preview y publicación

1. Ejecuta lint y pruebas, y resuelve todos los fallos.
2. Abre el Editor local con `npm run dev` y valida los cambios en el sitio correcto.
3. Usa Preview cuando el flujo de Wix lo permita y verifica reservas, logs y datos.
4. Publica solo el commit validado, seleccionando conscientemente el origen en Wix CLI for Sites.
5. Tras publicar, verifica el dominio y el flujo real de reservas.

No se debe publicar una rama de auditoría sin validar ni asumir que GitHub y el sitio publicado están sincronizados.

## Documentación oficial

- [Requisitos y configuración de Wix CLI for Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites)
- [Estructura del repositorio y `velo.dependencies.json`](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/git-hub-repository-file-structure)
- [Instalación y actualización de paquetes npm](https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/packages/work-with-npm-packages-with-the-wix-cli)

- [Configurar Git Integration y Wix CLI](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites)
- [Comandos del Wix CLI para Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands)
- [Acerca de Git Integration y Wix CLI](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/about-git-integration-wix-cli-for-sites)
