# Auditoría de alineación TPV — 2026-11-19

## 1. Objetivo
Comparar la interfaz versionada `#htmlTPV.txt`, el controlador Velo, los WebMethods actuales de `src/backend/tpv/` y los módulos legacy ubicados en la raíz de `src/backend/`.

## 2. Baseline
- Repositorio: `nachoortegazgz/marianmadridz`.
- Rama base auditada: `main`.
- HEAD auditado: `f1074788ac2c4cceb225da2ebf77a1895a04399d`.
- SHA blob HTML: `25fe92bced08b790630dbd6546490f7809df4c7a`.
- Estado Wix previamente verificado: `Draft`; no Preview, Publish ni runtime acreditado.

## 3. Hallazgos verificados

### 3.1 Interfaz HTML
`#htmlTPV.txt` (995 líneas, 20.154 caracteres) es una maqueta local, no un widget integrado:
- Ocho productos/precios están hardcodeados en el HTML.
- El usuario aparece fijado como `Administrador`.
- El estado de caja se muestra estáticamente como abierta.
- `pay()` incrementa variables locales en memoria y limpia el ticket; no invoca backend ni persiste una venta.
- No contiene `postMessage`, listener de mensajes, `MM_READY` ni `MM_CONTEXT`.
- No contiene la integración de catálogo/venta que requiere el controlador público.
- El controlador `src/public/tpvPageController.js` sí despacha los WebMethods de QA, pero el HTML actual no implementa el protocolo que los conecta.

**Conclusión:** no instalar ni usar este HTML como TPV funcional. Conservarlo versionado únicamente como maqueta hasta sustituirlo por una interfaz conectada y validada.

### 3.2 Backend canónico
La implementación activa está organizada en `src/backend/tpv/` y la consume `src/public/tpvPageController.js`. Incluye sesiones QA, ventas sintéticas, catálogo Bookings/Stores V3 de solo lectura, pagos simulados, movimientos QA, devoluciones QA, cierres X/Z, auditoría, permisos, validación, repositorio idempotente y locks CAS.

El page code `src/pages/TPV.yl5th.js` se limita correctamente a inicializar `initializeTpvPage`; no duplica lógica de negocio.

### 3.3 Módulos legacy de la raíz
Se encontraron diez archivos `src/backend/tpv*.web.js` fuera del directorio canónico. La búsqueda de símbolos/imports no encontró consumidores activos de sus exports. Son stubs de contratos antiguos; dos escribían directamente en `CajaActual`/ `MovimientosCaja`, fuera de las políticas y repositorio QA actuales.

Se eliminan de esta rama:
- `src/backend/tpvCaja.web.js`
- `src/backend/tpvVentas.web.js`
- `src/backend/tpvCatalogo.web.js`
- `src/backend/tpvCierres.web.js`
- `src/backend/tpvDevoluciones.web.js`
- `src/backend/tpvMovimientos.web.js`
- `src/backend/tpvPagos.web.js`
- `src/backend/tpvPermisos.web.js`
- `src/backend/tpvAuditoria.web.js`
- `src/backend/tpvUtils.web.js`

No se elimina ningún módulo del directorio canónico `src/backend/tpv/`.

## 4. Impacto y riesgos
- La eliminación evita que se importe accidentalmente el backend legacy, que contiene escritores directos y contratos incompatibles.
- No cambia colecciones, registros, permisos, índices, automatizaciones, ledgers ni Wix.
- El widget HTML permanece sin integrar y constituye un bloqueo funcional P1.
- Los tests de contrato del widget esperan `MM_READY/MM_CONTEXT`, `postMessage` y acciones QA que no están presentes en el HTML actual; se requiere ejecución CI para confirmar el resultado de la suite y corregir el contrato de forma coherente.

## 5. Validación
- Búsqueda GitHub de los exports legacy: sin consumidores fuera de los propios archivos.
- Lectura completa de `#htmlTPV.txt`, `src/public/tpvPageController.js`, `src/pages/TPV.yl5th.js`, README canónico y pruebas de contrato.
- Inspección de estructura recursiva del repositorio.
- Tests locales: no ejecutados.
- CI de la rama: pendiente.
- Runtime Wix / Preview / Publish: no ejecutados.

## 6. Decisión
Conservar el backend modular `src/backend/tpv/`, el controlador público y el page code. Eliminar los diez módulos legacy de la raíz. Mantener `#htmlTPV.txt` como maqueta bloqueada, no como interfaz operativa. La integración UI debe ser un cambio separado con contrato, pruebas y revisión antes de sincronizar con Wix.
