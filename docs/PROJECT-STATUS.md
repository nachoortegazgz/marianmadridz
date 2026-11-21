> **AVISO DE ACTUALIZACIÓN (20/11/2026):** Este documento contiene snapshots históricos de 14–19/11. El addendum live del 20/11 al final prevalece cuando exista contradicción; el estado Wix actual es Draft y el esquema CajaActual es revisión 18 (81 campos). Véase [reconciliación live 20/11](qa/2026-11-20-live-caja-schema-and-reconciliation.md).

> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`nacho.pitt@example.test`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](qa/QA-ENVIRONMENT-SSOT.md).

---

# Estado del proyecto — sitio Marian Madrid

**Corte:** 2026-11-14  
**Sitio QA único de trabajo:** 188bed94-177c-4bc9-a9f0-35080d874f3e  
**Naturaleza:** entorno QA previo al despliegue real; nunca ha tenido actividad real y sus datos son sintéticos, según declaración expresa del propietario.  
**Plataforma:** Wix Editor Classic + Velo.  
**Repositorio:** nachoortegazgz/marianmadridz.

## Situación actual

El sitio es el único objeto de trabajo. No se mantiene una matriz de comparación con otro sitio. Los registros presentes se consideran sintéticos y no acreditan actividad comercial, fiscal ni laboral.

### CMS verificado

- 23 colecciones: 15 NATIVE y 8 WIX_APP; 524 campos físicos NATIVE.
- CajaActual: 39 campos, 1 registro; operationDate DATE, openingAmount NUMBER, sequenceCounters OBJECT y otherAmount. cashRegisterStatus=SIMULACION; isOpen=true no es autoridad.
- ControlOperativo: 42 campos, 0 registros; ownerToken, retryAfter y nextRetryAt ausentes; traceId es fencing token.
- ComplementosCatalogo: 18 campos, 36 registros; addonId = _id en 36/36.
- MapaStaff: 18 campos, 3 registros; mapa de identidades de personal. thirdPartyId es TEXT opaco, no coincide con DatosFiscales._id y no tiene consumidor localizado.
- DatosFiscales: 28 campos, 1 placeholder; recordType, taxId, legalName, thirdPartyType y datos de gestoría; sin traceId ni schemaVersion.
- ServiciosCatalogo: 42 campos, 95 registros; serviceId y pricingPlanId son identificadores nativos distintos de _id CMS.
- InventarioStockVenta y MovimientosInventario permanecen físicamente, pero sus contratos y writers están retirados.

La especificación de campos y tipos está en [la auditoría del esquema actual](audits/2026-11-14-current-site-cms-normalization.md) y en [el diccionario CMS](../DICCIONARIO_DATOS_CMS.md).

### Código y documentación

La rama fix/current-site-cms-contract-alignment separa los contratos de MapaStaff y DatosFiscales, migra los lectores/escritores fiscales a DatosFiscales, usa _id como keyfield CMS canónico de ComplementosCatalogo y consolida gestorName como nombre de gestoría.

PR #370 está abierto pero GitHub informa `dirty` (historial divergente respecto a main). No hay checks asociados al HEAD actual; los últimos checks exitosos son de 68a2f327 y no validan los cambios posteriores. Rebase y CI actual pendientes; no fusionar ni publicar.

### Seguridad y operaciones

- La decisión QA-2026-11-15-TEMP-MUTABILITY autoriza temporalmente correcciones de datos sintéticos, pero la mutabilidad no está habilitada técnicamente: la política central aún bloquea update/remove de ledgers append-only.
- No existe una bandera global de mutabilidad; no habilitarla sin identidad de sitio verificada server-side, ADMIN-only, allowlist por colección, backup y auditoría.
- Las colecciones WIX_APP y los claims/eventos de idempotencia permanecen protegidos.
- Writers fiscales/contables/laborales, pagos, reembolsos y envíos externos siguen fail-closed.
- No existe CONFIG_SISTEMA con identidad fiscal oficial verificada.

## Pendientes de cierre

1. Ejecutar CI completa, lint, contratos y secret scanning sobre la rama.
2. Revisar diff y abrir PR; no integrar con pruebas fallidas.
3. Validar hooks/WebMethods en Wix Editor y ejecutar pruebas sintéticas controladas.
4. Exportar código Velo del Editor y comparar con Git; la sincronización Editor↔Git no está acreditada.
5. Revisar consumidores externos antes de retirar físicamente campos espejo.
6. No habilitar writers fiscales ni afirmar cumplimiento Veri*Factu sin datos oficiales y pruebas end-to-end.

