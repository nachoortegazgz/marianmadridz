# Estado actual — 2026-11-28

**MVP operativo/comercial: NO-GO.** El sitio continúa en Draft/no publicado. La validación offline de Capa 0 está verde en CI; Wix Local Editor, Wix Runtime E2E y producción no están acreditados. No se publica ni se ejecutan cobros reales.

## Git y CI

- Repositorio: `nachoortegazgz/marianmadridz`, rama `main`.
- HEAD de `main` tras integrar PR #671: `25b55d406b365ab8b82c70f1eb0803a5bf1f5628`.
- Después se integró PR #661 (`c444f7aff2ad615f8711ae51c085f78e8b8985ea`), que actualiza la estrategia de pruebas Wix Classic en `tests/runtime/RUNTIME-TEST-PLAN.md` y su auditoría asociada. No modifica la evidencia CI de PR #670.
- PR #662–#667: endurecimiento de serialización, errores de CMS, configuración, criptografía, bookingType y transactionId; integradas en main.
- PR #668: evidencia documental inicial de Capa 0; integrada.
- PR #670: validación DAL, GUID de jornada, normalización de errores públicos, redacción de logs y paridad de enums frontend/backend; integrada mediante squash en `5a1c84e34c2112de1a3f4874ca0eb070bbf4845b`.
- PR #669 quedó cerrada sin merge porque su rama estaba desactualizada; su trabajo fue recreado y validado en #670.

### CI verificado para PR #670

- Layer 1: 29 suites / 384 tests; 0 fallos.
- Layer 2: 16 suites / 250 tests; 0 fallos.
- Suite offline completa: 88 suites / 794 tests; 0 fallos.
- Wix eCommerce Cart SDK: PASS.
- Wix eCommerce Transactions SDK: PASS.
- Wix TPV SDK: PASS.
- ESLint: PASS.
- Gitleaks full-history scan: PASS.
- npm audit: paso completado correctamente.
- Workflow backend quality gates: run `46081642075`, job `140781735934`, PASS.
- Secret scanning: run `46081642097`, PASS.

Estas evidencias son CI offline del HEAD de PR #670. No demuestran ejecución dentro del Wix Runtime.

## Capa 0 — corregido e integrado

- Fingerprints TPV: serialización estricta; rechaza valores no JSON, ciclos, arrays dispersos, fechas inválidas, getters y objetos no planos.
- Writers fiscales: errores de lectura CMS distintos de ausencia real; el periodo no se considera abierto ante indisponibilidad.
- Configuración: timeouts, cachés, TTL y límites compartidos centralizados en `SDK_CONFIG`.
- Criptografía: SHA-256/HMAC no generan hashes ficticios ante entradas vacías.
- Bookings dual: ausencia de `bookingType` preservada; nuevas inserciones CitasF2 lo exigen y las actualizaciones legacy no inventan el dato.
- Writer de eventos económicos: `transactionId` obligatorio (1–128 caracteres), identidad única para dedupe y recuperación; sin sustitución por secuencia ni traceId.
- DAL: límites y offsets inválidos rechazados; offset 0 permitido; no se inventa un máximo 100 no declarado en el contrato usado. Retirados `contains` y la heurística implícita; pertenencia a arrays mediante `hasSome`/`hasAll` explícitos.
- Jornada laboral: `resourceId` y `memberId` validados como GUID.
- Errores públicos: objetos arbitrarios no se convierten en `[object Object]`.
- Logging: redacción recursiva de claves y strings, secretos, tokens, credenciales URL, emails, PII y stacks; pruebas de regresión añadidas.
- Contrato frontend/backend: retirado `PAYMENT_METHOD.OTRO` del espejo público al no formar parte del enum backend ni tener consumidores activos localizados.

## Pendiente — Capa 0 sigue EN EJECUCIÓN

