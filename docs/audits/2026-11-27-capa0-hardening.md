# Auditoría y endurecimiento de Capa 0 — 2026-11-27

## Alcance

Inspección estática de los módulos transversales y sus consumidores inmediatos en `main`: configuración, validación, acceso a datos, seguridad, secretos, logging, utilidades TPV, identidad de staff, writers fiscales y pruebas asociadas.

No se ejecutó Wix Local Editor, Wix Runtime ni producción. No se modificaron colecciones CMS, registros, secretos ni configuración del sitio. La auditoría no certifica el estado Runtime.

## Hallazgos corregidos

| ID | Módulo | Defecto | Corrección | Evidencia |
|---|---|---|---|---|
| C0-01 | `tpv/tpvUtils.js` | `stableSerialize()` podía serializar `[undefined]` como `[]`; admitía valores no JSON y estructuras cíclicas. | Rechazo explícito de valores ambiguos/no representables, fechas inválidas, arrays dispersos, ciclos, getters y objetos no planos. | PR #662; test `tpv.utils.serialization.test.mjs`; CI PASS. |
| C0-02 | `cajas.web.js` | El guard del cierre fiscal convertía cualquier error de lectura de `HistoricoCierresZ` en ausencia de cierre. | Retirada del catch redundante; DAL devuelve null solo ante WDE0073 y propaga otros fallos. | PR #663; test `operational-writers.fail-closed.contract.test.mjs`; CI PASS. |
| C0-03 | `internalConfig.js` y consumidores | Timeouts, cachés, TTL, versiones y paginación fiscal se definían mediante fallbacks locales; un límite genérico mezclaba capacidades distintas. | Valores centralizados en `SDK_CONFIG`; límites diferenciados STAFF/SERVICES; consumidores leen constantes obligatorias. | PR #664; test `sdk-config.consumers.contract.test.mjs`; CI PASS. |
| C0-04 | `securityEngine.js` | SHA-256/HMAC devolvían `ZERO_HASH` para entradas vacías, aparentando un digest calculado. | Errores estables `HASH_INPUT_REQUIRED`, `HMAC_KEY_REQUIRED`, `HMAC_PAYLOAD_REQUIRED`. Genesis hash permanece explícito en `hashChain`. | PR #665; tests `security.rateLimiter.test.mjs`; vectores criptográficos y CI PASS. |
| C0-05 | `internalConfig.js`, `validation.js` | La normalización convertía `bookingType` ausente en `SIMPLE`, ocultando datos obligatorios ausentes. | La normalización conserva vacío; nuevas inserciones CitasF2 exigen tipo explícito. Las actualizaciones de registros históricos incompletos siguen permitidas para no bloquear cambios de estado legítimos. | PR #666; test `booking-type.normalization.test.mjs`; CI PASS. |
| C0-06 | `eventLog.js` | `registrarEventoEconomico()` deduplicaba solo si existía `transactionId`, generaba `TX_<sequence>` y permitía recuperar por `traceId`. | Exigencia de `transactionId` (1–128 caracteres) antes de cualquier resolución o persistencia; dedupe y recuperación solo por esa identidad. | PR #667; test `eventLog.transaction-id.required.test.mjs`; CI PASS. |

## Resultado cuantitativo

Última validación offline de PR #667:

- Layer 1: 29 suites, 384 tests, 0 fallos.
- Layer 2: 16 suites, 250 tests, 0 fallos.
- Suite completa: 84 suites, 783 tests, 0 fallos.
- Wix eCommerce Cart SDK: PASS.
- Wix eCommerce Transactions SDK: PASS.
- Wix TPV SDK: PASS.
- ESLint: PASS.
- Secret scanning: PASS.
- npm audit: paso completado correctamente.

Los resultados corresponden al HEAD de PR validado antes del merge. No son pruebas Runtime.

## Revisión de compatibilidad

- Los valores de configuración centralizados conservan los valores efectivos previos; no se modificó el comportamiento temporal ni la capacidad de caché.
- Los registros CitasF2 históricos sin `bookingType` pueden seguir recibiendo actualizaciones que no introduzcan un tipo falso. Las nuevas inserciones deben incluirlo.
- El writer fiscal general ya no genera identidades sustitutas. Los call sites activos revisados en `events.js` y `crons.js` entregan identidad transaccional; los fallos de consumidores no cubiertos se rechazan antes de persistir.
- No se recalcularon hashes, fingerprints ni ledgers históricos.

## Pendiente — no declarar Capa 0 completada

1. **Secretos:** `secretAccess.js` convierte errores de proveedor en string vacío. Los consumidores revisados fallan cerrados, pero debe diferenciarse secreto ausente de proveedor no disponible y preservarse la causa técnica segura.
2. **Identidad Staff:** `staff.js` convierte algunos fallos de consulta en `null`/`[]`. La autorización falla cerrada; falta propagar un error operativo distinguible de NOT_FOUND.
3. **Logging:** ampliar cobertura de redacción para nombres compuestos, secretos y mensajes brutos de proveedores; mantener trazabilidad sin registrar credenciales ni datos personales.
4. **DAL:** mapear consumidores de argumentos vacíos en `getItem()` y respuestas inesperadas de `queryReferencedItems()` antes de cambiar contratos de ausencia.
5. **Dinero:** revisar consumidores de `mmUtils._roundMoney()` que pueden convertir entradas inválidas en cero; no cambiar hasta conocer impacto en cálculos.
6. **Configuración TPV:** revisar la duplicidad semántica `TPV_RUNTIME_POLICY.CURRENCY` / `CURRENCY_CODE` y consumidores.
7. **Idempotencia global:** extender la matriz de consumidores a todos los writers operativos, no solo los dos writers fiscales revisados.
8. **Runtime:** ejecutar pruebas en Wix Local Editor y Runtime con aislamiento de fixtures y sin cobros reales.

## Criterio de cierre

Capa 0 solo podrá declararse COMPLETADA cuando los pendientes anteriores se resuelvan o se documenten como no aplicables con evidencia, las suites offline pasen en el HEAD final y se ejecute el conjunto de pruebas Runtime pertinente. No confundir código integrado, CI PASS y Runtime verificado.
