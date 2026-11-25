# TPV — preparación para pruebas online finales en Wix

**Fecha de verificación:** 2026-11-25  
**Rama:** `feat/tpv-online-test-runtime-20261125`  
**PR:** [#615 — TPV isolated online test runtime](https://github.com/nachoortegazgz/marianmadridz/pull/615)  
**Sitio:** Marian Madrid · `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Entorno:** lecturas Wix/CMS de solo lectura + CI offline. Wix Preview/Runtime no ejecutado.

## 1. Resultado

El código deja disponible un runtime de pruebas online aislado, no un TPV operativo fiscal ni un cobro real.

- Las operaciones de prueba se guardan como eventos sintéticos dentro de un registro `TPV_TEST_RUN` en la colección física existente `ControlOperativo`. Es persistencia auxiliar real de QA, no persistencia inexistente ni ledger comercial.
- La persistencia se conserva porque las invocaciones WebMethod son solicitudes backend independientes: la sesión, idempotencia, CAS y cierres deben sobrevivir entre llamadas. Una variable en memoria no ofrece continuidad fiable entre invocaciones.
- El lock QA usa el discriminador exclusivo `TPV_TEST_SESSION_LOCK` y `_id` con prefijo `TPVT`; el lock operativo conserva `TPV_SESSION_LOCK` y prefijo `TPVS`. No comparten namespace, dedupeKey ni ciclo de vida.
- El runtime exige administrador autenticado, una sesión activa por administrador, control de concurrencia CAS, idempotencia, hash-chain SHA-256 y validación append-only del historial.
- El runtime declara `sourceType=SYNTHETIC`, `processingMode=INTERNAL`, `reconciliationStatus=NOT_RECONCILED`, `realPayment=false` y `externalSideEffects=false`.
- No escribe `MovimientosCaja`, `CajaActual`, pedidos, Wix Payments, Wix Invoices, Wix Bookings ni inventario.
- No crea colecciones TPV nuevas ni una colección `TransaccionesTPV`.
- Los registros `TPV_TEST_RUN` llevan `expiresAt` a 24 horas y la purga solo permite ese tipo exacto con filtro de expiración. La purga es oportunista al abrir una nueva sesión; no es un cron ni garantiza eliminación automática en el instante de caducidad. Los locks QA tienen lease de 12 horas y se liberan por CAS; no se purgan con la política de runs.

## 2. Verificación del CMS live

Lectura de `GET /wix-data/v2/collections` en el sitio:

- 40 colecciones físicas.
- Colecciones relevantes: `ControlOperativo`, `MapaStaff`, `MovimientosCaja` y `CajaActual`.
- `ControlOperativo` contiene los campos físicos requeridos por el runtime: `controlType`, `dedupeKey`, `traceId` y `payload`; también `status`, `version` y `expiresAt`.
- `MovimientosCaja` conserva su esquema fiscal y campos obligatorios; el runtime de pruebas no lo utiliza.
- No aparece una colección física independiente de TPV ni `TransaccionesTPV`.
- Consulta consistente de `ControlOperativo`: 0 registros `TPV_TEST_RUN` y 0 registros `TPV_SESSION_LOCK` en el momento de la comprobación. La lectura no creó sesiones ni locks.

La colección física sigue siendo SSOT. `TPV_TEST_RUN` y `TPV_TEST_SESSION_LOCK` son discriminadores QA sobre la colección existente, no colecciones físicas nuevas. El tipo operativo `TPV_SESSION_LOCK` no se reutiliza.

## 3. Verificación del catálogo Wix

Lecturas de las APIs oficiales del sitio:

| Fuente nativa | Resultado |
|---|---:|
| Wix Bookings — servicios totales | 94 |
| Wix Bookings — servicios visibles | 70 |
| Wix Bookings — servicios ocultos | 24 |
| Wix Bookings — proveedores de servicio | 3 |
| Wix Stores Catalog V3 — productos | 24 |
| Productos visibles | 24 |
| Productos visibles en POS | 24 |

Los 24 servicios ocultos incluyen servicios auxiliares F2. El widget TPV no debe presentarlos como servicios vendibles independientes. Se corrigió `tpvCatalogo.web.js` para consultar Bookings con `hidden = false`, conforme al filtro documentado por Wix.

Los 24 productos consultados están marcados como visibles y disponibles en POS. Esto acredita visibilidad de catálogo, no disponibilidad física de inventario ni autorización para descontar stock. El runtime de pruebas no modifica existencias.

## 4. Identidad de profesionales

Se compararon los tres registros `MapaStaff` de tipo `STAFF` con los tres proveedores nativos de Wix Bookings:

- Los tres `resourceId` coinciden.
- Los tres `staffMemberId` coinciden con el `_id` nativo de Bookings.
- Se corrigió el código para rechazar un `staffMemberId` obsoleto cuando el `resourceId` resuelve a un proveedor nativo.
- El frontend selecciona el `resourceId`; el backend vuelve a resolver al operador desde el miembro Wix autenticado. No se aceptan IDs de operador enviados por el navegador como prueba de identidad.

## 5. Medios de pago del runtime de prueba

En esta versión solo se admite simular un único medio de pago por venta: efectivo o tarjeta.

- Bizum: deshabilitado hasta acreditar configuración y flujo.
- Bono y tarjeta regalo: deshabilitados porque no hay verificación de saldo en backend.
- Otros: deshabilitado por no estar incluido en el contrato V1.
- Split tender: bloqueado por el contrato V1.
- Ningún medio de pago simulado confirma una transacción bancaria.

## 6. Validación de código

- CI offline: PASS en el commit de código `a23a4db1154c004c1d29fabbcc666c73845c441a` (Backend offline quality gates y Secret scanning).
- Se añadieron pruebas para el cruce `MapaStaff.staffMemberId` ↔ Wix Bookings y para bloquear medios no verificados.
- Se corrigieron aserciones de imports agrupados que habían quedado obsoletas tras consolidar imports del controlador.
- Se añadió prueba contractual para excluir servicios ocultos del catálogo TPV.

CI offline no equivale a ejecución de los WebMethods en Wix Preview/Runtime.

## 7. Pendiente para cerrar pruebas online

1. Abrir Wix Preview con un administrador autorizado y confirmar que el catálogo muestra solo los 70 servicios visibles y los 24 productos POS.
2. Confirmar que los tres profesionales se resuelven y que el contexto de miembro autenticado corresponde al profesional seleccionado.
3. Abrir sesión sintética, registrar operaciones de prueba y verificar persistencia en `ControlOperativo`, hash-chain, idempotencia, concurrencia y cierre X/Z.
4. Confirmar que no aparecen escrituras en `MovimientosCaja`, `CajaActual`, pedidos, pagos, facturas, reservas o inventario.
5. Verificar comportamiento en el sitio publicado solo mediante pruebas negativas/read-only autorizadas; no ejecutar cobros reales.

## 8. Revisión arquitectónica de persistencia QA (PR #616)

La auditoría posterior a PR #615 identificó que el runtime persiste sesiones/eventos de prueba en `ControlOperativo`. Se confirma el hecho y se evita describirlo como runtime sin persistencia.

Decisión de diseño:
- Mantener una única fila `TPV_TEST_RUN` por sesión para permitir continuidad entre WebMethods, reintentos idempotentes, CAS, verificación hash-chain y cierre X/Z durante pruebas online.
- No trasladar estado crítico a memoria del proceso ni al navegador: no proporciona persistencia/consistencia entre invocaciones y no sería una prueba de concurrencia durable.
- Separar el lock QA del lock operativo con `TPV_TEST_SESSION_LOCK` y prefijo de ID `TPVT`; el writer operativo sigue usando su tipo/prefijo propios.
- Mantener las escrituras QA solo en `ControlOperativo`; no se escribe `MovimientosCaja`, `CajaActual`, pedidos, pagos, facturas, reservas ni inventario.
- Eliminar los registros expirados únicamente mediante el filtro exacto `controlType=TPV_TEST_RUN` + `expiresAt < now`; no se aplica la purga a otros controles.

La búsqueda estática del repositorio y los contratos añadidos comprueban que los módulos operativos de caja, ledger, cierres, movimientos y devoluciones no consumen `TPV_TEST_RUN` ni `TPV_TEST_SESSION_LOCK`. Esta comprobación es estática; no sustituye una prueba Wix Runtime.

La retención de 24 horas es una ventana de elegibilidad para purga oportunista al abrir otra sesión, no una garantía de borrado programado. No se ha añadido un cron de limpieza porque no hay requisito de negocio para ello.
## 9. Bloqueos operativos y fiscales

El hito de pruebas online no habilita el writer fiscal operativo. Permanecen bloqueados:

- Configuración fiscal/SIF no acreditada.
- Clasificación fiscal por artículo/servicio y series de factura no aprobadas.
- Integración real con lector de tarjetas, cajón monedero y Epson.
- Confirmación bancaria/conciliación de pagos.
- Política de inventario físico de la ubicación del salón.
- Facturación real, Veri*Factu y escrituras append-only en `MovimientosCaja`.

**Estado:** código preparado para iniciar pruebas online controladas; no declarar TPV operativo ni cierre del hito hasta ejecutar y documentar Wix Preview/Runtime.
