# Baseline de adaptación neutral del TPV

**Fecha:** 23-11-2026  
**Estado:** directriz aportada por el propietario; pendiente de reconciliación con el HEAD y aprobación técnica.  
**Alcance:** TPV interno/sintético. No autoriza pagos, reembolsos, inventario, facturación ni efectos externos reales.

## 1. Decisión de arquitectura

El repositorio ya está parcialmente migrado a nombres neutrales. Evolucionar la implementación existente; no crear un segundo repositorio ni un módulo independiente `tpvRuntimePolicy.js`.

Módulos de integración previstos:
- `src/backend/internalConfig.js`: política y constantes canónicas.
- `src/backend/tpv/tpvUtils.js`: identificadores y utilidades compartidas.
- `src/backend/tpv/tpvRepository.js`: persistencia, envelope, consultas, locks e idempotencia.
- `src/backend/tpv/tpvContext.js`: contexto de operación, si existe en el HEAD.
- WebMethods TPV existentes y consumidores frontend.

Nombres neutrales identificados como objetivo: `tpvRepository.js`, `withTpvSessionLock()`, `withTpvSaleLock()`, `makeTpvId()`, `queryTpvRecords()`, `insertTpvEvent()` y `resolveTpvContext()`. Verificar siempre en la rama de intervención; no asumir que la lista está completa.

## 2. Política única propuesta

El propietario propone una política central en `internalConfig.js`:

```js
export const TPV_RUNTIME_POLICY = Object.freeze({
    SOURCE_TYPE: "SYNTHETIC",
    PROCESSING_MODE: "INTERNAL",
    RECONCILIATION_STATUS: "NOT_RECONCILED",
    ALLOW_NATIVE_PAYMENTS: false,
    ALLOW_NATIVE_REFUNDS: false,
    ALLOW_NATIVE_INVENTORY: false,
    SCHEMA_VERSION: 2,
});
```

Criterios:
- Una única autoridad backend. No duplicar políticas ni flags.
- No añadir `ACTOR_ID` fijo. La identidad se obtiene del usuario autenticado/contexto backend; el diseño aportado propone `operator.actorId`, pendiente de comprobar contra el contrato real.
- Ninguna capability se activa desde frontend ni por el nombre del entorno.
- Las operaciones sintéticas nunca se presentan como pagos/reembolsos nativos ni como conciliadas.
- Antes de añadir la constante, comprobar si ya existe y mapear todos sus consumidores, nombres y semánticas.

## 3. Colecciones y persistencia

Aliases lógicos propuestos:

```js
export const TPV_COLLECTIONS = Object.freeze({
    SESIONES_CAJA: "CajaActual",
    VENTAS: "MovimientosCaja",
    VENTA_LINEAS: "MovimientosCaja",
    PAGOS: "MovimientosCaja",
    REEMBOLSOS: "MovimientosCaja",
    MOVIMIENTOS_CAJA: "MovimientosCaja",
    TICKET_X: "HistoricoCierresZ",
    TICKET_Z: "HistoricoCierresZ",
    AUDITORIA: "MovimientosCaja",
});
export const TPV_PAYMENT_METHOD = PAYMENT_METHOD;
export const TPV_IDENTITY_TYPES = Object.freeze({
    STAFF: "STAFF",
    CUSTOMER: "CUSTOMER",
});
```

Son propuestas contractuales, no autorización para declarar colecciones ni crear nuevas. La auditoría estática de main observó discriminadores lógicos TPV persistidos en `MovimientosCaja`, sesiones proyectadas en `CajaActual` y mapeos históricos. Por tanto:
1. Distinguir entidades/discriminadores lógicos de colecciones físicas.
2. No crear colecciones TPV_QA_* ni otro repositorio.
3. Confirmar nombres, campos, índices, permisos y política de escritura del CMS.
4. Mantener ledger append-only separado de proyecciones operativas.
5. No borrar ni sobrescribir históricos para normalizar estados.

## 4. IDs e idempotencia

Compatibilidad requerida con llamadas existentes como `makeTpvId("REFUND", key)`. El propietario propone firma compatible `makeTpvId(type, key, siteId = "")`, pasando `operator.siteId` para operaciones nuevas.

Antes de cambiar:
- Inventariar todas las llamadas, argumentos, consumidores e IDs ya persistidos.
- Confirmar normalización de `type`, determinismo, alcance y unicidad.
- Verificar compatibilidad del algoritmo y runtime Wix; el ejemplo usa `node:crypto`/SHA-256. Que exista en código o pase Node offline no acredita el smoke test Wix Runtime.
- Clave de idempotencia con alcance correcto para sitio/sesión/tipo/clave de cliente.
- Misma clave + mismo fingerprint: devolver el registro previo.
- Misma clave + fingerprint distinto: conflicto explícito `TPV_IDEMPOTENCY_CONFLICT`.
- Un cierre Z por sesión y reintentos idempotentes.
- No reutilizar IDs históricos sin compatibilidad de lectura.