## Decisiones

Consultar [DECISION-LOG.md](DECISION-LOG.md). TEC-038 describe la política técnica fail-closed actualmente implementada; QA-2026-11-15-TEMP-MUTABILITY autoriza la excepción temporal, cuya implementación segura sigue pendiente.


> **Nota de baseline CMS:** los inventarios y recuentos CMS que acompañan este estado son snapshots históricos; no constituyen baseline vigente del Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e` hasta repetir una lectura de solo lectura contra el sitio QA actual.


## Addendum de estado — 2026-11-17

El inventario histórico de este documento ha sido sustituido por el corte live del 2026-11-17. MapaStaff es el maestro fiscal/personas discriminado actual; DatosFiscales no existe; CONFIG_SISTEMA no existe. PR #418 y #419 tienen CI offline en verde, pero permanecen abiertas, no fusionadas y sin validar en Wix runtime. SiteContext devuelve Draft.

Bloqueos P0: issues #415 (maestro fiscal/configuración) y #416 (compensaciones, pedidos POS y caja). Main carece de rulesets/required checks; no se puede modificar protección desde la integración actual. No publicar ni habilitar writers.

Ver [estado completo de preparación](../docs/audits/2026-11-17-deployment-readiness.md).


---

## Addendum vigente — 2026-11-19

Este bloque sustituye el estado operativo de los addenda anteriores cuando exista contradicción. El documento rector es [DOSSIER TÉCNICO CONSOLIDADO.md](../DOSSIER%20T%C3%89CNICO%20CONSOLIDADO.md).

- Baseline actual de `main`: `f764a209d417027f07dc31bb86aa471f2aaed834` (PR #430 integrada).
- Wix Site Context informa **Published**, Editor Classic, Velo habilitado, EUR y Europe/Madrid. La clasificación del sitio como QA deriva de la declaración del propietario. Publicación no acredita SHA instalado ni runtime validado.
- CI offline y secret scanning SUCCESS en runs `44602059578` y `44602059662`, respectivamente, para el SHA actual.
- Auditoría estática: 15/15 jobs declarados tienen export en `crons.js`; un diagnóstico read-only adicional no está programado. Estado de ejecución/activación en Wix pendiente.
- `main` sigue sin protección ni required checks. Issue #210 abierto.
- Bloqueos P0 #415/#416 y #209 siguen abiertos. No activar escritores ni ejecutar compensaciones/cierres.
- Inventario personalizado pendiente de retirada controlada (#237); Wix Stores Catalog V3 es la autoridad aprobada.
- Release: **NO-GO para operación real**. Runtime, sincronización Wix y E2E no están acreditados.

La auditoría detallada de jobs, riesgos operativos y secuencia mínima está en el addendum del dossier maestro del 2026-11-19.


### Addendum de conciliación live — 2026-11-19

La revalidación consistente de Wix confirma 3 compensaciones FISCAL_LEDGER/PENDING_RECOVERY (0 intentos), CajaActual ABIERTA con 300 EUR esperados/contados, cero MovimientosCaja y cero HistoricoCierresZ, seis CitasF2 y MapaStaff con 3 STAFF, 1 TERCERO y 1 GESTORIA, sin CONFIG_SISTEMA. Pedidos asociados: #10033 totalmente reembolsado (18,15 EUR) y #10032 PAID/Cash (92,45 EUR; composición dos líneas Stores + una Bookings). No se ha mutado ningún registro. El detalle y la decisión de no reintentar están en el addendum vigente del dossier maestro y en issues #415/#416.

La retirada de inventario custom (#237) está completada en código; falta QA runtime nativo. La persistencia de snapshots trimestrales (#223) está implementada con hash y create-only; agregador mensual y registro de despacho append-only pendientes. Release NO-GO.


### Addendum live de automatizaciones y permisos — 2026-11-19

La API oficial de Wix devuelve 158 automatizaciones: 8 ACTIVE y 150 INACTIVE; las ocho activas son PREINSTALLED. Una automatización activa se dispara por `wix_bookings-sessions_booked` y contiene acción `triggered-emails`; destinatario pendiente de verificar. No se han modificado automatizaciones.

Los permisos de MovimientosCaja, LibroAsientosContablesDetalle, HistoricoCierresZ, RegistrosHorariosStaff y PaquetesGestoria son PRIVILEGED para insert/update/remove, sin special permissions. La jerarquía oficial sitúa CMS_EDITOR por debajo de PRIVILEGED; el nivel mínimo PRIVILEGED excluye al CMS_EDITOR sin privilegios superiores. No hay special permissions. Issue #261: configuración alineada; prueba runtime de CMS_EDITOR y de writers backend elevada pendiente. No se han modificado permisos.

`CajaActual.sequenceCounters` se almacena como string JSON válido (`{}`), y el hook normaliza ese valor; no se clasifica como corrupción confirmada. Release NO-GO.


---

## Addendum live — 2026-11-20 (prevalece sobre los snapshots anteriores)

La consulta actual de Wix Site Context devuelve **Draft** para el Site ID 188bed94-177c-4bc9-a9f0-35080d874f3e. Este es el estado observado ahora; las menciones anteriores a Published no son vigentes.

### CMS live
- CajaActual: revisión 18, 81 campos, 1 singleton. Esquema actualizado el 17/11/2026. Incluye openingCashAmount, openingCardAmount, openingBizumAmount, openingOtherAmount, bizumAmount y operationDateHour.
- MovimientosCaja: revisión 109, 113 campos, 0 elementos.
- HistoricoCierresZ: revisión 44, 66 campos, 0 elementos.
- ControlOperativo: revisión 93, 32 campos, 58 elementos; 3 compensaciones FISCAL_LEDGER/PENDING_RECOVERY, attempts=0.
- CitasF2: revisión 60, 29 campos, 6 elementos.
- LibroAsientosContablesDetalle: revisión 9, 103 campos, 0 elementos.
- Las seis colecciones consultadas devuelven permisos ADMIN para read/insert/update/remove.

### CajaActual
El singleton sigue ABIERTA con openingCashAmount/cashAmount/expectedCash/countedCash=300 EUR, difference=0, snapshotSource=APERTURA_CAJA y traceId vacío. closedAt y lastMovementAt (12/11) son anteriores a openedAt (14/11). sequenceCounters está persistido como texto JSON aunque el esquema declara OBJECT. No se ha cerrado ni modificado.

### Pedidos y reservas vinculados
- Pedido #10033: POS, APPROVED/FULLY_REFUNDED, 18,15 EUR; booking nativo CONFIRMED/PAID, mientras CitasF2 continúa CONFIRMED/PENDING_LEDGER y totalAmount=0.
- Pedido #10032: POS, APPROVED/PAID, 92,45 EUR, Cash, composición mixta Stores+Bookings; booking nativo CONFIRMED/PAID, mientras CitasF2 continúa CONFIRMED/PENDING_LEDGER y totalAmount=0.
- Las tres compensaciones históricas siguen pendientes; no se reintentan ni modifican. Véase issue #416 y [reconciliación live 20/11](qa/2026-11-20-live-caja-schema-and-reconciliation.md).

PR #460 corrigió el DTO getCashierState para leer openingCashAmount desde el campo físico; PR #462 eliminó la escritura del campo ausente operationDate y deriva el daykey de Jornada desde openedAt en Europe/Madrid. El campo físico operationDateHour permanece sin uso hasta aprobar su semántica. Ambas PR superaron CI: Layer 1 333/333, Layer 2 266/266, suite offline 688/688, contratos SDK, npm audit, ESLint y secret scanning SUCCESS.

El detalle de esquema, permisos, evidencia nativa, riesgos y límites de validación está en [reconciliación live de CajaActual y reservas](qa/2026-11-20-live-caja-schema-and-reconciliation.md). No se han ejecutado escrituras Wix, reintentos, cierres ni publicación. Writers fiscales/contables siguen deshabilitados; release **NO-GO**.


## Addendum vigente — 2026-11-20, HEAD main cfe1d0c

Este bloque prevalece sobre los snapshots y addenda TPV anteriores cuando exista contradicción.

### Repositorio y CI
- HEAD de `main`: `cfe1d0c37a9464cb63aea9d31873071eecb10d9f` (PR #499 fusionada).
- PR #496, #497, #498 y #499 integradas.
- CI post-merge para este SHA: Backend offline quality SUCCESS (run `44780145944`) y Gitleaks SUCCESS (run `44780145900`).
- Evidencia: Layer 1 28 suites/338 tests; Layer 2 19 suites/268 tests; total 75 suites/705 tests, 0 fallos; contratos Wix SDK, eCommerce Order Transactions y TPV Catalog, ESLint y Gitleaks PASS.
- Esta evidencia es offline/estática. No acredita Wix Runtime, Preview E2E, permisos efectivos ni despliegue.

### Contrato TPV Sandbox vigente
- Configuración canónica actual: `TPV_SANDBOX_RUNTIME_POLICY.ENABLED=true`, `ENVIRONMENT=SANDBOX`, `SYNTHETIC_ONLY=true`, pagos reales, escrituras fiscales, notificaciones y hardware deshabilitados; run ID `TPVSANDBOX-DEV-20261120-01`.
- No confundir esta implementación con la ruta histórica `TPV_QA_RUNTIME_POLICY` / WebMethods con sufijo QA. La documentación antigua de esa ruta se conserva como historial, no como contrato actual del TPV Sandbox.
- Los WebMethods actuales usan nombres neutros y exigen autorización backend y `assertTpvSandboxEnabled()`. Las etiquetas `environment` / `previewOnly` no prueban por sí solas qué data plane atiende la llamada.
- Las colecciones `SANDBOX_LOGICAL_*` son aliases lógicos, no colecciones físicas nuevas: el repositorio proyecta eventos en `MovimientosCaja`, estado de sesión/proyección en `CajaActual` y locks en `ControlOperativo`. Wix Apps no quedan aisladas por CMS Sandbox.
- PR #499 convirtió el bootstrap de caja y la comprobación de las seis identidades en read-only. La aplicación exige presemilla manual en CMS Sandbox; no crea singleton ni identidades automáticamente.

### Precondiciones sintéticas
- Caja: `_id=SINGLE_ITEM_ID`, `singletonKey=CAJA_PRINCIPAL`, `cashRegisterStatus=CERRADA`, `snapshotSource=TPV_SANDBOX_INITIALIZED`, `traceId=TPVSANDBOX-DEV-20261120-01`, `sequenceCounters` objeto y `conceptOperations.tpvSandbox.sandboxRunId` coincidente.
- Identidades: tres clientes y tres profesionales, IDs `SANDBOX-CUSTOMER-01..03` y `SANDBOX-STAFF-01..03`, `environment=SANDBOX`, `syntheticOnly=true`, `active=true`, `testRunId` igual al run ID y correos `@example.test`. No añadir PII ni referencias de CRM/Bookings/Members.
- Última lectura read-only documentada: `TpvSandboxIdentities=0` en ambos data planes. No se ha demostrado que la presemilla exista ni se ha ejecutado.

### Corrección adicional en revisión
La revisión del repositorio identificó que los locks de `ControlOperativo` deben validar el marcador de `CajaActual` antes de cualquier acceso. La rama `fix/tpv-sandbox-lock-preflight-and-docs` incorpora un helper read-only común, el preflight previo a los locks y una prueba contractual. Está pendiente de CI/merge; no atribuir esta corrección a `main` hasta su integración.

### Riesgos y límites no resueltos
- `SANDBOX_RUN_ID` es estático; no existe ciclo de vida/rotación de test-run validado.
- No se ha ejecutado Wix Preview E2E ni prueba negativa desde Published/direct WebMethod.
- No hay prueba de concurrencia/atomicidad en Wix Runtime para todos los escritores de `CajaActual` (H-01).
- No se ha ejecutado comparación de datos LIVE antes/después de una jornada TPV.
- Permisos efectivos por rol, efectos de automatizaciones y Wix Apps, reset sintético preproducción y rollback permanecen pendientes.
- Site Context observado: Draft. No se ha publicado ni acreditado la sincronización del código con Wix Editor.

### Decisión
CI offline de `main` en el SHA indicado: PASS. Integridad runtime, E2E y readiness global: NO VERIFICADOS. Publicación/despliegue: **NO-GO**. No tocar singleton LIVE, tres compensaciones `PENDING_RECOVERY`, pedidos #10032/#10033 ni ledgers. No sincronizar Sandbox→Online.


## Addendum posterior a PR #500 — 2026-11-20

PR #500 está fusionada en `main`: commit `6da7cdf0d815ad2e1833f5bd56b5950aff2afb3e`. La corrección consolida el helper `_ensureCajaActualForSandbox()` para validar existencia y marcador/run ID de `CajaActual` y ejecuta ese preflight antes de cualquier lectura/escritura de locks en `ControlOperativo`. Se añade una prueba contractual específica.

Validación pre-merge del HEAD `306816dff20d62e4ec3fda87e25fb050c155bb96`: Layer 1 28 suites/339 tests PASS; Layer 2 19 suites/268 tests PASS; suite completa 75 suites/706 tests PASS; contratos Wix SDK, eCommerce Order Transactions, TPV Catalog y ESLint PASS; Gitleaks PASS (runs `44781808680` y `44781808524`). CI post-merge para `6da7cdf0...` está en curso en los runs `44781982497` y `44781982392`; no declararlo aprobado hasta que ambos finalicen SUCCESS.

La corrección es una barrera de código por estado de datos; no identifica de forma contractual Preview frente a Published. No equivale a prueba de aislamiento runtime ni a aceptación E2E. Wix Preview, prueba negativa Published, concurrencia H-01, permisos efectivos, efectos externos, comparación LIVE antes/después y reset preproducción siguen pendientes. Sitio Wix observado en Draft. **NO-GO de publicación.**


---

## Addendum vigente — 2026-11-21 (PR #516 / relevo TPV)

Este addendum prevalece sobre el corte anterior del 20/11 para el estado del repositorio y del código TPV. El relevo operativo completo está en [SESSION-HANDOFF-2026-11-21.md](qa/SESSION-HANDOFF-2026-11-21.md).

### Repositorio y CI
- Baseline de código TPV en `main`: `6bf263502c58fa28bd13f7db848553c18b34a323`, merge de PR #516. HEAD de `main` al cierre documental: `10c15c56d2ff3e605d3cec3da0ca717b426bd280`, merge documental de PR #517.
- Backend offline quality gates: run `44860968238` SUCCESS.
- Secret scanning: run `44860968226` SUCCESS.
- Layer 1, Layer 2, regresión offline, contratos Wix SDK/eCommerce/TPV y ESLint finalizaron SUCCESS. No se añade recuento de tests porque no se extrajo de los logs.
- GitHub devuelve `protected=false` para `main`; branch protection/required checks no están acreditados.

### Contrato TPV integrado
- PR #516 alinea `#htmlTPV`, `src/public/tpvPageController.js` y WebMethods de `src/backend/tpv/`.
- El handshake ya no transporta flags estáticos de entorno; la configuración de contexto entrega EUR y Europe/Madrid.
- La identidad sintética de cliente usa `customerIdentityId`, no `customerContactId`.
- Bookings y Stores Catalog V3 se consultan para catálogo. No se invocan pagos/reembolsos reales, pedidos eCommerce, inventario, hardware ni emisión fiscal.
- Persistencia lógica: `CajaActual` (proyección), `MovimientosCaja` (ledger append-only) y `ControlOperativo` (locks/idempotencia). `SANDBOX_LOGICAL_*` no son colecciones físicas.
- Se retiró `assertTpvSandboxEnabled()`; se mantienen autorización backend y guardas por marcador/run ID de CajaActual. Estas guardas no demuestran por sí mismas el enrutamiento de Preview a CMS Sandbox.

