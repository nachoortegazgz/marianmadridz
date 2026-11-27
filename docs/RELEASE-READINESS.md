## GOBIERNO DEL PROYECTO — RESET DE DIRECTRICES HUMANAS (2026-11-27)

**Prevalecen los objetivos funcionales y de negocio del proyecto.** Las decisiones, restricciones, procedimientos, convenciones y documentos redactados anteriormente por personas son material editable, no una autoridad autónoma ni un motivo suficiente para bloquear desarrollo, pruebas o correcciones. Este apartado sustituye cualquier directriz anterior incompatible.

Reglas de trabajo:
- Resolver cada bloqueo según el objetivo que impide alcanzar; retirar la restricción mínima necesaria y documentar el cambio, sin perpetuar bloqueos por decisiones históricas.
- No existe un objetivo independiente de conservar datos de prueba, históricos sintéticos, estructuras, colecciones, documentos o código heredado. Pueden corregirse, migrarse, resetearse o eliminarse cuando sea necesario para cumplir los objetivos y las pruebas, después de comprobar el impacto técnico.
- Los datos sintéticos creados para QA son reutilizables y mutables. Deben poder crearse, actualizarse y eliminarse de forma controlada para repetir escenarios; no se exige conservarlos como evidencia permanente.
- No se impondrá append-only, prohibición de borrado, congelación de datos ni política de retención por una directriz humana aislada. Se aplicarán únicamente cuando una obligación legal vigente, un contrato externo real o una propiedad técnica necesaria para el objetivo lo exija y exista evidencia concreta.
- No se bloquearán pruebas funcionales por la ausencia de una configuración de producción si la prueba puede ejecutarse con fixtures, simuladores o datos sintéticos en la misma ruta de negocio.
- Las pasarelas, terminales, notificaciones, remisiones fiscales y demás efectos externos se simularán en QA. Ninguna prueba debe generar cobros, comunicaciones a clientes o declaraciones reales por accidente.
- Los requisitos legales vigentes y los contratos técnicos de Wix/proveedores son restricciones objetivas del sistema, no directrices humanas arbitrarias. Deben verificarse y aplicarse al flujo real correspondiente, sin extenderlos a pruebas sintéticas cuando no proceda.
- Una restricción temporal debe tener alcance, condición de salida y fecha/criterio de retirada. No se aceptan bloqueos indefinidos del tipo “pendiente humano” si existe una alternativa técnica segura que permita avanzar.
- La evidencia de pruebas es reproducible y regenerable. El estado de validación debe distinguir pruebas unitarias, integración, Wix Preview/Runtime y producción; no se exige preservar registros operativos para declarar una prueba superada.

**Criterio de decisión:** objetivo del proyecto → requisito legal/contrato oficial verificable → comportamiento técnico demostrado → solución mínima. La documentación humana previa, los estados heredados y las decisiones históricas se revisan a la luz de este criterio y pueden ser sustituidos.

---

# RELEASE-READINESS — 2026-11-25

Criterio vinculante: **NO-GO comercial** mientras los gates P0/P1 no dispongan de evidencia reproducible. El propietario autoriza pruebas online en desarrollo sobre el sitio y colecciones actuales, con un único código y formato de registros. recordNature se deriva en backend de recordTimestamp UTC frente a productionActivationAt UTC. Los datos sintéticos podrán resetearse antes del corte; tras el corte los registros reales son inmutables. CI offline no sustituye Wix Runtime, aceptación de hardware, conciliación ni revisión fiscal. No se habilitan cobros reales ni remisión AEAT durante QA.

## P0

