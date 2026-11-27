# Estado actual del proyecto — 2026-11-27

**Estado global: NO-GO MVP operativo/comercial.** Esta página es la referencia de continuidad para la siguiente sesión. Sustituye estados narrativos anteriores; las auditorías fechadas se conservan como evidencia histórica, no como instrucciones actuales.

## 1. Baseline Git y CI

- Repositorio: `nachoortegazgz/marianmadridz`.
- `main`: `f0b30c31c8ad924e42f8790338fa223716026420` (PR #645, documentación de aceptación read-only).
- PR #639, #640, #641, #643, #644 y #645 integradas.
- PR #640: clasificación temporal TPV y gate de venta integrados. CI: 81 suites, 764 tests, 0 fallos.
- PR #641: preparación de paquete de registro externo Capa 3 integrada. CI: 80 suites, 762 tests, 0 fallos.
- No hay ejecuciones de workflow asociadas al HEAD documental actual. Las ejecuciones anteriores acreditan los commits de sus PR, no el estado Wix Runtime.
- No se ha demostrado que el SHA de `main` esté sincronizado con el código cargado en Wix Editor/Preview.

## 2. Wix y CMS — último read-back documentado 2026-11-27

- Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`; Editor clásico, Velo habilitado, estado Draft (`published=false`).
- 9 páginas estáticas y 2 dinámicas. TPV: ID `yl5th`, ruta `/blank`.
- Apps leídas: Bookings, Forms & Payments, Gift Cards, Invoices V1, Members Area, Payments, Stores Catalog V3, Blog y SEO.
- CMS: `CajaActual=1` (ABIERTA); `MovimientosCaja=5`; `HistoricoCierresZ=1`; `TransaccionesTPV=0`; `ControlOperativo=78` (3 compensaciones `FISCAL_LEDGER/PENDING_RECOVERY`, attempts=0); `MapaStaff=5`; `CitasF2=11`; `LibroAsientosContablesDetalle=3`; `RegistrosHorariosStaff=0`.
- `MapaStaff` contiene 1 GESTORIA, 1 TERCERO y 3 STAFF. No existe registro `recordType=CONFIG_SISTEMA`; ninguno de los cinco registros contiene `productionActivationAt`.
- No se realizaron escrituras CMS en las auditorías read-only citadas. La caja ABIERTA y los ledgers existentes no son fixtures de QA.

Fuente: [aceptación MVP read-only](audits/2026-11-27-mvp-runtime-readonly-acceptance.md) y [auditoría multicapa](audits/2026-11-27-current-site-layer-verification.md).

## 3. TPV — estado de código integrado

- PR #640 está integrada en `main`.
- `src/backend/tpv/tpvRecordNature.js` deriva la naturaleza en backend con timestamp UTC de servidor y el único corte `MapaStaff/CONFIG_SISTEMA.productionActivationAt`.
- Regla: instante anterior al corte = `SYNTHETIC`; igual o posterior = `REAL`. Sin singleton/corte configurado, los registros válidos se clasifican `SYNTHETIC`; fechas inválidas o configuración ambigua fallan cerradas.
- Los metadatos se conectan a eventos físicos TPV, proyección de sesión, auditoría e intención comercial.
- `registrarVenta()` vuelve a calcular preparación y aplica los mismos `saleReadinessBlockers` que `validarVentaBorrador()`. Si no está lista, devuelve `TPV_SALE_NOT_READY` y no crea intención nueva. El replay idempotente se resuelve antes del gate.
- `TransaccionesTPV`: intención comercial pendiente/no contable. `MovimientosCaja`: ledger físico canónico. No fusionar dominios ni duplicar ledgers.
- El widget sigue en MODO CONSULTA y `saleReady=false` por configuración fiscal, pago no verificado, presentación de precio final y otros gates. No hay venta, cobro ni movimiento físico aceptados en Runtime.
- `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false`, `ALLOW_SIMULATION_RECORDS=false` y writer de jornada deshabilitado permanecen fail-closed según la auditoría.

## 4. Reservas / Bookings — fallo funcional abierto

- 11/11 IDs de `CitasF2` existen en Bookings V2.
- 5 estados coinciden; 6 proyecciones `CONFIRMED/PENDING` contradicen el estado nativo `CANCELED`.
- No se debe recrear, reconfirmar ni actualizar manualmente estas reservas.
- Próximo trabajo: reconciliación backend controlada, idempotente y auditable que lea Bookings V2 y actualice solo la proyección `CitasF2`; después, relectura comparativa 11/11. Issue #523.

## 5. Capa 3 — estado

- PR #641 integrada: preparación determinista de paquete trimestral, checksum SHA-256, minimización de campos y lectura estricta de registros `recordNature=REAL`; WebMethod Admin-only con autorización y rate limit.
- El paquete se prepara en memoria. No existe transporte conectado a SharePoint/Graph ni Power Automate E2E.
- Sin configuración fiscal válida y sin corte real, la exportación fiscal real debe fallar cerrada.

## 6. Otros bloqueos verificados

- Tres compensaciones fiscales en `ControlOperativo` permanecen `PENDING_RECOVERY`; requieren correlación con la operación fuente, no cambio manual de estado.
- Concurrencia de `CajaActual`: lock/CAS implementado y CI offline histórico; concurrencia real en Wix Runtime no probada.
- Jornada laboral: cero fichajes en el read-back y writer deshabilitado.
- Siete automatizaciones ACTIVE del inventario read-only eran PREINSTALLED y con `disableStatusChange=true`; no se modificaron.
- Wix Preview workflow manual no ejecutado; el smoke actual es read-only y no invoca WebMethods ni interacciones.

## 7. Decisiones e invariantes vigentes

- Un único código, contrato, validación y writer para desarrollo y producción; los tests usan fixtures/dobles, no un runtime de negocio paralelo.
- La naturaleza del registro es metadato derivado por backend, nunca selector de flujo.
- Wix CMS es SSOT transaccional; SharePoint solo custodia evidencia/exportación.
- Frontend sin lógica de negocio ni autoridad de permisos.
- Autorización, validación y secretos exclusivamente en backend.
- Procesos asíncronos/webhooks idempotentes.
- Ledgers físicos, fiscales, contables, laborales y cierres append-only son inmutables, también cuando el dato es sintético; corrección mediante nuevos registros trazables.
- No activar pagos reales, reembolsos, remisión AEAT, writers fiscales ni notificaciones externas durante QA.

## 8. Siguiente sesión — orden de ejecución

1. **Bookings P1:** implementar reconciliación segura de las seis proyecciones divergentes; tests de cancelación, replay, concurrencia e idempotencia; ejecutar read-back antes/después. No mutar reservas nativas.
2. **TPV P0:** revisar el código integrado de PR #640 y cerrar pruebas unitarias/integración del clasificador y del gate WebMethod. Preparar un fixture de sesión realmente aislado, sin tocar `CajaActual` singleton ni `MovimientosCaja` existentes.
3. **Runtime:** ejecutar Wix CLI Preview con build fingerprint y smoke; después ampliar un runner autenticado que interactúe con UI y llame flujos de aplicación de forma segura. No confundir smoke HTTP con E2E.
4. **Capa 3:** completar contrato de transporte con tenant SharePoint aislado, permisos mínimos, idempotencia y read-back de evidencia; sin enviar documentos reales.
5. **Fiscal/compensaciones:** resolver configuración legal y las tres compensaciones desde sus operaciones fuente; mantener writers deshabilitados hasta superar gates.
6. **Toolchain/deuda:** auditar versiones SDK y toolchain (incluido ESLint 8 EOL y transitivas deprecated) en una PR aislada con CI y changelog. No actualizar dependencias en bloque ni editar `wix.lock` manualmente.

## 9. Límites de esta consolidación

- Verificado en GitHub: PRs integradas, commits y resultados CI declarados en los PR de código.
- Verificado por read-back Wix en auditorías fechadas: Site Context, recuentos CMS, Booking Reader V2 y Automation V2.
- No verificado: Wix Preview/Runtime de WebMethods, UI E2E, concurrencia online, sincronización SHA Git-Wix, hardware de pago, SharePoint/Power Automate E2E ni producción.
- El HEAD documental `f0b30c31c8ad924e42f8790338fa223716026420` no tiene runs de workflow asociados.
