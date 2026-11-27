# Auditoría Capa 0 — conciliación y endurecimiento — 2026-11-28

## Estado y alcance

Estado de Capa 0: **EN EJECUCIÓN**. Esta auditoría registra las correcciones integradas en PR #662–#667 y #670, junto con deuda pendiente. La PR #670 está integrada en `main` mediante squash commit `5a1c84e34c2112de1a3f4874ca0eb070bbf4845b`.

Se revisó código, consumidores y pruebas disponibles en GitHub. No se ejecutó Wix Local Editor, Wix Runtime, Preview E2E ni producción. No se modificaron CMS, datos, secretos, pagos ni configuración del sitio.

## Hallazgos corregidos

| ID | Área | Corrección | Evidencia |
|---|---|---|---|
| C0-01 | Fingerprints TPV | Serialización canónica estricta; rechaza estructuras no representables, ciclos, arrays dispersos, fechas inválidas, getters y objetos no planos. | PR #662; `tpv.utils.serialization.test.mjs`. |
| C0-02 | Cierre fiscal / DAL | Errores de Wix Data ya no se interpretan como cierre inexistente; ausencia solo para el código de item inexistente reconocido. | PR #663; `operational-writers.fail-closed.contract.test.mjs`. |
| C0-03 | Configuración | Timeouts, cachés, TTL y paginación fiscal centralizados en `SDK_CONFIG`, con límites STAFF/SERVICES diferenciados. | PR #664; `sdk-config.consumers.contract.test.mjs`. |
| C0-04 | Criptografía | SHA-256/HMAC rechazan entrada vacía; genesis hash explícito conservado. | PR #665; `security.rateLimiter.test.mjs`. |
| C0-05 | Booking type | No se inventa SIMPLE cuando falta `bookingType`; nuevas inserciones lo exigen y se conserva compatibilidad acotada de actualizaciones legacy. | PR #666; `booking-type.normalization.test.mjs`. |
| C0-06 | Identidad económica | `registrarEventoEconomico()` exige `transactionId` y lo usa para dedupe/recuperación; sin IDs sustitutos por secuencia/traceId. | PR #667; `eventLog.transaction-id.required.test.mjs`. |
| C0-07 | DAL paging y operadores | Límites/offsets inválidos rechazados; offset 0 permitido; eliminada heurística `contains`; `hasSome`/`hasAll` explícitos. | PR #670; `dataAccess.query-validation.test.mjs`. |
| C0-08 | Identidad laboral | `resourceId` y `memberId` deben ser GUID válidos en RegistrosHorariosStaff. | PR #670; `validation.shared.helpers.test.mjs`. |
| C0-09 | Errores públicos | Mensajes de objetos no string no producen `[object Object]`; fallback genérico seguro. | PR #670; `responseUtils.contract.test.mjs`. |
| C0-10 | Logging | Redacción recursiva de secretos, tokens, credenciales URL, emails, PII y stacks; pruebas de fuga añadidas. | PR #670; `logger.sanitize.contract.test.mjs`. |
| C0-11 | Paridad frontend/backend | Eliminado `PAYMENT_METHOD.OTRO` del espejo público; paridad con enum backend probada. | PR #670; `config.public-parity.contract.test.mjs`. |

## CI — evidencia del HEAD de PR #670

- Layer 1: 29 suites / 384 tests; 0 fallos.
- Layer 2: 16 suites / 250 tests; 0 fallos.
- Suite completa: 88 suites / 794 tests; 0 fallos.
- Wix eCommerce Cart SDK: PASS.
- Wix eCommerce Transactions SDK: PASS.
- Wix TPV SDK: PASS.
- ESLint: PASS.
- Gitleaks full-history scan: PASS.
- npm audit: paso completado correctamente.
- Workflow backend quality gates: run `46081642075`, job `140781735934`, conclusión success.
- Secret scanning: run `46081642097`, conclusión success.

No se atribuye a estos resultados capacidad de probar Wix Runtime o datos reales.

## Conciliación de bugs