## 5. Envelope central de persistencia

El propietario propone centralizar los metadatos en `insertTpvEvent()`, mediante un helper privado equivalente a:

```js
function buildTpvEnvelope(record, context) {
    return {
        ...record,
        siteId: context.siteId,
        sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
        processingMode: TPV_RUNTIME_POLICY.PROCESSING_MODE,
        reconciliationStatus: TPV_RUNTIME_POLICY.RECONCILIATION_STATUS,
        schemaVersion: TPV_RUNTIME_POLICY.SCHEMA_VERSION,
        externalSideEffects: false,
        realPayment: false,
    };
}
```

Antes de implementarlo:
- Verificar si ya existe un envelope equivalente.
- Confirmar campos canónicos y payload existente; no sobrescribir datos válidos.
- Obtener sitio/sesión del contexto backend validado, nunca del frontend.
- Garantizar `externalSideEffects:false` y `realPayment:false` como invariantes server-side.
- Comprobar que todos los escritores pasan por `insertTpvEvent()`; identificar rutas alternativas.

## 6. Estados, trazas y compatibilidad histórica

Separar siempre `status`, `sourceType` y `reconciliationStatus`.

Normalizaciones propuestas, pendientes de consumidores:
- `CONFIRMADA_SINTETICA` → `status: "CONFIRMED"` + `sourceType: "SYNTHETIC"`.
- `CONFIRMADO_SINTETICO` → `status: "CONFIRMED"` + origen explícito.
- `REEMBOLSO_SINTETICO` → `status: "REFUND_CONFIRMED"` + origen explícito.
- `syntheticOnly: true` → origen/conciliación explícitos si todos los consumidores están adaptados; `isSynthetic` puede conservarse si aporta semántica útil.
- Trazas `tpv-sandbox-*` → `tpv-*` solo después de revisar logs, dashboards, tests e histórico.

Si se necesita transición legacy, centralizar lectura temporal, solo lectura, con tests y criterio/fecha de retirada. No escribir nuevos estados antiguos. No cambiar filtros sin actualizar todos sus consumidores.

## 7. CajaActual, aislamiento y locks

La propuesta neutral requiere validar existencia, `siteId`, `sourceType`, `sessionId` y `schemaVersion`. No depender únicamente de `snapshotSource`, `traceId`, `SIMULACION` o `SANDBOX_RUN_ID`.

Antes de copiar el validador, comprobar:
- Modelo real de CajaActual (singleton o por sitio/sesión), inicialización y cierre.
- Todos sus escritores, proyección, versión y reconciliación.
- Compatibilidad de estados actuales y CLOSED.
- Idempotencia de movimientos aplicados y límites de proyección.

Conservar `withTpvSessionLock()`, `withTpvSaleLock()`, locks de reembolso y lock fiscal cuando correspondan. Cada lock debe tener alcance, expiración, versión/CAS, adquisición atómica, liberación segura y pruebas Runtime. No reemplazar garantías por retries simples. #525 sigue siendo gate P0.

## 8. Contratos por módulo

### Cierres
- Normalizar `tpv-sandbox-summary`, `tpv-sandbox-ticket-x`, `tpv-sandbox-ticket-z` solo tras búsqueda global.
- Conservar `normalizeClientIdempotencyKey(input.idempotencyKey)` y `requestFingerprint`.
- Cierre Z debe preservar idempotencia, fingerprint, sesión, operador y actor autenticado.
- No imponer el ejemplo de clave/reportId hasta verificar unicidad, esquema y contrato de historial.

### Movimientos
- Normalizar trazas tras revisar consumidores.
- Sustituir marcadores ambiguos por origen/conciliación explícitos si el contrato completo está actualizado.
- Mantener `isSynthetic` cuando sea útil y no redundante.

### Devoluciones
- Siguen siendo internas; no son reembolsos nativos Wix.
- Mantener exactamente el contrato `{ paymentMethod, amount }`; no cambiarlo a `medioPago` o `importe`.
- No marcar conciliadas.
- Mantener locks e idempotencia por venta/devolución.
- Estados nuevos requieren lectura legacy temporal y pruebas.

### Ventas, pagos y caja
- Filtros distinguen estado confirmado y origen sintético.
- No llamar a Wix Payments ni simular éxito de pago nativo.
- `actorId`: usuario autenticado; `operatorId`: operador; `profesionalId`: profesional asociado cuando corresponda.
- No aceptar libremente `actorId` desde frontend ni usar actor fijo.
- Confirmar el nombre canónico `profesionalId`/ `professionalId`; no añadir alias sin decisión contractual.

