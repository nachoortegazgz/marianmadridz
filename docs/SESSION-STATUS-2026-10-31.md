# Marian Madrid — Estado consolidado de sesión

**Fecha de actualización:** 2026-11-01  
**Repositorio canónico:** https://github.com/nachoortegazgz/marianmadridz  
**Rama de documentación actual:** `docs/canonical-repository-reference-2026-11-01`  
**HEAD de `main` verificado:** `1c1165d32795fa1fc8b646f4a3e249af8e58e228`  
**Último cambio funcional integrado:** [PR #22 — Bookings V2 cancellation event contract](https://github.com/nachoortegazgz/marianmadridz/pull/22)  
**Wix Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Dominio:** https://www.marianmadrid.es/

## 1. Estado verificado

- La PR #19 (checkout Cart V2) está **fusionada** en `main` mediante `ff16a703856b3f997ff73e1a56932e185f72a66a`.
- La PR #22 (contrato de evento de cancelación Bookings V2) está **fusionada** en `main`; su merge commit es el HEAD verificado `1c1165d32795fa1fc8b646f4a3e249af8e58e228`.
- La PR #23 (envoltorio webhook REST) está **cerrada sin merge**; no se incorpora su implementación.
- El run #310 de **Backend quality gates** fue `completed / success` para `be55b725`, pero no demuestra CI del HEAD actual. La consulta de checks y runs asociada al HEAD `1c1165d` no devolvió resultados; CI actual queda **sin verificar**.
- Wix identifica el Site ID anterior como **Published**, plan Premium, dominio personalizado, Editor clásico y Velo habilitado.
- Wix Apps observadas: Bookings, Stores **Catalog V1**, Invoices **V1**, Members, Forms & Payments y Gift Cards.
- No se ha realizado publicación Wix ni mutación de CMS durante esta consolidación.

## 2. Cambios de código ya presentes en la rama

### Booking / checkout

- `src/backend/booking/bookingCore.js`: cabecera `v5020-CART-V2-ITEM-VALIDATION`.
- Checkout eCommerce Cart V2 con `createCart`, `calculateCart` y `getCheckoutUrl`.
- Para Bookings, el carrito usa el booking F1 como `catalogReference.catalogItemId`; la asociación dual mantiene F2 vinculada mediante `pairToken` y solo cobra F1.
- Validación fail-closed previa a devolver checkout URL: el carrito calculado debe contener exactamente una línea del booking F1 esperado y el item no debe estar marcado como no disponible.
- Separación del estado de pago de la confirmación final de Bookings.

### Seguridad / fiscalidad

- Rate limiter persistente GCRA en `ControlOperativo`, con compare-and-set por versión y limpieza condicionada.
- Webhook fiscal preserva el total explícito de pedido `0.00`; si falta total explícito, prioriza importes de línea después de descuentos.
- Seis pruebas fiscales de regresión añadidas a la batería de capa 2.
- Suite Cart V2 ampliada a once casos, incluidos carrito vacío, bookingId discordante y artículo no disponible.

### Wix CLI / manifiesto

- Workflow `.github/workflows/wix-cli-manifest.yml` usa el secreto GitHub `CLI_API_KEY` como `WIX_CLI_API_KEY`.
- El workflow instala Wix CLI for Sites, ejecuta `wix install --npm @wix/data` y comprueba la versión esperada de `@wix/data`.
- **Verificado en `main` (2026-11-01):** `src/velo.dependencies.json` no existe (consulta GitHub Contents: 404). La regla ESLint `@wix/cli/no-invalid-backend-import` sigue desactivada temporalmente por esta razón.

## 3. Entorno Wix y QA

El usuario confirma expresamente que el Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e` y el dominio `www.marianmadrid.es` se usan como entorno QA aislado, sin actividad real.

Esta confirmación permite planificar pruebas persistentes controladas. No obstante, en esta sesión no se han ejecutado reservas ni escrituras de agenda/CMS. La comprobación de contexto Wix sigue mostrando el sitio como Published y Premium; esa etiqueta de Wix no invalida la confirmación del usuario, pero exige mantener identificados los datos de prueba y limpiar únicamente registros creados por el propio plan QA.

### Datos de prueba autorizados por el usuario

- Identidad y contacto: datos de prueba facilitados por el usuario en la conversación; no replicar teléfono ni email en documentación versionada.
- Método de pago: presencial / en el establecimiento.
- Ventana solicitada: semana próxima respecto a la fecha de ejecución de cada prueba.
- No realizar cobros online ni emitir documentos fiscales reales durante pruebas.

### Próxima batería E2E pendiente

1. Leer catálogo Bookings, servicios, recursos, profesionales y horarios efectivos.
2. Consultar disponibilidad real para la semana próxima en zona `Europe/Madrid`.
3. Ejecutar una reserva simple con pago presencial.
4. Ejecutar una reserva dual F1/F2, verificando gap de exposición y ausencia de solapamiento.
5. Verificar agenda nativa, profesional/recurso, datos de cliente y registros personalizados vinculados.
6. Verificar que no se crea pedido/cobro online ni documento fiscal indebido.
7. Comprobar cancelación y compensación de las reservas de prueba.
8. Registrar resultados en la colección de auditoría/QA existente solo después de identificar su nombre, permisos y esquema canónico.
9. Verificar notificaciones emitidas y evitar comunicaciones a terceros.
10. Limpiar los registros de prueba únicamente mediante los flujos soportados y conservar evidencia no sensible.

**Importante:** antes de insertar resultados en una colección, consultar el esquema real y los hooks. No escribir directamente en colecciones nativas `WIX_APP` ni en ledgers append-only. No inventar nombres de colecciones ni campos.

## 4. Bloqueos y riesgos abiertos

1. Confirmar resultado del workflow Wix CLI y generar/recuperar `src/velo.dependencies.json`.
2. Reactivar `@wix/cli/no-invalid-backend-import` y repetir lint tras disponer del manifiesto.
3. Validar Cart V2 y Bookings Writer V2 en runtime Wix, no solo con mocks offline.
4. Verificar compare-and-set del rate limiter bajo concurrencia real.
5. Resolver identidad anónima fiable: `anon:noip` agrupa llamadas anónimas y no representa una defensa anti-bot por IP.
6. Aclarar tratamiento fiscal de pedidos gratuitos/descuentos del 100 % antes de habilitar ventas online.
7. Verificar en la cuenta Wix la correspondencia exacta de servicios, recursos y horarios antes de crear reservas E2E.

## 5. Publicación y sincronización

- **GitHub:** el estado se consolida en este documento y en la descripción de PR #19.
- **Wix:** no se ha ejecutado `wix publish`, ni una publicación de Editor, ni una mutación CMS. El contexto Wix disponible identifica el sitio y sus aplicaciones, pero no proporciona evidencia de que el código de la rama feature esté sincronizado con el Editor ni de que sea seguro publicarlo.
- No publicar una rama Draft/no fusionada con manifiesto Velo pendiente y E2E runtime sin completar.
- La publicación queda bloqueada hasta completar QA, revisar el diff contra `main`, validar en el Editor vinculado y aprobar explícitamente el commit de despliegue.

## 6. Secuencia recomendada para la próxima sesión

1. Verificar el HEAD de `main`, las PR y los checks del commit antes de cada cambio. Último HEAD observado: `1c1165d`.
2. Generar `src/velo.dependencies.json` mediante Wix CLI for Sites; no crear ni editar manualmente el manifiesto. El workflow existente solo se activa con `push` a ramas `feat/**` o `workflow_dispatch`; el conector disponible no expone dispatch.
3. Reactivar `@wix/cli/no-invalid-backend-import` únicamente después de generar el manifiesto y confirmar que el lint completo pasa.
4. Ejecutar regresión offline, instalación limpia y lint sobre el HEAD candidato; exigir CI verde del commit exacto.
5. Inventariar servicios, recursos y horarios Bookings mediante lecturas en QA.
6. Ejecutar la batería E2E autorizada (reserva simple y dual, gap, pago presencial, cancelación, compensación y notificaciones controladas).
7. Documentar evidencia y limpiar solo registros QA creados por estas pruebas, usando flujos soportados.
8. Revisar y fusionar PR #24 (documentación) tras revisión; después abordar los bloqueos funcionales en ramas separadas.
9. No publicar Wix hasta disponer de Preview/E2E runtime satisfactorios y aprobación explícita del commit de despliegue.

## 7. Actualización de repositorio y documentación (2026-11-01)

- Repositorio canónico único: `nachoortegazgz/marianmadridz`.
- Corregidas en esta rama las referencias obsoletas del repositorio en `BIBLIA SSOT (v10.0) — MARIANMADRID.ES.txt` y `CMS KEYFIELDS.md`.
- Verificación posterior de ambos archivos: cero coincidencias con `marianmadridXXXXX` y `marianmadridX.git`.
- La búsqueda de código de GitHub no devolvió coincidencias indexadas; la verificación de referencias se hizo leyendo directamente los documentos versionados identificados en el árbol Git.
- Esta actualización solo cambia documentación. No altera código, CMS, reservas ni publicación Wix.

## 8. Regla de integridad de este informe

Este documento separa hechos verificados, cambios existentes en GitHub y tareas pendientes. No afirma que se hayan creado reservas, escrito resultados en CMS, sincronizado el código con Wix ni publicado cambios, porque esas acciones no se han ejecutado en esta sesión.