| Issue | Gate de aceptación | Evidencia actual |
|---|---|---|
| #416 Caja/POS | Contrato de sesión/venta, conciliación/recovery trazable y pruebas online sobre datos sintéticos; reset controlado antes del corte real | PENDIENTE. PR #611 integra preparación de venta read-only y PR #612 contrato de preescritura V1 (una tasa, un tender físico, total exacto). El writer canónico de `MovimientosCaja` sigue sin implementarse/configurarse; fiscal singleton, pago externo, idempotencia y aceptación Runtime pendientes. |
| #415/#209 Fiscal/SIF | Singleton fiscal único y válido; writer append-only; revisión legal y flags false hasta autorización | PENDIENTE. Query CMS `MapaStaff` por `recordType=CONFIG_SISTEMA` devolvió 0 registros (2026-11-25); `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`. |
| #525 CajaActual | Una sola sesión bajo llamadas concurrentes | PENDIENTE. CAS integrado en código; ninguna prueba Runtime de concurrencia ejecutada. |
| #434 MovimientosCaja | M1–M3/M5 código; M4 Activity Logs/backups y discrepancia histórica explicada | PENDIENTE. No alterar ni borrar registros reales tras productionActivationAt; durante desarrollo se permite mantenimiento auditado de datos sintéticos. |
| #520 Automations | Estado actual de automatizaciones y ausencia de efectos no autorizados acreditados | PENDIENTE. Último read-back documentado: siete PREINSTALLED ACTIVE y app laboral INACTIVE; requiere relectura. |

## P1

| Issue | Gate de aceptación | Evidencia actual |
|---|---|---|
| #523/#522 Bookings | Reconciliar CitasF2 con bookings nativos y opciones de pago, sin inferir estados | PENDIENTE |
| #210 Main | Ruleset y checks requeridos acreditados | PENDIENTE |
| #435 TPV QA | Preparación autoritativa, permisos, idempotencia y persistencia validados en Wix Runtime | PR #611 preparación Wix read-only + PR #612 contrato de preescritura V1 integrados; CI offline PASS; writer, persistencia real y Wix Preview/Runtime pendientes |
| P1.1 Apertura de sesión | BLOQUEADA PARA QA SINTÉTICO | `abrirSesionCaja()` actualiza `CajaActual` y crea/recupera `TPV-SESSION-YYYYMMDD`; el writer no deriva/persiste `recordNature` desde `recordTimestamp`/`productionActivationAt`. No se abrió sesión para evitar contaminar el ledger con naturaleza ambigua. |
| P1.2 Cierre operativo de sesión | PASS estático; RUNTIME BLOQUEADO POR PRECONDICIÓN | TinyFish autenticó al administrador y localizó `/tpv` (run `d10ece85-5528-409d-9372-a9315c07e908`), pero no existe sesión sintética clasificable con el writer actual. No invocado. Además, el read-back del plan PR #629 consulta `sessionId` en raíz de `MovimientosCaja`; el repositorio lo almacena en `payloadFiscal.sessionId`, por lo que ese criterio debe corregirse antes de usarlo. |
| TPV-01 Núcleo único y persistencia canónica | COMPLETADO EN PR PROPUESTA | Runtime de prueba (3 módulos) eliminado; `tpvHistoricalCompat.js` conserva solo lectura/validación histórica; writes `TPV_TEST_RUN`/`TPV_TEST_SESSION_LOCK` denegados; clasificadores SANDBOX_LOGICAL/SIMULATED conservados solo para compatibilidad/denegación histórica. CI offline PR #627 PASS (80 suites/759 tests); Wix Runtime no ejecutado. |
| Fase 2 Integración Wix Apps | VERIFICADA ESTÁTICAMENTE; 1 FIX | Bookings: `resourceId` separado de `staffMemberId`, sesión `memberId` comparada con `associatedWixIdentity`; Catalog V3: variante/precio correctos, disponibilidad `inventoryStatus` (sin stock por ubicación); Data: hooks beforeInsert/beforeUpdate con invariantes de negocio; Payments legacy: 0 referencias activas. Idempotencia: venta/movimiento/Ticket X deterministas; cierre corregido a clave `sessionId-CIERRE`. CI PR #628 run `45926525032` PASS (80 suites/759 tests, 0 fallos); Wix Runtime no ejecutado. Ubicación física única detectada, default no acreditado. |
| P1.2 Estado global de cierre | PARCIAL | El cierre operativo está habilitado; la emisión de Ticket Z real sigue bloqueada por Contract C. |
| P1.2-X Ticket X | PASS estático; RUNTIME BLOQUEADO POR PRECONDICIÓN | Ruta `/tpv` y administrador autenticados; no hay sesión sintética segura porque falta clasificación temporal `recordNature`. No invocado; sin JSON runtime. |
| P1.2-E Exportación movimientos | PASS estático; RUNTIME BLOQUEADO POR PRECONDICIÓN | Ruta `/tpv` y administrador autenticados; no hay sesión sintética segura porque falta clasificación temporal `recordNature`. No invocado; JSON/CSV y paginación multi-page sin evidencia runtime. |
| P1.3 Movimiento de caja | PARCIAL | `tpvMovimientos.web.js:70-127`; `tpvRepository.js:44-45,744-810`; `data.js:392-455`; `validation.js:246-280`: guard physical y hook físico habilitados con cadena hash; CI offline PASS, runtime no ejecutado |
| P1.4 Registro de venta | PARCIAL | Catalog V3/impuestos backend, idempotencia y persistencia de intención `PENDING_PAYMENT`; Draft Order externo desactivado. Intenciones sintéticas pendientes mutables/eliminables bajo predicate exacto; sin cobro ni movimiento físico; runtime no probado |
| P1.5 Devolución | BLOQUEADO | `tpvDevoluciones.web.js:43-86`: valida DTO y devuelve `TPV_REFUND_PROVIDER_NOT_CONFIGURED`; no persiste; `procesarDevolucion` ausente |
| P1.6 Cierre Z | PARCIAL | `tpvCierres.web.js:66-253`: guard physical y persistencia física separados del ledger fiscal; Contract C mantiene cierres reales bloqueados; CI offline PASS, runtime no probado |
| P1.7 Operador TPV | PENDIENTE | `security.js:163-187,538-545`; `tpvOperatorContext.js:1-20`; gates de autorización en código, prueba efectiva pendiente |

