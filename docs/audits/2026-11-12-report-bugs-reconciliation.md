# Reconciliación del informe técnico de bugs — marianmadrid.es

**Fecha:** 2026-11-12  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Baseline auditado:** `main` · `9f3b4366aacc720f6712ab47ac828af94fc63cff`  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · Published · Wix Editor · Velo enabled  
**Método:** lectura de código en GitHub, historial de PRs, contexto live Wix y contraste con documentación oficial Wix. No se han ejecutado escrituras ni pruebas runtime.

## Conclusión ejecutiva

El informe recibido detecta algunos defectos reales, pero no es una lista segura de cambios directos. De los veinte puntos:

- **2 correcciones de código aplicadas y fusionadas en `main`:** BUG-10 y BUG-11 (PR #300, merge commit `c508c69dc9788c8b93b8fc4cbc0c89b2554e6fff`).
- **Bloqueos deliberados que deben mantenerse:** BUG-01, BUG-04 y BUG-06.
- **Incidentes o requisitos reales pendientes de evidencia/runtime/decisión:** BUG-02, BUG-03, BUG-05, BUG-07, BUG-08 y BUG-09.
- **Propuestas de corrección inseguras o prematuras:** BUG-12, BUG-13, BUG-15, BUG-17 y BUG-19.
- **Hallazgos falsos o no reproducidos en el HEAD auditado:** BUG-14 y BUG-16.
- **Estado de herramienta o PR, no bug de producto:** BUG-18 y BUG-20.

## Matriz de verificación

| ID | Estado | Evidencia/decisión |
|---|---|---|
| BUG-01 | Deliberado | `FISCAL_RUNTIME_POLICY` mantiene escrituras fiscales/contables deshabilitadas hasta certificación runtime. No activar por eliminar el error. |
| BUG-02 | Abierto, causa desconocida | Los handlers `BOOKING_CREATED` y `BOOKING_CONFIRMED` y `_syncNativeBookingToCitas` existen en main. La ausencia observada de proyección/marcador en una reserva sintética no determina si falló el despliegue, entrega de evento, normalización o persistencia. El handler ya registra `BOOKING_CONFIRMED_LEDGER_SYNC_FAILED` con razón y campos ausentes. Requiere logs runtime y SHA publicado en entorno aislado. |
| BUG-03 | Bloqueo de seguridad sobre dato QA | `CajaActual` está en estado `SIMULACION` por dato sintético documentado. No sustituirlo por `CERRADA` ni limpiar saldo sin inventario, conciliación, autorización y evidencia de reset. |
| BUG-04 | Deliberado | Writers de jornada cerrados hasta completar idempotencia, serialización por empleado/día y transiciones concurrentes. Que este writer esté cerrado no demuestra por sí solo incumplimiento legal si existiera otro sistema válido de registro. |
| BUG-05 | Defecto de configuración confirmado; valor sustituto pendiente | `internalConfig.js` contiene `noreply@marianmadrid.com`. No se ha acreditado que `noreply@marianmadrid.es` esté verificado en Resend. Verificar dominio, identidad remitente y DNS en Resend antes de cambiarlo. |
| BUG-06 | Deliberado | Envío a gestoría deshabilitado hasta certificar persistencia e idempotencia de despacho. |
| BUG-07 | Gap funcional parcial confirmado | CajaActual solo proyecta EFECTIVO + PRESENCIAL. BUS-009 define los flujos físicos; TEC-026 mantiene pendiente el clasificador backend IN/OUT/NONE. PR #284 es parcial y permanece sin integrar según documentación del repositorio. No añadir tipos sin contrato, esquema, validación y pruebas. |
| BUG-08 | Requisito declarado, sync pendiente | TEC-027 registra ServiciosCatalogo como SSOT declarada por el propietario, pero el puente a Bookings no está verificado. No invertir autoridad ni implementar escritura sin auditar endpoints, triggers, reconciliación e idempotencia. |
| BUG-09 | Riesgo operativo confirmado | PR #296 documenta nueve automatizaciones email activas con diez acciones. El backend Resend no las gobierna. No ejecutar E2E de reservas en Published mientras no exista aislamiento probado. |
| BUG-10 | Confirmado y corregido en rama | `bookingCore.js` leía `CHECKOUT_MS` inexistente y caía a 20.000 ms local. Se añade `SDK_CONFIG.TIMEOUTS.CHECKOUT_MS = 20000`, se retira el fallback y se añade regresión. |
| BUG-11 | Export zombie confirmado y corregido en rama | El único uso funcional aplica `CORRECTION_REASON.OTRAS`; el uso de `NUMERO_SERIE` era comentario histórico. Se elimina la clave no consumida y se añade test negativo. |
| BUG-12 | Falso como corrección propuesta; rechazo fiscal intencional | El resolver valida `Order.taxInfo` y `lineItems[].taxInfo`, tasas, bases y cuotas. Derivar IVA desde ServiciosCatalogo cuando faltan datos de línea podría fabricar el desglose fiscal, especialmente en depósitos/anticipos. Mantener revisión manual hasta disponer de payload real y regla fiscal aprobada. |
| BUG-13 | Compatibilidad histórica, no bug demostrado | Cierre Z consulta fecha canónica y alias histórico, deduplica por `_id` y ordena por `sequenceNumber`. No retirar alias ni migrar ledger sin inventario histórico verificable. |
| BUG-14 | No reproducido | El código actual de `getMovimientoByBooking` usa `hasSome` para array y `eq` exacto como compatibilidad histórica; no existe la tercera query `.contains()` descrita. |
| BUG-15 | Propuesta peligrosa | `LEDGER_IDEMPOTENCY` tiene writer activo y es claim durable; se excluye deliberadamente de la purga de 24 h. Añadirlo a purga de 90 días puede permitir duplicar operaciones económicas antiguas. |
| BUG-16 | No reproducido; DAL alineado con Wix | `dataAccess.js` convierte `consistencyMode: "strong"` a `consistentRead: true`. Wix documenta `consistentRead` para lecturas desde la base primaria. |
| BUG-17 | No es bug | `_buildInternalFiscalChainPayload` utiliza `previousRecordHash` como huella anterior en la cadena interna; no debe reemplazarse por el hash actual. |
| BUG-18 | Estado de PR | PR #296 permanece Draft, pendiente de revisión. PR #299 ya está fusionada en main. No fusionar #296 sin revisión y CI actual. |
| BUG-19 | Limpieza defensiva legacy | No hay writer activo para nuevos snapshots DUAL_CACHE, pero existe un cron que limpia registros expirados. No se ha probado que CMS live tenga cero filas; mantener hasta consulta read-only y análisis histórico. |
| BUG-20 | Requisito oficial correcto; máquina local pendiente | Wix anunció el 22-10-2026 Node.js 24.22.1+ para Wix CLI. El workflow del repositorio ya usa 24.22.1 y README lo declara. No se comprobó la versión instalada en el equipo local. |

## Correcciones de código aplicadas en PR #300 y fusionadas en `main`

1. `src/backend/internalConfig.js`
   - Añadido `SDK_CONFIG.TIMEOUTS.CHECKOUT_MS: 20000`.
   - Retirado `CORRECTION_REASON.NUMERO_SERIE`, sin consumidor funcional.
2. `src/backend/booking/bookingCore.js`
   - `createBookingCartCheckout()` consume directamente `SDK_CONFIG.TIMEOUTS.CHECKOUT_MS`; eliminado fallback duplicado.
3. `src/backend/tests/unit.ssot.v5011.test.mjs`
   - Regresión del timeout canónico y de ausencia del enum retirado.
4. `docs/DECISION-LOG.md` y `README.md`
   - Registrada la reconciliación y su índice.

## Riesgos que permanecen bloqueados

- No activar escritores fiscales/contables ni de jornada.
- No resetear `CajaActual` ni alterar ledgers.
- No reconstruir base/cuota fiscal cuando falte información fiscal autoritativa.
- No retirar compatibilidad histórica sin inventario de datos.
- No probar reservas en Published mientras las automatizaciones nativas puedan comunicar a clientes.
- No activar el envío Resend/gestoría sin verificar remitente y despacho idempotente.

## Validación y despliegue

- Los cambios de esta rama son código y documentación; no se han escrito datos Wix/CMS ni modificado configuración del sitio.
- PR #300 se fusionó en `main` mediante `c508c69dc9788c8b93b8fc4cbc0c89b2554e6fff`.
- CI sobre el HEAD de PR `a8f04705872a120f31fb9dc25c984a7148830eb5`: `Backend offline quality gates` (run `43123426512`) y `Secret scanning` (run `43123426492`) finalizaron con `success`. La suite offline completa, contratos SDK Wix, ESLint y escaneo Gitleaks finalizaron correctamente.
- Los workflows están asociados al HEAD validado de la PR; no se encontraron runs asociados directamente al merge commit. No se infiere una segunda ejecución post-merge.
- No se ha ejecutado Wix Runtime, Preview, E2E ni publicación. La fusión GitHub no implica despliegue Wix.

## Fuentes oficiales

- Wix Data — consistencia eventual y `consistentRead`: https://dev.wix.com/docs/studio-two/code-your-site/work-with-data/data-api/about-the-data-api
- Wix CLI — Node.js 24.22.1+ (changelog 22-10-2026): https://dev.wix.com/docs/changelog/
