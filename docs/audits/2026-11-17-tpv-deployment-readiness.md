# Auditoría de deuda técnica y preparación de despliegue TPV — 2026-11-17

## Estado ejecutivo

- Repositorio: `nachoortegazgz/marianmadridz`.
- HEAD de `main` auditado: `4eb3972232ff468ea6d13b2c823a9d40ede3a665`.
- Sitio Wix: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Editor: Wix Editor Classic; Velo habilitado; Stores Catalog V3; Invoices V1.
- Estado Wix comprobado por GetSiteContext: `Draft`.
- Página TPV: ID `yl5th`, ruta `/blank`; código `src/pages/TPV.yl5th.js`.
- No se ha ejecutado Preview ni Publish en esta auditoría.

## Evidencia revisada

Se inspeccionaron `package.json`, `package-lock.json`, `wix.config.json`, `.eslintrc.json`, `src/backend/internalConfig.js`, `src/backend/dataAccess.js`, los módulos y README de TPV, el controlador público, el bridge, el page code, el workflow Wix Preview y la documentación de integración.

Se confirmó en el código:
- Los nueve nombres de colecciones QA están centralizados en `TPV_QA_COLLECTIONS`.
- La política de runtime mantiene pagos reales, escrituras fiscales, notificaciones y hardware deshabilitados.
- `dataAccess.js` centraliza el acceso CMS elevado y aplica políticas por colección.
- `tpvQaRepository.js` concentra inserciones idempotentes y CAS de locks técnicos.
- El page code de TPV delega en `initializeTpvPage`; no se identificó motivo técnico para reescribirlo.
- Los contratos de catálogo usados son Bookings Services y Stores Catalog V3. GetSiteContext confirma esas apps y versiones.

La búsqueda GitHub no devolvió referencias a `bulkUpdateItems`, ni coincidencias de `TODO FIXME HACK` en el índice consultado. Esto no equivale a una búsqueda exhaustiva local de todos los símbolos exportados.

## Deuda y bloqueos confirmados

### P1 — Manifiesto de dependencias Velo ausente

- `src/velo.dependencies.json` no existe en el HEAD inspeccionado.
- `.eslintrc.json` mantiene desactivada la regla `@wix/cli/no-invalid-backend-import`.
- Consecuencia: hay una regla de ESLint desactivada y el archivo no está presente; no se ha demostrado que `src/velo.dependencies.json` sea un requisito de este proyecto Wix Editor Classic ni que la regla dependa de él.
- Acción: mantener la regla sin cambios hasta confirmar su alcance y requisitos en documentación/código oficial aplicables a Velo Editor Classic. No generar un manifiesto con comandos de Wix CLI for Apps: esos manifiestos pertenecen a proyectos de extensiones/app y no son equivalentes al código Velo del sitio. No editar `wix.lock`.

### P1 — Runtime y sincronización Wix no acreditados

- El merge en GitHub no acredita por sí solo que el Editor tenga el mismo SHA.
- El contenido versionado `#htmlTPV.txt` no acredita que esté instalado en el HTML Component `#htmlTPV`.
- Permisos de la página y prueba con roles ADMIN, GESTION, ESTILISTA, miembro ordinario y visitante pendientes.
- Preview, E2E, idempotencia y concurrencia contra CMS real pendientes.

### P1 — Automatizaciones y efectos externos

La última evidencia documentada registra automatizaciones preinstaladas activas con triggers de notificación/email y una automatización TPV custom inactiva cuya task no fue inspeccionada. Revalidar su estado antes de E2E que pudiera emitir notificaciones. No ejecutar esas automatizaciones durante esta fase.

### P2 — Toolchain y dependencias

- `package.json` fija ESLint 8.25.0 y `@wix/eslint-plugin-cli` 1.0.2.
- `package-lock.json` contiene dependencias transitivas marcadas deprecated.
- Un checkpoint histórico documentó 10 vulnerabilidades moderadas en `npm audit`; no se ha ejecutado un audit actual en este trabajo.
- Acción: ejecutar `npm audit --json` sobre el lockfile actual, atribuir cada hallazgo a dependencia directa/transitiva y evaluar compatibilidad del plugin Wix antes de actualizar ESLint. No ejecutar `npm audit fix --force` ni actualizar versiones por lote.

### P2 — Documentación histórica inconsistente

- `TPV-WIX-NATIVE-INTEGRATION.md` contenía una línea que declaraba Published pese a que el estado vigente es Draft.
- `TPV-CAJA-INTEGRATION.md` referenciaba una plantilla `src/pages/TPV.page-code.template.txt` que no existe.
- La guía de workflow afirmaba que `CLI_API_KEY` faltaba, aunque el estado del secreto no es visible desde la integración.
- Correcciones propuestas en PR #409; no fusionar hasta CI verde y revisión del diff.

## Decisiones de limpieza

No se eliminan módulos TPV, funciones, exports ni dependencias en esta intervención: no hay una prueba completa de ausencia de consumidores ni resultados de tests locales disponibles en el entorno actual. La página `TPV.yl5th.js` es un adaptador mínimo correcto; reescribirlo sería cambio cosmético. Los documentos históricos se conservan, pero se corrigen afirmaciones activas incorrectas.

No se alteran ledgers append-only, colecciones, índices, permisos, automatizaciones, pagos, reservas, datos de clientes ni configuración LIVE.

## Validación ejecutada

- Lectura GitHub de archivos y configuración: completada.
- GetSiteContext Wix: completado; Draft / Editor Classic / Velo / Stores V3 / Invoices V1.
- Búsquedas acotadas en GitHub: sin coincidencias de `TODO FIXME HACK` ni `bulkUpdateItems`; no es análisis AST exhaustivo.
- CI de PR #409: pendiente al redactar este informe.
- `npm test`, Layer 1, Layer 2, ESLint y `npm audit` ejecutados localmente: no ejecutados. Se incorpora un paso de auditoría reproducible al workflow existente en PR #411; resultado pendiente.
- Wix Preview, runtime, E2E y Publish: no ejecutados.

## Criterios de salida para despliegue

No autorizar Publish hasta que:
1. PR #409 esté integrada y CI esté verde.
2. Manifiesto Velo y regla de imports estén resueltos mediante flujo oficial.
3. Se confirme read-back del SHA en Wix Git Integration.
4. Se verifique el HTML Component real y los permisos de página.
5. Se ejecute Preview controlado sin escrituras ni efectos externos.
6. Se cierren pruebas de autorización, venta, devolución, idempotencia, concurrencia, conciliación y cierre en un entorno aislado.
7. Se revise la automatización y los canales externos.
8. Exista aprobación explícita de despliegue y estrategia de reversión.

**Conclusión:** el repositorio está preparado para continuar la validación técnica, pero no para publicación LIVE. La deuda más importante no es cosmética: es la ausencia del manifiesto de dependencias Velo y la falta de validación runtime/sincronización con Wix.
