# TPV — estado de implementación en el sitio actual (2026-11-16)

## 1. Alcance confirmado

- Sitio QA único: Marian Madrid Peluquería y Estética.
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Dominio: `https://www.marianmadrid.es/`.
- Editor: Wix Classic Editor (GetSiteContext devuelve `Editor`); Velo habilitado.
- Estado actual Wix: `Draft` (no publicado), confirmado por GetSiteContext el 2026-11-16 23:09 Europe/Madrid. La publicación anterior es un estado histórico.
- Página TPV: ID `yl5th`, título `TPV`, ruta `/blank`.
- Page code versionado: `src/pages/TPV.yl5th.js`; HTML Component: `#htmlTPV`.
- Studio Two queda fuera de alcance.
- SSOT QA: no hay actividad real declarada; los registros de prueba deben ser sintéticos; pasarela de pagos desconectada declarada por el propietario.

El repositorio `nachoortegazgz/marianmadridz` contiene `wix.config.json` con el Site ID exacto y `uiVersion: 15941`, además de scripts `wix dev`/`wix` y la estructura Velo. Está configurado para Git Integration del Editor clásico. La sincronización efectiva del HEAD de `main` con el Editor no se ha verificado mediante read-back en el panel. No hay versión pública activa; Preview no generado y runtime no validado.

## 2. Regla de integridad

- No se insertan datos TPV en `MovimientosCaja`, `LibroAsientosContablesDetalle`, `HistoricoCierresZ` ni otros ledgers fiscales/contables/laborales.
- No se actualizan ni eliminan registros append-only.
- No se escribe en `CajaActual`.
- No se inicia ni liquida pago, pedido, reserva, devolución, factura o cierre Z real.
- La política fiscal global no se relaja para habilitar pruebas TPV.
- Toda escritura QA se limita a las colecciones `TPV_QA_*` con claves idempotentes y sobre sintético.

## 3. Discrepancia de permisos CMS (bloqueo previo a cualquier escritor operativo)

La última auditoría CMS histórica documentó:
| Colección | Revisión | Insert | Update | Remove | Read |
|---|---:|---|---|---|---|
| `CajaActual` | 17 | `SITE_MEMBER` | `SITE_MEMBER_AUTHOR` | `SITE_MEMBER_AUTHOR` | `SITE_MEMBER_AUTHOR` |
| `MovimientosCaja` | 108 | `SITE_MEMBER` | `SITE_MEMBER_AUTHOR` | `SITE_MEMBER_AUTHOR` | `SITE_MEMBER_AUTHOR` |
| `ControlOperativo` | 80 | `ADMIN` | `ADMIN` | `ADMIN` | `ANYONE` |

Estos valores son evidencia histórica, no una lectura nueva de permisos a 2026-11-16. Los permisos de items tampoco se han vuelto a comprobar en esta intervención. Antes de activar cualquier escritor operativo hay que releer permisos de colección e items y conciliar con la política central. No se han modificado permisos CMS en esta intervención.

## 4. Almacenamiento QA

Revalidación read-only 2026-11-16 23:09: las nueve colecciones `TPV_QA_*` existen; sus permisos son ADMIN para insert/update/remove/read; cada una tiene índice único `idempotencyKey` en estado `ACTIVE`; los nueve recuentos son cero. `ControlOperativo` contiene 58 registros, pero no hay locks `TPV_QA_SESSION_LOCK` ni `TPV_QA_REFUND_LOCK`. No se han insertado registros.

## 5. Arquitectura versionada

Módulos de backend:
- `tpvCaja.web.js`: sesión diaria QA y arqueo parcial.
- `tpvVentas.web.js`: validación y saga de venta sintética.
- `tpvMovimientos.web.js`: movimientos sintéticos.
- `tpvCatalogo.web.js`: catálogo Bookings/Stores de solo lectura y fixtures sintéticas de cliente/profesional.
- `tpvGiftCards.web.js`: bloquea consulta de tarjetas regalo reales.
- `tpvPagos.web.js`: validación de medios sin pasarela.
- `tpvDevoluciones.web.js`: devoluciones sintéticas ADMIN y locks CAS.
- `tpvCierres.web.js`: resumen, Ticket X y Ticket Z QA.
- `tpvAuditoria.web.js`: lectura autenticada de auditoría QA.
- `tpvPermisos.web.js`: capacidades derivadas del rol comprobado en backend.
- `tpvQaRepository.js`, `tpvUtils.js`, `tpvCierresCore.js`: repositorio idempotente, validación y agregación.