### Datos y runtime
- La descripción de PR #516 recoge una lectura CMS read-only con CajaActual ABIERTA y `snapshotSource=TPV_FUNCTIONAL_TEST`, un movimiento de MovimientosCaja incompleto para el contrato TPV y cero filas en TpvSandboxIdentities.
- No reconstruir ni sobrescribir los registros existentes. La presemilla Sandbox y la verificación de las seis identidades siguen pendientes.
- Wix Preview E2E, prueba negativa Published, aislamiento Sandbox/Online, concurrencia runtime, comparación Online antes/después y SHA instalado en Editor no están acreditados.
- El informe smoke comunicado el 21/11 es PARCIAL; el texto disponible solo permite registrar efectivo 320 EUR, esperado 320 EUR, diferencia declarada 0 EUR, tarjeta 25 EUR y tickets 45 EUR. El informe completo y su conciliación por medios siguen pendientes.

### Decisión
CI offline de `main`: **PASS**. Integridad runtime, aislamiento, E2E y conciliación completa: **NO VERIFICADOS**. Publicación/despliegue: **NO-GO**. No tocar caja Online, ledgers históricos, compensaciones pendientes ni pedidos #10032/#10033. No sincronizar Sandbox → Online.


### Corrección de baseline Git — 2026-11-21
- PR #517 integró únicamente documentación mediante commit `10c15c56d2ff3e605d3cec3da0ca717b426bd280`; el baseline funcional TPV permanece en `6bf263502c58fa28bd13f7db848553c18b34a323` (PR #516).
- Checks pre-merge de PR #517: calidad offline y Gitleaks SUCCESS. Los workflows post-merge del commit documental deben consultarse por SHA antes de cerrar la evidencia CI final.


