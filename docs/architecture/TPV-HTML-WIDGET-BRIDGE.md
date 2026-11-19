# Integración del widget HTML TPV — contrato vigente

**Fecha de revisión:** 2026-11-19  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Estado:** alineación estática de código; instalación y runtime Wix pendientes.

## Arquitectura

```text
#htmlTPV.txt (HTML Component)
  ↕ postMessage / MM_READY / MM_CONTEXT
src/pages/TPV.yl5th.js
  ↓ initializeTpvPage()
src/public/tpvPageController.js
  ↓ WebMethods
src/backend/tpv/*.web.js
  ↓
Repositorios TPV_QA_* y APIs Wix de lectura autorizadas
```

El HTML no accede directamente a CMS ni contiene lógica de autorización. El controlador traduce mensajes y conserva correlación por `messageId`. Los WebMethods aplican autenticación, permisos, validación, idempotencia y locks.

## Identificador Wix

El código de página versionado consulta exactamente `$w("#htmlTPV")`. Por tanto, el HTML Component de la página TPV debe tener el ID **htmlTPV**, respetando mayúsculas. No cambiarlo a `htmlTpv` sin modificar y validar conjuntamente el page code.

El page code activo es `src/pages/TPV.yl5th.js`; inicializa el controlador y no implementa reglas de negocio.

## Handshake

1. El widget emite `MM_READY` con `version: 1`, `messageId` y `payload.component = "htmlTPV"`.
2. `createWidgetBridge` valida origen, versión, tipo y tamaño del mensaje.
3. El controlador no genera una respuesta artificial para `MM_READY`; el bridge publica `MM_CONTEXT` tras completar el handshake.
4. El contexto comunica `protocolVersion: 1`, `environment: "QA"` y `syntheticOnly: true`. El widget marca `contextReady` y arranca su bootstrap.
5. El widget consulta configuración y permisos de nuevo mediante WebMethods; el contexto no sustituye la autorización backend.

## Contrato de mensajes

| Petición | Respuesta | WebMethod |
|---|---|---|
| `CASHIER_STATE` | `CASHIER_STATE_RES` | `obtenerSesionCajaQA` |
| `CATALOG_SERVICES` | `CATALOG_SERVICES_RES` | `obtenerServicios` |
| `CATALOG_STAFF` | `CATALOG_STAFF_RES` | `obtenerProfesionales` |
| `CATALOG_PRODUCTS` | `CATALOG_PRODUCTS_RES` | `obtenerProductos` |
| `PRODUCT_VARIANTS` | `PRODUCT_VARIANTS_RES` | `obtenerVariantesProducto` |
| `CUSTOMERS_SEARCH` | `CUSTOMERS_SEARCH_RES` | `buscarClientesTPV` |
| `CUSTOMER_BOOKINGS` | `CUSTOMER_BOOKINGS_RES` | `obtenerReservasClienteTPV` |
| `VALIDATE_SALE_DRAFT` | `VALIDATE_SALE_DRAFT_RES` | `validarVentaBorrador` |
| `GIFT_CARD_BALANCE` | `GIFT_CARD_BALANCE_RES` | `consultarTarjetaRegalo` |
| `QA_CONFIG` | `QA_CONFIG_RES` | `obtenerConfiguracionTPVQA` |
| `QA_PERMISSIONS` | `QA_PERMISSIONS_RES` | `obtenerPermisosTPVQA` |
| `QA_SESSION_OPEN` | `QA_SESSION_OPEN_RES` | `abrirCajaQA` |
| `QA_PARTIAL_COUNT` | `QA_PARTIAL_COUNT_RES` | `registrarArqueoParcialQA` |
| `QA_CASH_MOVEMENT` | `QA_CASH_MOVEMENT_RES` | `registrarMovimientoCajaQA` |
| `QA_PAYMENT_VALIDATE` | `QA_PAYMENT_VALIDATE_RES` | `validarDesglosePagosQA` |
| `QA_SALE_REGISTER` | `QA_SALE_REGISTER_RES` | `registrarVentaQA` |
| `QA_REFUND` | `QA_REFUND_RES` | `solicitarDevolucionQA` |
| `QA_SESSION_SUMMARY` | `QA_SESSION_SUMMARY_RES` | `obtenerResumenSesionQA` |
| `QA_TICKET_X` | `QA_TICKET_X_RES` | `generarTicketXQA` |
| `QA_TICKET_Z` | `QA_TICKET_Z_RES` | `cerrarTicketZQA` |
| `QA_AUDIT_LIST` | `QA_AUDIT_LIST_RES` | `consultarAuditoriaTPVQA` |

Además, `MM_READY` y `MM_CONTEXT` pertenecen al handshake administrado por `public/widgetBridge.js`, no a operaciones de negocio.

## Seguridad y límites

- Los escritores actuales son exclusivos de colecciones `TPV_QA_*`; no escribir en `CajaActual`, `MovimientosCaja` ni ledgers operativos desde el widget.
- Las ventas, pagos y devoluciones de esta ruta son sintéticos. No llaman a pasarela, no generan cobro bancario y no escriben ledger fiscal.
- La lectura de catálogo usa Bookings y Stores Catalog V3 según los WebMethods actuales; clientes y profesionales de QA se limitan a fixtures sintéticos.
- La UI no concede permisos. Cada WebMethod comprueba la sesión Site Member y el rol requerido.
- Las operaciones persistentes usan claves idempotentes y locks en backend. Un error con persistencia parcial exige reconciliación; no debe reintentarse con una clave nueva de forma automática.
- No habilitar hardware, cobro real, reservas, Gift Cards reales, facturación ni escrituras fiscales con este contrato.

## Validación

La prueba `src/backend/tests/tpv-widget.contract.test.mjs` verifica que cada petición funcional declarada por el widget está permitida, despachada y tiene respuesta correlacionada. La suite también debe validar el parseo del script HTML y los contratos de WebMethods.

**No verificado:** ID real del componente instalado en Wix, contenido efectivamente pegado en el Editor, permisos de página, Wix Preview, runtime publicado, impresora, cajón, terminal bancario y pruebas E2E. La presencia de código en GitHub no demuestra sincronización con el Editor.

## Procedimiento de instalación controlada

1. Confirmar que el componente HTML de la página TPV tiene ID `htmlTPV`.
2. Copiar íntegramente el contenido actual de `#htmlTPV.txt` al componente; no pegar fragmentos.
3. Confirmar que el page code vinculado a la página es `TPV.yl5th.js` y que importa `public/tpvPageController`.
4. Ejecutar CI y revisar el diff antes de sincronizar el checkout Wix CLI.
5. En Preview, probar primero handshake, lectura de estado, configuración, permisos y catálogos con un Site Member autorizado.
6. Probar denegación con usuario no autorizado.
7. Solo después ejecutar operaciones QA sintéticas en una sesión de prueba. No ejecutar cobros, fiscalidad, ni escrituras operativas.
8. Registrar resultados, logs y SHA desplegado. No publicar sin autorización explícita y sin gates aprobados.
