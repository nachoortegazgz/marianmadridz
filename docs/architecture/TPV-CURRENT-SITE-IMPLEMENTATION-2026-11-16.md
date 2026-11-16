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

La publicación del sitio no demuestra que los archivos actuales de GitHub estén sincronizados con el runtime del Editor clásico. El estado del runtime TPV queda pendiente de comprobación en Wix Editor/Preview.

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

PR #397 y PR #398 figuran fusionadas en `main`. La ejecución post-merge sobre HEAD `a8feb0f6632d493d2133d12081aff3157aea05a7` terminó correctamente: 74 suites / 670 pruebas offline, 0 fallos; Layer 1, Layer 2, SDK contracts, ESLint y secret scanning correctos. La PR #398 tuvo una ejecución de rama fallida por aserciones desalineadas; el CI posterior de `main` sí pasó.

La rama de hardening sintético todavía necesita CI propio y revisión del diff. Ninguna prueba offline equivale a validación runtime Wix.

## 8. Bloqueos runtime y despliegue

- No se ha sincronizado el page code, HTML Component ni módulos backend con Wix Classic.
- No se han ejecutado escrituras de prueba en CMS durante esta intervención.
- No se ha probado la concurrencia/idempotencia contra CMS real.
- No se ha validado Preview con ADMIN, GESTION, ESTILISTA, miembro ordinario y visitante.
- La SSOT registra 7 automatizaciones Wix preinstaladas ACTIVE con acciones de email/notificación y bloqueos de cambio; aislamiento runtime de comunicaciones no acreditado. Runtime/E2E permanece bloqueado hasta neutralización soportada y read-back.
- La desconexión de la pasarela es una declaración del propietario; debe confirmarse en Wix Dashboard antes de cualquier prueba que pueda producir efectos financieros.

La CLI oficial Origami documenta exportación/importación para Studio Two, no para el Editor clásico. No se ha identificado un endpoint REST oficial soportado para sincronizar código Velo de Classic. No se ha intentado un despliegue por mecanismos no soportados.

## 9. Próximos pasos seguros

1. Terminar hardening sintético y obtener CI verde.
2. Revisar diff y abrir PR contra `main`.
3. Obtener copia/verificación del estado actual de los archivos en Wix Classic.
4. Aplicar manualmente el código revisado mediante Wix Editor/Preview, guardando el estado previo para reversión.
5. Probar roles y casos negativos en Preview sin activar comunicaciones, pagos ni escrituras fiscales.
6. Revalidar colecciones/índices/permisos CMS.
7. No publicar hasta cerrar los bloqueos y comprobar el runtime.
