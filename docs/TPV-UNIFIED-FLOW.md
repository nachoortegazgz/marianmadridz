# TPV — contrato único, persistencia y errores

**Vigencia:** 2026-11-28. Flujos de aceptación: [TPV-RUNTIME-AND-TEST-FLOWS](TPV-RUNTIME-AND-TEST-FLOWS.md). Estado: [STATE-NOW](STATE-NOW.md). Gates: [RELEASE-READINESS](RELEASE-READINESS.md).

## 1. Runtime único

Desarrollo, pruebas y producción ejecutan el mismo código y las mismas reglas de dominio. No hay ramas funcionales por entorno, ni lógica que trate una venta/movimiento de forma distinta por ser una prueba.

El caso de prueba se identifica funcionalmente por el cliente de prueba acordado y el periodo de prueba. Los registros anteriores a 2027 son de prueba y se eliminarán en el reinicio previo a la puesta en marcha. Esta limpieza es una tarea de preparación de datos; no crea un runtime alternativo.

Frontend presenta e interactúa. Backend resuelve identidad, autorización, catálogo, importes, impuestos, validación, idempotencia, persistencia y recuperación.

## 2. Bloqueos y errores

No hay interruptores globales de escritura por entorno ni bloqueos fiscales genéricos que impidan probar el dominio.

Bloquean únicamente la operación afectada:
- identidad o autorización inválida para el WebMethod;
- sesión no abierta, cerrada o no coincidente;
- catálogo, precio, variante, importe o esquema no verificable;
- clave idempotente ausente, inválida o en conflicto;
- lock, concurrencia o persistencia no seguros;
- configuración imprescindible para la operación concreta.

La ausencia de proveedor externo, terminal bancaria, AEAT, SharePoint o notificaciones reales no debe impedir pruebas del dominio cuando esas dependencias no se invocan. No simular una confirmación de pago: una intención comercial permanece pendiente hasta que exista confirmación válida.

Todo rechazo debe devolver código estable, causa y remediation; no convertir errores en éxito, vacío o cero. Un fallo secundario debe declarar persistencia parcial y recuperación pendiente.

## 3. Datos y persistencia

| Colección | Función |
|---|---|
| `TransaccionesTPV` | Intención comercial; no acredita cobro ni movimiento físico. |
| `MovimientosCaja` | Ledger físico canónico. |
| `ControlOperativo` | Locks, idempotencia técnica y auditoría. |
| `CajaActual` | Proyección de sesión. |
| `HistoricoCierresZ` | Evidencia de cierre. |

No duplicar ledgers ni saltarse DAL, hooks o writers mediante REST/CMS directo. Los WebMethods y repositorios canónicos gobiernan las operaciones.

Identidad transaccional:
- PR #650 exige `transactionId` en el writer fiscal manual.
- PR #667 exige `transactionId` (1–128 caracteres) en `registrarEventoEconomico()`, para deduplicación y recuperación de insert incierto.
- El resto de writers mantiene la identidad idempotente definida por su dominio; no imponer una regla ciega a eventos no económicos.

## 4. Integridad y preparación de datos

- Los ledgers y registros fiscales/contables/laborales/cierres no se alteran para hacer pasar una prueba; las rectificaciones operativas se registran mediante nuevos eventos.
- No reutilizar ni sobrescribir la caja singleton ABIERTA ni los históricos existentes.
- El reinicio previo a la puesta en marcha eliminará los registros de prueba anteriores a 2027 según la instrucción del propietario. Debe ejecutarse como tarea de preparación explícita, con inventario, backup/evidencia y verificación posterior; no se ejecuta desde el runtime ni durante una batería.
- No introducir marcadores de negocio, flags, prefijos, colecciones paralelas o filtros que diferencien registros reales y de prueba.

## 5. Errores explícitos

El normalizador común es `src/backend/tpv/tpvError.js`.

Contrato público:
- `status`, `data`, `error` y `traceId`.
- Error estable: `code`, mensaje público seguro y remediation accionable.
- Metadatos cuando apliquen: `retryable`, `persisted`, `recoverable`, `auditPersisted` y código de fallo de auditoría.
- No enviar mensajes brutos de proveedor, secretos, tokens ni stack traces al navegador.
- No ocultar persistencia parcial. No reintentar automáticamente si `retryable=false` o la persistencia es incierta.
- Guards de configuración, identidad y autorización dentro de la frontera try/catch del WebMethod.

## 6. Fiscalidad y medios de pago

El backend vuelve a resolver catálogo, precio e impuestos; el navegador no es autoridad. Intención comercial, pago verificado, movimiento físico y registro fiscal son etapas separadas. Un medio seleccionado no equivale a pago confirmado. Los medios no soportados por el contrato vigente se rechazan explícitamente.

No confundir hash interno con hash AEAT. El mapping fiscal y los campos CMS deben contrastarse con especificación oficial. No recalcular ni alterar históricos para completar datos ausentes.

## 7. Divergencia de implementación pendiente

La inspección de `registrarVenta` en la rama `main` consultada el 28-11-2026 encontró que el registro incluye `sourceType` desde `TPV_RUNTIME_POLICY`. La instrucción vigente del propietario prohíbe clasificar operaciones/datos por origen real/prueba. Antes de retirar el campo, inventariar esquema CMS, writers, readers, validadores y compatibilidad histórica; no cambiar solo un lado del contrato. Esta divergencia no se considera resuelta por esta actualización documental.

## 8. Evidencia

CI offline PASS no acredita Preview, Runtime ni producción. Cada aceptación identifica SHA, nivel, flujo, identidad/rol, respuesta y read-back. Un CMS REST insert/read-back no acredita WebMethods Velo. No declarar E2E sin ejecución real en Wix Runtime.

La matriz reproducible y los flujos de éxito están en [TPV-RUNTIME-AND-TEST-FLOWS](TPV-RUNTIME-AND-TEST-FLOWS.md).
