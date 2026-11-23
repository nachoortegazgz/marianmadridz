# Auditoría Wix — TPV — corte 2026-11-23

**Repositorio/main:** 956356db48ee9d0ba363023c14105474316f84dd  
**PR #541:** integrada en main.  
**PR #540:** integrada en main. **PR #542:** integrada; CI posterior falló.  
**PR #537:** sus commits exclusivos quedan preservados en el historial de #541.  
**Sitio:** 188bed94-177c-4bc9-a9f0-35080d874f3e.  
**Estado de aceptación:** **NO-GO Runtime / producción**.

## Conclusión vigente

La integración de código TPV está en main. La aceptación estática no demuestra ejecución en Wix Preview, sincronización Git-Editor, esquema CMS real, permisos efectivos ni conciliación operacional. No hay autorización para publicar ni para habilitar pagos o writers fiscales.

## CI de referencia

- Backend offline quality gates sobre main: FAIL, run 45105979742. Una aserción contractual esperaba cuatro medios de pago y contradice el enum centralizado de seis.
- Secret scanning: SUCCESS, run 45105979748.
- PR #542 integró una primera corrección que aún fallaba. PR #543 contiene la corrección final de las aserciones; CI de su HEAD más reciente pendiente.

## Contrato de pagos comprobado estáticamente

TPV_PAYMENT_METHOD contiene EFECTIVO, TARJETA, BIZUM, BONO, TARJETA_REGALO y OTROS. El validador obtiene los métodos desde el enum centralizado. El resumen separa seis categorías y las devoluciones conservan la asignación por medio.

BONO y TARJETA_REGALO son medios sintéticos de registro; no equivalen a canje real ni a integración de saldo con Wix Gift Cards. Esta distinción se mantiene en la matriz de aceptación.

## Pendientes de aceptación

- Identidad del operador Wix y recurso Staff real.
- Matriz de roles y permisos efectivos.
- Sesión, lock y concurrencia de CajaActual.
- Ventas mixtas, movimientos, devoluciones parciales y conciliación física de efectivo.
- Ticket X, cierre Z, replay, vínculo X/Z y auditoría.
- Exportaciones, lecturas, impresión y denegaciones.
- Aislamiento Sandbox/Online y prueba negativa Published.
- Sincronización exacta de Git con Wix Editor y validación Preview.

## Límites de esta auditoría

Es una revisión de repositorio/GitHub y documentación. No se han ejecutado escrituras CMS, pagos, reembolsos, facturación, emisión Veri*Factu, automatizaciones externas, publicación ni despliegue. La última lectura de contexto Wix disponible indicaba Draft y Velo Enabled; no se interpreta como prueba de sincronización del código.

## Historial

La comparación detallada de ramas, los hashes de merge y las notas del candidato PR #537/#541 quedan en el historial Git y en los commits correspondientes. Este documento sustituye las afirmaciones antiguas de «PR abierta», «main intacta» o «sin CI» que ya no describen el estado actual.
