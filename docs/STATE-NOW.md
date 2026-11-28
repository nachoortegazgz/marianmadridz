# Estado actual — 2026-11-28

## Directriz transversal aprobada por el propietario — 28-11-2026

**CERO BLOQUEOS SILENCIOSOS.** Directriz clave incorporada a [PROJECT-CANON](PROJECT-CANON.md). Todo bloqueo, rechazo o salida anticipada debe:
- normalizar el dato mediante función determinista si la representación es válida y equivalente;
- en caso contrario, generar error estable, detallado y accionable y log estructurado correlacionado;
- preservar el significado y no fabricar defaults ni convertir fallos en éxito, vacío o cero;
- marcar como PARTIAL/PENDING_RECOVERY cualquier paso secundario pendiente, con recuperación trazable;
- disponer de pruebas para cada condición de bloqueo/early return.



**Datos sensibles y pruebas:** utilizar placeholders realistas para datos sensibles. Excepción acotada autorizada por el propietario: Nacho Ortega es cliente de prueba; `nachoortegazgz@gmail.com` y `666724634` son contactos seguros para ese fixture. No ampliar esta excepción a otros datos ni registrar payloads completos; ver PROJECT-CANON.

Métrica exigida: 100 % de condiciones bloqueantes/early return observables con error y log correlacionados; 100 % de datos esperados aplicables contabilizados como persistidos, rechazados con causa o pendientes explícitos. Esta directriz no elimina validaciones justificadas ni autoriza datos ficticios.


**MVP operativo/comercial: NO-GO.** El sitio continúa en Draft/no publicado según el read-back Wix del 28-11-2026. CI offline de Capa 0 está PASS para PR #670, #675 y el hardening posterior de PR #679 en sus respectivos HEAD validados. Wix Local Editor, Wix Runtime E2E y producción no están acreditados. No se publica ni se ejecutan cobros reales.

## Auditoría de persistencia operativa — 28-11-2026

- Informe: [auditoría de persistencia operativa](audits/2026-11-28-operational-persistence-audit.md).
- Lectura real, solo lectura: 12 colecciones propias NATIVE; Bookings Reader V2 (360 reservas); eCommerce Orders (34 pedidos) y transacciones (8 pagos, 1 reembolso).
- Resultado: NO CONFORME para persistencia integral. 5/5 movimientos de caja sintéticos incompletos, cierre Z simulado incompleto, 3 recuperaciones pendientes, 7 pedidos pagados/reembolsados sin movimiento correlacionado, 6 proyecciones CitasF2 con estado nativo divergente, cero CONFIG_SISTEMA_FISCAL, TPV comercial sin intención persistida, jornada sin escrituras y 3 eventos externos NOT_SENT.
- Los datos previos a 2027 son sintéticos por directriz del proyecto; no se infieren pérdidas económicas reales.
- No se ejecutaron mutaciones ni pruebas de escritura. El sitio figura Draft; código instalado en Wix Editor y Runtime E2E no acreditados.

## Git y CI

- Repositorio: `nachoortegazgz/marianmadridz`, rama `main`.
- HEAD de `main` al actualizar este estado: `03435dea0487aa1eb0c242d2bffb42f31bbf55c5`.
- PR #662–#667: endurecimiento de serialización, errores CMS, configuración, criptografía, bookingType y transactionId; integradas.
- PR #668: evidencia documental inicial de Capa 0; integrada.
- PR #670: validación DAL, GUID de jornada, errores públicos, redacción de logs y paridad de enums; integrada mediante squash `5a1c84e34c2112de1a3f4874ca0eb070bbf4845b`.
- PR #671: actualización documental tras PR #670; integrada.
- PR #661: estrategia de pruebas Wix Classic; actualiza `tests/runtime/RUNTIME-TEST-PLAN.md`.
- PR #675: propagación de fallos de proveedores, identidad Staff/Members y endurecimiento DAL; integrada mediante squash `910ad3faa6e543c23e81b2902726d4d8cd43087f`.
- PR #679: contratos de sort Wix, redacción ampliada de secretos, serialización segura de metadatos y bookingType canónico en nuevas inserciones; integrada (merge `d44501c3c224ac417b283f687718ec9eb7538606`) y corregidas las regresiones en `944eb225b63260353cf283c87b0c0b6f07af6caf`.
- PR #680: corregidos `secretAccess.js`, `_roundMoney` y la duplicidad de moneda/zona horaria en `TPV_RUNTIME_POLICY`; integrada.
- PR #681: corregidas regresiones de CI de PR #680 y #679; integrada.

