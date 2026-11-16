# TPV — estado de implementación en el sitio actual (2026-11-16)

## 1. Alcance confirmado

- Sitio único: Marian Madrid Peluquería y Estética.
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Dominio: `https://www.marianmadrid.es/`.
- Editor clásico; Velo habilitado.
- El sitio aparece como publicado. Los cambios de configuración CMS realizados por API se aplican al sitio publicado.
- Studio Two queda expresamente fuera de alcance.
- Entorno declarado por el propietario: desarrollo, sin actividad real, con datos sintéticos y pasarela de pagos desconectada.

## 2. Regla de integridad durante el desarrollo

La solicitud de “pausar los ledgers append-only” se aplica como **bloqueo de escrituras operativas**, no como suspensión de su inmutabilidad.

Se mantienen intactas estas garantías:
- No se insertan datos sintéticos en `MovimientosCaja`, `LibroAsientosContablesDetalle` ni otros ledgers fiscales/contables/laborales.
- No se actualizan ni borran registros append-only.
- No se escribe directamente en `CajaActual`.
- No se inicia ni liquida ningún pago, reserva, pedido, devolución, factura o cierre Z real.
- En el HEAD versionado de la rama TPV, `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED`, `ACCOUNTING_LEDGER_WRITES_ENABLED` y `ALLOW_SIMULATION_RECORDS` permanecen `false`; no se relaja la política fiscal global para habilitar pruebas TPV.
- **Limitación crítica:** el código de esa rama aún no se ha sincronizado con el Editor clásico. Por tanto, no se afirma que esos flags estén activos en el runtime publicado. La lectura pública CMS sí quedó cerrada; la desactivación integral de todos los escritores backend live queda pendiente de comparar y sincronizar el código del Editor.

## 3. Corrección de permisos CMS P0 aplicada

Se inspeccionaron los esquemas live antes de modificar permisos. Se preservaron los campos no-sistema y los plugins existentes durante el reemplazo de permisos.

| Colección | Revisión anterior | Revisión verificada | Lectura de colección | Lectura de items |
|---|---:|---:|---|---|
| `CajaActual` | 14 | 16 | `ADMIN` | `CMS_EDITOR` |
| `MovimientosCaja` | 105 | 107 | `ADMIN` | `CMS_EDITOR` |

En ambas colecciones:
- Permisos de colección insert/update/remove: `ADMIN`.
- Permisos de items insert/update/remove: `CMS_EDITOR`.
- Lectura pública `ANYONE`: eliminada en ambos niveles.
- Sin cambios en los datos existentes.

La lectura backend de TPV continúa pasando por WebMethods autenticados y `requireCajero()`. La configuración de permisos fue leída de nuevo tras las mutaciones y coincide con los valores objetivo. Sigue pendiente la prueba runtime con visitante anónimo, miembro ordinario, cajero y administrador.

## 4. Almacenamiento QA separado provisionado

Se crearon nueve colecciones nuevas, vacías y con prefijo explícito `TPV_QA_`:

1. `TPV_QA_Ventas`
2. `TPV_QA_VentaLineas`
3. `TPV_QA_Pagos`
4. `TPV_QA_Reembolsos`
5. `TPV_QA_MovimientosCaja`
6. `TPV_QA_SesionesCaja`
7. `TPV_QA_TicketX`
8. `TPV_QA_TicketZ`
9. `TPV_QA_Auditoria`

Las colecciones contienen campos tipados para claves idempotentes, estados, importes en unidades menores, trazabilidad y payload sintético. Todas se crearon con permisos de colección `ADMIN` para lectura/escritura y permisos de items `CMS_EDITOR`. No contienen registros de prueba ni datos de clientes.

### Índices de idempotencia

Se creó un índice único sobre `idempotencyKey` en cada colección. El primer read-back devolvió `BUILDING`; una comprobación posterior confirmó los nueve índices en estado `ACTIVE`, sin fallos. Una consulta posterior de recuento verificó 0 elementos en cada colección. Según el contrato de Wix, `ACTIVE` indica que el índice está listo para uso.

**Estado:** la unicidad está provisionada a nivel CMS. Esto no sustituye las pruebas de inserción duplicada y concurrencia ni resuelve la atomicidad entre colecciones. La persistencia desde la aplicación está implementada en la rama de trabajo y pasa por `dataAccess.js` / `dataAccessPolicy.js`. Cada inserción QA exige `idempotencyKey` y un sobre sintético (`isSynthetic=true`, `realPayment=false`, `externalSideEffects=false`). No se han insertado todavía registros QA en el CMS; la integración real contra CMS y Preview sigue pendiente.

## 5. Módulos TPV y persistencia QA versionados

La rama de integración actual es `feat/tpv-classic-persistent-qa-2026-11-16`, creada directamente desde `main` tras detectar que la rama anterior divergía y que la PR #396 estaba cerrada sin fusionar. La nueva rama contiene los módulos solicitados en el informe funcional. PR #397 está abierta para revisión, sin fusionar:

- `tpvCaja.web.js`: sesión diaria QA, lectura de caja QA y arqueo parcial.
- `tpvVentas.web.js`: validación backend y saga de venta sintética (PREPARED → líneas/pagos → COMMITTED).
- `tpvMovimientos.web.js`: entradas, salidas y retiradas sintéticas.
- `tpvCatalogo.web.js`: lectores de Bookings y Stores Catalog V3 con llamadas elevadas solo después de autorización backend.
- `tpvGiftCards.web.js`: consulta real de tarjetas regalo deshabilitada en QA; no envía códigos ni consulta saldos reales.
- `tpvPagos.web.js`: validación de efectivo/tarjeta/Bizum/otros sin pasarela.
- `tpvDevoluciones.web.js`: devoluciones sintéticas con autorización ADMIN y locks CAS por venta/sesión.
- `tpvCierres.web.js`: resumen de sesión, Ticket X y Ticket Z de QA.
- `tpvAuditoria.web.js`: consulta de auditoría QA.
- `tpvPermisos.web.js`: capacidades derivadas del rol validado en backend.
- `tpvUtils.web.js`: configuración y validaciones QA expuestas.
- `tpvQaRepository.js`, `tpvUtils.js` y `tpvCierresCore.js`: repositorio idempotente, utilidades puras y agregación reproducible.