El inventario BUG-001 a BUG-020 queda registrado en `2026-11-28-capa0-bug-reconciliation.md`. Hallazgos descartados o ya corregidos no deben reabrirse sin evidencia nueva. Se preservan aliases históricos y contratos existentes cuando no hay prueba de que estén muertos.

## Deuda pendiente y plan técnico

1. **Secretos:** `secretAccess.js` convierte cualquier fallo del proveedor en `""`. La documentación Velo `getSecretValue()` indica elevación y uso backend, pero no define errores personalizados. No se puede asumir qué código distingue ausencia de indisponibilidad. Inspeccionar todos los consumidores (`securityEngine.js`, `events.js`, `horario.web.js`, `cajas.web.js`) y diseñar propagación de error técnico seguro con fail-closed; no exponer el secreto ni mensajes brutos.
2. **Staff:** `_fetchStaffByResourceId` captura errores y retorna null; `_fetchAllStaff` retorna []; `getSiteMemberIdByContactId` retorna cadena vacía. Revisar contratos de consumidores en `security.web.js`, `security.js`, `horario.web.js`, `cajas.web.js`, `reservas.web.js`, `citasManager.web.js`. Separar NOT_FOUND de indisponibilidad sin debilitar autorización. La API documenta cursor paging con `staffMembers` y `pagingMetadata.cursors.next`.
3. **DAL ausencia/contrato:** `getItem()` retorna null ante colección/ID vacío. `queryReferencedItems()` retorna [] para respuesta no reconocida. Inventariar consumidores y SDK response contract antes de cambiar.
4. **Dinero:** `toFiniteNumber` acepta fallback, `_roundMoney` retorna 0 ante número inválido y `_readPositiveAmount` usa 0 como ausencia. Consumidores localizados en `accountingLedger.js`, `fiscalAggregator.web.js`, `cajas.web.js`, `booking/bookingCore.js` y `src/public/mmUtils.js`. Es cambio de riesgo alto; requiere clasificar cada uso (presentación, duración, importe, IVA, saldo) y pruebas por dominio antes de cambiar el contrato compartido.
5. **Configuración TPV:** duplicidad semántica entre `TPV_RUNTIME_POLICY.CURRENCY` y `CURRENCY_CODE`; inspeccionar consumidores y mantener una sola clave canónica cuando no rompa interfaces.
6. **Idempotencia:** completar matriz de writers económicos y operativos: identidad primaria, transactionId requerido, idempotency key, append-only, comportamiento ante timeout/inserción incierta y call sites.
7. **Dead code/dependencias:** revisar imports/exports, consumidores, tests y dependencias con evidencia; no borrar por tamaño, antigüedad o sospecha.
8. **Runtime:** ejecutar Local Editor/Preview E2E aislado, sin CajaActual ABIERTA preexistente y sin movimientos económicos reales. Confirmar sincronización Wix-Git con read-back de sitio.

## Referencias oficiales contrastadas

- Velo Secrets API v2 — Get Secret Value: https://dev.wix.com/docs/velo/apis/wix-secrets-backend-v2/secrets/get-secret-value
- Bookings — Query Staff Members: https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members
- Bookings — Query Staff Members V2 (Developer Preview; no adoptar sin decisión explícita): https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members-v-2
- Velo Wix Data Query: https://dev.wix.com/docs/velo/apis/wix-data/query
- Velo Wix Data Get: https://dev.wix.com/docs/velo/apis/wix-data/get

## Criterio de cierre

Capa 0 solo podrá declararse COMPLETADA cuando:
- Los contratos anteriores estén resueltos con cambios mínimos o justificados como no aplicables.
- Todos los consumidores afectados estén inventariados y cubiertos por pruebas.
- La suite offline pase en el HEAD final.
- Los flujos pertinentes se ejecuten en Wix Local Editor/Runtime con evidencia verificable.
- No queden errores silenciosos que puedan confundirse con ausencia legítima.
- El sitio continúe Draft/NO-GO hasta autorización independiente de publicación.

**No certificar como completada solo por CI verde.**
