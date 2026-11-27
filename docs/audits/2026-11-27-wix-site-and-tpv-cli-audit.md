> **Baseline histórico — anterior a PR #640 (2026-11-27).** Este informe registra los gaps detectados antes de integrar clasificación temporal y gate de venta. No usar sus conclusiones de implementación como estado actual. La implementación posterior está descrita en [TPV-UNIFIED-FLOW](../TPV-UNIFIED-FLOW.md), [STATE-NOW](../STATE-NOW.md) y [RELEASE-READINESS](../RELEASE-READINESS.md). El estado read-only posterior está en [aceptación MVP](2026-11-27-mvp-runtime-readonly-acceptance.md).

# Auditoría Wix, TPV y Wix CLI — 2026-11-27

**Resultado ejecutivo: NO-GO funcional para TPV; sitio Wix en Draft; CI offline PASS; Wix Preview/Runtime NO EJECUTADO.**  
**Repositorio:** `nachoortegazgz/marianmadridz` · **main auditado:** `d95c2321f5227e987b22455150fd7a62b4129fa0`  
**Sitio:** Marian Madrid · `188bed94-177c-4bc9-a9f0-35080d874f3e`

## 1. Alcance y método

Auditoría de solo lectura realizada el 2026-11-27 mediante:
- GitHub: árbol, código Velo/HTML, configuración, tests, workflows y ejecución CI.
- Wix Site Context y Wix REST: estado del sitio, páginas estáticas/dinámicas y CMS.
- Wix CLI docs: contraste del flujo CLI y del workflow ya versionado.
- HTTP público: comprobación limitada de rutas indexadas por el buscador. Las respuestas disponibles son rastreos antiguos y no sustituyen una prueba de Preview actual.

No se ejecutaron escrituras CMS, reservas, pagos, devoluciones, notificaciones, operaciones fiscales ni publicación.

## 2. Estado GitHub y CI

- `main` apunta a `d95c2321f5227e987b22455150fd7a62b4129fa0`.
- PR #638 integrada. Añade fingerprint `TPV_BRIDGE_DIAGNOSTICS_2026-11-27` y diagnóstico del bridge.
- GitHub Actions run `45948074849`: **Backend quality gates SUCCESS**.
- Suite offline: **80 suites, 759 tests, 0 fallos**.
- Completados: instalación bloqueada por lockfile, auditoría de dependencias según umbral del workflow, Layer 1, Layer 2, suite completa, verificaciones SDK eCommerce/TPV y ESLint.
- El umbral de npm audit falla ante advisories high/critical; un resultado correcto no significa ausencia absoluta de advisories.
- La CI no prueba código sincronizado en Wix, permisos reales, Preview, iframe real ni persistencia runtime.

## 3. Estado actual del sitio Wix

Read-back de `GetSiteContext`:
- Estado: **Draft**; no publicado según Wix.
- Editor Type: **Editor** (Wix Editor clásico), Velo habilitado, plan Premium y dominio personalizado.
- Última actualización indicada por Wix: 2026-11-27 05:37.
- Zona horaria `Europe/Madrid`, moneda `EUR`, región `ES`.
- Apps instaladas: Wix Bookings, Forms & Payments, Gift Cards, Invoices V1, Members Area, Payments, Stores Catalog V3, Blog y SEO.

La lectura de Site Context y de páginas devuelve `published=false`.

### Inventario de páginas

| Tipo | Página | Ruta |
|---|---|---|
| Estática | Inicio | `/inicio` |
| Estática | Catálogo | `/reserva-online` |
| Estática | Promociones | `/promociones` |
| Estática | Blog | `/blog` |
| Estática | Privacidad y Cookies | `/politica-privacidad-texto` |
| Estática | Carrito | `/cart-page` |
| Estática | MUY PRONTO | `/muy-pronto` |
| Estática | ZONA MARIAN | `/zona-marian` |
| Estática | TPV | `/blank` |
| Dinámica | Calendario de reservas 2 | `/booking-calendar` |
| Dinámica | Página de servicio 2 | `/service-page` |

Wix devolvió 9 páginas estáticas y 2 dinámicas. El TPV está registrado como página estática con ID `yl5th` y ruta `/blank`; no se debe asumir que su ruta es `/tpv`.

### Comprobación HTTP pública limitada

El buscador pudo recuperar contenido de `/`, `/reserva-online` y `/promociones`, pero sus rastreos datan de hace 3–6 meses. Otras rutas no fueron recuperables por el rastreador (errores de acceso/cache); eso no demuestra que respondan 404. Como Wix indica Draft y `published=false`, el contenido indexado puede corresponder a una versión publicada anterior. No se certifica el estado actual de las páginas públicas.

## 4. CMS — estado leído

