# Estado actual — 2026-11-28

**MVP operativo/comercial: NO-GO.** El sitio continúa en Draft/no publicado según el último read-back documentado. CI offline de Capa 0 está PASS para PR #670 y PR #675 en sus respectivos HEAD validados. Wix Local Editor, Wix Runtime E2E y producción no están acreditados. No se publica ni se ejecutan cobros reales.

## Git y CI

- Repositorio: `nachoortegazgz/marianmadridz`, rama `main`.
- HEAD de `main` al actualizar este estado: `910ad3faa6e543c23e81b2902726d4d8cd43087f`.
- PR #662–#667: endurecimiento de serialización, errores CMS, configuración, criptografía, bookingType y transactionId; integradas.
- PR #668: evidencia documental inicial de Capa 0; integrada.
- PR #670: validación DAL, GUID de jornada, errores públicos, redacción de logs y paridad de enums; integrada mediante squash `5a1c84e34c2112de1a3f4874ca0eb070bbf4845b`.
- PR #671: actualización documental tras PR #670; integrada.
- PR #661: estrategia de pruebas Wix Classic; actualiza `tests/runtime/RUNTIME-TEST-PLAN.md`.
- PR #675: propagación de fallos de proveedores, identidad Staff/Members y endurecimiento DAL; integrada mediante squash `910ad3faa6e543c23e81b2902726d4d8cd43087f`.

### CI verificado para PR #670

- Layer 1: 29 suites / 384 tests; 0 fallos.
- Layer 2: 16 suites / 250 tests; 0 fallos.
- Suite offline completa: 88 suites / 794 tests; 0 fallos.
- Wix eCommerce Cart, Transactions y TPV SDK: PASS.
- ESLint, Gitleaks y npm audit: PASS.
- Workflow backend quality gates run `46081642075`, job `140781735934`; secret scanning run `46081642097`.

### CI verificado para PR #675

- HEAD validado indicado en la PR: `7073d3de`; merge squash en main: `910ad3faa6e543c23e81b2902726d4d8cd43087f`.
- Layer 1: 29 suites / 390 tests PASS.
- Layer 2: 16 suites / 250 tests PASS.
- Suite offline completa: 89 suites / 804 tests PASS.
- Wix eCommerce Cart, Transactions y TPV SDK: PASS.
- ESLint, npm audit y Gitleaks: PASS.
- Backend quality gates run `46083433335`; secret scanning run `46083433301`.

Estas evidencias corresponden a los HEAD de las PR indicadas. No demuestran Wix Preview, Wix Runtime ni producción.

## Capa 0 — corregido e integrado

- Fingerprints TPV: serialización estricta; rechaza valores no JSON, ciclos, arrays dispersos, fechas inválidas, getters y objetos no planos.
- Writers fiscales: errores de lectura CMS distintos de ausencia real.
- Configuración: timeouts, cachés, TTL y límites compartidos centralizados en `SDK_CONFIG`.
- Criptografía: SHA-256/HMAC rechazan entradas vacías.
- Bookings dual: ausencia de `bookingType` preservada; nuevas inserciones CitasF2 lo exigen.
- `registrarEventoEconomico()` exige `transactionId` (1–128 caracteres) para dedupe y recuperación; sin fallbacks por secuencia ni recuperación por `traceId`.
- DAL: paging/offsets inválidos rechazados, operadores explícitos `hasSome`/`hasAll`; `getItem()` exige colección e ID string no vacíos y solo interpreta WDE0073 como ausencia.
- Eliminada `queryReferencedItems()` tras comprobar que no tenía consumidores activos.
- Bookings Staff, CRM y Members: fallos de proveedor y respuestas inválidas se propagan con códigos técnicos estables; no se convierten en NOT_FOUND, NOT_STAFF, false, null o listas vacías.
- Staff paging: no devuelve resultados parciales si se alcanza el límite defensivo con cursor pendiente.
- Identidad: `security.js` centraliza el contexto Staff; `horario.web.js` delega en él; `citasManager.web.js` preserva errores y valida primero propiedad por `memberId`.
- Jornada laboral: `resourceId` y `memberId` validados como GUID.
- Errores públicos: objetos arbitrarios no se convierten en `[object Object]`.
- Logging: redacción recursiva de secretos, tokens, credenciales URL, emails, PII y stacks.
- Contrato frontend/backend: retirado `PAYMENT_METHOD.OTRO` del espejo público por no formar parte del enum backend ni tener consumidores activos localizados.

