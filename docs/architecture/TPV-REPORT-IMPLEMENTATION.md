# TPV — implementacion modular basada en el informe funcional

## Alcance de esta entrega

Esta rama incorpora los puntos de entrada backend Velo con extension `.web.js` para:

- Caja: lectura autenticada del estado actual.
- Ventas: validacion del borrador comercial en backend, sin persistencia.
- Catalogo: lectura de servicios y profesionales desde Wix Bookings.
- Informes: lectura del estado y previsualizacion X parcial.
- Validacion: aritmetica en centimos, descuentos, impuestos declarados y pagos divididos.

Todos los WebMethods requieren `Permissions.SiteMember` y validan el rol de cajero en backend cuando no delegan en `getCashierState()`. El frontend no puede enviar identidad, permisos ni actor autorizado.

## Limites deliberados

No se crean pedidos, pagos, reembolsos, movimientos de caja, sesiones, cierres X/Z, tarjetas regalo, facturas ni registros CMS. Los metodos de escritura devuelven errores explicitos `TPV_*_DISABLED`; no simulan persistencia ni pagos reales.

## Bloqueos de contrato detectados

1. El informe propone `MovimientosCaja` como ledger operativo TPV. En el repositorio actual, `MovimientosCaja` es el ledger fiscal canonico, con esquema, hooks, secuencia y cadena de integridad propios. No se puede reutilizar como tabla POS sin un ADR y un contrato de datos aprobado; mezclar ambos dominios podria contaminar la trazabilidad fiscal.
2. El informe propone campos como `estado`, `efectivoEsperado`, `totalTarjetas` y `totalBizum` en `CajaActual`. El esquema live auditado usa `cashRegisterStatus`, `netAmount`, `cashAmount`, `cardAmount`, `otherAmount`, `expectedCash`, `countedCash` y `sequenceCounters`; no existen varios de los campos del ejemplo.
3. Bizum no tiene bucket dedicado en el esquema actual de `CajaActual`; su agregado reside en `otherAmount` y el desglose se obtiene del ledger fuente.
4. `@wix/stores` y `@wix/gift-vouchers` no figuran entre las dependencias instaladas en `package.json`. El lector de productos y la consulta de tarjetas regalo quedan bloqueados hasta instalar versiones aprobadas y verificar sus contratos SDK.
5. El esquema de lineas, impuestos, ventas presenciales, pagos divididos, devoluciones, apertura de caja, arqueo y cierre Z debe aprobarse antes de habilitar escritores.
6. La identidad de cajero se valida mediante `requireCajero()`; no se usa `Permissions.SiteMember` como autorizacion suficiente.

## Integraciones nativas

- Servicios y profesionales: Wix Bookings, solo lectura en esta entrega.
- Productos y variantes: Wix Stores Catalog V3, pendiente del paquete `@wix/stores`.
- Pedidos y transacciones: Wix eCommerce, no se crean ni modifican.
- Pagos y reembolsos: proveedor conectado / Wix Payments, bloqueados.
- Tarjetas regalo: Wix Gift Cards, pendiente del paquete `@wix/gift-vouchers`.
- Facturas: Wix Invoices y flujo fiscal aprobado, bloqueados.
- Caja: `CajaActual` y `MovimientosCaja` no reciben escrituras TPV en esta entrega.

## Validacion

La suite `tpv.web-modules.contract.test.mjs` verifica validacion economica y ausencia de escritores CMS en estos WebMethods. Las pruebas offline no sustituyen la validacion en Wix Editor/Preview ni una prueba runtime del SDK Bookings.

## Siguiente gate

Antes de activar cualquier escritura:

1. Aprobar el modelo de datos POS separado del ledger fiscal, o aprobar expresamente una arquitectura que mantenga ambos contratos aislados.
2. Verificar el esquema de cada coleccion live y sus permisos.
3. Instalar y fijar las dependencias oficiales faltantes.
4. Definir idempotencia, concurrencia, compensaciones y autorizaciones.
5. Diseñar pruebas de integracion con pagos, automatizaciones y comunicaciones aislados.
6. Aprobar el cambio y habilitar writers de forma independiente, con rollback y pruebas de regresion.
