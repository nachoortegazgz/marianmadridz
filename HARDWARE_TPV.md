# Arquitectura hardware — TPV física Marian Madrid

**Revisión:** 19-11-2026  
**Estado:** arquitectura objetivo; no se han seleccionado ni validado modelos concretos.

## 1. Objetivo

Operar una TPV web personalizada en un PC Windows, conectada al backend Wix, con cobro presencial mediante terminal bancario, impresión térmica y apertura de cajón portamonedas. La TPV registra el resultado económico; no sustituye al proveedor de pagos ni controla el hardware por su mera ejecución en navegador.

## 2. Arquitectura física objetivo

```text
                    Internet
                       |
                 Router / Firewall
                       |
                 LAN / Wi-Fi
                       |
                 PC Windows
              Navegador TPV web
                       |
                 HTTPS / Wix
                       |
             Backend Velo / WebMethods
                       |
                  Wix CMS

PC Windows ---- USB / Ethernet ---- Impresora térmica ESC/POS
                                           |
                                    RJ11/RJ12 kick
                                           |
                                      Cajón cash

Terminal bancario autónomo ---- adquirente/banco
          |
   Confirmación del pago
   (manual o integración certificada)
```

El diagrama representa la topología deseada, no una instalación ya probada.

## 3. Componentes y requisitos

| Componente | Requisito mínimo de selección | Estado |
|---|---|---|
| PC TPV | Windows soportado, navegador actualizado, SSD, RAM suficiente, puertos USB y Ethernet | Equipo concreto pendiente |
| Red | Router/firewall estable; Ethernet preferible para periféricos; Wi-Fi solo si la cobertura y estabilidad se validan | Pendiente de inventario |
| Impresora | Térmica 80 mm preferente (o ancho definido por ticket), ESC/POS documentado, driver Windows mantenido, USB o Ethernet | Modelo pendiente |
| Cajón | Compatible con tensión/pinout del puerto drawer-kick de la impresora; apertura mediante comando soportado | Modelo pendiente |
| Terminal bancario | Terminal homologado/provisto por adquirente, contactless/chip/PIN; protocolo/API documentado si se pretende integración | Marca/modelo/proveedor pendientes |
| SAI/UPS | Protección eléctrica para PC, red e impresora según carga; autonomía dimensionada | Recomendado |
| Lector de códigos | USB HID o modo teclado compatible, si el flujo de venta lo necesita | Opcional |
| Pantalla cliente | Segunda pantalla o display compatible si aporta valor operativo | Opcional |

No comprar por nombre comercial o compatibilidad genérica. Verificar ficha técnica, driver, SDK, garantía, soporte en España y disponibilidad de consumibles.

## 4. Impresora y cajón

La primera opción a evaluar es una impresora ESC/POS USB o Ethernet con driver Windows mantenido. La impresión puede realizarse mediante diálogo estándar del navegador o un agente local autorizado, según los requisitos de formato y corte.

El cajón no se conecta directamente a Wix ni se presupone controlable desde JavaScript web. La arquitectura preferente es cajón conectado al puerto de apertura de la impresora y activado mediante el mecanismo documentado por el fabricante. Deben verificarse:

- Conector, pinout, voltaje y compatibilidad eléctrica.
- Comando ESC/POS y soporte del driver para drawer-kick.
- Apertura solo después de una operación autorizada (por ejemplo, cobro efectivo), no por carga de página ni por acción no autenticada.
- Registro de la orden de apertura y manejo de fallo físico.
- Pruebas de apertura repetida, desconexión y recuperación.

No conectar un cajón a un puerto RJ11/RJ12 de impresora sin confirmar el pinout y la compatibilidad del fabricante.

## 5. Terminal bancario y registro de CARD

El terminal bancario es el componente que procesa la tarjeta con el adquirente. Wix Orders, Order Transactions o un registro interno de pago no realizan por sí mismos el cargo bancario.

Fases de evidencia que no deben confundirse:

