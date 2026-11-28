# TPV — contrato único, bloqueos y errores

**Vigencia:** 2026-11-28. Estado en [STATE-NOW](STATE-NOW.md); gates en [RELEASE-READINESS](RELEASE-READINESS.md). La guía consultiva está en [AI-ENTRYPOINT](AI-ENTRYPOINT.md).

## 1. Runtime único

Todas las ejecuciones utilizan el mismo código, WebMethods, validaciones, permisos y writers. No existen ramas de negocio ni clasificación de registros por entorno. La fecha y el cliente de prueba seleccionado son el único contexto diferenciador.

Frontend presenta/orquesta. Backend resuelve identidad, autorización, catálogo, importes, impuestos, validación, idempotencia, persistencia y recuperación.

## 2. Bloqueos

No hay interruptores globales de escritura por entorno ni gates fiscales genéricos que impidan probar el dominio.

- **No bloquea el flujo interno:** las dependencias externas se aíslan en su frontera. En pagos se simula únicamente la respuesta del proveedor; el resto del flujo y la persistencia se ejecutan normalmente.
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

No duplicar ledgers ni saltarse DAL, hooks o writers mediante REST/CMS directo.

Identidad transaccional:
- PR #650 exige `transactionId` en el writer fiscal manual.
- PR #667 exige `transactionId` (1–128 caracteres) en `registrarEventoEconomico()`, y lo usa para deduplicación y recuperación de insert incierto. Se eliminaron fallbacks por secuencia y recuperación por `traceId`.
- El resto de writers se clasificará en una matriz por dominio: transactionId, clave de idempotencia propia o no aplicabilidad justificada. No imponer una regla ciega a eventos no económicos.

## 4. Integridad y no-borrado

- `bulkRemove` y `assertBulkRemoveAllowed` deniegan borrado físico.
- `removeById` solo permite retirada lógica CAS para cachés, tokens, locks y rate limits autorizados; no elimina filas.
- Crons retiran lógicamente esos controles efímeros. Idempotencia, flags y evidencia de auditoría se conservan; no se purgan físicamente.
- Intenciones comerciales/proyecciones operativas admiten actualización validada y autorizada.
- Movimientos físicos, ledgers fiscales/contables contabilizados, jornada y cierres son append-only. Rectificar mediante nuevos eventos/registros trazables.
- No modificar ni borrar movimientos históricos. La apertura de sesión sustituye la proyección heredada mediante el writer canónico y conserva su trazabilidad; cada prueba debe cerrar la sesión que abre o utiliza.

## 5. Errores explícitos

El normalizador común integrado en `main` es `src/backend/tpv/tpvError.js`. Su contrato se mantiene independiente de la validación Runtime.

Contrato público:
- `status`, `data`, `error` y `traceId`.
- Error estable: `code`, mensaje público seguro y remediation accionable.
- Metadatos cuando apliquen: `retryable`, `persisted`, `recoverable`, `auditPersisted` y código de fallo de auditoría.
- `technicalDetail` expuesto al navegador se limita al código seguro. Nunca enviar mensajes brutos de proveedor, secretos, tokens ni stack traces.
- Mantener códigos legacy reconocibles; excepción desconocida: mensaje seguro y no reintentable por defecto.
- No ocultar persistencia parcial: informar si la operación quedó persistida, requiere recuperación o falló la auditoría posterior.
- Guards de configuración, identidad y autorización dentro de la frontera try/catch del WebMethod.

El frontend muestra mensaje y remediation, conserva código/`traceId` para soporte y no convierte un error en éxito. No reintentar automáticamente si `retryable=false` o la persistencia es incierta.

## 6. Fiscalidad, caja y pruebas

- Las operaciones de prueba recorren el mismo flujo de negocio que las operaciones ordinarias. No se excluyen por etiquetas de entorno ni se utilizan ramas especiales de persistencia.
- La fecha y el cliente de prueba seleccionado identifican el contexto de la prueba; no alteran validaciones, writers, permisos, ledger ni contabilización.
- En el pago, el único elemento simulado es la respuesta del proveedor externo. Una respuesta aprobada debe recorrer el mismo tratamiento interno que la respuesta del proveedor real; nunca se declara un cobro confirmado sin esa respuesta.
- Los movimientos de caja se escriben en `MovimientosCaja` con `transactionId`, secuencia, hash, hash anterior, timestamp, sesión, operador y correlación. `CajaActual` se actualiza como proyección de la sesión.
- Los eventos fiscales y contables mantienen sus validaciones específicas y append-only. Los campos de factura no se exigen a un movimiento físico TPV cuando no aplican; el hook aplica el contrato según el tipo de registro.
- No borrar, editar ni reclasificar movimientos históricos para preparar pruebas. Las correcciones se registran como nuevos eventos trazables.


## 7. Venta y medios

El backend vuelve a resolver catálogo, precio e impuestos; el navegador no es autoridad. La intención comercial, la respuesta del proveedor, el movimiento físico y el registro fiscal son etapas separadas. Un pago solo se confirma cuando existe una respuesta válida del proveedor; el resto del flujo interno se persiste y audita con el mismo contrato.

## 8. Evidencia

CI offline PASS no acredita Preview, Runtime ni producción. Cada aceptación identifica SHA, flujo, identidad autorizada, resultado y read-back de CMS. No declarar E2E sin ejecución real en Wix Runtime.
