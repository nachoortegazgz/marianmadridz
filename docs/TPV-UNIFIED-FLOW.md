# TPV — contrato único, bloqueos y errores

**Vigencia:** 2026-11-27. Este documento define reglas; [STATE-NOW](STATE-NOW.md) contiene el estado y [RELEASE-READINESS](RELEASE-READINESS.md) los gates.

## 1. Runtime único

Desarrollo, pruebas y producción ejecutan el mismo código y reglas de dominio. Fixtures y adaptadores simulados solo sustituyen CMS, pagos, terminales, fiscalidad o notificaciones en los límites de infraestructura. No crear un runtime de negocio paralelo ni falsear configuración productiva.

Frontend presenta/orquesta. Backend resuelve identidad, autorización, catálogo, importes, impuestos, validación, idempotencia, persistencia y recuperación.

## 2. Bloqueos correctos

No existen interruptores globales de escritura por entorno ni gates fiscales genéricos que impidan probar el dominio.

- **No bloquea unitarias/contratos/integración simulada:** ausencia de serie/configuración fiscal productiva, credenciales reales, terminal, CMS live, AEAT, SharePoint o notificaciones; se inyectan fixtures y dobles.
- **Sí bloquea la operación concreta:** identidad/autorización inválida; configuración requerida para esa operación; campos/tipos/importes/secuencia/hash inválidos; catálogo/precio no verificable; falta de lock, idempotencia o concurrencia segura; destino de escritura no aislado.
- **En Preview/Runtime:** ejecutar mismo dominio con fixture aislado y efectos externos interceptados. La persistencia solo se permite por writer canónico en ámbito de prueba inequívoco.
- **En producción:** configuración legal, permisos, pago verificado y controles de integridad son obligatorios. Ningún gate productivo se elimina para facilitar QA.

Un fallo debe detener la operación afectada antes de persistir cuando corresponda, no deshabilitar globalmente módulos ajenos.

## 3. Contratos de datos y persistencia

| Colección | Función |
|---|---|
| `TransaccionesTPV` | Intención comercial; no acredita cobro ni movimiento físico. |
| `MovimientosCaja` | Ledger físico canónico. |
| `ControlOperativo` | Locks, idempotencia técnica y auditoría. |
| `CajaActual` | Proyección de sesión. |
| `HistoricoCierresZ` | Evidencia de cierre sujeta a inmutabilidad. |

No duplicar ledgers ni saltarse DAL, hooks o writers mediante REST/CMS directo. `transactionId` obligatorio y fingerprint de replay están implementados en el writer fiscal manual de PR #650; no generalizar a todos los eventos hasta auditar `eventLog.js` y consumidores.

## 4. Integridad y edición

- Borrado prohibido en DAL, bulk y hooks CMS; los crons no pueden purgar físicamente.
- Intenciones comerciales y proyecciones operativas admiten actualización solo mediante validación backend completa y autorización.
- Movimientos físicos, ledgers fiscales/contables contabilizados, jornada y cierres son append-only. Corregir con nuevos eventos/registros rectificativos trazables; no sobrescribir evidencia.
- No modificar ni reclasificar históricos durante QA. No reutilizar la caja singleton ABIERTA.

## 5. Errores explícitos

El normalizador canónico propuesto por PR #651 es `src/backend/tpv/tpvError.js`; su integración debe considerarse pendiente hasta merge/CI PASS.

Contrato público:
- `status`, `data`, `error` y `traceId`.
- Error estable: `code`, mensaje público seguro y remediation accionable.
- Metadatos cuando apliquen: `retryable`, `persisted`, `recoverable`, `auditPersisted` y código de fallo de auditoría.
- Detalle técnico acotado y sanitizado; nunca secretos, tokens ni stack traces al navegador.
- Mantener códigos legacy reconocibles. Excepción desconocida: mensaje seguro y no reintentable por defecto.
- No ocultar persistencia parcial: informar si la operación quedó persistida, requiere recuperación o falló la auditoría posterior.
- Guards de configuración, identidad y autorización deben quedar dentro de la frontera try/catch del WebMethod para devolver el mismo envelope.

El frontend muestra mensaje y remediation, conserva el código/traceId para soporte y no convierte un error en éxito. No reintentar automáticamente si `retryable=false` o el resultado de persistencia es incierto.

## 6. Fiscalidad y clasificación

- `recordTimestamp` UTC lo genera backend; no usar etiquetas de entorno ni campos cliente-controlados para clasificar registros.
- Marcadores explícitos de smoke/simulación, si existen en fixtures, sirven solo para identificar datos de prueba y excluirlos de lecturas operativas cuando el contrato lo requiera; no acreditan operaciones reales.
- No confundir hash interno con hash AEAT. El mapping de alta/anulación, serie/número, fecha, importes, hash previo y campos CMS debe contrastarse con especificación oficial antes de integrar.
- No recalcular ni alterar históricos.

## 7. Venta y medios

El backend vuelve a resolver catálogo, precio e impuestos; el navegador no es autoridad. La intención comercial, el pago verificado, el movimiento físico y el registro fiscal son etapas separadas. Los tests prueban tanto rechazos de producción como el flujo de dominio con fixtures. Medios no soportados por el contrato V1 deben rechazarse explícitamente.

## 8. Evidencia

CI offline no acredita Preview, Runtime ni producción. Cada aceptación identifica SHA, entorno, flujo y resultado. No declarar E2E sin ejecución real en Wix Runtime.
