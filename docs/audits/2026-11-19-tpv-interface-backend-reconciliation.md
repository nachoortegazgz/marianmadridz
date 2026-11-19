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

### 3.1 Interfaz HTML — estado tras desarrollo
`#htmlTPV.txt` se ha sustituido por una interfaz QA conectada al controlador público:
- Implementa `MM_READY/MM_CONTEXT`, `postMessage`, correlación de respuestas y validación de `event.source`.
- Lee servicios Bookings, productos/variantes Stores Catalog V3 y profesionales/cliente sintéticos mediante los mensajes existentes.
- Implementa borrador de venta en memoria, validación backend, validación de pagos simulados y persistencia mediante `QA_SALE_REGISTER`.
- Implementa apertura/lectura de sesión QA, movimientos sintéticos, arqueo parcial, devoluciones QA, Ticket X/Z y consulta de auditoría.
- Los controles de cobro real, Gift Cards reales, reservas, facturación, hardware y operaciones fiscales/operativas permanecen deshabilitados.
- No hay productos ni precios codificados en la interfaz ni identidad fija de Administrador.
- Las claves idempotentes se conservan durante reintentos de operaciones con resultado incierto; los borradores del ticket permanecen solo en memoria de la sesión.

**Conclusión:** la brecha de código UI queda corregida a nivel estático. La instalación del HTML en Wix y el runtime siguen pendientes.

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
- Inspección del árbol: diez módulos legacy eliminados; 16 módulos canónicos conservados.
- HTML: comprobaciones estáticas de los mensajes requeridos, controles QA, ausencia de `fetch`/`wix-data`/`suppressAuth`, ausencia de productos hardcodeados y compilación sintáctica del script mediante V8 `new Function`: correcta.
- El primer run CI del commit anterior falló en dos aserciones de contrato (`m.type===MM_CONTEXT` y `e.source!==window.parent`); ambas se corrigieron en commits posteriores. No existe aún un run CI asociado al HEAD actual que confirme el arreglo.
- Tests locales completos: no ejecutados.
- Runtime Wix / Preview / Publish: no ejecutados.

## 6. Decisión
Conservar el backend modular `src/backend/tpv/`, el controlador público, el page code y la nueva interfaz HTML. Eliminar los diez módulos legacy de la raíz. El código UI cumple estáticamente los contratos inspeccionados, pero no se considera validado hasta ejecutar CI completo y runtime Wix. Mantener la PR Draft y no sincronizar/publicar mientras falte esa validación.