1. **Secretos — P1:** `secretAccess.js` aún convierte errores del proveedor en cadena vacía. La documentación oficial Velo confirma `getSecretValue()`, permisos elevados y uso exclusivo backend, pero no declara errores personalizados para distinguir de forma contractual NOT_FOUND de indisponibilidad. No clasificar códigos de error por intuición. Próximo cambio: preservar el fallo de proveedor con código técnico seguro y revisar cada consumidor para mantener fail-closed; ausencia solo podrá tratarse como opcional donde el contrato lo permita.
2. **Staff — P1:** `staff.js` aún convierte fallos de consulta Bookings en `null`/ `[]`; autorización permanece fail-closed, pero los llamadores no distinguen ausencia de fallo del proveedor. La API documenta cursor paging y respuestas con `staffMembers`/ `pagingMetadata`; revisar consumidores y cambiar contratos con pruebas.
3. **DAL — P1/P2:** `getItem(collection,id)` devuelve null para colección/ID vacíos; inventariar consumidores antes de endurecer. `queryReferencedItems()` normaliza respuestas desconocidas como lista vacía; verificar contrato SDK exacto y consumidores.
4. **Dinero — P1:** `toFiniteNumber`, `_roundMoney` y helpers relacionados convierten ciertas entradas inválidas en fallback/0. Hay consumidores en contabilidad, fiscalidad, caja y reservas. No cambiar hasta definir contratos por dominio y añadir pruebas de regresión de importes.
5. **Configuración — P2:** `TPV_RUNTIME_POLICY.CURRENCY` y `CURRENCY_CODE` duplican semánticamente EUR. Revisar consumidores y consolidar solo si no hay dependencia contractual.
6. **Idempotencia global — P1:** completar inventario de todos los writers económicos/operativos y clasificar cuáles requieren `transactionId`, claves de idempotencia propias o no aplicabilidad justificada. No imponer una regla global ciega a eventos no económicos.
7. **Deuda/código muerto:** continuar inventario por consumidores/imports/exports y dependencias; PR #670 no elimina módulos ni aliases históricos por tamaño o sospecha.
8. **Runtime:** ejecutar Local Editor y pruebas E2E aisladas con fixture/sesión propia, sin reutilizar `CajaActual` ABIERTA y sin cobros reales. Confirmar despliegue/sincronización Wix-Git mediante evidencia del sitio.

**Estado Capa 0: EN EJECUCIÓN.** El endurecimiento estático principal y la CI están validados, pero los puntos anteriores impiden declarar Capa 0 COMPLETADA o “excelente” todavía.

## Wix/CMS — último read-back documentado

- Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`; Wix Editor clásico, Velo habilitado, Draft.
- Página TPV ID `yl5th`, ruta `/tpv`, `published=false` (read-back 27-11-2026).
- Recuentos observados entonces: `CajaActual=1` (ABIERTA), `MovimientosCaja=5`, `HistoricoCierresZ=1`, `TransaccionesTPV=0`, `ControlOperativo=78`, `MapaStaff=5`, `CitasF2=11`, `LibroAsientosContablesDetalle=3`, `RegistrosHorariosStaff=0`.
- Es una lectura histórica, no consulta live actual. No se modificaron colecciones ni registros en esta intervención.

## Fuentes oficiales y criterios

- Velo Secrets API v2: https://dev.wix.com/docs/velo/apis/wix-secrets-backend-v2/secrets/get-secret-value
- Bookings Query Staff Members: https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members
- Wix Data Query / Paging: https://dev.wix.com/docs/velo/apis/wix-data/query
- Wix Data `get()`: https://dev.wix.com/docs/velo/apis/wix-data/get
- Documentación de proyecto: `PROJECT-CANON.md`, `TPV-UNIFIED-FLOW.md`, `RELEASE-READINESS.md`, `ESQUEMA_CMS.md`.

**CI PASS ≠ Runtime PASS ≠ Producción verificada.** Mantener NO-GO hasta obtener evidencia del entorno correspondiente.