| Colección | Registros | Estado relevante |
|---|---:|---|
| `HistoricoCierresZ` | 1 | Cierre sintético del 23-11-2026 |
| `CajaActual` | 1 | Singleton existente en estado `ABIERTA` |
| `MovimientosCaja` | 5 | Movimientos sintéticos de 20, 21 y 23-11 |
| `TransaccionesTPV` | 0 | Sin transacciones comerciales persistidas |
| `ControlOperativo` | 78 | Locks, auditoría y controles operativos |

El cierre existente tiene `closingType=Z_SIMULATED`, 3 operaciones, ventas brutas 55 €, devoluciones 35 €, efectivo neto 20 €, firma `NOT_SIGNED` y estado AEAT `NOT_SENT`. No es un cierre del 26/11 ni acredita ventas de ese día.

La caja singleton está abierta. No se ha abierto, cerrado ni actualizado. La sesión actual impide tratar una apertura nueva como prueba aislada sin resolver antes la precondición de sesión.

## 5. TPV personalizada — diagnóstico de código y CMS

### Interfaz y bridge

- `src/pages/TPV.yl5th.js` enlaza `#htmlTPV` con `public/tpvPageController.js`.
- El HTML versionado está en `#htmlTPV.txt`.
- El controlador importa los WebMethods operativos de caja, ventas, movimientos, devoluciones, cierres, catálogo, auditoría, permisos y exportación; no importa el runtime de pruebas separado.
- El widget y el controlador comparten tipos de mensajes y respuestas; el origen del iframe no usa comodín.
- La interfaz contiene el aviso **MODO CONSULTA**. La tarifa personalizada está deshabilitada. Solo EFECTIVO y TARJETA aparecen habilitados; Bizum, bono, tarjeta regalo y otros están deshabilitados. El impuesto se presenta como cálculo Wix de solo lectura.
- El test `tpv-ui.qa-source.test.mjs` valida parseo del script, controles, operaciones, DTO y gates; `tpv-widget.contract.test.mjs` valida el contrato del bridge. Son pruebas de fuente, no interacción en Wix.

### Gates funcionales reales

`validarVentaBorrador()` devuelve `saleReady=false` mientras existan bloqueos como:
- `FISCAL_CONFIG_UNVERIFIED`
- `PAYMENT_NOT_VERIFIED`
- `CONSUMER_PRICE_PRESENTATION_UNVERIFIED`
- `FISCAL_WRITER_DISABLED`
- `INVENTORY_POLICY_NOT_CONFIGURED` cuando hay productos.
- La preparación también comprueba la configuración de impuestos Wix y el tratamiento de precios con IVA.

`FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED` y `ALLOW_SIMULATION_RECORDS` permanecen en `false`. El estado de permisos `operationalWritesAvailable=true` describe capacidades operativas no fiscales; no equivale a venta lista, pago verificado ni autorización de cierre Z. En `tpvPermisos.web.js`, devolución, Ticket Z y exportación de auditoría siguen deshabilitados.

### Hallazgo contractual importante

`registrarVenta()` vuelve a resolver catálogo e impuestos y valida líneas, pago, sesión, autorización e idempotencia. Sin embargo, la ruta de escritura comercial no consume los `saleReadinessBlockers` devueltos por `validarVentaBorrador()`: puede persistir una intención `PENDING_PAYMENT` en `TransaccionesTPV` aunque la cotización de UI indique `saleReady=false`. El flujo omite Draft Order y proveedor de pago, y no acredita cobro ni movimiento físico; aun así, la diferencia entre el gate de interfaz y el WebMethod debe resolverse para que el contrato sea inequívoco.

Además, el registro comercial construye `sourceType: "SYNTHETIC"` como literal. La búsqueda de código fuente no encontró implementación de `productionActivationAt` ni de `recordNature` en `src/`. La decisión de flujo único exige que la naturaleza se derive en backend de `recordTimestamp` UTC frente al corte oficial. La clasificación temporal está documentada, pero no está implementada en la ruta examinada. No debe habilitarse actividad real hasta corregirlo y añadir pruebas de frontera temporal.

### Contrato de colecciones pendiente de reconciliación

El código asigna ventas comerciales pendientes a `TransaccionesTPV` y movimientos físicos a `MovimientosCaja`; el read-back confirma 0 registros en `TransaccionesTPV`. Parte de la documentación canónica histórica afirma que no debe crearse esa colección. Debe quedar decidido documentalmente si `TransaccionesTPV` es una intención comercial no contable separada o si esa persistencia se retira. No mezclarla con el ledger físico.

### Estado de aceptación TPV

| Prueba | Estado |
|---|---|
| Contrato HTML/controller | PASS estático en CI |
| Validación de importes y DTO | PASS offline |
| Resolución catálogo/impuestos por código | Contrato cubierto; respuesta live no repetida en esta auditoría |
| Permisos reales y sesión Wix | NO EJECUTADO |
| Bridge real HTML Component en Preview | NO EJECUTADO |
| Apertura/venta/movimiento/arqueo | NO EJECUTADO |
| Ticket X / cierre Z | NO EJECUTADO |
| Devolución y conciliación | NO EJECUTADO |
| Idempotencia/concurrencia en Wix CMS | NO EJECUTADO |
| Cobro real | NO AUTORIZADO / NO EJECUTADO |

