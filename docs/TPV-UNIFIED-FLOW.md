# TPV — contrato único, bloqueos y errores

**Vigencia:** 2026-11-27. Estado en [STATE-NOW](STATE-NOW.md); gates en [RELEASE-READINESS](RELEASE-READINESS.md).

## 1. Runtime único

Desarrollo, pruebas y producción ejecutan el mismo código y reglas de dominio. Fixtures y adaptadores simulados sustituyen dependencias externas, no la lógica de negocio.

Frontend presenta/orquesta. Backend resuelve identidad, autorización, catálogo, importes, impuestos, validación, idempotencia, persistencia y recuperación.

## 2. Bloqueos

No hay interruptores globales de escritura por entorno ni gates fiscales genéricos que impidan probar el dominio.

- **No bloquea unitarias/contratos/integración simulada:** ausencia de serie/configuración fiscal productiva, credenciales reales, terminal, CMS live, AEAT, SharePoint o notificaciones; se inyectan fixtures y dobles.
- **Sí bloquea la operación concreta:** identidad/autorización inválida; configuración requerida para esa operación; campos/tipos/importes/secuencia/hash inválidos; catálogo/precio no verificable; falta de lock, idempotencia o concurrencia segura; destino de escritura no aislado.
- **Preview/Runtime:** mismo dominio con fixture aislado y efectos externos interceptados. Persistencia solo mediante writer canónico en ámbito de prueba inequívoco.
- **Producción:** configuración legal, permisos, pago verificado y controles de integridad obligatorios.

Un fallo detiene la operación afectada antes de persistir cuando corresponda; no deshabilita módulos ajenos.

## 3. Datos y persistencia

| Colección | Función |
|---|---|
| `TransaccionesTPV` | Intención comercial; no acredita cobro ni movimiento físico. |
| `MovimientosCaja` | Ledger físico canónico. |
| `ControlOperativo` | Locks, idempotencia técnica y auditoría. |
| `CajaActual` | Proyección de sesión. |
| `HistoricoCierresZ` | Evidencia de cierre inmutable. |

No duplicar ledgers ni saltarse DAL, hooks o writers mediante REST/CMS directo. `transactionId` obligatorio y fingerprint de replay están implementados en el writer fiscal manual de PR #650; no generalizar a todos los eventos hasta auditar `eventLog.js` y consumidores.

## 4. Integridad y no-borrado

- `bulkRemove` y `assertBulkRemoveAllowed` deniegan borrado físico.
- `removeById` solo permite retirada lógica CAS para cachés, tokens, locks y rate limits autorizados; no elimina filas.
- Crons retiran lógicamente esos controles efímeros. Idempotencia, flags y evidencia de auditoría se conservan; no se purgan físicamente.
- Intenciones comerciales/proyecciones operativas admiten actualización validada y autorizada.
- Movimientos físicos, ledgers fiscales/contables contabilizados, jornada y cierres son append-only. Rectificar mediante nuevos eventos/registros trazables.
- No modificar ni reclasificar históricos durante QA. No reutilizar la caja singleton ABIERTA.

## 5. Errores explícitos

El normalizador común integrado en `main` es `src/backend/tpv/tpvError.js`. PR #651 está integrada y su CI completo está PASS; esto no acredita Wix Runtime.

Contrato público:
- `status`, `data`, `error` y `traceId`.
- Error estable: `code`, mensaje público seguro y remediation accionable.
- Metadatos cuando apliquen: `retryable`, `persisted`, `recoverable`, `auditPersisted` y código de fallo de auditoría.
- `technicalDetail` expuesto al navegador se limita al código seguro. Nunca enviar mensajes brutos de proveedor, secretos, tokens ni stack traces.
- Mantener códigos legacy reconocibles; excepción desconocida: mensaje seguro y no reintentable por defecto.
- No ocultar persistencia parcial: informar si la operación quedó persistida, requiere recuperación o falló la auditoría posterior.
- Guards de configuración, identidad y autorización dentro de la frontera try/catch del WebMethod.

El frontend muestra mensaje y remediation, conserva código/`traceId` para soporte y no convierte un error en éxito. No reintentar automáticamente si `retryable=false` o la persistencia es incierta.

## 6. Fiscalidad y fixtures

- `recordTimestamp` UTC lo genera backend; no usar etiquetas genéricas de entorno para clasificar negocio.
- Solo marcadores explícitos de smoke/fixture (p. ej. `SMOKE_TEST`, movement types de simulación, `SIMULATED_ONLY` o la triple marca legacy QA) se excluyen de lecturas fiscales/recibos cuando el contrato lo requiere. Un campo genérico `synthetic` o `sourceType` por sí solo no clasifica un registro.
- No confundir hash interno con hash AEAT. El mapping de alta/anulación, serie/número, fecha, importes, hash previo y campos CMS debe contrastarse con especificación oficial.
- No recalcular ni alterar históricos.

## 7. Venta y medios

El backend vuelve a resolver catálogo, precio e impuestos; el navegador no es autoridad. Intención comercial, pago verificado, movimiento físico y registro fiscal son etapas separadas. Medios no soportados por el contrato V1 se rechazan explícitamente.

## 8. Evidencia

CI offline PASS no acredita Preview, Runtime ni producción. Cada aceptación identifica SHA, entorno, flujo y resultado. No declarar E2E sin ejecución real en Wix Runtime.
