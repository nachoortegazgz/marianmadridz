# Remediación P0 — aislamiento ledger TPV y cierre Z

**Fecha:** 2026-11-28  
**Base:** `main` en `82ed5257a0a0541412cc02a847ebb42040d5cc37`  
**Rama:** `fix/p0-tpv-ledger-zclosing-2026-11-28`  
**Alcance:** B-BK-01 y B-BK-02 de `bugstpv.md`.

## Resultado ejecutivo

| Hallazgo | Estado de implementación | Validación |
|---|---|---|
| B-BK-01 — colisión de cadenas TPV/fiscal | **IMPLEMENTADA en código** | Pruebas de regresión añadidas; CI y Wix Runtime pendientes |
| B-BK-02 — cierre Z manual/nocturno | **PARCIALMENTE CORREGIDA** | Cron convertido a verificación + alerta; cierre manual sigue pendiente de dominio aprobado |
| Integridad de CMS y Runtime | Sin cambios de datos | Pendiente de prueba Wix aislada |

## B-BK-01 — separar lectores fiscales del ledger TPV

### Cambios

Se mantiene `MovimientosCaja` como colección física compartida, pero los lectores de la cadena fiscal excluyen explícitamente `recordSource=TPV_LEDGER` usando la constante canónica `TPV_LEDGER_SOURCE`:

- `cajas.web.js`: lectura del último movimiento fiscal, recuento diario, lectura de movimientos para cierre Z, búsqueda del predecesor y verificación de la cadena.
- `eventLog.js`: lectura del head fiscal y cola de proyección fiscal.
- `fiscalAggregator.web.js`: agregación trimestral.

En `tpvRepository.js::_sessionCajaPatch`, la apertura de sesión ya no reinicia `CajaActual.sequenceCounters`. Conserva `seqGlobal`, contadores anuales y claves de idempotencia fiscal. Si el campo compartido tiene una forma inválida, devuelve `TPV_SHARED_SEQUENCE_COUNTERS_INVALID` en lugar de sustituirlo silenciosamente.

### Decisión arquitectónica

No se crean colecciones nuevas ni se migran datos. La separación se realiza en los consumidores según el discriminador físico canónico `recordSource`, sin clasificar operaciones como live/sandbox/sintéticas y sin alterar los registros append-only existentes.

`CajaActual` continúa siendo una proyección compartida. Los writers TPV y fiscales mantienen el lock fiscal compartido; el cambio evita que una apertura TPV borre los contadores usados por la cadena fiscal.

### Riesgo residual

La separación estática de lectores no acredita por sí sola el comportamiento del QueryBuilder ni el esquema físico en Wix Runtime. Se requiere una prueba de integración aislada con registros de ambas cadenas, verificando:
1. que cada lector devuelve exclusivamente su población;
2. que la secuencia y el hash fiscal continúan desde el último movimiento fiscal;
3. que abrir una sesión TPV conserva los contadores fiscales;
4. que las proyecciones concurrentes no pierden actualizaciones.

## B-BK-02 — cierre Z

### Cambio implementado

`verifyNightlyZClosing` deja de invocar `registerZClosingInternal`. El cron queda como proceso observacional: comprueba si existe `Z_<fecha>` y, si no existe, registra la alerta deduplicada `NIGHTLY_Z_CLOSING_MANUAL_REQUIRED`.

No se fabrica un `closedBy`, una identidad de sistema ni un `recordDomain`. El cron no puede crear un cierre fiscal en nombre de un responsable no autenticado.

### Pendiente bloqueante

El cierre manual sigue validando `closedBy` como GUID de recurso y exige un `recordDomain` aprobado. En el contrato/configuración inspeccionados no existe una constante canónica ni una decisión aprobada que determine el valor permitido de `recordDomain`. El histórico existente `TPV_CUSTOM_QA` es un registro sintético incompleto y no constituye autorización para reutilizar ese valor.

Por tanto, no se ha inventado un dominio ni se ha eliminado la validación. Para completar el cierre manual se necesita aprobar y configurar el dominio fiscal/operativo correspondiente. También debe validarse el contrato completo de `HistoricoCierresZ` contra los campos required del CMS y consolidar el ownership del ID determinista `Z_<fecha>`.

## Archivos modificados

- `src/backend/cajas.web.js`
- `src/backend/eventLog.js`
- `src/backend/fiscalAggregator.web.js`
- `src/backend/tpv/tpvRepository.js`
- `src/backend/crons.js`
- `src/backend/tests/p0-tpv-ledger-zclosing.regression.test.mjs`

## Pruebas

Añadidas cuatro regresiones estáticas:
- lectores fiscales excluyen TPV_LEDGER;
- apertura TPV preserva contadores compartidos;
- cron nocturno no fabrica identidad de cierre;
- cierre público no acepta `recordDomain` del navegador.

**CI:** PENDIENTE en el HEAD de esta rama.  
**Unitarias/integración:** PENDIENTE de ejecución CI.  
**Wix Runtime/E2E:** PENDIENTE.  
**CMS:** sin escrituras ni modificaciones.  
**Pagos/cobros:** ninguno ejecutado.  
**Publicación:** no realizada; el sitio permanece Draft/no publicado.

## Criterio de aceptación

B-BK-01 solo podrá marcarse VALIDADA tras CI PASS y pruebas Wix aisladas que demuestren la segregación de ambas cadenas y la conservación de contadores. B-BK-02 solo podrá marcarse COMPLETADA cuando exista un `recordDomain` aprobado, el cierre manual supere Runtime y el cron verifique de forma idempotente el cierre persistido.