### CI verificado para PR #670

- Layer 1: 29 suites / 384 tests; 0 fallos.
- Layer 2: 16 suites / 250 tests; 0 fallos.
- Suite offline completa: 88 suites / 794 tests; 0 fallos.
- Wix eCommerce Cart, Transactions y TPV SDK: PASS.
- ESLint, Gitleaks y npm audit: PASS.
- Backend quality gates run `46081642075`, job `140781735934`; secret scanning run `46081642097`.

### CI verificado para PR #675

- Layer 1: 29 suites / 390 tests PASS.
- Layer 2: 16 suites / 250 tests PASS.
- Suite offline completa: 89 suites / 804 tests PASS.
- Wix eCommerce Cart, Transactions y TPV SDK: PASS.
- ESLint, npm audit y Gitleaks: PASS.
- Backend quality gates run `46083433335`; secret scanning run `46083433301`.

### CI verificado para PR #679 y corrección posterior en main

- HEAD inicial PR #679: `7b53e4bf784ea7744a140995c083ce4e120ccca2`; quality gates fallaron en run `46085515643`, secret scanning PASS en `46085515618`.
- El commit correctivo final de `main` es `944eb225b63260353cf283c87b0c0b6f07af6caf`.
- Backend offline quality gates PASS: run `46085827875`; 91 suites / 816 tests PASS.
- Secret scanning PASS: run `46085827842`.
- No trasladar el fallo del HEAD inicial al commit correctivo; tampoco trasladar este PASS a futuros SHAs sin nueva evidencia.

### CI verificado para PR #681 (correcciones de PR #680)

- Backend offline quality gates PASS: run `46085729210`, job `140794719898`.
- Secret scanning PASS: run `46085729219`.
- Suite offline completa: 91 suites / 816 tests PASS; 0 fallos.
- La ejecución inicial de PR #680 tuvo quality gates FAILURE (run `46085681740`); PR #681 corrigió las regresiones y el HEAD validado pasó.

Estas evidencias corresponden a los HEAD de las PR indicadas. No demuestran Wix Preview, Wix Runtime ni producción.

## Capa 0 — corregido e integrado

