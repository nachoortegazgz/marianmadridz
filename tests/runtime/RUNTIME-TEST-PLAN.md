# Wix Editor / Velo — plan de ejecución y aceptación TPV

**Propósito:** ejecutar y acreditar el TPV completo en el Runtime real de Wix Editor clásico, sin confundir CI offline, Preview y producción.

**Jerarquía:** objetivos funcionales finales del proyecto → normativa vigente → documentación oficial vigente de Wix/proveedores → implementación y evidencias. Este documento es un runbook subordinado; no puede crear prohibiciones contrarias a esa jerarquía.

## 1. Contexto del sitio

Última consulta Wix: 2026-11-28.

- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Estado: Draft.
- Editor: Wix Editor clásico.
- Velo: habilitado.
- Moneda: EUR.
- Zona horaria: Europe/Madrid.
- El sitio no consta como publicado en la consulta del contexto.
- La disponibilidad de Git Integration y el SHA realmente cargado en el Editor deben verificarse al abrir Local Editor/Preview; la existencia de `wix.config.json` no demuestra sincronización.

## 2. Qué acredita cada entorno

| Entorno | Qué acredita | Límite |
|---|---|---|
| CI offline | Contratos, lógica, validaciones, lint y suites con mocks/fixtures | No ejecuta WebMethods Velo ni CMS real |
| Wix Editor Preview | Código guardado ejecutado por Wix Runtime, bridge, permisos de Preview, WebMethods y operaciones CMS | Preview asigna rol Admin; no valida los permisos efectivos de un miembro/cajero en producción |
| Local Editor (`wix dev`) | Código local sincronizado con Wix Editor sin publicar | Requiere Git Integration y vínculo de sitio/repo comprobados |
| Wix CLI `wix preview` | Preview remoto compartible del proyecto CLI | No confundir con Preview del Editor clásico; la documentación de CLI for Sites condiciona el flujo remoto a que el sitio haya sido publicado |
| Test Site / Release Manager | Validación de funciones que requieren una versión publicada | Requiere publicación previa y exposición configurada |
| Producción | Permisos, integraciones y efectos reales | Solo tras aceptación completa y aprobación productiva |

Documentación oficial:
- Preview mode: https://dev.wix.com/docs/develop-websites/articles/workspace-tools/testing-monitoring/testing-troubleshooting/about-testing-code-in-preview-mode
- Git Integration + CLI for Sites: https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/setting-up-git-integration-wix-cli-for-sites
- Wix CLI for Sites: https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands
- Local Editor: https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/test-your-code-in-the-local-editor
- Sandbox y Live (ES): https://support.wix.com/es/article/cms-accessing-and-syncing-your-sandbox-and-live-collections

## 3. Preview, Sandbox y efectos de datos

No se debe afirmar que Preview aísla los datos sin verificar la configuración CMS.

Según documentación oficial de Wix:
- Preview está disponible en Wix Editor y permite probar la mayoría del código antes de publicar.
- El usuario de Preview recibe rol Admin y, por tanto, todos los permisos posibles. Esto no sustituye pruebas de autorización con identidades reales de producción.
- Si Sandbox está habilitado, las colecciones propias consultadas desde Preview usan su versión Sandbox. Si está deshabilitado, Preview usa la versión Live.
- Sandbox está deshabilitado por defecto en sitios nuevos; debe comprobarse en CMS → Manage collections → More Actions → Advanced Settings.
- Las colecciones de aplicaciones Wix solo tienen versión Live; sus cambios desde Preview afectan al sitio publicado.
- Los cambios de datos en Sandbox persisten al salir de Preview. No se debe sincronizar Sandbox → Live como parte de una prueba.
- Las colecciones propias del TPV incluyen `CajaActual`, `MovimientosCaja`, `TransaccionesTPV` y `ControlOperativo`. El catálogo/Bookings puede consultar colecciones de aplicaciones Wix.