## Pendiente — Capa 0 sigue EN EJECUCIÓN

1. **Secretos — P1:** `secretAccess.js` aún convierte fallos/ausencia de secreto en cadena vacía. La documentación oficial Velo no define errores personalizados suficientes para distinguir de forma contractual NOT_FOUND de indisponibilidad. Preservar el fallo de proveedor con código técnico seguro; revisar consumidores y `events.js::_getEmisorFiscal`, que aún puede convertir error de secreto en NIF vacío. No inventar códigos ni exponer mensajes brutos.
2. **Cobertura de Staff — P1:** Query Staff Members v1 solo devuelve service providers. Verificar que todos los `resourceId` usados por los roles del sitio corresponden a service providers. No asumir cobertura universal; evaluar v2 solo con contrato oficial y decisión explícita.
3. **Dinero — P1:** `toFiniteNumber`, `_roundMoney` y helpers relacionados convierten ciertas entradas inválidas en fallback/0. Clasificar consumidores por dominio (presentación, duración, importe, IVA, saldo) y añadir pruebas antes de cambiar contratos compartidos.
4. **Configuración — P2:** `TPV_RUNTIME_POLICY.CURRENCY` y `CURRENCY_CODE` duplican semánticamente EUR. Inventariar consumidores antes de consolidar.
5. **Idempotencia — P1:** completar matriz de writers económicos/operativos: identidad primaria, `transactionId`, clave propia, append-only, timeout/insert incierto y call sites. No imponer regla ciega a eventos no económicos.
6. **Dead code/dependencias — P2:** continuar auditoría por consumidores/imports/exports/tests. PR #675 retiró `queryReferencedItems()` al demostrar cero consumidores; aplicar el mismo estándar al resto. No eliminar por tamaño o sospecha.
7. **Runtime — P1:** ejecutar Local Editor/Preview E2E aislado, sin reutilizar `CajaActual` ABIERTA y sin cobros reales. Confirmar sincronización Wix-Git mediante evidencia del sitio.

**Estado Capa 0: EN EJECUCIÓN.** PR #675 cierra defectos de propagación de errores en Staff/Members/DAL, pero permanecen secretos, cobertura de roles Staff, conversiones monetarias, configuración, matriz global de writers, deuda y validación Runtime. No declarar Capa 0 COMPLETADA.

## Wix/CMS — último read-back documentado

- Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`; Wix Editor clásico, Velo habilitado, Draft.
- Página TPV ID `yl5th`, ruta `/tpv`, `published=false` (read-back 27-11-2026).
- Recuentos de la auditoría integral posterior del 27-11-2026: `CajaActual=1` (ABIERTA), `MovimientosCaja=5`, `HistoricoCierresZ=1`, `TransaccionesTPV=0`, `ControlOperativo=81`, `MapaStaff=5`, `CitasF2=12`, `LibroAsientosContablesDetalle=3`, `RegistrosHorariosStaff=0`. La lectura read-only anterior de aceptación había observado `ControlOperativo=78` y `CitasF2=11`; se conserva como evidencia de ese instante, no como baseline posterior.
- Es una lectura histórica, no consulta live actual. No modificar esos registros ni utilizarlos como fixtures.

## Fuentes y auditorías

- [Auditoría Capa 0 PR #670](audits/2026-11-27-capa0-hardening.md).
- [Conciliación BUG-001…020](audits/2026-11-28-capa0-bug-reconciliation.md).
- [Propagación de errores Staff/Members/DAL — PR #675](audits/2026-11-28-capa0-provider-error-propagation.md).
- [Estrategia Wix Runtime](../tests/runtime/RUNTIME-TEST-PLAN.md).
- Velo Secrets API v2: https://dev.wix.com/docs/velo/apis/wix-secrets-backend-v2/secrets/get-secret-value
- Bookings Query Staff Members v1: https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members
- Wix Data Query / Paging: https://dev.wix.com/docs/velo/apis/wix-data/query

**CI PASS ≠ Runtime PASS ≠ Producción verificada.** Mantener NO-GO hasta obtener evidencia del entorno correspondiente.