---

## Addendum vigente — auditoría Wix y plan maestro 2026-11-21

**HEAD main:** `e75aec5d28dcb8560fe75dbd04d5eae95957c3d8`.  
**Baseline funcional TPV:** PR #516, `6bf263502c58fa28bd13f7db848553c18b34a323`.  
**CI post-merge en HEAD:** backend offline quality gates run `44867151597` SUCCESS; secret scanning run `44867151605` SUCCESS.  
**Estado Wix:** Editor Classic, Velo habilitado, Published. Clasificación funcional QA por directriz del propietario.  
**Release:** NO-GO.

### Hallazgos actuales
- 42 colecciones CMS (13 NATIVE / 29 WIX_APP).
- Site Data Usage API: LIVE 203 elementos / 266.227 bytes; SANDBOX 109 / 206.023 bytes.
- CajaActual 1/1; MovimientosCaja 2/2; TpvSandboxIdentities 0/0; ControlOperativo 58/0; CitasF2 6/6; ServiciosCatalogo 95/95; MapaStaff 5/5.
- CajaActual LIVE ABIERTA sin marcador TPV Sandbox: source MOVIMIENTOS_CAJA_RECONCILIADOS, traceId 0, cash 320 EUR, expected 320 EUR, counted 0 EUR, difference 0 EUR.
- Dos movimientos LIVE (25 EUR CARD y 20 EUR CASH) sin contrato completo de ledger sintético. No modificarlos.
- Tres registros FISCAL_LEDGER/PENDING_RECOVERY en ControlOperativo, attempts=0; no reintentar.
- Ocho automatizaciones ACTIVE confirmadas de 159: siete preinstaladas con bloqueo de cambio de estado y una aplicación LLM programada `Configuración de control laboral`, aún sin inspección completa de tarea/efectos.
- Accessibility scan `aae3b411-81ff-4309-a767-6301164cb483` en curso; 121 descubiertas, 0 procesadas, 51 fallidas, 70 pendientes en el último polling.
- `main` devuelve `protected=false`; SHA instalado en Wix no acreditado.
- PR #495 sigue abierta/no mergeable; no integrar sin revisión del diff.

