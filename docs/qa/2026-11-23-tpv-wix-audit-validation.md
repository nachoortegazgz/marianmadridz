# Auditoría Wix — TPV — corte 2026-11-23

**Repositorio/main:** ccdac0347e86f430c4f8086765815d9d5d7e00af  
**PR #541, #540, #542, #543 y #544:** integradas en main. PR #543 corrigió las aserciones TPV; PR #544 actualizó la documentación.  
**PR #537:** sus commits exclusivos quedan preservados en el historial de #541.  
**Sitio:** 188bed94-177c-4bc9-a9f0-35080d874f3e.  
**Read-back Wix Site Context (2026-11-23):** Draft · Wix Editor · Velo Enabled · Premium · dominio personalizado · EUR · Europe/Madrid.  
**Estado de aceptación:** **NO-GO Runtime / producción**.

## Conclusión vigente

La integración de código TPV está en main. La aceptación estática no demuestra ejecución en Wix Preview, sincronización Git-Editor, esquema CMS real, permisos efectivos ni conciliación operacional. No hay autorización para publicar ni para habilitar pagos o writers fiscales.

## CI de referencia

- Backend offline quality gates sobre el HEAD actual: SUCCESS, run 45107377657 (364/364 Layer 1, 255/255 Layer 2, 736/736 suite offline, npm audit 0, contratos SDK y ESLint).
- Gitleaks full-history: SUCCESS, run 45107377700.
- La aserción obsoleta que esperaba cuatro métodos se corrigió en PR #543; no es un fallo vigente.

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

Es una revisión de repositorio/GitHub, documentación y lectura de contexto del sitio. El read-back directo de Wix Site Context devuelve Draft; las menciones Published de issues #520/#526 son históricas y quedan reconciliadas. No se han ejecutado escrituras CMS, pagos, reembolsos, facturación, emisión Veri*Factu, automatizaciones externas, publicación ni despliegue. El estado Draft no demuestra que el SHA Git esté sincronizado con Wix Editor ni sustituye las pruebas Preview/Runtime.

## Historial

La comparación detallada de ramas, los hashes de merge y las notas del candidato PR #537/#541 quedan en el historial Git y en los commits correspondientes. Este documento sustituye las afirmaciones antiguas de «PR abierta», «main intacta» o «sin CI» que ya no describen el estado actual.
