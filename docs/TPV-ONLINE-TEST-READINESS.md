# TPV — preparación para pruebas online finales en Wix

**Fecha de verificación:** 2026-11-25  
**Rama:** `feat/tpv-online-test-runtime-20261125`  
**PR:** [#615 — TPV isolated online test runtime](https://github.com/nachoortegazgz/marianmadridz/pull/615)  
**Sitio:** Marian Madrid · `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Entorno:** lecturas Wix/CMS de solo lectura + CI offline. Wix Preview/Runtime no ejecutado.

## 1. Resultado

El código deja disponible un runtime de pruebas online aislado, no un TPV operativo fiscal ni un cobro real.

- Las operaciones de prueba se guardan como eventos sintéticos dentro de un registro `TPV_TEST_RUN` en la colección física existente `ControlOperativo`.
- El runtime exige administrador autenticado, una sesión activa por administrador, control de concurrencia CAS, idempotencia, hash-chain SHA-256 y validación append-only del historial.
- El runtime declara `sourceType=SYNTHETIC`, `processingMode=INTERNAL`, `reconciliationStatus=NOT_RECONCILED`, `realPayment=false` y `externalSideEffects=false`.
- No escribe `MovimientosCaja`, `CajaActual`, pedidos, Wix Payments, Wix Invoices, Wix Bookings ni inventario.
- No crea colecciones TPV nuevas ni una colección `TransaccionesTPV`.
- Los registros de prueba tienen retención temporal; la purga solo permite registros `TPV_TEST_RUN` caducados mediante el filtro exacto de expiración. No se aplica a ledgers fiscales.

## 2. Verificación del CMS live

Lectura de `GET /wix-data/v2/collections` en el sitio:

- 40 colecciones físicas.
- Colecciones relevantes: `ControlOperativo`, `MapaStaff`, `MovimientosCaja` y `CajaActual`.
- `ControlOperativo` contiene los campos físicos requeridos por el runtime: `controlType`, `dedupeKey`, `traceId` y `payload`; también `status`, `version` y `expiresAt`.
- `MovimientosCaja` conserva su esquema fiscal y campos obligatorios; el runtime de pruebas no lo utiliza.
- No aparece una colección física independiente de TPV ni `TransaccionesTPV`.
- Consulta consistente de `ControlOperativo`: 0 registros `TPV_TEST_RUN` y 0 registros `TPV_SESSION_LOCK` en el momento de la comprobación. La lectura no creó sesiones ni locks.

La colección física sigue siendo SSOT. Los nombres `TPV_LOGICAL_*` son discriminadores lógicos del runtime, no IDs de colecciones CMS.

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

## 8. Bloqueos operativos y fiscales

El hito de pruebas online no habilita el writer fiscal operativo. Permanecen bloqueados:

- Configuración fiscal/SIF no acreditada.
- Clasificación fiscal por artículo/servicio y series de factura no aprobadas.
- Integración real con lector de tarjetas, cajón monedero y Epson.
- Confirmación bancaria/conciliación de pagos.
- Política de inventario físico de la ubicación del salón.
- Facturación real, Veri*Factu y escrituras append-only en `MovimientosCaja`.

**Estado:** código preparado para iniciar pruebas online controladas; no declarar TPV operativo ni cierre del hito hasta ejecutar y documentar Wix Preview/Runtime.
