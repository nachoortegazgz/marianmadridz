# Marian Madrid — Wix Editor + Velo

Repositorio conectado al sitio Wix **Marian Madrid Peluquería y Estética**. El sitio sigue la rama predeterminada del repositorio; los cambios de otras ramas no se sincronizan automáticamente con producción.

## Requisitos

- Git
- Node.js **v24.22.1 o superior**, según la documentación actual de Wix
- npm
- Clave SSH añadida a GitHub y acceso al repositorio
- Wix CLI para Sites instalado y sesión iniciada en Wix

## Preparación local

1. Clona este repositorio y entra en su carpeta.
2. Instala dependencias con `npm install`.
3. Instala el CLI de Wix si aún no está disponible: `npm install -g @wix/cli`.
4. Comprueba la cuenta activa con `wix whoami`.
5. Abre el Editor local conectado al sitio con `wix dev`.

El proyecto ejecuta `wix sync-types` durante `postinstall`. Si la instalación falla, conserva el error exacto y no lo eludas publicando.

## Validación y publicación

1. Ejecuta `npm run lint`.
2. Abre el Editor local con `wix dev` y prueba los cambios.
3. Genera una vista previa con `wix preview` cuando el sitio ya se haya publicado previamente.
4. Publica con `wix publish` únicamente después de validar los cambios y seleccionar conscientemente el origen correcto.

**Importante:** `wix publish` permite elegir entre el último commit de la rama predeterminada y el código local. Publicar código local sin haberlo sincronizado puede dejar producción y GitHub desalineados. No se debe publicar una rama de auditoría como si estuviera validada.

## Documentación oficial

- [Configurar Git Integration y Wix CLI](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites)
- [Comandos del Wix CLI para Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands)
- [Acerca de Git Integration y Wix CLI](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/about-git-integration-wix-cli-for-sites)