## Bloques de evidencia Runtime

| ID | Prueba | Criterio PASS |
|---|---|---|
| P1 | Concurrencia CajaActual | Una sesión creada; segundo intento rechazado o replay idéntico |
| P2 | Identidad Bookings | memberId vinculado autorizado; identidad distinta denegada |
| P3 | Idempotencia TPV | Mismo ID, un solo registro, replay sin segundo efecto |
| P4 | Hook beforeInsert | Sobre válido normalizado; sobres sin siteId o con externalSideEffects rechazados |
| F5 | Append-only HistoricoCierresZ | update rechazado y lectura strong sin cambios |
| F1 | CONFIG_SISTEMA_FISCAL | Singleton único, campos completos, taxId válido; writers permanecen false |

Procedimientos históricos: [RUNTIME-EVIDENCE-CHECKLIST.md](archive/2026-11/RUNTIME-EVIDENCE-CHECKLIST.md). Ninguno de estos bloques se declara ejecutado en Wix Preview/Runtime a 2026-11-25.

## Evidencia CI de código integrado

| PR | Merge commit | CI offline | Secret scan |
|---|---|---|---|
| #600 | `7ffca8c4ceeea2af9be5bf0a697af15283ab214b` | run 45443104056 PASS | run 45443104106 PASS |
| #601 | `46a7e01e9c6bb328405da12a8423b735f934866f` | run 45448196443 PASS | run 45448196393 PASS |
| #603 | `f42ef7fb50925be7bfece15ff5391383cd33ee84` | run 45509432988 PASS (80 suites/747 tests) | run 45509433003 PASS |
| #604 | `0acb60df65bba1545d3a57cfa261d1de518eb39d` | run 45511826479 PASS (81 suites/750 tests) | run 45511827103 PASS |
| #611 | `62fdcb7b560f7eab16f1188ecf9227ae7b45d5cf` | run 45555933654 PASS sobre commit de código `b3ed704fa6a7a37ddba4975e4c1136c681b4630f` | run 45555933681 PASS |
| #612 | `239fd8207d228bde56e9908055166980a87d4989` | run 45592833890 PASS sobre árbol `632c85edbd765a291abe7b411fe08af75da5e571` | run 45592834040 PASS |