## 6. Wix CLI — capacidad real y workflow disponible

El repositorio contiene `.github/workflows/wix-tpv-preview.yml`:
- Solo se activa por `workflow_dispatch`; `create_preview=false` por defecto.
- Verifica el `siteId` y `uiVersion` de `wix.config.json`.
- Requiere el secreto `CLI_API_KEY` con permiso Wix CLI for Sites - Git Integration.
- Instala `@wix/cli@1.2.14` y ejecuta `wix preview --source remote` sobre `main`; no publica.
- Ejecuta Playwright sobre la URL de Preview y guarda un artefacto de smoke.

El smoke actual **no es una prueba funcional TPV**: permite GET/HEAD/OPTIONS, bloquea endpoints dinámicos (`_api`, `_functions`, `_serverless`, `api`, `graphql`), no hace clics ni rellena formularios, y declara 0 interacciones. Comprueba documento/renderizado y errores de consola, no WebMethods ni persistencia CMS.

La integración Wix disponible en esta sesión permite consultar documentación CLI y ejecutar APIs Wix, pero no expone un ejecutor de comandos CLI ni una acción GitHub `workflow_dispatch`. Por ello no he podido iniciar el workflow desde aquí. No se afirma que el Preview CLI haya sido ejecutado.

La documentación oficial consultada distingue:
- Wix CLI for Apps y Wix CLI for Headless: proyectos de apps/headless, no sustituyen automáticamente el desarrollo Velo de este sitio.
- Wix CLI Origami: exportación/importación beta de sitios **Studio Two**; el Site Context actual identifica este sitio como **Editor**, por lo que no se debe aplicar Origami.
- El workflow versionado de Wix CLI for Sites es el mecanismo del repositorio para crear Preview no publicador, sujeto al secreto y a su ejecución real.

## 7. Riesgos y acciones priorizadas

1. **P0 — clasificación sintético/real:** implementar `recordTimestamp`, `productionActivationAt` y `recordNature` en backend; rechazar fechas/configuración inválidas y probar antes, igual y después del corte.
2. **P0 — coherencia del writer:** definir si `registrarVenta` puede persistir una intención pendiente cuando `saleReady=false`; alinear el contrato WebMethod/UI y cubrir llamadas directas.
3. **P0 — contrato de colecciones:** resolver la discrepancia documental sobre `TransaccionesTPV` sin mezclar ventas pendientes y movimientos físicos.
4. **P1 — sesión aislada:** diseñar la prueba sobre sesión independiente sin cerrar ni reutilizar el singleton `CajaActual` existente.
5. **P1 — Preview CLI:** ejecutar manualmente `Wix TPV Preview (non-production)` desde GitHub Actions con `create_preview=true` y revisar el artefacto. El smoke actual debe ampliarse por separado si se pretende cubrir todas las rutas estáticas.
6. **P1 — runtime funcional:** después de sincronizar el código Velo, ejecutar pruebas autorizadas de WebMethods, bridge, persistencia y read-back en Wix Preview; mantener pagos, devoluciones bancarias, notificaciones y AEAT simulados/deshabilitados.

## 8. Resultado de esta auditoría

- **Verificado:** main SHA, CI offline, Site Context, inventario de páginas, inventario CMS y contratos de código descritos.
- **Declarado por código:** gates de venta, permisos, ruta de intención pendiente y configuración fiscal fail-closed.
- **Inferido:** contenido público indexado puede ser una versión anterior, dada la antigüedad de los rastreos y el estado Draft actual.
- **Pendiente:** Wix CLI Preview, sincronización Git-Wix, runtime TPV, resto de páginas con interacción, reservas reales/sintéticas, carrito/checkout, pagos, hardware y cierre Z.
- **Mutaciones realizadas:** ninguna. **Publicación:** ninguna.



## Addendum — decisión de política TPV 2026-11-27 (PR #651)

La auditoría inicial describe el estado previo a esta rama y queda superada en los puntos de política de entorno y gates globales. La implementación actual elimina `recordNature`/`productionActivationAt` como clasificador, deja de excluir filas por marcadores SIMULATED/SYNTHETIC, unifica el lector operativo e histórico y elimina el hard gate global `TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED`. Las escrituras siguen sometidas a autorización, idempotencia, locks, validación de catálogo/impuestos, contrato de movimiento, hashes y datos fiscales obligatorios. Los fallos devuelven códigos de dominio y detalle técnico.

La política de datos prohíbe borrado individual y masivo. Las intenciones comerciales y proyecciones editables se actualizan mediante validación backend. Los ledgers ya contabilizados y evidencia laboral/cierres no se sobrescriben directamente; se corrigen con registros rectificativos por exigencia de trazabilidad y cumplimiento. Esta rama no acredita Wix Runtime E2E ni publicación.