- Fingerprints TPV: serialización estricta; rechaza valores no JSON, ciclos, arrays dispersos, fechas inválidas, getters y objetos no planos.
- Writers fiscales: errores de lectura CMS distintos de ausencia real.
- Configuración: timeouts, cachés, TTL y límites compartidos centralizados en `SDK_CONFIG`.
- Criptografía: SHA-256/HMAC rechazan entradas vacías.
- Bookings dual: ausencia de `bookingType` preservada; nuevas inserciones CitasF2 lo exigen.
- `registrarEventoEconomico()` exige `transactionId` para dedupe y recuperación; sin fallbacks por secuencia ni recuperación por `traceId`.
- DAL: offsets inválidos rechazados, operadores explícitos `hasSome`/`hasAll`; `getItem()` exige colección e ID string no vacíos y solo interpreta WDE0073 como ausencia.
- Eliminada `queryReferencedItems()` tras comprobar que no tenía consumidores activos.
- Bookings Staff, CRM y Members: fallos de proveedor y respuestas inválidas se propagan con códigos técnicos estables; no se convierten en NOT_FOUND, NOT_STAFF, false, null o listas vacías.
- Staff paging: no devuelve resultados parciales si se alcanza el límite defensivo con cursor pendiente.
- Identidad: `security.js` centraliza el contexto Staff; `horario.web.js` delega en él; `citasManager.web.js` preserva errores y valida primero propiedad por `memberId`.
- Secretos: `secretAccess.js` valida el nombre y la respuesta, distingue valor vacío de respuesta inválida y preserva errores del proveedor; no inventa códigos de error no documentados.
- Dinero/configuración: `_roundMoney` rechaza valores inválidos; `TPV_RUNTIME_POLICY` ya no duplica moneda/zona horaria, que se consumen desde `SDK_CONFIG`.
- Jornada laboral: `resourceId` y `memberId` validados como GUID.
- Errores públicos: objetos arbitrarios no se convierten en `[object Object]`.
- Logging: redacción recursiva de secretos, tokens, credenciales URL, emails, PII, claves privadas, cookies, cabeceras de autorización y segmentos sensibles de rutas URL (PR #679).
- Contrato frontend/backend: retirado `PAYMENT_METHOD.OTRO` del espejo público por no formar parte del enum backend ni tener consumidores activos localizados.
- Wix Data sort: builders emiten la propiedad oficial `order`; entradas inválidas se rechazan, sin fallback silencioso a ASC.
- Respuestas públicas: metadatos se clonan a un formato JSON-safe, con manejo explícito de ciclos, fechas, BigInt y valores no finitos.
- CitasF2: alias históricos explícitos siguen siendo legibles; nuevas inserciones exigen el enum canónico.

## Pendiente — Capa 0 sigue EN EJECUCIÓN

1. **Emisor fiscal — P1:** `events.js::_getEmisorFiscal` aún debe revisarse para evitar que un error de secreto termine convertido en NIF vacío. Mantener el error técnico y no fabricar datos fiscales.
2. **Cobertura de Staff — P1:** Query Staff Members v1 solo devuelve service providers. Verificar que todos los `resourceId` usados por los roles del sitio corresponden a service providers. No asumir cobertura universal; evaluar v2 solo con contrato oficial y decisión explícita.
2. **Dinero — P1:** `_readPositiveAmount` y normalizadores numéricos locales de caja/fiscalidad aún convierten ciertos datos inválidos en cero. Clasificar consumidores por dominio (presentación, duración, importe, IVA, saldo) y añadir pruebas antes de cambiar contratos compartidos.
3. **Idempotencia — P1:** completar matriz de writers económicos/operativos: identidad primaria, `transactionId`, clave propia, append-only, timeout/insert incierto y call sites. No imponer regla ciega a eventos no económicos.
4. **Dead code/dependencias — P2:** continuar auditoría por consumidores/imports/exports/tests. PR #675 retiró `queryReferencedItems()` al demostrar cero consumidores; aplicar el mismo estándar al resto. No eliminar por tamaño o sospecha.
5. **Contrato TPV `sourceType` — P1:** existe una divergencia entre la directriz de no persistir un campo genérico `sourceType` y el contrato CMS/documentación vigente de `TransaccionesTPV`, que lo declara requerido. La implementación actual también lo consume. No retirarlo parcialmente: reconciliar primero esquema CMS, writers, readers, validadores y compatibilidad histórica, con rollback documentado.
6. **Remitente de correo — P1/P2:** `FROM_ADDRESS` usa `marianmadrid.com` mientras el dominio operativo es `.es`; la verificación de Resend no está acreditada. El envío de gestoría continúa deshabilitado. No cambiar el remitente sin evidencia de dominio verificado.
7. **Runtime — P1:** ejecutar Local Editor/Preview E2E aislado, sin reutilizar `CajaActual` ABIERTA y sin cobros reales. Confirmar sincronización Wix-Git mediante evidencia del sitio.

**Estado Capa 0: EN EJECUCIÓN.** PR #675–#681 integran propagación de errores, hardening de sort/logging/serialización, validación de secretos, rechazo de importes inválidos en `_roundMoney` y consolidación de moneda/zona horaria. Permanecen la revisión del emisor fiscal, cobertura de roles Staff, normalizadores numéricos locales, matriz global de writers, auditoría de deuda, contradicción `sourceType`, remitente de correo y validación Runtime. No declarar Capa 0 COMPLETADA.

## Wix/CMS — último read-back documentado

- Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`; Wix Editor clásico, Velo habilitado, Draft.
- Página TPV ID `yl5th`, ruta `/tpv`, `published=false` (read-back 27-11-2026).
- Recuentos de la auditoría integral posterior del 27-11-2026: `CajaActual=1` (ABIERTA), `MovimientosCaja=5`, `HistoricoCierresZ=1`, `TransaccionesTPV=0`, `ControlOperativo=81`, `MapaStaff=5`, `CitasF2=12`, `LibroAsientosContablesDetalle=3`, `RegistrosHorariosStaff=0`. La lectura read-only anterior de aceptación había observado `ControlOperativo=78` y `CitasF2=11`; se conserva como evidencia de ese instante, no como baseline posterior.
- Es una lectura histórica, no consulta live actual. No modificar esos registros ni utilizarlos como fixtures.

## Fuentes y auditorías

- [Auditoría Capa 0 PR #670](audits/2026-11-27-capa0-hardening.md).
- [Conciliación BUG-001…020](audits/2026-11-28-capa0-bug-reconciliation.md).
- [Propagación de errores Staff/Members/DAL — PR #675](audits/2026-11-28-capa0-provider-error-propagation.md).
- [Hardening posterior a PR #675 — PR #679](audits/2026-11-28-capa0-post-675-hardening.md).
- [Estrategia Wix Runtime](../tests/runtime/RUNTIME-TEST-PLAN.md).
- Get Secret Value: https://dev.wix.com/docs/api-reference/business-management/secrets/get-secret-value
- Query Staff Members v1: https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members
- Wix Data Query / Paging: https://dev.wix.com/docs/velo/apis/wix-data/query

**CI PASS ≠ Runtime PASS ≠ Producción verificada.** Mantener NO-GO hasta obtener evidencia del entorno correspondiente.


## Corrección SSOT fiscal — 28-11-2026

- Decisión vigente: la inmutabilidad prohíbe editar/borrar registros existentes; **no impide insertar nuevos registros válidos**.
- Código activo en el HEAD base `51c42cdf5b514e79079de0c7e6cb78be8e2fe3fa`: no contiene un bloqueo global `FISCAL_LEDGER_WRITES_DISABLED` / `LEDGER_WRITES_ENABLED=false`. La prueba `operational-writers.fail-closed.contract.test.mjs` comprueba que los writers no dependan de interruptores globales.
- Prueba positiva disponible: `events.native-booking-sync.test.mjs::EVENT-PAYMENT-09` valida insert fiscal sintético en `MovimientosCaja`, campos económicos, hash/secuencia, correlación y replay idempotente. Tests de locking cubren serialización/fencing.
- CI de PR #681: 91 suites / 816 tests PASS; quality gates run `46085729210`, secret scan `46085729219`. Es evidencia del HEAD de esa PR, no del runtime instalado.
- Sigue pendiente resolver la configuración real `CONFIG_SISTEMA_FISCAL` y secretos del emisor con datos verificados. Es un requisito de validez/configuración, no una prohibición legal a escribir.
- Detalle: [corrección SSOT fiscal append-only](qa/2026-11-28-fiscal-writer-append-only-ssot.md).


## VERI*FACTU y QR tributario — dossier añadido (28-11-2026)

- Nuevo dossier: [VERI*FACTU y QR tributario — implementación](architecture/VERIFACTU-QR-IMPLEMENTATION-DOSSIER.md).
- Enlazado desde [Dossier Capa 3](architecture/CAPA3-REGISTRO-EXTERNO-DOSSIER.md), [INDEX](INDEX.md) y [AI-INDEX](AI-INDEX.md).
- Revisión normativa: RD 1007/2023, RD 1619/2012, Orden HAC/1177/2024, RD 238/2026, Orden HAC/1028/2026 y RDL 43/2026.
- El RDL 43/2026, vigente desde 26-11-2026, modifica el plazo RRSIF. Cómputo general resultante para obligados del artículo 3.1: 06-10-2028 (24 meses desde entrada en vigor de Orden HAC/1028/2026 el 06-10-2026), sujeto a ámbito/exclusiones y revisión profesional.
- El dossier diferencia factura simplificada/ticket-factura de justificante de pago, proforma y recibo no-factura; incorpora formato oficial QR, URL, requisitos físicos, remisión AEAT, incidencias, idempotencia, arquitectura Wix/Velo y plan de pruebas.
- **Estado: DOCUMENTADO; implementación no acreditada.** No hay evidencia de SIF/modalidad elegidos, declaración responsable, registro AEAT, QR fiscal, impresión Epson conforme ni remisión real.
- No se ejecutaron pruebas: el cambio es exclusivamente documental. No se realizaron llamadas de escritura a AEAT ni mutaciones Wix.