El proyecto distingue registros de prueba y reales por la fecha operativa: antes de 2027 son pruebas. No se introduce una ruta de negocio diferente, un modo de pago falso ni validaciones más laxas. Los efectos externos que aún no estén integrados deben devolver un estado explícito pendiente/error; nunca simular un cobro confirmado.

Los eventos append-only se conservan. Una batería no borra cierres, auditorías ni movimientos históricos para “limpiar” el entorno.

## 4. Preflight de cada ejecución Runtime

1. Confirmar Site ID, Editor clásico, página `/tpv`, Preview abierto y versión de código guardada/sincronizada.
2. Confirmar identidad de Preview y que el bridge muestra `Operaciones autorizadas`.
3. Leer `CASHIER_STATE`; la lectura es estrictamente read-only.
4. Si existe una sesión abierta, el runner se detiene sin cerrarla ni modificarla.
5. Si la caja no está inicializada, el bootstrap ocurre como parte del comando explícito `SESSION_OPEN`, no como efecto secundario de `CASHIER_STATE`.
6. Comprobar la configuración Sandbox/Live y registrar el contexto de datos usado. Si Sandbox está deshabilitado, las escrituras propias de TPV se registrarán en Live; esa condición debe quedar explícita en el informe.
7. No ejecutar dos baterías simultáneas. El workflow usa concurrencia sin cancelación porque interrumpir una sesión abierta dejaría el cierre pendiente.

## 5. Batería E2E TPV

El runner `scripts/wix-preview-tpv-e2e.mjs` recorre el widget real mediante el puente `postMessage`, el controlador Velo, los WebMethods y el repositorio/CMS:

1. Handshake `MM_READY → MM_CONTEXT` y autorización.
2. Lectura inicial `CASHIER_STATE`.
3. Apertura con fondo inicial de 300 €.
4. Entrada de efectivo de 1 €.
5. Arqueo parcial con efectivo contado de 301 €.
6. Registro de una venta comercial pendiente con un servicio real de precio fijo del catálogo.
7. Verificación de que la venta queda persistida como `PENDING_PAYMENT`, no como cobrada, y separada de la conciliación de efectivo.
8. Ticket X.
9. Consulta del ledger y conciliación exacta en céntimos.
10. Ticket Z con contado de 301 €, diferencia cero y cierre de sesión.
11. `SALE_READBACK` verifica la fila `TransaccionesTPV` y vuelve a leer el pedido nativo Wix: mismo `orderId`, `externalOrderId`, total en céntimos, estado APPROVED y paymentStatus NOT_PAID.
12. Read-back posterior de `CASHIER_STATE`, ledger y auditoría; verificación de IDs, secuencias, hashes, venta, vínculo de pedido y eventos X/Z.

El runner no usa `SESSION_CLOSE` para sustituir Ticket Z y nunca cierra una sesión que ya existía antes de la ejecución.

La batería actual registra una venta pendiente sin cobro. La aceptación adicional del cobro en efectivo debe verificar: pago offline Wix con método CASH y estado APPROVED, read-back de `orderTransactions`, `paymentStatus=PAID`, evento `TPV_PAYMENT` visible como `COBRO`, proyección `CajaActual.cashAmount` y auditoría `PAGO_TPV_CONFIRMADO`. No se considera probado por la batería de venta pendiente.

La vista de reservas del cliente debe verificar `CUSTOMER_BOOKINGS` con paginación completa, datos de `extendedBookings.queryExtendedBookings`, estados y paymentStatus de Wix Bookings. Esta consulta es de solo lectura; aún no confirma ni modifica reservas.

La sesión usa actualmente el identificador diario `TPV-SESSION-YYYYMMDD`; por diseño actual solo puede abrirse una sesión de caja por fecha operativa. Una vez ejecutado Ticket Z, no se puede repetir la batería ese mismo día. Un fallo después de abrir la sesión exige terminarla conscientemente desde el flujo de caja/Ticket Z antes de volver a ejecutar; no se debe forzar una segunda apertura ni borrar registros.

