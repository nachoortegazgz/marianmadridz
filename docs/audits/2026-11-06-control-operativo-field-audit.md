# Auditoría de campos — CitasF2, ComplementosCatalogo y ControlOperativo

- Fecha: 2026-11-06
- Alcance: búsqueda estática del código de `main` y contratos CMS documentados en el snapshot de 2026-11-05.
- Limitación: no se ha consultado ni modificado el esquema físico CMS en esta auditoría. Las recomendaciones de eliminación requieren comprobar datos existentes y usos en CMS/Editor.

## 1. ControlOperativo — expiración e idempotencia

`expiresAt` es el campo canónico `DATETIME` de expiración. `bookingCore.js` usa `expiresAt` para locks y transacciones `IDEMPOTENCY`; `events.js` lo usa para el TTL de `WEBHOOK_EVENT`; `security.js` lo escribe/renueva en `RATE_LIMIT`; y `crons.js` lo consulta para limpiar locks, rate limits y cachés.

La variante plural `leasesExpireAt` no aparece en el código. La variante histórica real es `leaseExpiresAt`; `normalizeControlKeys` la promueve a `expiresAt` y la elimina del objeto antes de persistir. Por tanto, el flujo activo de idempotencia ya utiliza `expiresAt`. Se añade una aserción de regresión para exigir `Date` en `expiresAt` y prohibir ambas variantes en nuevas filas.

**Migración física pendiente:** antes de retirar la columna CMS `leaseExpiresAt`, hay que migrar cualquier valor existente a `expiresAt` y comprobar que no quedan valores que solo existan en la columna antigua. Mantener temporalmente la normalización legacy hasta completar esa migración evita perder leases históricos.

## 2. ControlOperativo — evaluación

| Campo | Evidencia de uso | Decisión |
|---|---|---|
| `pairToken` | `citasManager.web.js` crea flags `SYSTEM_FLAG` con este campo. En `IDEMPOTENCY` también es el `_id` de la fila. | **Conservar** |
| `transactionId` | `cajas.web.js` lo escribe en compensaciones; `crons.js` lo consume al recuperar el ledger fiscal. | **Conservar** |
| `orderId` | Compensaciones fiscales y alertas de conciliación de inventario. | **Conservar** |
| `refundId` | Compensaciones y alertas de conciliación de devoluciones. | **Conservar** |
| `kind` | Discriminador de compensación; `crons.js` lo usa para elegir el procesador. | **Conservar** |
| `maxAttempts` | `inventario.web.js` lo escribe en alertas de conciliación. | **Conservar** |
| `nextRetryAt` | Sin consumidor ni escritor activo localizado; solo aparece en documentación de esquema. | **Candidato a eliminar** |
| `lastError` | Escrito y leído en compensaciones y alertas de inventario. | **Conservar** |
| `totalAmount` | Escrito en compensaciones fiscales y leído por `crons.js`. | **Conservar** |
| `operationDescription` | Escrito en compensaciones y enviado al ledger fiscal por `crons.js`. | **Conservar** |
| `surface` | Clave de partición del rate limiter persistente. | **Conservar** |
| `requesterKey` | Hash del solicitante usado por el rate limiter. | **Conservar** |
| `requestCount` | Incremento atómico del rate limiter. | **Conservar** |
| `windowStart` | Timestamp guardado en registros RATE_LIMIT; figura en ADR-004. | **Conservar por contrato vigente** |
| `retryAfter` | Valor devuelto por el WebMethod como tiempo de espera; no se persiste en el registro. | **Candidato a eliminar de CMS** |
| `version` | Compare-and-set del rate limiter; se incrementa atómicamente. | **Conservar** |
| `processedAt` | Solo se escribe dentro de `payload` en eventos webhook; no hay uso top-level. | **Candidato a eliminar de CMS** |
| `attempt` | Alias singular legacy; `normalizeControlKeys` lo migra a `attempts` y lo elimina. | **Eliminar columna tras verificar/migrar datos** |

No confundir `attempt` con `attempts`: `attempts` sí se utiliza por compensaciones y alertas.

## 3. CitasF2 — evaluación

| Campo | Evidencia de uso | Decisión |
|---|---|---|
| `noShowReason` | Sin lector/escritor activo localizado. | **Candidato a eliminar** |
| `noShowAt` | Sin lector/escritor activo localizado. | **Candidato a eliminar** |
| `changeLog` | Sin lector/escritor activo localizado. | **Candidato a eliminar** |
| `thirdPartyId` | Escrito por `bookingCore.js` y validado en `data.js`; opcional. | **Conservar** |
| `cashMovementId` | Usado en `citasManager.web.js` para enlazar cobro y movimiento de caja. | **Conservar** |
| `invoicingDate` | Sin lector/escritor activo localizado. | **Candidato a eliminar** |

Los candidatos requieren comprobar datos existentes, vistas, filtros, automatizaciones y uso manual en el CMS.

## 4. ComplementosCatalogo — evaluación

| Campo | Evidencia de uso | Decisión |
|---|---|---|
| `traceId` | Sin consumidor específico de catálogo localizado en el código. | **Candidato a eliminar**, si no se usa para auditoría manual |
| `ServiciosCatalogo_name` | Campo `MULTI_REFERENCE`; no hay acceso por este ID en el código. | **No eliminar todavía**: comprobar relación nativa, referencias, vistas y widgets CMS. |

`ServiciosCatalogo_name` puede tener valor como relación nativa de CMS aunque el backend no lo consulte directamente. Su eliminación exige comprobar que no sea la relación que vincula complementos y servicios.

## 5. Orden seguro de limpieza

1. Exportar esquemas físicos QA actuales y registros de las tres colecciones.
2. Migrar `leaseExpiresAt` → `expiresAt` y `attempt` → `attempts` cuando falte el campo canónico; verificar cero valores pendientes.
3. Confirmar que no existen consumidores externos: páginas, widgets HTML, vistas CMS, automatizaciones, integraciones y consultas manuales.
4. Retirar del CMS solo campos aprobados y sin datos que deban conservarse.
5. Retirar después compatibilidades legacy de `normalizeControlKeys` y actualizar contrato/documentación.
6. Ejecutar regresión offline y pruebas QA controladas. No crear reservas ni pagos reales.

## 6. Límites

Este informe no declara que los campos candidatos estén vacíos ni que la columna física actual siga teniendo exactamente la revisión del snapshot anterior. No se han borrado campos, migrado registros ni modificado CMS.