1. **Orden de pago creada:** la TPV solicita cobrar; no significa que exista cargo.
2. **Confirmación del operador:** el empleado indica que el terminal muestra pago aprobado. Es evidencia manual y requiere actor/fecha/referencia.
3. **Confirmación técnica:** respuesta autenticada del terminal/proveedor con identificador y estado inequívoco. Solo existe si el proveedor ofrece una integración soportada.
4. **Liquidación/conciliación:** el adquirente refleja el abono en su liquidación bancaria. Es una fase distinta.

Hasta identificar terminal y proveedor, el modo viable a evaluar es terminal autónomo con confirmación manual controlada. El backend debe registrar explícitamente el origen de confirmación; no etiquetar una confirmación manual como verificación técnica ni como liquidación.

No asumir que Wix Payments permite controlar un terminal externo en España, ni que un terminal integrado con Wix POS puede reutilizarse desde una TPV web personalizada. Exigir documentación oficial del proveedor, soporte territorial, SDK/API, sandbox, webhooks, idempotencia, cancelación y devolución.

## 6. Conectividad local y seguridad

Un navegador web no tiene acceso irrestricto a USB, puertos serie ni a dispositivos de la LAN. Antes de usar impresión silenciosa, cajón o terminal integrado, comparar:

- Impresión del navegador con diálogo estándar.
- Driver/spooler Windows del fabricante.
- Agente local o middleware firmado y mantenido.
- API LAN del dispositivo, si existe y está documentada.

Cualquier agente local debe tener autenticación, allowlist de comandos, protección frente a CSRF/replay, actualización controlada, logs sin datos de tarjeta y mínimo privilegio. No exponer puertos locales a Internet ni permitir que el frontend envíe comandos arbitrarios.

La comunicación con Wix usa HTTPS y WebMethods autorizados. Nunca incluir secretos, PAN completo, CVV ni credenciales bancarias en frontend, CMS o logs.

## 7. Contrato TPV ↔ caja

- Importes en céntimos enteros.
- `CASH`: efectivo recibido menos cambio entregado; solo el neto incrementa efectivo físico.
- `CARD`: no incrementa efectivo físico.
- Mixto: componentes CASH/CARD separados, cada uno con importe, estado, referencia e idempotency key; suma exacta igual al total.
- No registrar como cobrado un intento pendiente, fallido o cancelado.
- La apertura de cajón no acredita cobro.
- Una impresión no acredita pago ni emisión fiscal válida.
- `MovimientosCaja` es el ledger fuente; `CajaActual` es proyección.
- X es snapshot no cerrante; Z es cierre inmutable y conciliado.

## 8. Plan de selección y pruebas de aceptación

1. Inventariar PC, Windows, puertos, red y periféricos existentes.
2. Identificar proveedor, marca y modelo del terminal; obtener documentación oficial de integración para España.
3. Seleccionar impresora ESC/POS y cajón compatibles como conjunto.
4. Validar driver, impresión, corte, apertura de cajón y recuperación tras desconexión.
5. Decidir modo de terminal: autónomo/manual o integración técnica certificada.
6. Definir agente local solo si la impresión/control requerido no se resuelve con mecanismos estándar y soportados.
7. Ejecutar pruebas offline y luego sandbox del proveedor; no realizar cobros reales en QA.
8. Documentar versiones, drivers, cableado, configuración, procedimientos de sustitución y mantenimiento.

**Criterio de aceptación:** cada periférico tiene modelo y firmware identificados, driver/protocolo oficial, conexión reproducible, pruebas de fallo/recuperación y responsable de mantenimiento. El terminal tiene una semántica de confirmación inequívoca y no puede provocar dobles cobros.

## 9. Decisiones todavía abiertas

- Marca/modelo del PC y versión exacta de Windows.
- Marca/modelo del terminal y adquirente bancario.
- Impresora: ancho, USB/Ethernet, ESC/POS y driver.
- Cajón: medidas, conector y compatibilidad eléctrica con impresora.
- Necesidad de impresión silenciosa, corte automático y apertura remota.
- Uso de lector de códigos y pantalla cliente.
- Necesidad real de integración automática del terminal frente a confirmación manual.

Hasta resolverlas, esta guía define requisitos y límites, no una lista de compra ni una integración aprobada.