## 6. Integración nativa Wix actualmente incorporada

- Pedidos: `orders.createOrder`, `orders.getOrder`, `orders.searchOrders`, `orders.cancelOrder`.
- Cobros: `orderTransactions.addPayments` y `listTransactionsForSingleOrder`. AddPayments registra el cobro offline; no recauda efectivo ni procesa tarjeta. El cajero debe haber recibido físicamente el efectivo antes de confirmar el pago.
- CRM: el contacto seleccionado se asocia a `buyerInfo.contactId` del pedido.
- Bookings: `extendedBookings.queryExtendedBookings` mediante el adaptador `tpvNativeDirectory.js`; lectura paginada y acciones permitidas.
- El inventario de Wix Stores se reserva por el pedido nativo Wix; no se mantiene un stock paralelo del TPV.
- Tarjeta no se habilita hasta integrar un proveedor/terminal real. Efectivo es el único medio de cobro implementado en este alcance.
- Las devoluciones aún requieren integración nativa con Payments/Order Billing y su ledger inverso; no se deben simular como reembolso confirmado.

**Importante sobre datos:** las colecciones propias del TPV pueden usar Sandbox si está activado. Las colecciones de aplicaciones Wix (incluidos Orders y Bookings) usan Live también desde Preview. La batería actual crea un pedido Wix real en Orders, sin pago, sin notificación y usando una línea de servicio para no tocar stock. Se identifica mediante `externalOrderId` y la fecha operativa de pruebas. El pedido debe permanecer claramente marcado como test o cancelarse después de la verificación si el protocolo de pruebas lo exige.

## 7. Workflow y secretos

Workflow: `.github/workflows/wix-tpv-preview.yml`.

- Se lanza manualmente desde la rama/commit que se quiere probar.
- Requiere la URL HTTPS de Preview abierta desde Wix Editor/Local Editor.
- Usa el secreto `WIX_STORAGE_STATE_B64` para autenticar Playwright; nunca se publica ni se adjunta el storageState.
- El workflow ejecuta `scripts/wix-preview-tpv-e2e.mjs` y conserva únicamente el informe JSON anonimizado.
- No usa `wix preview` de Headless/Apps como sustituto del Preview de Wix Editor clásico.
- No publica el sitio.

## 8. Criterios de aceptación

**PASS CI offline:** suite y gates del SHA concreto terminan en SUCCESS.

**PASS Runtime E2E:** el runner termina PASS en Wix Preview y verifica bridge, WebMethods, escritura, read-back, idempotencia aplicable, arqueo, Ticket X, Ticket Z, cierre y auditoría.

**GO TPV:** CI offline PASS + Runtime E2E PASS + revisión de los efectos de datos + verificación de capacidades y permisos relevantes. El rol Admin automático de Preview no basta para certificar autorización productiva de cajeros.

**GO producción:** requiere además validar proveedores reales de cobro/devolución, configuración fiscal vigente, facturación, permisos, conciliación y obligaciones aplicables. Veri*Factu y cualquier obligación productiva se mantienen separados del test de caja en Draft; no bloquean la prueba del flujo de caja ni se consideran validados por ella.

## 9. Evidencia mínima

Por ejecución guardar:
- SHA/branch de GitHub y versión de controlador observada.
- Site ID, tipo de Editor, URL de Preview y hora Europe/Madrid.
- Contexto de datos: Sandbox o Live (no inferido).
- Identidad/rol efectivo de Preview.
- IDs de sesión, movimientos, venta pendiente, Ticket X/Z.
- Read-back CMS/ledger, secuencias, hashes, auditoría y resultado.
- Logs de consola y errores explícitos.

No registrar cookies, tokens, datos de tarjeta ni datos personales innecesarios. Un test estático, mock, HTTP 200 o CI offline nunca se etiqueta como Runtime PASS.
