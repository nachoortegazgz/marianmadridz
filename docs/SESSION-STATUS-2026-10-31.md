# Marian Madrid — Estado consolidado de sesión

**Fecha:** 2026-10-31  
**Repositorio canónico:** https://github.com/nachoortegazgz/marianmadridz  
**Rama de trabajo:** `feat/bookings-cart-v2-checkout-2026-10-30`  
**Commit auditado:** `be55b725578056e3e021cc61041d3faf62cc31c3`  
**PR:** [#19 — Bookings Cart V2 checkout](https://github.com/nachoortegazgz/marianmadridz/pull/19)  
**Wix Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Dominio:** https://www.marianmadrid.es/

## 1. Estado verificado

- GitHub Actions, workflow **Backend quality gates**, run **#310**: `completed / success`.
- El run #310 corresponde al commit `be55b725`; cuatro jobs completados correctamente según la comprobación previa de la sesión.
- Rama de trabajo: `feat/bookings-cart-v2-checkout-2026-10-30`.
- PR #19 sigue abierta y en Draft; no está fusionada.
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
- **Pendiente:** no se ha verificado la presencia de `src/velo.dependencies.json` en la rama consultada. La regla ESLint `@wix/cli/no-invalid-backend-import` sigue desactivada temporalmente por esta razón.

## 3. Entorno Wix y QA

El usuario confirma expresamente que el Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e` y el dominio `www.marianmadrid.es` se usan como entorno QA aislado, sin actividad real.

Esta confirmación permite planificar pruebas persistentes controladas. No obstante, en esta sesión no se han ejecutado reservas ni escrituras de agenda/CMS. La comprobación de contexto Wix sigue mostrando el sitio como Published y Premium; esa etiqueta de Wix no invalida la confirmación del usuario, pero exige mantener identificados los datos de prueba y limpiar únicamente registros creados por el propio plan QA.

### Datos de prueba autorizados por el usuario

- Cliente: Nacho Ortega
- Teléfono: 666724634
- Email: nachoortegazgz@gmail.com
- Método de pago: presencial / en el establecimiento
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

1. Recuperar este documento y verificar HEAD/PR/CI antes de cambiar código.
2. Verificar manifiesto Wix CLI y cerrar el bloqueo ESLint.
3. Inventariar servicios/recursos/horarios de Bookings mediante lectura.
4. Ejecutar la batería QA E2E autorizada con los datos de prueba anteriores, semana próxima, pago presencial.
5. Anotar resultados en agenda y colección QA identificada; adjuntar IDs de reserva y traceId, minimizando PII.
6. Ejecutar tests offline + lint + CI.
7. Revisar PR #19; mantener Draft si persiste cualquier fallo o falta evidencia runtime.
8. Solo tras aprobación: fusionar y desplegar el commit validado a Wix.

## 7. Regla de integridad de este informe

Este documento separa hechos verificados, cambios existentes en GitHub y tareas pendientes. No afirma que se hayan creado reservas, escrito resultados en CMS, sincronizado el código con Wix ni publicado cambios, porque esas acciones no se han ejecutado en esta sesión.
