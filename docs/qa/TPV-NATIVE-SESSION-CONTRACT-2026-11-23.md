# TPV — contrato de sesión y conciliación con Wix nativo

**Fecha:** 2026-11-23  
**PR:** #569  
**Estado:** integrada en `main` por PR #569; CI offline SUCCESS; pendiente verificación en Local Editor/Preview Runtime.  
**Entorno:** código sintético interno; sin pagos, devoluciones nativas, fiscalidad, notificaciones ni hardware.

## Objetivo

Separar la sesión operativa de caja de la simulación, el estado de pago y el estado de integración. La identidad del operador procede del contexto Wix autenticado en backend; el widget no puede establecer ni sobrescribir actor/operator IDs.

## Contrato de sesión

| Estado | Significado | Operaciones |
|---|---|---|
| ABIERTA | Existe una sesión abierta y no existe Ticket Z de cierre | Operaciones permitidas solo con el sessionId exacto |
| CERRADA | Existe Ticket Z cerrado para la sesión | Escrituras rechazadas con TPV_SESSION_CLOSED; nueva apertura permitida al siguiente día de negocio |
| SIN_SESION | No existe sesión proyectada | Apertura permitida; operaciones rechazadas |

El backend devuelve `operationalStatus`, `canOpenSession`, `sessionId`, `operatorId`, `actorId`, `now` ISO-8601 y `timeZone=Europe/Madrid`. Cuando no existe sesión, el operador autenticado se informa por separado y `operatorId` de sesión permanece null.

## Estados independientes

- `operationalStatus`: ABIERTA / CERRADA / SIN_SESION.
- `integrationStatus`: NO_ENVIADO mientras no haya confirmación de integración Wix nativa.
- `simulationStatus`: SYNTHETIC para el flujo de QA.
- `paymentStatus`: SIMULATED_ONLY para ventas/devoluciones sintéticas; NOT_APPLICABLE para caja, arqueos y cierres.
- `realPayment=false`, `gatewayCalled=false` y flags de runtime permanecen desactivados.

No utilizar `isSynthetic`, `realPayment` o `integrationStatus` para inferir si la caja está abierta.

## Identidad

- `getMyStaffContext()` y `resolveTpvContext()` son la fuente backend de identidad autenticada.
- La apertura persiste operador/actor, displayName y Bookings resourceId en el evento de sesión.
- La proyección de CajaActual conserva la identidad del opener y el recurso staff.
- La lectura separa nombre/identidad del opener de la identidad autenticada del usuario que consulta.
- Los campos `operatorId` o `actorId` enviados por el navegador no son aceptados como autoridad.
- El widget muestra nombre de operador y Wix member ID; el Bookings resourceId se conserva como identidad de recurso backend.

## Aislamiento de sesión

Se exige `sessionId` en:
- venta sintética;
- devolución sintética;
- entrada/salida/retirada de efectivo;
- arqueo parcial;
- resumen;
- Ticket X y Ticket Z;
- consulta y exportación de movimientos;
- consulta y exportación de auditoría.

Las lecturas filtran por igualdad exacta de `sessionId`. Los registros históricos cerrados se muestran como CERRADA, no como ABIERTA. La idempotencia conserva su fingerprint y su clave por sesión.

## Hora local

El backend emite `now` como ISO UTC y `timeZone=Europe/Madrid`. El widget formatea la hora mediante `Intl.DateTimeFormat` con la zona recibida; no modifica ni elimina la marca ISO almacenada.

## Pruebas de contrato incorporadas

- Identidad autenticada backend y ausencia de autoridad de identidad del widget.
- Estados ABIERTA/CERRADA/SIN_SESION.
- sessionId obligatorio y rechazo de sesión cerrada.
- Consultas de movimientos y auditoría acotadas a sesión.
- Estados separados de operación, integración, simulación y pago.
- Zona horaria Europe/Madrid en la interfaz.
- Ausencia de la etiqueta engañosa SIMULATED_SUCCESS.

## Pruebas pendientes