## 9. Checklist obligatorio antes de cualquier patch

### Imports y módulos
- [ ] Cada archivo importado existe y cada símbolo está exportado.
- [ ] No hay imports activos a `tpvSandboxRepository` ni módulos sandbox retirados.
- [ ] Repository, context y utils coinciden con el HEAD real.
- [ ] No existen sufijos `.web.web.js`.
- [ ] Búsqueda global de consumidores en `src/`, tests, runners, workflows y contratos externos.

### Configuración
- [ ] Una sola `TPV_RUNTIME_POLICY`, sin duplicar flags o semánticas.
- [ ] Sin `ACTOR_ID` fijo; actor autenticado.
- [ ] SOURCE_TYPE, PROCESSING_MODE, RECONCILIATION_STATUS y SCHEMA_VERSION consistentes.
- [ ] Exports TPV_COLLECTIONS, TPV_PAYMENT_METHOD y TPV_IDENTITY_TYPES coinciden con imports reales.
- [ ] Capabilities nativas deshabilitadas durante QA.

### CMS
- [ ] Colecciones físicas y discriminadores lógicos diferenciados.
- [ ] `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ` y `ControlOperativo` reconciliados con esquema, campos, índices y permisos reales.
- [ ] No se crean colecciones duplicadas.
- [ ] Append-only y proyección separados.
- [ ] Todos los writers usan la persistencia/lock autorizados.

### Frontend/backend e identidades
- [ ] DTOs de venta, pago, movimiento, devolución, X, Z e historial comparados con controlador/widget.
- [ ] Contrato devolución `{ paymentMethod, amount }` preservado.
- [ ] Idempotency key enviada y normalizada en backend.
- [ ] Actor, operador y profesional diferenciados y validados en backend.
- [ ] Autorización en cada WebMethod.

### Idempotencia y locks
- [ ] Firma makeTpvId compatible con todos los consumidores.
- [ ] Reintento idéntico devuelve registro existente.
- [ ] Misma clave con payload distinto produce conflicto.
- [ ] Un cierre Z por sesión.
- [ ] Locks con CAS/adquisición atómica, expiración y liberación segura en finally.
- [ ] Pruebas concurrentes de ventas/devoluciones y recuperación tras timeout.

### Estados y proyección
- [ ] Estado, origen y conciliación independientes.
- [ ] Lectura legacy centralizada, solo lectura y con retirada planificada.
- [ ] `realPayment:false`, `gatewayCalled:false`, `NOT_RECONCILED` invariantes para operaciones sintéticas.
- [ ] CajaActual aislada por sitio/sesión y schemaVersion.
- [ ] Idempotencia de movimientos aplicados y límites de proyección probados.

### Migración y pruebas
- [ ] Migrador separado del runtime web.
- [ ] Dry-run, conteos, totales antes/después y evidencia.
- [ ] IDs históricos preservados.
- [ ] Rollback documentado sin borrar ledgers ni sobrescribir evidencia.
- [ ] `npm run lint`, `npm test`, `npm run test:layer1`, `npm run test:layer2`.
- [ ] Wix Local Editor/Runtime: caja, venta, cambio, movimientos, devolución, X/Z y reintentos.
- [ ] Pruebas negativas de pagos/reembolsos/inventario nativos y writers fiscales.
- [ ] Concurrencia, idempotencia, timeout, replay y recuperación probados.

## 10. Secuencia de intervención

1. Read-only: capturar HEAD, árbol, imports/exports, llamadas, consumidores, CMS y contratos UI.
2. Reconciliar este baseline con código real y documentación oficial Wix vigente; resolver discrepancias en ADR/issue.
3. Tests de caracterización de persistencia, estados legacy e idempotencia.
4. Cambio mínimo en módulos existentes; no crear nuevos repositorios/políticas.
5. Migración separada solo si resulta necesaria, con dry-run y trazabilidad.
6. CI en el mismo SHA, Local Editor/Runtime y E2E controlado.
7. Revisar diff, consumidores, seguridad, rollback y documentación.
8. PR revisado y autorización expresa antes de cambios en Wix/producción.

## 11. Criterio de éxito y límites

TPV neutral respecto al entorno, interno/sintético por defecto, un único repositorio y política, persistencia alineada con CMS, sin efectos reales, conservando seguridad, locks e idempotencia. Mantener solo código diferencial necesario frente a Wix nativo.

Este documento no certifica que los snippets coincidan con el HEAD ni que TPV esté aceptado en Runtime. Su incorporación no modifica código, CMS, Wix Editor, automatizaciones, pagos o secretos.