PR #612 incorpora cambios de código sobre el árbol probado `632c85edbd765a291abe7b411fe08af75da5e571`; su merge commit conserva ese mismo árbol. PR #613 contiene solo consolidación documental. Wix Preview/Runtime continúa pendiente.

## TPV — estado de preparación

- Backend resuelve productos/variantes Stores Catalog V3 y servicios Bookings de precio fijo; no acepta precios/totales del navegador.
- Wix `taxSettings.getTaxSettings` y `taxCalculation.calculateTax` calculan impuestos en backend. Configuración leída: `taxIncludedInItemPrices=false`.
- Datos de solo lectura: 24 productos, 70 servicios, 30 registros de inventario con cantidad rastreada en ubicación virtual online; 0 registros en ubicación física del salón.
- PR #612 formaliza la preescritura V1: una tasa fiscal verificable, un solo medio físico (EFECTIVO/TARJETA) y total aplicado igual al total Wix. Bizum, split tender, bonos y tarjetas regalo no están admitidos por V1. `registrarVenta()` recalcula catálogo e impuestos en backend.
- La preparación y el contrato V1 no escriben ledger, stock, pedidos ni pagos. `saleReady=false`, `paymentVerified=false`, `persisted=false`.
- El precio final mostrado al consumidor no está verificado; no autorizar venta mientras no se garantice precio completo con impuestos incluidos conforme al RDL 1/2007.
- No se ha validado hardware EPSON/cajón ni confirmación manual del lector bancario externo.

## Normativa

