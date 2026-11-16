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
- `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED` y `ACCOUNTING_LEDGER_WRITES_ENABLED` permanecen `false`.
- `FISCAL_RUNTIME_POLICY.ALLOW_SIMULATION_RECORDS` permanece `false`; no se relaja la política fiscal global para habilitar pruebas TPV.

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

Se creó un índice único sobre `idempotencyKey` en cada colección. El primer read-back devolvió `BUILDING`; una comprobación posterior confirmó los nueve índices en estado `ACTIVE`, sin fallos. Según el contrato de Wix, `ACTIVE` indica que el índice está listo para uso.

**Estado:** la unicidad está provisionada a nivel CMS. Esto no sustituye las pruebas de inserción duplicada y concurrencia ni resuelve la atomicidad entre colecciones. La persistencia desde la aplicación sigue deshabilitada hasta integrar el flujo en la capa central de acceso a datos y validar las compensaciones/reintentos.

## 5. Estado de la interfaz y backend versionado

La rama `feat/tpv-web-modules-report-2026-11-15`, PR #396 (draft), contiene:
- Validación de borradores en backend con aritmética en céntimos.
- Desglose de efectivo/tarjeta/Bizum/otros y cambio de efectivo.
- Lectores autenticados Bookings y Stores Catalog V3.
- Consulta de saldo Gift Cards en modo solo lectura.
- Vista parcial de Ticket X.
- Puente HTML ↔ Velo corregido para llamar a `obtenerCajaActual()`.
- Cobro, persistencia de venta, devoluciones, movimientos de caja, apertura, arqueos, Gift Card write, facturas y cierre Z bloqueados.

La interfaz actual genera tickets QA solo en memoria de sesión. La persistencia sintética en las colecciones `TPV_QA_*` todavía no está conectada. No se habilitará hasta que los índices únicos estén activos, el contrato de escritura QA esté integrado con la capa central de acceso a datos y las pruebas de idempotencia/concurrencia estén ejecutadas.

No se han añadido módulos WebMethod de persistencia incompletos ni alias sin consumidores. Los límites de seguridad existentes se mantienen.

## 6. Pasarela de pagos

- Declaración del propietario: pasarela desconectada.
- Código TPV: `payments: DISABLED`, `realPayment: false`; no existe llamada a checkout, orders, payment intents ni refund desde el controlador TPV.
- No se ha realizado ninguna conexión ni desconexión de proveedor.
- La desconexión del proveedor no se ha verificado independientemente desde API; debe confirmarse en Wix Dashboard → Aceptar pagos antes de cualquier despliegue real.

## 7. Validación y gates pendientes

Estado verificado:
- Permisos CMS actualizados y leídos de nuevo.
- Nueve colecciones QA creadas y vacías.
- Nueve índices únicos creados, inicialmente `BUILDING`.
- No se ha escrito ningún dato de prueba.
- No se han ejecutado operaciones financieras.

Pendiente:
1. Esperar y comprobar estado `ACTIVE` de los nueve índices.
2. Integrar persistencia QA mediante la capa central `dataAccess.js` / `dataAccessPolicy.js`, sin `suppressAuth` directo ni acceso al ledger.
3. Diseñar escritura idempotente y reanudable para cabecera, líneas, pagos y auditoría; una secuencia de inserts en varias colecciones no es una transacción atómica.
4. Añadir pruebas unitarias, integración, duplicados, concurrencia y fallos parciales.
5. Ejecutar CI en el HEAD actualizado. El commit `9733e6876f9b0cc4c830be632c5506959822719c` no tiene checks ni workflow runs asociados.
6. Aplicar manualmente el page code `src/pages/TPV.yl5th.js` y el contenido `#htmlTPV.txt` en el Editor clásico; la integración Wix disponible no puede guardar el HTML Component ni el page code.
7. Validar en Preview el handshake, roles, Bookings, Stores y Gift Cards.
8. Revisar el diff, CI, reversión y autorización expresa antes de cualquier merge/despliegue.

## 8. Estado de despliegue

- No se ha fusionado PR #396.
- No se ha publicado código TPV nuevo.
- No se ha modificado el HTML Component ni el page code en el Editor clásico.
- No se ha conectado una pasarela de pagos.
- No se ha activado ninguna escritura TPV.
- No se ha intervenido en Studio Two.