- [x] CI pre-merge: npm ci, lint, suite completa, layer1 y layer2 (79 suites / 732 PASS / 0 FAIL).
- [ ] Usuario no autenticado: rechazo real en Wix Preview.
- [ ] Usuario autenticado sin sesión: SIN_SESION.
- [ ] Apertura sintética: operador, actor, hora y sessionId persistidos.
- [ ] Venta en efectivo sintética: ledger vinculado a la sesión.
- [ ] Tarjeta sintética: no invoca Wix Payments ni gateway.
- [ ] Devolución sintética: movimiento negativo/allocations vinculados a la misma sesión.
- [ ] Arqueo parcial: no genera Ticket Z ni cierra sesión.
- [ ] Ticket Z: estado CERRADA.
- [ ] Operaciones posteriores a Z: TPV_SESSION_CLOSED.
- [ ] Consultas históricas: no mezclan sesiones.
- [ ] Repetición idempotente: no duplica escrituras.
- [ ] Notificaciones, pagos nativos, devoluciones nativas, emisión fiscal y hardware siguen desactivados.
- [ ] Confirmar en el panel GitHub Integration que el SHA `bf6e9966526716eef00ff1e304eb22459e2ef46e` ya aparece en Wix Editor.
- [ ] Clonar el repo conectado y ejecutar `wix dev` para abrir el Local Editor y probar el código en tiempo real; no ejecutar `wix publish`.
- [ ] Validar UI version `15941` de `wix.config.json` contra la UI version del sitio en Wix.

## Integración GitHub ↔ Wix Editor

- Repositorio: `nachoortegazgz/marianmadridz`; rama por defecto verificada: `main`.
- `wix.config.json`: `siteId=188bed94-177c-4bc9-a9f0-35080d874f3e`, `uiVersion=15941`.
- El `siteId` coincide con el Wix Site Context. Wix documenta que, con Git Integration, el código del Editor se sincroniza con la rama por defecto; los cambios aparecen en el Editor tras un posible retraso.
- El Local Editor se abre desde el clon local con `wix dev`; su Preview ejecuta el código sin publicar. La CLI requiere Node.js 24.22.1 o superior, Git, npm/yarn y clave SSH añadida a GitHub.
- No se ha ejecutado `wix dev` desde esta sesión por no disponer del clon autenticado y sesión local Wix CLI. No ejecutar `wix publish` en este hito.



### HTML Component / iframe TPV

- `#htmlTPV.txt` está en la raíz del repositorio, no en las carpetas Velo mapeadas `src/pages`, `src/backend` o `src/public`. No se debe asumir que Git Integration lo sincroniza con el contenido de un HTML Component.
- Wix documenta que el código del embed HTML se introduce en el Editor seleccionando el elemento, **Enter Code**, pegando el snippet y pulsando **Apply**. Por tanto, el cambio de `#htmlTPV.txt` es un artefacto de código revisado en Git; la actualización del HTML Component real en Draft sigue pendiente.
- El controlador `src/public/tpvPageController.js` y el backend están en la estructura Velo del repositorio y deben sincronizarse con la rama por defecto si la integración está activa. La interfaz HTML aún no debe considerarse aplicada ni probada.
- Antes de usar el TPV en Preview, aplicar manualmente el contenido revisado de `#htmlTPV.txt` al HTML Component de la página TPV en el sitio Draft y comprobar el bridge/request contract.

## Restricciones

No se ejecutaron mutaciones CMS ni operaciones económicas en esta intervención. El repo contiene `wix.config.json` con el mismo `siteId` del sitio y el commit se fusionó en la rama por defecto `main`; según el contrato oficial de Git Integration, el código debe sincronizarse al Editor. La propagación efectiva del SHA no se ha leído en el panel GitHub Integration ni se ha ejecutado Local Editor/Runtime. El sitio sigue en estado Draft y no se ha publicado. Los pedidos POS #10032 y #10033 se consideran operaciones sintéticas según confirmación del titular; no se reescriben sus registros históricos. La integración con Wix Payments/Stores/Invoices continúa deshabilitada.
