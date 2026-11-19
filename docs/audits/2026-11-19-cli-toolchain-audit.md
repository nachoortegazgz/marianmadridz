# Auditoría de toolchain Wix CLI y GitHub Actions — 2026-11-19

## 1. Objetivo

Aumentar la reproducibilidad del flujo Wix CLI for Sites y homogeneizar las dependencias de GitHub Actions, sin publicar el sitio, modificar Wix CMS ni regenerar artefactos Wix desde un entorno no conectado.

## 2. Diagnóstico y evidencia

Baseline inspeccionado: `main` en `71b57a83ab9719fba8cc65cfac112739e2f0a9ec` (PR #422 integrada).

| Elemento | Estado previo | Resultado de auditoría |
|---|---|---|
| `wix.config.json` | Site ID y UI version configurados | Verificado: Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`, UI version `15941` |
| Node.js | `24.22.1` en CI | Verificado; CI conserva versión exacta y README aclara mínimo local Wix `24.22.1+` |
| `@wix/cli` | Instalación global sin versión | No reproducible; se fija `1.2.14` en el workflow Preview y en README |
| GitHub Actions | checkout v5/v4/SHA; setup-node v5/v4 | Homogeneizadas: checkout v6.0.0 y setup-node v5.0.0, ambos por SHA |
| Preview | Manual, default false | Se conserva: `workflow_dispatch`, rama `main`, `create_preview=false`, sin `wix publish` |
| `package-lock.json` | npm lockfile | Verificado: lockfileVersion 3; dependencias raíz y versiones directas coinciden con `package.json` |
| `wix.lock` | Archivo versionado, excedía límite de lectura habitual | Leído mediante API GitHub; cabecera declara artefacto generado y menciona Yarn Plug'n'Play |
| `wix.lock` / Stores | Correspondencia no confirmada | Discrepancia demostrada: resolución raíz `@wix/stores@1.0.960` frente a `1.0.997` en `package.json` y `package-lock.json` |

### Wix Preview y README

El README previo no contenía literalmente la afirmación de que Actions nunca inicia Preview; tampoco describía el workflow manual. Se añade una explicación explícita para eliminar ambigüedad: el workflow puede crear Preview únicamente tras activación manual y con `create_preview=true`; no publica.

### Integridad de wix.lock

- El archivo está versionado (blob SHA observado: `e98e65714d58f877abaa2369ba84cd72d307af89`).
- Su contenido se identifica como generado automáticamente y advierte que no debe editarse.
- La comprobación estática dirigida no encontró cadenas `CLI_API_KEY`, claves privadas PEM, tokens Bearer ni patrones de API key Wix. Esto no sustituye al workflow Gitleaks.
- No se ha modificado ni regenerado. No hay evidencia suficiente en esta sesión para afirmar que su resolución corresponde al estado actual del checkout Wix. La divergencia de Stores debe resolverse en el entorno local conectado, no parcheando el archivo manualmente.

## 3. Cambios implementados

1. Fijar `@wix/cli@1.2.14` en la instalación global del workflow Preview y mostrar la versión instalada.
2. Fijar `actions/checkout@v6.0.0` por SHA `1af3b93b6815bc44a9784bd300feb67ff0d1eeb3`.
3. Fijar `actions/setup-node@v5.0.0` por SHA `a0853c24544627f65ddf259abe73b1d18a591444`.
4. Aplicar las mismas referencias de Actions en los tres workflows: calidad offline, Preview y secret scanning. Gitleaks conserva su SHA existente.
5. Documentar versiones, procedimiento local, condiciones de Preview y estado real de `wix.lock` en README.

## 4. Impacto y riesgos

- Cambios limitados a tres workflows y README; no se modifica código funcional.
- El pin de CLI hace reproducible la versión directa del ejecutable, pero no certifica por sí solo la compatibilidad runtime Wix ni sustituye una actualización periódica revisada.
- La divergencia `@wix/stores` en `wix.lock` queda abierta. No debe resolverse mediante edición manual, borrado ni actualización masiva de dependencias.
- La existencia y validez del secreto `CLI_API_KEY` no se inspecciona ni modifica.
- El workflow Preview sigue requiriendo autorización manual y no contiene pasos de publicación.

## 5. Validación

**Verificado por lectura de GitHub:** configuraciones, Site ID/UI version, workflows, package.json, package-lock.json y contenido de wix.lock.

**Pendiente de ejecución:** CI de la rama/PR, instalación real de Wix CLI, `wix whoami`, autenticación, Wix Local Editor, Preview runtime y reconciliación de wix.lock desde el checkout local.

No se declara validado ningún flujo runtime ni despliegue.

## 6. Despliegue y reversión

No hay despliegue Wix. Revertir este cambio consiste en revertir el PR/commit documental y de workflows. No requiere ni autoriza cambios CMS.

## 7. Fuentes

- Wix Git Integration & Wix CLI for Sites: https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites
- Wix CLI requirements and installation: https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites
- npm `@wix/cli`: https://www.npmjs.com/package/@wix/cli
- GitHub Actions checkout: https://github.com/actions/checkout
- GitHub Actions setup-node: https://github.com/actions/setup-node