### Documentos rectores actualizados
- [Plan maestro de ejecución](MASTER-EXECUTION-PLAN.md).
- [Auditoría Wix read-only 2026-11-21](audits/2026-11-21-wix-site-readonly-baseline.md).
- [SSOT de entorno QA](qa/QA-ENVIRONMENT-SSOT.md).
- [Relevo de sesión](qa/SESSION-HANDOFF-2026-11-21.md).

### Decisión
Completar primero contención de efectos externos, conciliación read-only, inspección de Sandbox desde Editor y garantías compartidas de CajaActual. Solo entonces ejecutar TPV E2E. No ejecutar operaciones económicas, notificaciones ni writers fiscales/contables/laborales reales. No publicar.


### SEO y accesibilidad — resultado final del scan
- Google Search Console Get Site Readiness: `READY`; no se modificó la configuración SEO. Esto no acredita indexación o ranking.
- Scan full-site `aae3b411-81ff-4309-a767-6301164cb483`: PARTIALLY_COMPLETED, 121/121 páginas fallidas, 0 procesadas, código `ACCESSIBILITY_SCAN_FAILURE_CODE_ANALYSIS_FAILED`, mensaje `This page could not be checked.`, 0 findings. Las páginas enumeradas usan el host wixsite.com. Diagnosticar origen antes de volver a escanear; no declarar WCAG aprobado.