### Frontera de datos sintéticos

La implementación inicial incorporó consultas de Contacts V5, Bookings Reader V2, staffMembers y Gift Cards. Eso contradecía el SSOT QA de datos exclusivamente sintéticos. La rama `fix/tpv-qa-synthetic-data-boundary-2026-11-16`:
- reemplaza contactos/profesionales por fixtures QA;
- deshabilita consulta y vínculo de reservas reales;
- deshabilita consulta de saldos reales de Gift Cards;
- rechaza IDs de cliente/profesional no incluidos en fixtures;
- usa `QA_ACTOR` en auditoría, no persiste IDs reales de miembros;
- elimina el módulo de lectores nativos de contactos/reservas y sus contratos SDK no utilizados.

Se mantienen solo lecturas de catálogo de servicios Bookings y productos/variantes Stores V3. No se realizan escrituras en esos dominios.

## 6. Integridad y concurrencia

- Ventas: saga reanudable PREPARED → líneas/pagos → COMMITTED.
- Informes: solo consideran ventas confirmadas.
- Idempotencia: clave cliente normalizada, lectura fuerte y reconciliación.
- Locks CAS por sesión/venta para ventas, movimientos, arqueos, devoluciones y cierre Z.
- Ticket Z bloquea si existen ventas PREPARADAS pendientes.
- La persistencia multi-colección no es ACID; las operaciones parciales quedan detectables/reanudables.
- Ticket Z cierra solo la sesión QA, no caja real ni periodo fiscal.

## 7. CI y validación

PR #397, PR #398 y PR #399 están fusionadas en `main`. CI de PR #399 sobre HEAD `db2628965a28572d7e9339a8b268bd4e87fe708c`: 74 suites / 670 pruebas offline, 0 fallos; Layer 1 (28 suites / 331 pruebas), Layer 2 (19 suites / 255 pruebas), SDK contracts, ESLint y secret scanning correctos. La PR #398 tuvo una ejecución de rama fallida por aserciones desalineadas; el CI posterior pasó.

PR #399 de hardening sintético está integrada en main y superó CI: 74 suites / 670 pruebas offline, 0 fallos; Layer 1/2, SDK contracts, ESLint y secret scanning correctos. Ninguna prueba offline equivale a validación runtime Wix.

## 8. Bloqueos runtime y despliegue

- El repositorio está enlazado al Site ID mediante `wix.config.json`; el commit de PR #399 debe estar sincronizado con el Editor, pero no se ha verificado el read-back.
- No se ha ejecutado `wix preview` ni `wix publish`; el sitio está Draft y no hay versión publicada.
- No se han ejecutado escrituras de prueba en CMS durante esta intervención.
- No se ha probado la concurrencia/idempotencia contra CMS real.
- No se ha validado Preview con ADMIN, GESTION, ESTILISTA, miembro ordinario y visitante.
- Revalidación posterior: 7 automatizaciones PREINSTALLED ACTIVE, todas con `disableStatusChange=true`; dos además readonly. La automatización custom TPV (ID `961f911d-8386-4e20-843e-cdf4595c24e8`) está INACTIVE, revisión 4. Su task IA `d56d7590-7eb7-4e4f-94ac-2ca9fa465fcf` sigue sin inspección; no se ha ejecutado. Las siete preinstaladas conservan triggers de email/notificación y siguen bloqueando E2E que pueda generarlos.
- El propietario declara que la pasarela está desconectada; no se ha verificado independientemente en Wix Dashboard. El estado del sitio Draft sí está confirmado por GetSiteContext.

