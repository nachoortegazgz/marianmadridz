# Relevo técnico — 2026-11-23

**Repositorio:** `nachoortegazgz/marianmadridz`  
**main:** `995c085aa2ef45fea6d57f95f86d4c75c7cf7f7d` (PR #536)  
**PR de trabajo:** [#541](https://github.com/nachoortegazgz/marianmadridz/pull/541)  
**Rama:** `feat/tpv-payment-exports-after-p0-20261123`  
**HEAD de esta nota:** `f799e5e56ad0bf9d10cdb5958a964641f8576118`

## Objetivo
Continuar la auditoría de TPV sobre el estado real de GitHub, corregir incompatibilidades entre widget, WebMethods, validadores y contratos de persistencia, y mantener el release bloqueado hasta obtener evidencia Wix Runtime.

## Cambios implementados en la rama

1. **Selección de cliente en #htmlTPV:** el botón Cliente abre búsqueda de identidades sintéticas con `CUSTOMERS_SEARCH`; los resultados se renderizan escapados, se conserva `customerIdentityId` y se envía en `SALE_REGISTER`. El backend valida de nuevo la identidad.
2. **Identidades canónicas:** `assertTpvIdentity` exige `sourceType=SYNTHETIC`, `siteId` y `schemaVersion=2`, además de tipo/ID, email de prueba, estado activo y `syntheticOnly=true`. La política de inserción ya exigía esos campos; el validador se ha alineado.
3. **Compatibilidad histórica:** la validación legacy solo se activa con `allowLegacyRead: true`, admite los IDs históricos `SANDBOX-*` y el formato transicional `TPV-*` con `environment/testRunId`, y no autoriza escrituras. El fixture existente se ha reclasificado como fixture de lectura legacy, no como plantilla de altas.
4. **Idempotencia:** la búsqueda de eventos contempla ID canónico, ID legacy por colección y el formato legacy compartido, evitando perder descubribilidad de reintentos históricos.
5. **WebMethods/exportaciones:** la clasificación de seguridad contempla los métodos de exportación que escriben una entrada de auditoría; se mantienen protegidos por autorización backend.
6. **Contratos de UI:** pruebas ajustadas para verificar el protocolo real (respuestas dinámicas `type + "_RES"`, helper compartido de movimientos, variantes y DTO de cierre) sin exigir formatos de espacios irrelevantes.
7. **Documentación:** actualizado el baseline del backlog y el README TPV para separar escritura neutral de lectura legacy.

## Evidencia CI

- HEAD anterior `3b1fb058f8580c7b185154e7d2b0c46488fc80a5`: Layer 1 falló 356/364; había incompatibilidades de widget, tests y contrato de identidades.
- HEAD `d4f234efc36cb1f03262eb7c0ed021f26ebc7ba6`: 362/364; quedaron dos aserciones estáticas desactualizadas.
- HEAD `72013651be10bed2af3085431fb58309e94f07a0`: 363/364; quedó una aserción estática de REFUND.
- HEAD actual `f799e5e56ad0bf9d10cdb5958a964641f8576118`: secret scanning SUCCESS (run 45099716725); Backend offline quality gates en ejecución (run 45099716665) al redactar esta nota. No declarar CI aprobado hasta consultar el resultado final.

## Pendiente / release gate

- Confirmar SUCCESS de Layer 1, Layer 2, suite offline completa, SDK contracts y ESLint sobre el mismo HEAD final.
- Revisar diff completo de PR #541 y confirmar que no queden imports, símbolos o WebMethods duplicados/huérfanos. En particular, revisar el endpoint histórico duplicado `obtenerMovimientosCaja` en `tpvAuditoria.web.js` frente al lector de ledger en `tpvMovimientos.web.js`; no eliminar ni renombrar sin completar búsqueda de consumidores y compatibilidad.
- Ejecutar pruebas de aceptación en Wix Preview con CMS Sandbox real: abrir sesión, leer catálogo, seleccionar cliente y profesional, venta sintética, pago mixto, entrada/salida, devolución sintética, X, Z, exportaciones e idempotencia/replay.
- Ejecutar pruebas negativas en Published sin realizar escrituras: llamadas no autorizadas, datos legacy en ruta de escritura, identidad de otro site, hash/version inválidos y capabilities externas deshabilitadas.
- Reconciliar #416 (compensaciones fiscales), #520 (automatizaciones), #526 (reservas online), #525 (lock CajaActual) y demás gates del backlog antes de release.
- Confirmar sincronización del SHA en Wix Editor; no hay evidencia actual de que el branch esté instalado.

**Estado:** PR #541 abierta; integración y runtime no validados; **NO-GO para producción**. No se han ejecutado escrituras CMS, pagos, reembolsos, cambios de configuración Wix ni despliegues.
