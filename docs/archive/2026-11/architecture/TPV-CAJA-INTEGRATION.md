> **ESTADO HISTÓRICO / GUÍA SUPERADA — 2026-11-16:** Este documento describe una integración anterior de solo lectura basada en `getCashierState()`; no es el contrato de la TPV QA persistente actual. La implementación vigente está documentada en [TPV-CURRENT-SITE-IMPLEMENTATION-2026-11-16.md](TPV-CURRENT-SITE-IMPLEMENTATION-2026-11-16.md) y [TPV-WIX-NATIVE-INTEGRATION.md](TPV-WIX-NATIVE-INTEGRATION.md). No reutilizar los pasos de instalación antiguos sin contrastarlos con esos documentos.

---

# TPV MarianMadrid — integración CajaActual / MovimientosCaja

## Estado de esta entrega

Interfaz Velo/HTML de consulta conectada al WebMethod existente `getCashierState()`. No se crean nuevos writers, endpoints de pago ni colecciones. No se modifica el backend fiscal ni las políticas CMS.

## Autoridad de datos

- `MovimientosCaja`: ledger histórico de movimientos. Es la fuente para el detalle y los agregados de la sesión que devuelve `getCashierState()`.
- `CajaActual`: singleton/proyección operativa de la sesión. `netAmount` representa el efectivo físico esperado; `cashAmount`, `cardAmount` y `otherAmount` son acumulados de sesión por bucket físico del esquema actual.
- La interfaz presenta ambos modelos por separado. No suma `cardAmount` u `otherAmount` al efectivo físico.
- El método Bizum no tiene campo dedicado en el esquema físico; su importe agregado reside en `otherAmount`, mientras que el desglose real se consulta desde `MovimientosCaja` mediante `sessionPayments.BIZUM`.
- El frontend no consulta CMS directamente ni decide permisos. El backend autoriza al usuario mediante `requireCajero()` dentro de `getCashierState()`.

## Alineación con Wix Apps nativas

| Dominio | Sistema propietario | Regla TPV |
|---|---|---|
| Catálogo y variantes | Wix Stores Catalog | No mantener catálogo/stock paralelo en el widget |
| Pedidos online | Wix Stores / Wix eCommerce | Leer pedidos por sus APIs; no recrearlos como tickets de caja |
| Reservas | Wix Bookings | Mantener reservas y pagos de reserva en Bookings; no duplicar slots |
| Procesamiento de pago | Proveedor nativo conectado a Wix (actualmente pasarela QA desconectada) | No capturar ni simular una captura real desde HTML |
| Tarjetas regalo | Wix Gift Cards | Validar/redimir mediante la app/API propietaria, nunca como descuento local no conciliado |
| Facturas | Wix Invoices V1 y flujo fiscal propio aprobado | No emitir desde el widget; el ledger fiscal está fail-closed |

La interfaz actual no invoca esas operaciones nativas. Solo define el límite de integración para evitar duplicar sus fuentes de verdad.

## Instalación en Wix Editor

1. Añadir un HTML Component a la página interna de TPV y asignarle el ID `htmlTPV`.
2. Copiar el contenido de `#htmlTPV.txt` en el HTML Component.
3. La página existente utiliza el código versionado en `src/pages/TPV.yl5th.js`. No existe una plantilla `src/pages/TPV.page-code.template.txt`; no la crees ni la uses como sustituto del código vinculado al ID `yl5th`.
4. Dar acceso a la página solo a los roles internos autorizados. La autorización efectiva sigue siendo backend.
5. Probar con una cuenta Site Member autorizada y otra no autorizada. Confirmar que el primer caso devuelve estado y el segundo recibe error sin filtrar datos.

## Límites funcionales deliberados

- No se implementan alta de ticket, cobro, devolución, apertura/cierre de caja, arqueo, emisión fiscal ni modificación de movimientos.
- `registerManualTransaction()` sigue sujeto a `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`; no debe conectarse al botón de cobro hasta corregir los gaps TPV-01..TPV-07 y certificar el runtime.
- La proyección de CajaActual debe seguir siendo consecuencia del movimiento fuente persistido. Nunca actualizar CajaActual desde el frontend ni por una ruta separada.
- El estado live actual `cashRegisterStatus=SIMULACION` hace que `getCashierState()` responda fail-closed. La interfaz muestra ese error; no lo convierte en caja abierta ni usa `isOpen` como autoridad.

## Validación pendiente

No se ha ejecutado este código en Wix Editor/Preview ni se ha confirmado que el HTML Component exista en una página concreta. Tras instalarlo, ejecutar pruebas runtime de permisos, lectura consistente, error de caja en SIMULACION, y renderizado móvil/escritorio. No realizar escrituras ni operaciones nativas de pago durante estas pruebas.