El [RDL 15/2025 (BOE-A-2025-24446)](https://www.boe.es/eli/es/rdl/2025/12/02/15) fija los plazos de adaptación RRSIF indicados en su art. 3.1. El [RDL 1/2007](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555), arts. 20.1.c y 60.2.c, exige que el precio informado al consumidor sea el precio final completo, incluidos impuestos. Confirmar siempre la norma consolidada vigente antes de tomar decisiones fiscales.

**Estado operativo: NO-GO.** Read-back CMS de solo lectura 2026-11-25; Wix Preview/Runtime no ejecutado. No se han modificado datos CMS, configuración fiscal, secretos, ledgers, pedidos, pagos ni inventario.


## Wix Preview — descubrimiento TPV (2026-11-27)

- TinyFish run `d10ece85-5528-409d-9372-a9315c07e908`: administrador autenticado; sitio y página `/tpv` identificados; código `src/pages/TPV.yl5th.js`; UI sin sesión abierta. Solo inspección, sin mutaciones.
- No ejecutar `abrirSesionCaja()` hasta implementar/verificar la clasificación única `recordNature = recordTimestamp < productionActivationAt ? SYNTHETIC : REAL` y confirmar el campo/corte CMS. La implementación actual no persiste esos metadatos; apertura modifica la proyección `CajaActual`.
- Gates runtime ejecutados: 0/3. No se generó JSON porque no se abrió una sesión de naturaleza acreditada. La paginación multi-page sigue sin ejercitar.
- Corrección requerida al plan PR #629: el read-back de `MovimientosCaja` debe filtrar por `movementType === "CIERRE"` y `payloadFiscal.sessionId`, no por `sessionId` raíz (según `_buildTpvLedgerItem()`).



## Auditoría profunda de código y continuidad online — 2026-11-27

| Área | Verificación | Estado |
|---|---|---|
| SDK/Bookings/Catalog/eCommerce/CRM | SDK npm actual + API Bookings V2, Catalog V3, Cart V2, Contacts V5; Wix backend events/hooks/web modules usan convenciones Velo requeridas | PASS estático; runtime pendiente |
| API Wix deprecated | No halladas familias activas `wix-bookings-backend`, `wix-stores-backend`, `wix-pay-backend`, `wix-ecom-backend`, `wix-bookings.v1`, `@wix/api-client` | PASS en búsquedas de código |
| Dependencias SDK | npm lock sincronizado; `wix.lock` difiere en `@wix/crm` y `@wix/stores`; paquetes Wix por detrás de versiones publicadas | PENDIENTE reconciliar/actualizar con pruebas |
| Toolchain | ESLint 8.25.0 EOL; npm ci advierte inflight, rimraf 3, glob 7 y @humanwhocodes | FAIL P2 mantenimiento |
| Reservas online | Bookings V2 + Cart V2; webhook PAID necesita ledger fiscal bloqueado | PENDIENTE Contract A/C; riesgo P1 |
| Ledger fiscal/contable | `LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false` | BLOQUEADO por política |
| Jornada | `WRITES_ENABLED=false`, `ADJUSTMENTS_ENABLED=false` | BLOQUEADO por política |
| TPV | Preparación devuelve blockers; registro genera draft/PENDING_PAYMENT, no cobro ni movimiento físico | NO-GO comercial |
| Paquetes gestoría | Preview existe; creación, historial, descarga y envío devuelven stub de storage retirado | NO IMPLEMENTADO |
| Cron | 15 jobs declarados; paridad estática PASS | Runtime no acreditado |
| Navegación pública | Home y páginas principales enlazadas; `/reserva-online` lenta/DOM vacío; `/blank` vacía; redes apuntan a Wix | PARCIAL |
| Runtime Wix | CI offline PASS 80 suites/759 tests; no JSON runtime TPV ni Preview E2E completo | PENDIENTE |

- CI main: run `45937204664` PASS (80 suites/759 tests, SDK contracts, ESLint); secret scan `45937204680` PASS. No confundir con runtime Wix.
- No certificar online end-to-end mientras el webhook de pago no pueda persistir y reconciliar ledger, no se habiliten/validen fichajes, no exista salida documental y no se ejecute Preview con datos sintéticos clasificados.
- Actualización de ESLint y dependencias Wix debe hacerse en PR aislada, reconciliando `wix.lock` con el gestor Wix y verificando import/exports de todos los SDK, suites y Preview antes de merge.

- TPV writer gap: `productionActivationAt`/`recordNature` remains specified in docs but not implemented in backend source; `registrarVenta()` mantiene `sourceType=SYNTHETIC` y persiste solo una intención `PENDING_PAYMENT` con pagos `confirmed=false`. No es venta cobrada ni movimiento físico. La creación de Draft Orders Wix se ha eliminado de esta ruta QA: `QA_EXTERNAL_SIDE_EFFECTS_DISABLED`, paso `SKIPPED`. El contrato de `TransaccionesTPV` queda definido como intención comercial, separado del ledger físico `MovimientosCaja`.


## Avance de implementación — 2026-11-27

- QA de venta TPV: no crea Draft Orders, pedidos ni pagos en Wix. Mantiene persistencia comercial sintética pendiente y auditoría idempotente.
- Test de contrato actualizado para fallar si reaparecen `draftOrders`, `createDraftOrder` o `auth.elevate` en el WebMethod de ventas.
- Estado: cambio preparado en rama; CI pendiente; Wix Preview/Runtime pendiente. No se han ejecutado operaciones sobre CMS real.


## Avance — limpieza/repetición de QA comercial TPV (2026-11-27)

- `TransaccionesTPV` queda como intención comercial, no ledger. Se permite modificar/eliminar únicamente registros `SYNTHETIC` en `PENDING_PAYMENT`, sin `orderId`, con `requiresReconciliation=true` y sin ningún pago confirmado.
- La política se aplica en DAL y hooks Wix; la eliminación incluye filtro de condición por `sourceType`, `status` y `requestFingerprint`.
- Los ledgers físicos/fiscales/contables/laborales no cambian de política. No se ejecutó ninguna mutación CMS real.
- CI pendiente sobre PR; Preview/Runtime pendiente.
