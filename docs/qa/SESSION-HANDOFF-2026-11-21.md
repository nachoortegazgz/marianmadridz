# SESSION HANDOFF — Marian Madrid / Wix Auditoría
**Fecha de corte:** 2026-11-21  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Rama de referencia:** `main`  
**HEAD de main al corte actual:** `e75aec5d28dcb8560fe75dbd04d5eae95957c3d8` (merge documental PR #518)  
**Baseline de código TPV:** `6bf263502c58fa28bd13f7db848553c18b34a323` (merge PR #516)  
**PR integrada:** [#516 — refactor(tpv): align widget handshake and backend test contracts](https://github.com/nachoortegazgz/marianmadridz/pull/516)  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Release:** **NO-GO**. No publicar ni ejecutar operaciones de escritura hasta superar los gates indicados.

> Este documento es el punto de continuidad vigente para la siguiente sesión. Distingue evidencia Git/CI, declaraciones del informe de smoke y validaciones Wix pendientes. No convierte una prueba offline en evidencia de runtime.

## 1. Baseline y control de cambios

- El baseline de código TPV en `main` es `6bf263502c58fa28bd13f7db848553c18b34a323`; sustituye el baseline anterior `106ec75`. El HEAD posterior de `main` es `10c15c56d2ff3e605d3cec3da0ca717b426bd280`, que solo integra esta consolidación documental mediante PR #517.
- PR #516 quedó fusionada el 2026-11-21 a las 03:24:32 UTC. Merge commit: `6bf263502c58fa28bd13f7db848553c18b34a323`.
- La rama `main` existe y el repositorio concede permisos de lectura/escritura a la integración. La API de GitHub devuelve `protected=false`: no hay protección de rama acreditada.
- CI post-merge del SHA actual:
  - Backend offline quality gates: run [44860968238](https://github.com/nachoortegazgz/marianmadridz/actions/runs/44860968238) — SUCCESS.
  - Secret scanning: run [44860968226](https://github.com/nachoortegazgz/marianmadridz/actions/runs/44860968226) — SUCCESS.
- El workflow de calidad completó instalación bloqueada, auditoría npm, Layer 1, Layer 2, regresión offline, contratos Wix SDK, eCommerce Order Transactions, TPV Catalog y ESLint. No se ha extraído un recuento exacto de tests desde los logs; no atribuir una cifra.
- El merge #516 modificó `#htmlTPV.txt`, `src/public/tpvPageController.js`, módulos `src/backend/tpv/*.web.js`, repositorio/utilidades TPV, pruebas contractuales y `docs/architecture/TPV-HTML-WIDGET-BRIDGE.md` / `src/backend/tpv/README.md`.

## 2. Cambios funcionales integrados en #516

- El handshake `MM_READY → MM_CONTEXT` deja de transportar/validar `environment`, `previewOnly`, `syntheticOnly` y otros flags de entorno. El widget habilita el flujo cuando recibe un sobre de contexto con `status=SUCCESS`.
- `obtenerConfiguracionTPV` entrega moneda EUR y zona horaria Europe/Madrid; conserva autorización `requireCajero`.
- Se retiró `assertTpvSandboxEnabled()` de WebMethods, repositorio y simulador. No hay que describir el antiguo gate booleano como protección activa.
- Se mantienen autorización backend, validación de DTO, controles de sesión, locks CAS, claves de idempotencia y validación de integridad de `CajaActual`.
- El identificador de cliente se denomina `customerIdentityId`; no se presenta como `customerContactId`, Wix Contact, Member ni recurso nativo.
- El HTML Component `#htmlTPV` sigue el patrón operativo POS de Wix Dashboard con extensiones propias.
- Catálogo: lectura de servicios Wix Bookings y productos/variantes Wix Stores Catalog V3. Personal y clientes se resuelven desde identidades sintéticas propias.
- No se crean pedidos eCommerce ni se invocan pagos/capturas/reembolsos reales, inventario, impresora POS, notificaciones o emisión fiscal.
- Persistencia lógica TPV: `CajaActual` es proyección/sesión; `MovimientosCaja` es ledger append-only; `ControlOperativo` coordina locks/idempotencia. `SANDBOX_LOGICAL_*` son namespaces de eventos, no colecciones físicas.
- Se conserva `cashRegisterStatus=SIMULACION` para la proyección sintética. No sustituirlo por `ABIERTA` para hacer pasar una prueba.

## 3. Riesgo que permanece: aislamiento del data plane

La retirada del gate booleano fue integrada y pasó CI, pero **no prueba que una llamada de WebMethod desde Preview opere en CMS Sandbox ni que una llamada desde Published no pueda alcanzar Online**.

El guard actual se apoya en el estado/marcador de `CajaActual` y en el `SANDBOX_RUN_ID`; es una defensa por estado de datos, no una detección contractual del modo Preview. La configuración mantiene `TPV_SANDBOX_RUNTIME_POLICY` y los efectos externos continúan deshabilitados, pero las constantes de configuración tampoco demuestran qué data plane resuelve Wix en runtime.

La prueba de contrato offline no reemplaza:
1. Evidencia del contexto Wix Editor/Preview y selección explícita de Sandbox.
2. Lectura CMS desde Preview del singleton y de las identidades en ese data plane.
3. Prueba negativa desde contexto Published/direct WebMethod sin mutación de Online.
4. Comparación read-only de Online antes/después.
5. Evidencia de que las colecciones Wix Apps no se escriben ni se consideran aisladas por CMS Sandbox.

No retirar el guard de integridad de `CajaActual` ni introducir un bypass de entorno. No habilitar writers por el mero hecho de que CI esté verde.

## 4. Estado de datos y precondiciones del TPV

La descripción de PR #516 registra una lectura CMS read-only con:
- `CajaActual` en estado `ABIERTA` y `snapshotSource=TPV_FUNCTIONAL_TEST`, incompatible con el marcador sintético esperado.
- Un registro en `MovimientosCaja` sin el contrato completo del ledger TPV.
- Cero filas en `TpvSandboxIdentities`.

Esta evidencia impide asumir que existe una sesión Sandbox válida. No reconstruir la sesión a partir de importes, no inferir identidad/actor y no corregir el movimiento histórico. Mantener la caja y el ledger existentes intactos hasta conciliación documental y lectura del data plane correcto.

La preparación prevista exige caja presembrada con marcador inequívoco del run actual y las seis identidades sintéticas definidas en `docs/qa/fixtures/tpv-sandbox-identities.json`. La presemilla solo podrá realizarse desde CMS Sandbox tras confirmar visualmente el entorno; nunca mediante una llamada de backend ambigua ni sincronizando Sandbox → Online. Wix Apps no quedan aisladas por el Sandbox del CMS.

## 5. Informe de smoke TPV recibido — 2026-11-21

El informe comunicado en la conversación indica estado global **PARCIAL — no apto aún para producción** y contiene, entre otros, estos datos:
- Caja principal localizada y abierta.
- Efectivo registrado: 320 EUR.
- Efectivo esperado: 320 EUR.
- Diferencia declarada: 0 EUR.
- Tarjeta registrada: 25 EUR.
- Total de tickets: 45 EUR.

El texto recibido en el contexto de esta sesión está truncado después del encabezado relativo a ventas contabilizadas. Por tanto, no se certifica el resto del arqueo, conciliación por método de pago, ventas, movimientos, cierre Z ni integridad de ledger. Los importes anteriores son datos declarados por el informe, no una verificación independiente del CMS ni prueba de aislamiento Sandbox. Antes de repetir el smoke, obtener el informe íntegro y asociarlo a run ID, contexto Wix, sesión, movimientos y evidencia read-only.

## 6. Validación: estado real

| Área | Estado al corte |
|---|---|
| PR #516 integrada en main | Verificado |
| CI offline post-merge | SUCCESS |
| Secret scanning post-merge | SUCCESS |
| Contratos estáticos del widget/WebMethods | CI SUCCESS |
| Identidad sintética separada de Wix Contact | Integrado; CI SUCCESS |
| Catálogo Bookings / Stores V3 | Integrado en código; runtime pendiente |
| Presemilla de CajaActual Sandbox | Pendiente |
| Seis identidades sintéticas Sandbox | Pendiente; última evidencia de PR: cero filas |
| Wix Local Editor / Preview E2E | No acreditado |
| Aislamiento Preview Sandbox vs Online | No demostrado |
| Prueba negativa desde Published | No ejecutada |
| Concurrencia/atomicidad real en Wix Runtime | Pendiente |
| Comparación Online antes/después | Pendiente |
| Sincronización Editor ↔ Git y SHA instalado | No acreditada |
| Publicación/despliegue | NO-GO |

## 7. Próxima sesión — secuencia recomendada

1. Confirmar de nuevo HEAD de `main`, estado de PRs y CI; sincronizar localmente desde `6bf263502c58fa28bd13f7db848553c18b34a323`. No asumir que el Editor Wix contiene ese SHA.
2. Recuperar el informe completo del smoke y conservar evidencia original; conciliar tickets, pagos y ledger sin alterar registros append-only.
3. Hacer inventario read-only de `CajaActual`, `MovimientosCaja`, `ControlOperativo` y `TpvSandboxIdentities` en Online y Sandbox por separado. No usar Management API sin selector de entorno como prueba de Sandbox.
4. Verificar que el singleton Sandbox tiene el marcador/run ID exacto y estado inicial permitido. Si no existe o no coincide, detenerse: no crear/actualizar desde un WebMethod del sitio.
5. Verificar las seis identidades `SANDBOX-CUSTOMER-01..03` y `SANDBOX-STAFF-01..03`, todas sintéticas y con email `@example.test`; no asociarlas a Contacts/Members/Bookings.
6. Ejecutar Preview E2E solo cuando el contexto Sandbox esté inequívocamente confirmado: handshake, catálogo, cliente, operador, apertura, venta sintética, movimiento, devolución sintética, X y Z. No ejecutar cobros reales.
7. Probar reintentos idempotentes y concurrencia; comprobar que el cierre Z bloquea ventas/devoluciones pendientes y que la conciliación por medio de pago coincide.
8. Comparar Online antes/después y demostrar ausencia de cambios; guardar trazas, run ID y resultados. Ejecutar la prueba negativa Published sin escrituras.
9. Actualizar issues, dossier técnico, matriz E2E y documentación de relevo con resultados observados. Mantener NO-GO si falta cualquier evidencia P0/P1.

## 8. Restricciones permanentes

- No modificar ni borrar ledgers, históricos, claims/eventos de idempotencia o registros append-only; rectificar mediante nuevos registros trazables cuando exista un procedimiento aprobado.
- No tocar la caja Online, compensaciones `PENDING_RECOVERY`, pedidos #10032/#10033 ni sus bookings asociados.
- No ejecutar crons, pagos, reembolsos, writers fiscales/contables/laborales ni notificaciones reales.
- Wix CMS es SSOT transaccional; SharePoint solo evidencia documental.
- No sincronizar Sandbox → Online.
- No publicar hasta validar runtime, aislamiento, concurrencia, permisos, CI, diff, reversión y autorización de release.

## 9. Referencias de continuidad

- [PR #516](https://github.com/nachoortegazgz/marianmadridz/pull/516)
- [CI backend offline](https://github.com/nachoortegazgz/marianmadridz/actions/runs/44860968238)
- [Secret scanning](https://github.com/nachoortegazgz/marianmadridz/actions/runs/44860968226)
- `docs/architecture/TPV-HTML-WIDGET-BRIDGE.md`
- `src/backend/tpv/README.md`
- `docs/qa/2026-11-20-tpv-sandbox-session-handoff.md`
- `docs/qa/2026-11-20-live-caja-schema-and-reconciliation.md`

**Conclusión:** el código y la documentación del contrato TPV están integrados hasta PR #516 y los gates offline del merge están verdes. El estado operativo no está validado: precondiciones CMS, aislamiento del data plane, runtime Preview, E2E y conciliación completa del smoke siguen pendientes. Mantener **NO-GO**.


## 10. Consolidación documental integrada — PR #517

- PR #517 se fusionó mediante squash el 2026-11-21; commit de documentación: `10c15c56d2ff3e605d3cec3da0ca717b426bd280`.
- PR #517 añadió este relevo y el addendum de `docs/PROJECT-STATUS.md`; no modificó código funcional, CMS ni configuración Wix.
- Checks pre-merge: Backend offline quality gates y Gitleaks SUCCESS en el SHA `dac880c5bdcf2ad0c3a0dec59ca799728b4bb6f9`.
- Los checks post-merge de `10c15c56...` se lanzaron tras la integración; consultar su resultado antes de declarar el último commit documental validado.
- Por tanto, el baseline funcional TPV sigue siendo PR #516 / `6bf263502c58fa28bd13f7db848553c18b34a323`, mientras que el HEAD actual de Git `main` incluye además el commit documental #517.


## 11. Reauditoría Wix read-only — 2026-11-21

El estado anterior de automatizaciones y CMS queda actualizado por [la auditoría read-only 2026-11-21](../audits/2026-11-21-wix-site-readonly-baseline.md) y el [plan maestro](../MASTER-EXECUTION-PLAN.md).

- HEAD actual de `main`: `e75aec5d28dcb8560fe75dbd04d5eae95957c3d8`; baseline funcional TPV sigue en PR #516 / `6bf263502c58fa28bd13f7db848553c18b34a323`.
- CI post-merge en HEAD: Backend offline quality gates run `44867151597` SUCCESS; Secret scanning run `44867151605` SUCCESS.
- Wix confirma Editor Classic, Velo habilitado y Published. La clasificación QA continúa por directriz expresa del propietario; el SHA instalado en Wix no está acreditado.
- CMS: 42 colecciones (13 NATIVE / 29 WIX_APP). Site Data Usage: LIVE 203 items / 266.227 bytes; SANDBOX 109 / 206.023 bytes. CajaActual 1/1; MovimientosCaja 2/2; TpvSandboxIdentities 0/0; ControlOperativo 58/0.
- CajaActual LIVE sigue ABIERTA con source MOVIMIENTOS_CAJA_RECONCILIADOS y traceId 0, no apta para TPV Sandbox. Los dos movimientos LIVE (25 CARD, 20 CASH) carecen del contrato sintético completo. No corregir ni borrar.
- Hay tres FISCAL_LEDGER/PENDING_RECOVERY sin intentos; no reintentar.
- Se confirmaron 8 automatizaciones ACTIVE de 159. Siete preinstaladas tienen status change bloqueado. Una automatización de aplicación, `Configuración de control laboral`, usa trigger programado y acción LLM; tarea y efectos pendientes de inspección. No ejecutar pruebas que puedan disparar automatizaciones.
- Accessibility scan `aae3b411-81ff-4309-a767-6301164cb483` terminó PARTIALLY_COMPLETED; 121 páginas descubiertas, 0 procesadas, 121 fallidas con ANALYSIS_FAILED y 0 findings. Las URLs usan wixsite.com; causa pendiente. Google Search Console readiness devuelve READY.
- `main` no está protegida. PR #495 sigue abierta y no mergeable.

**Siguiente secuencia:** F0 contención de automatizaciones y confirmación de SHA Wix; F1 inspección Sandbox y conciliación de caja/compensaciones; F2 garantías compartidas de CajaActual; F3 TPV E2E. Mantener NO-GO hasta completar las pruebas reales y el reset preproducción.
