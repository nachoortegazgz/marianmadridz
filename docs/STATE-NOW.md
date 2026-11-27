# Estado actual del proyecto — 2026-11-27

**Estado global: NO-GO MVP operativo/comercial; desarrollo y QA sintético habilitados.** Esta página resume la última evidencia fechada. Las auditorías históricas describen el momento observado, no son instrucciones actuales.

## 1. Baseline Git y CI

- Repositorio: `nachoortegazgz/marianmadridz`.
- La documentación y el código deben referenciar el HEAD real de `main`; no reutilizar SHAs históricos como estado actual sin read-back.
- Baseline de `main` al iniciar la revisión: `7a7e171357090c18d01874d8deb4368344cd5af6`.
- PR #640: clasificación temporal TPV y gate de venta integrados. CI histórico: 81 suites, 764 tests, 0 fallos.
- PR #641: preparación de paquete Capa 3 integrada. CI histórico: 80 suites, 762 tests, 0 fallos.
- PR #650: identidad transaccional fiscal obligatoria, fingerprint de replay y contrato mínimo de movimiento fiscal integrados; CI PASS. AEAT hash y Runtime E2E continúan pendientes.
- PR #651 (en revisión): normalización de errores TPV, guards operativos dentro de try/catch, ausencia de filtros por entorno, retirada de bloqueos fiscales globales y prohibición global de borrado. CI pendiente de ejecución sobre el HEAD final.
- Las ejecuciones CI acreditan únicamente los commits y suites ejecutados; no acreditan Wix Runtime.

## 2. Wix y CMS — último read-back documentado 2026-11-27

- Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`; Editor clásico, Velo habilitado, estado Draft (`published=false`).
- 9 páginas estáticas y 2 dinámicas. TPV: ID `yl5th`, ruta `/blank`.
- Apps leídas: Bookings, Forms & Payments, Gift Cards, Invoices V1, Members Area, Payments, Stores Catalog V3, Blog y SEO.
- CMS: `CajaActual=1` (ABIERTA); `MovimientosCaja=5`; `HistoricoCierresZ=1`; `TransaccionesTPV=0`; `ControlOperativo=78`; `MapaStaff=5`; `CitasF2=11`; `LibroAsientosContablesDetalle=3`; `RegistrosHorariosStaff=0`.
- No existe registro `recordType=CONFIG_SISTEMA` ni `productionActivationAt` en los cinco registros MapaStaff consultados.
- La caja ABIERTA y los ledgers existentes no son fixtures de QA. No se realizaron escrituras CMS en las auditorías read-only citadas.

## 3. TPV — estado de código integrado

- El contrato TPV no contiene `recordNature` ni clasifica registros como REAL/SYNTHETIC/SIMULATION. `recordTimestamp` UTC es el único metadato temporal neutral.
- La ausencia de corte/configuración real debe permitir probar el dominio con fixtures sintéticos y puertos simulados. No habilita clasificación REAL ni writers productivos.
- `registrarVenta()` aplica los blockers de preparación para operaciones reales; el replay idempotente se resuelve antes del gate.
- `TransaccionesTPV`: intención comercial editable mediante hook/DAL y validación completa del registro; borrado prohibido. `MovimientosCaja`: ledger físico canónico; no se borra y los movimientos contabilizados se rectifican mediante nuevos eventos trazables.
- El widget sigue en MODO CONSULTA y no hay venta/cobro/movimiento físico aceptados en Runtime según la última evidencia.
- No existen interruptores globales `FISCAL_RUNTIME_POLICY` ni `assertTpvOperationalLedgerConfigured("fiscal")` bloqueante. La validación fiscal/contable se mantiene en los contratos de datos: campos, tipos, importes, secuencias, hashes, autorización, locks e idempotencia. Una configuración o dato obligatorio ausente produce un código explícito de validación, no un bloqueo global genérico.
- El writer de jornada conserva su control específico hasta disponer de idempotencia y serialización validadas.
- Revisión actual en rama `fix/tpv-actionable-errors-and-guards`: normalización de errores TPV, guards dentro de `try/catch`, lectores sin clasificación por entorno, actualización validada de intenciones comerciales y no-delete global (DAL, hooks y bulk). Pendiente de CI/merge; no implica Runtime PASS.

## 4. Reservas / Bookings

- Última lectura: 11/11 IDs de `CitasF2` existen en Bookings V2; 6 proyecciones CONFIRMED/PENDING contradicen estado nativo CANCELED.
- Issue #523: reconciliación backend controlada, idempotente y auditable pendiente. No recrear ni reconfirmar reservas; desarrollar y probar la reconciliación primero con fixtures.

## 5. Capa 3

- PR #641 prepara paquete trimestral determinista, checksum SHA-256, minimización de campos y lectura estricta de registros REAL.
- La transformación y el checksum deben probarse con fixtures sintéticos. Transporte SharePoint/Graph/Power Automate real no acreditado.

## 6. Principio operativo para evitar bloqueos de QA

- La falta de datos, series o configuración fiscal productiva no bloquea unitarias, contratos ni integración simulada.
- Probar tanto el comportamiento fail-closed ante configuración ausente como el recorrido válido del dominio usando fixtures explícitos y adaptadores simulados.
- Las pruebas de Wix Runtime que escriban requieren un ámbito aislado y writer canónico; las pruebas read-only no requieren preparar sesión de caja.
- Ningún test sintético activa cobros, remesas, notificaciones ni servicios externos reales.
- Los gates de producción se mantienen en producción. No convertirlos en precondiciones globales de desarrollo.

## 7. Invariantes

- Un único código y reglas de dominio para desarrollo y producción; fixtures y dobles solo sustituyen dependencias de infraestructura.
- Wix CMS es SSOT transaccional; SharePoint solo custodia evidencia.
- Frontend sin lógica de negocio ni autoridad de permisos.
- Autorización, validación y secretos exclusivamente en backend.
- Procesos asíncronos/webhooks idempotentes.
- No se permite borrar ningún registro. Los datos operativos y comerciales editables se actualizan mediante validación backend. Los ledgers ya contabilizados y registros laborales/cierres conservan la rectificación mediante nuevos registros trazables para no alterar la evidencia legal.
- No usar REST/CMS directo para saltarse DAL, hooks o writers.

## 8. Siguiente trabajo

1. Auditar `src/backend/eventLog.js` y consumidores para decidir y aplicar el contrato global de `transactionId`; el cambio P0 de PR #650 cubre `cajas.web.js`, no todos los writers.
2. Completar el mapping AEAT oficial (alta/anulación, tipoFactura, serie/número, fecha, importes y hash previo) antes de conectar los hashes AEAT; no recalcular históricos.
3. Preparar Wix Runtime E2E con fixture/sesión sintética aislada y writer canónico; no reutilizar la caja ABIERTA ni activar pagos/AEAT.
4. Resolver las divergencias Bookings/CitasF2 mediante reconciliación backend y pruebas con fixtures.
5. Completar pruebas Capa 3 con fixtures y transporte simulado; después validar tenant SharePoint de pruebas.
6. Resolver configuración fiscal y compensaciones para habilitación productiva, sin bloquear el desarrollo del resto de módulos.

## 9. Estado de evidencia

- Los recuentos CMS y el estado Draft proceden del read-back fechado 2026-11-27.
- CI, Wix Preview/Runtime, sincronización SHA Git-Wix, hardware de pago y SharePoint E2E requieren ejecuciones específicas.
- Los datos de esta página son una instantánea fechada; no deben tratarse como lecturas actuales sin nueva verificación.
