# Estado actual — 2026-11-28

**MVP operativo/comercial: NO-GO.** El sitio continúa en Draft/no publicado según el último read-back documentado. La Capa 0 ha mejorado de forma sustancial y tiene CI offline PASS en el HEAD actual, pero Wix Local Editor, Runtime E2E y producción no están acreditados. No se publica ni se ejecutan cobros reales.

## Git y CI

- Repositorio: \`nachoortegazgz/marianmadridz\`, rama \`main\`.
- HEAD actual: \`944eb225b63260353cf283c87b0c0b6f07af6caf\`.
- PR #662–#667: endurecimiento de serialización, errores CMS, configuración, criptografía, bookingType y transactionId; integradas.
- PR #668: evidencia documental inicial de Capa 0; integrada.
- PR #670: validación DAL, GUID de jornada, errores públicos, redacción de logs y paridad de enums; integrada mediante squash \`5a1c84e34c2112de1a3f4874ca0eb070bbf4845b\`.
- PR #671: actualización documental tras PR #670; integrada.
- PR #661: estrategia de pruebas Wix Classic; actualiza \`tests/runtime/RUNTIME-TEST-PLAN.md\`.
- PR #675: propagación de fallos de proveedores, identidad Staff/Members y endurecimiento DAL; integrada mediante squash \`910ad3faa6e543c23e81b2902726d4d8cd43087f\`.
- PR #678: secretos, importes y configuración TPV canónica; integrada mediante squash \`a7a5d992a8a71aac93c851a43cbe1387401c77d7\`.
- PR #679: clonación circular, redacción adicional de logs, ordenación y aliases de booking; integrada mediante squash \`d44501c3c224ac417b283f687718ec9eb7538606\`. La primera ejecución completa sobre ese merge detectó 3 fallos de regresión; no se considera validada por sí sola.
- PR #681: corrección de esos 3 fallos; integrada mediante squash \`944eb225b63260353cf283c87b0c0b6f07af6caf\`.

### CI verificado para PR #670

- Layer 1: 29 suites / 384 tests; 0 fallos.
- Layer 2: 16 suites / 250 tests; 0 fallos.
- Suite offline completa: 88 suites / 794 tests; 0 fallos.
- Wix eCommerce Cart, Transactions y TPV SDK: PASS.
- ESLint, Gitleaks y npm audit: PASS.
- Backend quality gates run \`46081642075\`, job \`140781735934\`; secret scanning run \`46081642097\`.

### CI verificado para PR #675

- Layer 1: 29 suites / 390 tests PASS.
- Layer 2: 16 suites / 250 tests PASS.
- Suite offline completa: 89 suites / 804 tests PASS.
- Wix eCommerce Cart, Transactions y TPV SDK: PASS.
- ESLint, npm audit y Gitleaks: PASS.
- Backend quality gates run \`46083433335\`; secret scanning run \`46083433301\`.

### CI verificado para PR #678

- Layer 1: 29 suites / 391 tests PASS.
- Layer 2: 16 suites / 250 tests PASS.
- Suite offline completa: 91 suites / 812 tests PASS.
- Wix eCommerce Cart, Transactions y TPV SDK: PASS.
- ESLint, npm audit y Gitleaks: PASS.
- Backend quality gates run \`46084663961\`; secret scanning run \`46084663950\`.

### Incidencia PR #679 y corrección PR #681

- En el merge HEAD \`d44501c3\`, Layer 1 29/391 y Layer 2 16/250 pasaron, pero la suite completa terminó con 91 suites / 813 PASS / 3 FAIL.
- Fallos: fixture de reserva dual sin pairToken; tests de ordenación que pasaban strings donde el contrato exige arrays; redacción de rutas que no cubría el segmento \`/token/\`.
- La corrección se integró en PR #681. No se considera que el HEAD intermedio d44501c esté validado.
- HEAD de PR #681: \`efa4586a14f473ce7945c42246c0d4cadfd5221b\`.
- Layer 1: 29 suites / 391 tests PASS.
- Layer 2: 16 suites / 250 tests PASS.
- Suite offline completa: 91 suites / 816 tests PASS.
- Wix eCommerce Cart, Transactions y TPV SDK: PASS.
- ESLint, npm audit y Gitleaks: PASS.
- Backend quality gates run \`46085729210\`; secret scanning run \`46085729219\`.

Estas evidencias corresponden a los HEAD de las PR indicadas. No demuestran Wix Preview, Wix Runtime ni producción. El resultado correcto de Capa 0 se mide sobre el HEAD actual \`944eb225\`, no sobre ejecuciones históricas aisladas.

## Capa 0 — corregido e integrado

- Fingerprints TPV: serialización estricta; rechaza valores no JSON, ciclos, arrays dispersos, fechas inválidas, getters y objetos no planos.
- Writers fiscales: errores de lectura CMS distintos de ausencia real.
- Configuración: timeouts, cachés, TTL y límites compartidos centralizados en \`SDK_CONFIG\`.
- Criptografía: SHA-256/HMAC rechazan entradas vacías.
- Bookings dual: ausencia de \`bookingType\` preservada; nuevas inserciones CitasF2 lo exigen.
- \`registrarEventoEconomico()\` exige \`transactionId\` para dedupe y recuperación; sin fallbacks por secuencia ni recuperación por \`traceId\`.
- DAL: offsets inválidos rechazados, operadores explícitos \`hasSome\`/\`hasAll\`; \`getItem()\` exige colección e ID string no vacíos y solo interpreta WDE0073 como ausencia.
- Eliminada \`queryReferencedItems()\` tras comprobar que no tenía consumidores activos.
- Bookings Staff, CRM y Members: fallos de proveedor y respuestas inválidas se propagan con códigos técnicos estables; no se convierten en NOT_FOUND, NOT_STAFF, false, null o listas vacías.
- Staff paging: no devuelve resultados parciales si se alcanza el límite defensivo con cursor pendiente.
- Identidad: \`security.js\` centraliza el contexto Staff; \`horario.web.js\` delega en él; \`citasManager.web.js\` preserva errores y valida primero propiedad por \`memberId\`.
- Jornada laboral: \`resourceId\` y \`memberId\` validados como GUID.
- Secretos Wix: nombre inválido, respuesta inválida, valor vacío y error del proveedor tienen códigos distintos; no se devuelve cadena vacía ante error. El NIF emisor no se cachea vacío y la verificación de fichajes no degrada la ausencia de clave a firmas simplemente no verificadas.
- Dinero: \`_roundMoney()\` rechaza valores inválidos; el writer de reservas no convierte un total malformado a cero.
- Configuración TPV: eliminadas las copias \`CURRENCY\`, \`CURRENCY_CODE\` y \`TIME_ZONE\` de \`TPV_RUNTIME_POLICY\`; se usa \`SDK_CONFIG.CURRENCY_CODE\` y \`SDK_CONFIG.TZ\`.
- Errores públicos: objetos arbitrarios no se convierten en \`[object Object]\`; metadata circular se convierte en marcador JSON-safe.
- Logging: redacción de secretos en claves, valores string, tokens, API keys, claves privadas, HMAC, firmas, cookies, cabeceras, query strings, rutas URL y credenciales; PII y stacks saneados.
- Ordenación DAL: builders producen \`order: ASC|DESC\`; entradas inválidas ya no se convierten silenciosamente en ASC.
- Booking aliases: aliases históricos siguen siendo legibles/normalizables, pero el validador de nuevas inserciones exige el valor canónico.

## Pendiente — Capa 0 sigue EN EJECUCIÓN

1. **Cobertura de Staff — P1:** Query Staff Members v1 solo devuelve service providers. Verificar que todos los \`resourceId\` usados por los roles del sitio corresponden a service providers. No asumir cobertura universal; evaluar v2 solo con contrato oficial y decisión explícita.
2. **Dinero — P1:** \`_readPositiveAmount\` y normalizadores numéricos locales de caja/fiscalidad aún convierten ciertos datos inválidos en cero. Clasificar consumidores por dominio (presentación, duración, importe, IVA, saldo) y añadir pruebas antes de cambiar contratos compartidos.
3. **Idempotencia — P1:** completar matriz de writers económicos/operativos: identidad primaria, \`transactionId\`, clave propia, append-only, timeout/insert incierto y call sites. No imponer regla ciega a eventos no económicos.
4. **Dead code/dependencias — P2:** continuar auditoría por consumidores/imports/exports/tests. PR #675 retiró \`queryReferencedItems()\` al demostrar cero consumidores; aplicar el mismo estándar al resto. No eliminar por tamaño o sospecha.
5. **Contrato TPV \`sourceType\` — P1:** existe una divergencia entre la directriz de no persistir un campo genérico \`sourceType\` y el contrato CMS/documentación vigente de \`TransaccionesTPV\`, que lo declara requerido. La implementación actual también lo consume. No retirarlo parcialmente: reconciliar primero esquema CMS, writers, readers, validadores y compatibilidad histórica, con rollback documentado.
6. **Remitente de correo — P1/P2:** \`FROM_ADDRESS\` usa \`marianmadrid.com\` mientras el dominio operativo es \`.es\`; la verificación de Resend no está acreditada. El envío de gestoría continúa deshabilitado. No cambiar el remitente sin evidencia de dominio verificado.
7. **Runtime — P1:** ejecutar Local Editor/Preview E2E aislado, sin reutilizar \`CajaActual\` ABIERTA y sin cobros reales. Confirmar sincronización Wix-Git mediante evidencia del sitio.

**Estado Capa 0: EN EJECUCIÓN.** CI offline PASS en el HEAD actual, pero siguen pendientes cobertura completa de Staff, normalizadores numéricos, matriz global de writers, deuda restante, reconciliación de \`sourceType\`, remitente y validación Runtime. No declarar Capa 0 COMPLETADA.

## Wix/CMS — último read-back documentado

- Site ID \`188bed94-177c-4bc9-a9f0-35080d874f3e\`; Wix Editor clásico, Velo habilitado, Draft.
- Página TPV ID \`yl5th\`, ruta \`/tpv\`, \`published=false\` (read-back 27-11-2026).
- Recuentos de la auditoría integral posterior del 27-11-2026: \`CajaActual=1\` (ABIERTA), \`MovimientosCaja=5\`, \`HistoricoCierresZ=1\`, \`TransaccionesTPV=0\`, \`ControlOperativo=81\`, \`MapaStaff=5\`, \`CitasF2=12\`, \`LibroAsientosContablesDetalle=3\`, \`RegistrosHorariosStaff=0\`. La lectura read-only anterior de aceptación había observado \`ControlOperativo=78\` y \`CitasF2=11\`; se conserva como evidencia de ese instante, no como baseline posterior.
- Es una lectura histórica, no consulta live actual. No modificar esos registros ni utilizarlos como fixtures.

## Fuentes y auditorías

- [Auditoría Capa 0 PR #670](audits/2026-11-27-capa0-hardening.md).
- [Conciliación BUG-001…020](audits/2026-11-28-capa0-bug-reconciliation.md).
- [Propagación de errores Staff/Members/DAL — PR #675](audits/2026-11-28-capa0-provider-error-propagation.md).
- [Secretos, importes y configuración — PR #678](audits/2026-11-28-capa0-secrets-money-config.md).
- [Estrategia Wix Runtime](../tests/runtime/RUNTIME-TEST-PLAN.md).
- Get Secret Value: https://dev.wix.com/docs/api-reference/business-management/secrets/get-secret-value
- Query Staff Members v1: https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members
- Wix Data Query / Paging: https://dev.wix.com/docs/velo/apis/wix-data/query

**CI PASS ≠ Runtime PASS ≠ Producción verificada.** Mantener NO-GO hasta obtener evidencia del entorno correspondiente.