La política central `dataAccessPolicy.js` permite únicamente inserciones con clave idempotente y payload sintético en `TPV_QA_*`, y bloquea actualizaciones y eliminaciones. Las consultas paginan hasta 10.000 registros y fallan cerradas si exceden ese límite. Ticket Z impide cerrar una sesión si quedan ventas en estado PREPARADA sin confirmación. Los índices únicos `idempotencyKey` de las nueve colecciones se verificaron `ACTIVE`; el recuento CMS posterior confirmó cero elementos. Los eventos QA no se insertan en el ledger fiscal.

Las escrituras de ventas siguen una saga reanudable: cabecera PREPARADA, líneas, pagos y cabecera CONFIRMADA. Los informes solo agregan ventas confirmadas. Los reembolsos se serializan por venta y, junto con ventas, movimientos, arqueos y cierres, comparten un lock compare-and-swap por sesión en `ControlOperativo` (tipos `TPV_QA_REFUND_LOCK` y `TPV_QA_SESSION_LOCK`). Los locks no contienen importes ni registros de ventas. La política central solo permite mutaciones CAS de campos acotados. Ticket Z marca como cerrada exclusivamente la sesión QA.

El controlador HTML ↔ Velo y `#htmlTPV.txt` ya despachan apertura de sesión QA, ventas, movimientos, arqueos, devoluciones, Ticket X/Z y consulta de auditoría. El HTML se ha actualizado para presentar expresamente la persistencia sintética.

**No se ha sincronizado este código con Wix Classic.** El código versionado no es todavía el runtime del sitio publicado. No se han insertado registros QA ni ejecutado pruebas financieras en el CMS.

## 6. Pasarela de pagos

- Declaración del propietario: pasarela desconectada.
- Código TPV: `payments: DISABLED`, `realPayment: false`; no existe llamada a checkout, orders, payment intents ni refund desde el controlador TPV.
- No se ha realizado ninguna conexión ni desconexión de proveedor.
- La desconexión del proveedor no se ha verificado independientemente desde API; debe confirmarse en Wix Dashboard → Aceptar pagos antes de cualquier despliegue real.

## 7. Validación y gates pendientes

Estado verificado:
- Permisos CMS actualizados y leídos de nuevo.
- Nueve colecciones QA creadas y vacías; recuento final: 0 elementos en cada una.
- Nueve índices únicos de idempotencia confirmados `ACTIVE`.
- No se ha escrito ningún dato de prueba.
- No se han ejecutado operaciones financieras.
- Se realizó comprobación estática de sintaxis de los módulos backend y del script inline HTML; todos compilaron en el parser JS disponible.

Pruebas añadidas al repositorio:
- Contratos de WebMethods TPV y límites de escritura.
- Contratos del HTML Component y puente Velo.
- Parseo del script HTML QA.
- Política insert-only de las nueve colecciones.
- Política CAS del lock de devoluciones.
- Validaciones de claves idempotentes, métodos de pago y unidades menores.

**CI verificado sobre HEAD `36fcd9c9192b888e884ace3881dbd88f9cb6a574`:** Layer 1: 28 suites / 328 pruebas, 0 fallos; Layer 2: 19 suites / 255 pruebas, 0 fallos; regresión offline completa: 74 suites / 667 pruebas, 0 fallos; ESLint correcto; contratos de SDK Wix y secret scanning correctos. Estas pruebas son offline/estáticas y no sustituyen pruebas de runtime. La ejecución final de CI sobre el HEAD indicado terminó correctamente. Las ejecuciones previas fallidas se debieron a aserciones de contrato de pruebas, corregidas y reejecutadas.

Pendiente:
1. Repetir CI tras los últimos commits documentales; el código TPV ya superó Layer 1, Layer 2, regresión offline y ESLint en el commit `36fcd9c9192b888e884ace3881dbd88f9cb6a574`.
2. Probar inserciones duplicadas y concurrencia del índice idempotente en CMS QA.
3. Probar locks de sesión y reembolso en concurrencia real, CAS y recuperación tras expiración.
4. Probar reanudación de venta y devolución ante fallo parcial entre colecciones.
5. Aplicar manualmente `src/pages/TPV.yl5th.js`, `src/public/tpvPageController.js` y el contenido de `#htmlTPV.txt` en Wix Classic.
6. Validar Preview con ADMIN, GESTION, ESTILISTA, miembro ordinario y visitante anónimo.
7. Confirmar en Wix Dashboard que la pasarela continúa desconectada antes de cualquier despliegue real.
8. Revisar diff, CI, reversión y autorización expresa antes de merge/publicación.

## 8. Estado de despliegue

- PR #396 está cerrada sin fusionar. PR #397 está abierta para revisión y no se ha fusionado el TPV.
- No se ha publicado código TPV nuevo.
- No se ha modificado el HTML Component, el page code ni los módulos backend en el Editor clásico; su estado live no se ha comparado ni validado.
- No se ha conectado una pasarela de pagos.
- No se ha activado ninguna escritura TPV en el runtime Wix; las escrituras QA están implementadas solo en la rama GitHub.
- No se ha intervenido en Studio Two.
