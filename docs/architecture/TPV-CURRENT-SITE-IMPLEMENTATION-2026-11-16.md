# TPV — estado de implementación en el sitio actual (2026-11-16)

## 1. Alcance confirmado

- Sitio QA único: Marian Madrid Peluquería y Estética.
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Dominio: `https://www.marianmadrid.es/`.
- Editor: Wix Classic Editor (GetSiteContext devuelve `Editor`); Velo habilitado.
- Estado actual Wix: `Published`, confirmado por GetSiteContext y por `published: true` en List Static Pages.
- Página TPV: ID `yl5th`, título `TPV`, ruta `/blank`.
- Page code versionado: `src/pages/TPV.yl5th.js`; HTML Component: `#htmlTPV`.
- Studio Two queda fuera de alcance.
- SSOT QA: no hay actividad real declarada; los registros de prueba deben ser sintéticos; pasarela de pagos desconectada declarada por el propietario.

El repositorio `nachoortegazgz/marianmadridz` contiene `wix.config.json` con el Site ID exacto y `uiVersion: 15941`, además de scripts `wix dev`/`wix` y la estructura Velo. Está configurado para Git Integration del Editor clásico. El merge de PR #399 a `main` debe sincronizar el código con el Editor; el read-back en el panel aún está pendiente. La versión publicada sigue sin validar.

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

La auditoría histórica verificó nueve colecciones `TPV_QA_*`, nueve índices únicos `idempotencyKey` en estado `ACTIVE` y cero elementos en cada colección. No se han insertado registros en CMS durante esta intervención. La verificación de conteos/índices debe repetirse antes de runtime E2E.

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

La rama de hardening sintético todavía necesita CI propio y revisión del diff. Ninguna prueba offline equivale a validación runtime Wix.

## 8. Bloqueos runtime y despliegue

- El repositorio está enlazado al Site ID mediante `wix.config.json`; el commit de PR #399 debe estar sincronizado con el Editor, pero no se ha verificado el read-back.
- No se ha ejecutado `wix preview` ni `wix publish`; la producción no se considera actualizada.
- No se han ejecutado escrituras de prueba en CMS durante esta intervención.
- No se ha probado la concurrencia/idempotencia contra CMS real.
- No se ha validado Preview con ADMIN, GESTION, ESTILISTA, miembro ordinario y visitante.
- Revalidación Wix Automations V2 del 2026-11-16: 8 automatizaciones ACTIVE, todas confirmadas por Get Automation. Siete son PREINSTALLED y tienen `disableStatusChange=true`; una adicional de origen APPLICATION (`Creación de TPV física personalizada`) se ejecuta diariamente a las 01:45 y delega a `Delegate to AI Custom Agent` (task ID `d56d7590-7eb7-4e4f-94ac-2ca9fa465fcf`). No se conoce el contenido de la tarea ni sus integraciones; no se ha modificado. Runtime/E2E permanece bloqueado.
- La desconexión de la pasarela es una declaración del propietario; debe confirmarse en Wix Dashboard antes de cualquier prueba que pueda producir efectos financieros.

La vía soportada es [Git Integration & Wix CLI for Sites](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/about-git-integration-wix-cli-for-sites), que incluye Wix Editor (Classic). El repositorio coincide con el Site ID y contiene la configuración CLI. El workflow `.github/workflows/wix-tpv-preview.yml` está preparado para generar Preview; la última ejecución lo omitió porque falta el secreto `WIX_CLI_API_KEY`. Para usarlo hay que crear ese secreto con permiso `Wix CLI for Sites - Git Integration`. La ejecución local no está disponible en esta sesión: el contenedor tiene Node 22.16 y no tiene el binario `wix`; Wix requiere Node 24.22.1 o superior. No se ha ejecutado Preview ni Publish.

## 9. Próximos pasos seguros

1. Confirmar en GitHub Integration del Editor que `main` está sincronizado hasta el merge de PR #399.
2. Configurar el secreto `WIX_CLI_API_KEY` con permiso `Wix CLI for Sites - Git Integration`.
3. Ejecutar el workflow `Wix TPV Preview (non-production)` y revisar la URL de Preview.
4. Probar carga y lecturas con roles; no ejecutar apertura de caja, ventas, movimientos, devoluciones ni cierres en Preview.
5. Revalidar colecciones/índices/permisos CMS y neutralizar automatizaciones de comunicación.
6. No ejecutar `wix publish` hasta cerrar los bloqueos y completar E2E controlado.