La vía soportada es [Git Integration & Wix CLI for Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/about-git-integration-wix-cli-for-sites), que incluye Wix Editor (Classic). El repositorio coincide con el Site ID y contiene la configuración CLI. El workflow `.github/workflows/wix-tpv-preview.yml` está preparado para generar Preview; la ejecución anterior al cambio de nombre no generó Preview; el estado actual de existencia del secreto `CLI_API_KEY` no puede leerse desde la integración. Para usarlo hay que crear ese secreto con permiso `Wix CLI for Sites - Git Integration`. La ejecución local no está disponible en esta sesión: el contenedor tiene Node 22.16 y no tiene el binario `wix`; Wix requiere Node 24.22.1 o superior. No se ha ejecutado Preview ni Publish.

## 9. Próximos pasos seguros

1. Confirmar en GitHub Integration del Editor que `main` está sincronizado hasta el commit vigente.
2. Configurar el secreto `CLI_API_KEY` con permiso `Wix CLI for Sites - Git Integration`.
3. Ejecutar el workflow `Wix TPV Preview (non-production)` y revisar la URL de Preview.
4. Probar carga y lecturas con roles; no ejecutar apertura de caja, ventas, movimientos, devoluciones ni cierres en Preview.
5. Usar Wix Preview/SANDBOX para una prueba sintética limitada de persistencia tras validar que el runtime está en SANDBOX; evitar los triggers de las siete automatizaciones preinstaladas y no escribir por REST en LIVE.
6. No ejecutar `wix publish` hasta cerrar los bloqueos y completar E2E controlado.


## Addendum de cuota y aislamiento de persistencia — 2026-11-16

Get Site Data Usage (`consistentRead=true`) confirma 4.000 elementos por entorno, 201 elementos en LIVE (5,03 %) y 0 en SANDBOX; almacenamiento LIVE 265.822 bytes / 10 GiB y SANDBOX 0. Las nueve colecciones TPV QA están vacías en ambos entornos. Wix documenta que Preview usa SANDBOX, separado de LIVE; el límite de elementos es por entorno y el almacenamiento se comparte. Por tanto, tras configurar `CLI_API_KEY` y generar Preview, la prueba de persistencia puede realizarse en SANDBOX con fixtures limitados, sin tocar LIVE. La pasarela sigue declarada desconectada por el propietario; no se invocará ningún proveedor de pago.


## Addendum de auditoría de código y fuente HTML — 2026-11-17

- Se restaura `#htmlTPV.txt` como fuente versionada de referencia del HTML Component. Dos pruebas de contrato (`tpv-widget.contract.test.mjs` y `tpv-ui.qa-source.test.mjs`) lo leen mediante la ruta URL-encoded `%23htmlTPV.txt`; su eliminación dejaba referencias rotas y hacía fallar esas pruebas antes de evaluar el contrato.
- La restauración no demuestra que el contenido esté instalado en el componente `#htmlTPV` del Editor Classic. Esa instalación requiere read-back del Editor/Preview y permanece pendiente.
- Se verifican contra documentación oficial las firmas SDK de Bookings `services.queryServices(query, options)`, Stores Catalog V3 `productsV3.queryProducts(query, options)` y `productsV3.getProduct(productId, options)`. El sitio informa Catalog V3 instalado.
- No se modifica `src/pages/TPV.yl5th.js`: su responsabilidad es enlazar el componente existente con `public/tpvPageController.js`; la inicialización está correctamente separada de los WebMethods.
- Ticket Z bloquea ahora también devoluciones QA cuyo conjunto de pagos negativos o movimientos de efectivo no esté completo y rechaza el cierre cuando `reconciliationOk` no es `true`; la verificación offline está añadida como contrato de código, pendiente de ejecución CI/runtime.
- La conciliación de devoluciones compara ahora número e importe por medio de pago, suma total de la devolución y número/importe de movimientos de efectivo. Cualquier ausencia, exceso, importe no entero/positivo o diferencia deja la devolución pendiente y bloquea Ticket Z.
- Las colecciones QA y sus índices/permisos se mantienen sin cambios. La verificación CMS citada en el apartado 4 es la lectura read-only documentada el 2026-11-16, no una nueva lectura ejecutada el 2026-11-17.
- Esta corrección no habilita pagos, reservas, Gift Cards, escrituras fiscales, hardware ni notificaciones reales. No se ha ejecutado Wix Preview ni Publish.
