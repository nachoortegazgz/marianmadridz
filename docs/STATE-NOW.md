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

## CAPA 3 — EXPORTACIÓN PARA REGISTRO EXTERNO — 2026-11-27

PR #641 añade `prepareExternalRegistryPackage` (Admin-only, autorización backend y rate limit), contrato trimestral JSON versionado, checksum SHA-256, minimización de campos y lectura fiscal estricta `recordNature=REAL`. Solo prepara el paquete en memoria; no escribe CMS ni envía a SharePoint/Power Automate. La configuración fiscal legal y el corte de activación siguen ausentes, por lo que la exportación real falla cerrada. No equivale a runtime online ni a integración externa conectada. Detalle: [auditoría Capa 3](audits/2026-11-27-capa3-export-preparation.md).

## AUDITORÍA WIX / TPV / CLI — 2026-11-27

**Auditoría actual:** [2026-11-27-wix-site-and-tpv-cli-audit.md](audits/2026-11-27-wix-site-and-tpv-cli-audit.md). `main` integra PR #638, #640 y #641. CI PR #640 run `45952964585`: 81 suites / 764 tests / 0 fallos; CI PR #641 run `45952999105`: 80 suites / 762 tests / 0 fallos. Wix Site Context read-back 05:37: Draft, Editor clásico, Velo activo, `published=false`; 9 páginas estáticas y 2 dinámicas. TPV `/blank` (ID `yl5th`). CMS read-back: HistoricoCierresZ=1, CajaActual=1 ABIERTA, MovimientosCaja=5, TransaccionesTPV=0, ControlOperativo=78. Los esquemas CMS recibieron campos opcionales de clasificación; no se mutaron registros.

**TPV:** el HTML sigue en MODO CONSULTA y `saleReady=false` por gates fiscales, de pago y presentación de precios. PR #640 implementa clasificación backend UTC (`recordTimestamp`/`productionActivationAt`/`recordNature`), metadatos de registros y alinea `registrarVenta()` con los blockers de `validarVentaBorrador()`. Sin configuración/corte de producción, los registros se clasifican `SYNTHETIC`. `TransaccionesTPV` queda como intención comercial no contable; `MovimientosCaja` es el ledger físico canónico. No hay venta, cobro ni runtime Wix certificados.

**Wix CLI:** existe workflow manual `wix-tpv-preview.yml` que crea Preview no publicador y ejecuta smoke read-only. No se pudo disparar desde esta integración; el smoke no llama WebMethods ni prueba interacciones. No se ha ejecutado Preview ni Wix Runtime. No hay escrituras CMS ni publicación en esta auditoría.

---

# STATE-NOW — 2026-11-25

**Base de código TPV:** PR #612 squash merge `239fd8207d228bde56e9908055166980a87d4989` (árbol probado `632c85edbd765a291abe7b411fe08af75da5e571`) · **Documentación de flujo único:** integrada en la historia de `main` (commit `19378e00f6568afaf68df6550d7fbb7844e221ab`) · **Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · **Site Context read-back 2026-11-25 17:53 CET:** Draft, Velo habilitado, Editor, Stores Catalog V3, Bookings, Payments e Invoices V1; Preview/Runtime no ejecutado.
**Release:** **NO-GO** para ventas reales, pagos, devoluciones o activación de writers fiscales.
**Autoridad:** código integrado en `main` + CI ejecutada sobre el commit indicado + lectura Wix fechada. La fusión GitHub no acredita sincronización Git-Wix ni validación Runtime.

## Decisión arquitectónica nueva — TPV de flujo único (2026-11-25)

El propietario establece un único código, contrato, validación y writer para desarrollo y producción. Los registros comparten formato y recordNature se deriva en backend comparando recordTimestamp UTC con productionActivationAt UTC: anteriores = SYNTHETIC; iguales o posteriores = REAL. La marca es metadato de trazabilidad, no selector de motor. El propietario autoriza pruebas online completas en el sitio/colecciones actuales durante desarrollo; los registros sintéticos podrán modificarse y se resetearán mediante procedimiento controlado antes de iniciar actividad real. El estado Published/Draft de Wix no determina el corte comercial. Ver [TPV-UNIFIED-FLOW.md](TPV-UNIFIED-FLOW.md).

**TPV-01 unificado en la rama de trabajo:** el controlador usa WebMethods operativos; `tpvTestRuntime.web.js`, `tpvTestRuntimeRepository.js` y `tpvTestRuntimeCore.js` retirados. La compatibilidad histórica `TPV_TEST_RUN` queda en `tpvHistoricalCompat.js` para lectura/validación; las escrituras legacy quedan denegadas.

**Fase 2 Wix Apps (2026-11-27):** Bookings y Data hooks alineados con documentación oficial; Catalog V3 usa variante/precio correctos y disponibilidad por defecto, sin consulta de cantidades por ubicación. APIs Payments Create Transaction/Create Card Token sin referencias activas en `src/`.
**Idempotencia:** venta, movimiento, cierre y Ticket X usan claves/IDs deterministas; cierre corregido a `sessionId-CIERRE` para impedir duplicados si cambia el messageId. Ubicación física única detectada; default location no acreditado por la respuesta de Locations.
**Validación:** CI offline PR #628 PASS (80 suites/759 tests, 0 fallos; run `45926525032`); Wix Runtime no ejecutado. Inventario por ubicación concreta requiere confirmar la ubicación predeterminada si se desea mostrar cantidades exactas.

## 1. Estado ejecutivo

- PR #611, `feat(tpv-authoritative-sale-preparation-v2-20261125`, fusionada en `main` mediante `62fdcb7b560f7eab16f1188ecf9227ae7b45d5cf`.
- La preparación de venta TPV es autoritativa y read-only: backend resuelve catálogo y calcula impuestos mediante APIs Wix; el navegador no determina precios ni totales.
- `saleReady=false`, `paymentVerified=false`, `persisted=false`. No hay writer operativo TPV habilitado.
- No se creó `TransaccionesTPV`, Draft Order, pedido, movimiento, pago ni devolución. No se alteraron CMS, inventario, configuración fiscal, precios ni secretos.
- Los registros históricos creados por el runtime anterior permanecen preservados y fuera del nuevo contrato operativo; la ruta única aún no está conectada a persistencia.

## 2. P0 — bloqueos abiertos

| Issue | Estado verificado/documentado | Gate pendiente |
|---|---|---|
| #416 Caja/POS | Persistencia TPV sigue cerrada; `tpvRepository.insertTpvEvent()` rechaza por guard; hook `MovimientosCaja_beforeInsert` rechaza TPV_*; builder no completa todos los campos fiscales obligatorios | Contrato writer append-only canónico, conciliación y aceptación Runtime |
| #415/#209 Fiscal/SIF | Consulta Wix CMS `MapaStaff` por `recordType=CONFIG_SISTEMA` devolvió 0 registros el 2026-11-25; `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false` | Configuración fiscal legal verificada y aceptación fiscal; no sortear flags/hooks |
| #525 CajaActual | CAS integrado en código; no hay prueba Runtime concurrente acreditada | Una sola sesión bajo concurrencia en Wix Runtime |
| #434 MovimientosCaja | Append-only reforzado; discrepancia histórica y M4 (Activity Logs/backups) pendientes | Conciliación no destructiva y evidencia de auditoría |
| #520 Automations | Último read-back documentado: siete PREINSTALLED ACTIVE; app laboral INACTIVE | Revisión actual de estados y efectos externos |

## 3. P1 — pendientes

| Issue | Estado | Gate pendiente |
|---|---|---|
| #523/#522 Bookings/canales | Código integrado; reconciliación nativa y aceptación Runtime pendientes | Reconciliar proyecciones, bookings y opciones de pago sin inferir estados |
| #210 Protección de main | Ruleset/checks obligatorios no acreditados | Verificación de protección y CI requerida |
| #435 TPV QA | PR #611 preparación Wix read-only + PR #612 contrato de preescritura V1 integrados; CI offline PASS | Writer canónico, persistencia, idempotencia durable y aceptación en Wix Preview/Runtime |

## 4. TPV — preparación Wix y contrato de preescritura V1 (PR #611 + PR #612)

### Código integrado
- `src/backend/tpv/tpvSalePreparationCore.js`: normalización estricta, cantidades enteras, importes en céntimos y reconciliación fiscal por línea.
- `src/backend/tpv/tpvSalePreparation.js`: resolución Catalog V3/Bookings, profesional autorizado, tax settings y `taxCalculation.calculateTax`.
- `src/backend/tpv/tpvVentas.web.js`: `validarVentaBorrador` ignora precios/impuestos/totales del cliente y devuelve importes calculados en backend.
- `src/public/tpvPageController.js` y widget TPV: solicitan cotización backend, descartan respuestas obsoletas y bloquean pago/registro si no se cumplen todos los gates.
- Descuentos no configurados, líneas PERSONALIZADA y BONO/TARJETA_REGALO sin validación de saldo quedan bloqueados.
- El gate de inventario solo afecta a líneas PRODUCTO; los servicios no requieren stock.

### Contrato de preescritura V1 (PR #612, integrado)
- `src/backend/tpv/tpvWriteV1Contract.js` aplica una única tasa impositiva verificable por venta; las ventas multitarifa se bloquean sin asignar un tipo representativo.
- V1 admite un único medio de pago físico: EFECTIVO o TARJETA. Bizum no forma parte de `SUPPORTED_WRITE_V1_PAYMENT_METHODS`; split tender, bonos, tarjetas regalo y OTROS no están habilitados. El importe aplicado tras descontar el cambio debe igualar exactamente el total calculado por Wix.
- `registrarVenta()` vuelve a resolver catálogo e impuestos en backend antes de devolver cualquier resultado; el navegador no aporta importes autoritativos.
- El widget presenta los bloqueos de tasa, medio de pago y conciliación de importes.
- `writeContractV1.eligible=true` no equivale a `saleReady=true`, pago confirmado ni persistencia.

### Lectura Wix de solo lectura (2026-11-25)
- 24 productos Stores y 70 servicios Bookings de precio fijo EUR.
- Tax groups predeterminados Productos/Servicios; cálculo fiscal ES al 21% en muestras verificadas.
- `taxIncludedInItemPrices=false`: el precio de catálogo no incluye IVA. El código soporta ambos modos, pero la presentación pública del precio final al consumidor no está verificada.
- 30 registros de inventario con seguimiento de cantidad, todos en ubicación virtual online. La ubicación física del salón existe, pero tiene 0 registros de inventario asignados. No transferir ni inicializar stock sin recuento físico.
- La ubicación física de Stores y el Wix Location ID son identificadores distintos; no intercambiarlos.

### Bloqueos funcionales y legales
- `MovimientosCaja` es ledger físico de cajón; `TransaccionesTPV` es ledger comercial; `ControlOperativo` es auditoría. Son hechos distintos y colecciones separadas.
- El guard de configuración fiscal permanece fail-closed exclusivamente para escrituras fiscales; los writers físicos y comerciales usan sus propias validaciones, permisos, idempotencia y persistencia.
- No se ha acreditado confirmación manual del lector bancario externo, evidencia de justificante, pagos mixtos ni conciliación de caja en Runtime.
- No se ha validado inventario por variante en la ubicación física.
- No se ha verificado que los precios mostrados al consumidor sean finales con impuestos incluidos, exigencia de RDL 1/2007 arts. 20.1.c y 60.2.c.
- No existe configuración fiscal singleton verificada; flags fiscales permanecen false.
- No hay prueba Wix Preview/Runtime ni hardware Epson/cajón ejecutada.

## 5. CI y evidencia de integración

| Elemento | Evidencia |
|---|---|
| PR #611 | MERGED; merge commit `62fdcb7b560f7eab16f1188ecf9227ae7b45d5cf` |
| PR #612 | MERGED; merge commit `239fd8207d228bde56e9908055166980a87d4989`; árbol `632c85edbd765a291abe7b411fe08af75da5e571` |
| Commit de código probado | `b3ed704fa6a7a37ddba4975e4c1136c681b4630f` |
| Backend offline quality gates | Run `45555933654` PASS: package/lock, dependencias, npm audit, Layer 1, Layer 2, suite completa, SDK Wix, ESLint |
| Secret scan | PR #611 Gitleaks run `45555933681` PASS; PR #612 Gitleaks run `45592834040` PASS |
| Commits posteriores a CI | Solo actualizaciones documentales/enlaces BOE y evidencia; no alteraron código |
| Backend offline quality gates PR #612 | Run `45592833890` PASS: Layer 1, Layer 2, suite completa, SDK Wix, ESLint |
| Wix Preview/Runtime | NO EJECUTADO |

La evidencia CI valida el commit de código indicado; no debe atribuirse automáticamente a pruebas Runtime ni a un despliegue Wix.

## 6. Normativa y calendario

- [RDL 1/2007](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555), arts. 20.1.c y 60.2.c: precio final completo, incluidos impuestos, en la información al consumidor.
- [RDL 15/2025](https://www.boe.es/eli/es/rdl/2025/12/02/15): calendario de adaptación RRSIF según art. 3.1.a y resto de contribuyentes. Confirmar siempre el texto BOE vigente antes de fijar decisiones fiscales.
- La existencia de código fiscal o una configuración técnica no acredita conformidad legal ni certificación.

## 7. Decisiones e invariantes

- Los ledgers son independientes: `MovimientosCaja` físico, `TransaccionesTPV` comercial, `eventLog` fiscal y `ControlOperativo` auditoría.
- `MovimientosCaja`, `LibroAsientosContablesDetalle`, `RegistrosHorariosStaff` y `HistoricoCierresZ` mantienen append-only cuando contienen movimientos físicos, contables, laborales o cierres fiscales. `TransaccionesTPV` no es un ledger: sus intenciones sintéticas `PENDING_PAYMENT` sin pedido y con pagos no confirmados pueden actualizarse o eliminarse para repetir QA; cualquier registro que no cumpla exactamente esa condición queda protegido.
- Wix CMS es SSOT transaccional; SharePoint solo custodia evidencia.
- El frontend no contiene lógica de negocio ni autoridad de permisos.
- No mutar inventario real sin recuento físico; no alterar tax settings/precios para hacer pasar pruebas. Los datos sintéticos de desarrollo pueden prepararse/resetearse antes del corte oficial.
- No activar pagos, writers fiscales, pedidos, devoluciones o automatizaciones externas durante QA.
- No eliminar documentos históricos: conservar evidencia y mantener solo los documentos canónicos como entrada operativa.

## 8. Siguiente secuencia técnica

1. Verificar read-only del singleton fiscal y cerrar su contrato de campos con asesoría competente; no crear datos legales por defecto.
2. Cerrar contrato de sesión/caja y confirmación manual del lector, incluyendo referencia y evidencia del justificante.
3. Completar y probar el registro físico de apertura en `MovimientosCaja`; mantener su cadena hash/sequence y no mezclarlo con venta comercial ni ledger fiscal.
4. Resolver precio final al consumidor y recuento/asignación de inventario físico por variante.
5. Ejecutar pruebas online/Runtime de concurrencia, idempotencia, permisos, caja, movimientos, devoluciones y cierres sobre las colecciones actuales; verificar destino efectivo de escritura y reset sintético preproducción. Hardware y efectos externos permanecen separados.

**Decisión:** NO-GO. No desplegar ni habilitar ventas reales hasta cerrar todos los gates y documentar rollback.



## 9. Historial y documentación sustituida

Las implementaciones de PR #615/#616 quedan retiradas del runtime activo; sus registros históricos se conservan sin migración ni borrado. La compatibilidad de lectura se mantiene en `tpvHistoricalCompat.js`; no se ha consultado ni modificado CMS.

La decisión de flujo único y la secuencia ejecutable están en [TPV-UNIFIED-FLOW.md](TPV-UNIFIED-FLOW.md) y [Hito TPV-01](TPV-MILESTONE-01-UNIFIED-CORE.md). **NO-GO** hasta superar sus criterios y los gates fiscales/comerciales de [RELEASE-READINESS.md](RELEASE-READINESS.md).
## Prioridad 1 TPV — 2026-11-25
- Guard fiscal limitado a escrituras fiscales; MovimientosCaja físico, TransaccionesTPV comercial y ControlOperativo auditoría separados. Colección TransaccionesTPV creada en CMS con permisos PRIVILEGED (read/insert/update/remove).
- registrarVenta implementado como persistencia idempotente PENDING_PAYMENT, sin cobro; CI offline PASS (80 suites/764 tests), runtime Wix no ejecutado, por lo que no se declara escritura verificada.

- cerrarSesionCaja + generarTicketX + exportarMovimientos implementados en backend, con autorización ADMIN y persistencia operativa/auditoría no fiscal.
- P1.2 pasa de PENDIENTE a PARCIAL: cierre operativo de CajaActual disponible; Ticket Z fiscal continúa separado.
- Reembolso y Ticket Z real siguen bloqueados por Contract A (pagos) y Contract C (fiscal), respectivamente.
- Hito TPV-01 completado en PR propuesta: tres módulos de runtime retirados; compatibilidad histórica extraída y escrituras legacy denegadas.
- Tres gates operativos: PASS estático en PR #626; Wix Runtime: PENDIENTE_HUMANO. CI offline PR #627: PASS, 80 suites/759 tests; ejecución local no realizada.
- Runtime gates (2026-11-27): PENDIENTE. TinyFish perfil `prof_00998e8c1e184da0` autenticado; página `/tpv` localizada; WebMethods no invocados por falta de precondición sintética acreditada. Wix MCP HTTP 403 previo no se considera prueba de ejecución.
- Plan reproducible: `tests/runtime/RUNTIME-TEST-PLAN.md` (PR #629); runtime TPV 0/3, sin JSON de WebMethods y sin mutaciones CMS.
- P1 cerrada en delegable para el alcance aprobado; bloqueos externos: Contract A (pagos) y Contract C (fiscal).

- Wix Preview discovery (2026-11-27, TinyFish run `d10ece85-5528-409d-9372-a9315c07e908`): admin autenticado; página TPV localizada en `/tpv`, código `src/pages/TPV.yl5th.js`; interfaz visible y sin sesión de caja abierta. No se mutó CMS.
- Runtime gates siguen BLOQUEADOS antes de abrir sesión: `abrirSesionCaja()` escribe en `CajaActual` y `SesionesCaja` con `sessionId=TPV-SESSION-YYYYMMDD`, pero `_buildTpvLedgerItem()` aún no deriva/persiste `recordNature` desde `recordTimestamp`/`productionActivationAt`; el contrato de clasificación y ubicación del campo sigue pendiente (`TPV-ONLINE-TEST-READINESS.md`). No se creó sesión ni se invocaron gates para evitar registros de naturaleza ambigua.


## Auditoría profunda de código y continuidad online (2026-11-27)

- Main auditado: `1192c0de32e536528cc676a0e4ab380b916e09ec`. CI `45937204664` PASS: 80 suites/759 tests, Layer 1 369/369, Layer 2 246/246, verificadores SDK eCommerce/TPV y ESLint. Secret scan `45937204680` PASS. Esto es validación offline/contratos, no runtime Wix.
- Arquitectura Wix: `@wix/data`, `@wix/bookings` (Bookings V2), `@wix/stores` (Catalog V3), `@wix/ecom` (Cart V2/transactions), `@wix/crm` (Contacts V5), `@wix/secrets`; WebMethods `.web.js`, `events.js`, `data.js` y `jobs.config` conservan convenciones Velo que Wix aún requiere para web modules, backend events y data hooks. No se hallaron imports activos de `wix-bookings-backend`, `wix-stores-backend`, `wix-pay-backend`, `wix-ecom-backend`, `wix-bookings.v1` ni `@wix/api-client`.
- Versiones: package.json/package-lock sincronizados; ejemplos instalados `@wix/sdk` 1.21.17, `@wix/bookings` 1.0.1704, `@wix/data` 1.0.527, `@wix/members` 1.0.519, `@wix/stores` 1.0.997. `wix.lock` discrepa: `@wix/crm` 1.0.1636 vs npm 1.0.1686 y `@wix/stores` 1.0.960 vs npm 1.0.997. No editar `wix.lock` manualmente; reconciliar mediante Wix package manager y verificar Local Editor/Preview.
- Toolchain: CI instala `eslint@8.25.0` (línea ESLint 8 EOL desde 2024-10-05) y npm advierte paquetes deprecated `inflight@1.0.6`, `rimraf@3.0.2`, `glob@7.2.3`, `@humanwhocodes/*`. Actualizar ESLint/plugin y limpiar transitivas con PR aislada. El paso npm audit solo falla ante advisories high/critical; no demuestra cero advisories de menor severidad.
- Fail-closed confirmado: `internalConfig.js` fija `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false`, `ALLOW_SIMULATION_RECORDS=false`; `STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false` y `ADJUSTMENTS_ENABLED=false`. `horario.web.js:311-317` bloquea fichajes y `cajas.web.js:563-565` bloquea ledger manual. Esto protege integridad pero significa que esos procesos no están operativos en producción.
- Pagos online: `events.js` marca reservas `PENDING_LEDGER` antes de intentar el ledger; `registrarEventoEconomico` queda fail-closed, se encola recuperación y `crons.js` omite writers deshabilitados. Si un pedido Wix llega a PAID, el CMS puede quedarse sin movimiento canónico y sin reconciliación automática hasta habilitar Contract A/C tras validación. No certificar cobros online.
- TPV: `validarVentaBorrador` comunica bloqueadores de preparación para una venta real. `registrarVenta` persiste únicamente una intención comercial `PENDING_PAYMENT`, `sourceType=SYNTHETIC`, con pagos `confirmed=false`; no cobra ni escribe el ledger físico. En la corrección del 2026-11-27 se eliminó la creación de Draft Orders Wix desde esta ruta: la creación de pedidos externos queda `SKIPPED` con `QA_EXTERNAL_SIDE_EFFECTS_DISABLED`. La clasificación temporal `recordNature`/`productionActivationAt` y el writer de venta real siguen sin implementarse.
- Documentación/gestoría: `fiscalDocuments.web.js` permite preview, pero `createManagerPackageVersion`, historial, descarga y envío devuelven `_packageStorageRemovedResult`; la automatización documental end-to-end no está implementada/operativa.
- Cron: `jobs.config` declara 15 jobs y `crons.jobsConfigParity.test.mjs` pasa; la paridad de configuración no acredita que estén activados ni ejecutados en Wix.
- Navegación pública TinyFish `6f5f8f74-09bb-442d-9506-5e0cc5d547a5`: home, servicios, tienda, carrito, promociones, gift card, zona Marian, blog y contacto enlazados; sin 404 observados. `/reserva-online` tarda y muestra DOM visible vacío; `/blank` está vacía; enlaces sociales dirigen a perfiles de Wix, no a perfiles Marian. No se enviaron formularios ni se inició reserva/checkout.
- Workflow `wix-tpv-preview.yml` es manual (`workflow_dispatch`, `create_preview=false` por defecto), crea Preview read-only y nunca publica. GetSiteContext anterior devolvió estado Draft. El dominio público sirve contenido, pero no se ha demostrado que el `main` auditado sea el código que sirve el sitio.
- Conclusión: no hay evidencia de uso activo de las familias Wix deprecadas examinadas; sí hay deuda de toolchain EOL y versiones SDK desactualizadas/discrepantes. La continuidad online no está acreditada: pagos/ledger, jornada, fiscalidad, paquetes de gestoría y runtime TPV permanecen bloqueados o no ejercitados. NO-GO.

- Contradicción TPV adicional: `productionActivationAt`/clasificación temporal aparece en README y documentos, pero la búsqueda de código fuente no encuentra implementación backend; `tpvVentas.web.js` fija `sourceType: "SYNTHETIC"`. `registrarVenta()` no vuelve a imponer los `saleReadinessBlockers` de `validarVentaBorrador()` antes de crear Draft Order/insertar registro; una llamada directa al WebMethod puede persistir una intención `PENDING_PAYMENT` aunque el UI haya recibido `saleReady=false`. No cobra ni crea movimiento físico, pero la puerta de escritura no es coherente.
- Contrato de colección TPV contradictorio: `internalConfig.js` y `tpvVentas.web.js` asignan transacciones comerciales a `TransaccionesTPV`, mientras `docs/PROJECT-CANON.md` indica explícitamente no crear `TransaccionesTPV` y mantener `MovimientosCaja` como ledger físico canónico. Resolver si `TransaccionesTPV` es una colección de intención comercial no contable o si la escritura debe retirarse; no cambiar el writer hasta fijar el contrato. `MovimientosCaja` sigue siendo el ledger físico.


## Avance técnico — TPV QA sin efectos eCommerce externos (2026-11-27)

- `src/backend/tpv/tpvVentas.web.js`: retiradas las dependencias `@wix/ecom` Draft Orders y `@wix/essentials.auth.elevate` de la ruta de venta sintética. `createSaleDraftOrder()` devuelve ahora `orderId=null`, `requiresReconciliation=true` y `reason=QA_EXTERNAL_SIDE_EFFECTS_DISABLED`; no crea pedidos ni Draft Orders en Wix.
- `salePendingEnvelope()` registra el paso `draft-order` como `SKIPPED`, conservando trazabilidad del motivo. La venta sigue siendo una intención pendiente, no una venta cobrada.
- `src/backend/tests/tpv.web-modules.contract.test.mjs`: el contrato estático exige ausencia de `draftOrders`, `createDraftOrder` y `auth.elevate` en el módulo de ventas y comprueba el motivo de omisión.
- Se resuelve la contradicción documental de `TransaccionesTPV`: colección de intención comercial/pago pendiente, distinta del ledger físico `MovimientosCaja` y de auditoría `ControlOperativo`.
- Validación: cambio y test añadidos al repositorio; CI aún no ejecutada en esta rama. Wix Preview/Runtime no ejecutado. Sin escrituras CMS ni mutaciones Wix realizadas durante esta intervención.


## Avance técnico — mutabilidad controlada de intenciones TPV sintéticas (2026-11-27)

- `TransaccionesTPV` se trata como registro comercial de intención, no como ledger append-only. Se habilitan `update` y `remove` en la DAL solo si el registro persistido y el nuevo estado cumplen simultáneamente: `sourceType=SYNTHETIC`, `status=PENDING_PAYMENT`, `orderId=null`, `requiresReconciliation=true` y todos los pagos permanecen `confirmed !== true`.
- `TransaccionesTPV_beforeUpdate` lee el original con consistencia fuerte y valida tanto el original como el resultado. `TransaccionesTPV_beforeRemove` lee el original y solo permite eliminar intenciones sintéticas pendientes. Los intentos de convertir a REAL/PAID o mutar registros no sintéticos se rechazan.
- `removeById` aplica condición CMS sobre `sourceType`, `status` y `requestFingerprint`, además del ID exacto, para evitar borrar un registro que haya cambiado entre lectura y eliminación.
- Se actualizan pruebas de política y hooks. No se habilita mutabilidad para `MovimientosCaja`, contabilidad, fichajes ni cierres fiscales.
- CI de esta rama pendiente; Wix Runtime no ejecutado; sin mutaciones CMS reales.


## Read-back Wix actualizado — 2026-11-27 05:44 CET

- `GetSiteContext`: sitio Marian Madrid Peluquería y Estética `188bed94-177c-4bc9-a9f0-35080d874f3e` figura **Published**, plan Premium, dominio personalizado, Editor y Velo habilitado. Última actualización indicada por Wix: 2026-11-27 03:55.
- Apps confirmadas en contexto: Wix Bookings, Stores Catalog V3, Wix Payments, Wix Invoices V1, Members Area, Gift Cards, Forms & Payments, Blog y SEO.
- Este read-back acredita estado publicado del sitio y presencia de las apps; **no acredita** que el código de `main` (incluidos los PR #634/#635 posteriores al update de Wix) esté sincronizado/desplegado. No se ha publicado ni modificado el sitio desde esta intervención.


---

## READ-BACK DIRECTO WIX Y VERIFICACIÓN MULTICAPA — 2026-11-27

Auditoría posterior al commit documental `21b905859d64bd9989103ac328331ef6147e19c6`: [informe completo](audits/2026-11-27-current-site-layer-verification.md).

**Estado Wix:** Draft, `published=false`; 9 páginas estáticas y 2 dinámicas, `published=false`. TPV ID `yl5th`, ruta `/blank`.

**CMS read-back:** CajaActual=1 ABIERTA; MovimientosCaja=5 (`SIMULATED_SUCCESS`); TransaccionesTPV=0; HistoricoCierresZ=1 (`SIMULATED`, `NOT_SIGNED`); ControlOperativo=78; CitasF2=11; LibroAsientosContablesDetalle=3; MapaStaff=5; RegistrosHorariosStaff=0. MapaStaff tiene 1 GESTORIA, 1 TERCERO y 3 STAFF; no existe `recordType=CONFIG_SISTEMA` ni valor `productionActivationAt` en los cinco registros consultados. No se mutó CMS.

**Verificación:** PR #640/#641 mantienen CI offline PASS en sus respectivos commits. El HEAD documental de main no tiene checks/runs asociados. El workflow Wix Preview no se ejecutó; el smoke actual no interactúa ni invoca WebMethods. No se acredita runtime, sincronización Git-Wix, pagos, reservas, jornada ni hardware.

**Corrección de precisión documental:** sustituir la afirmación genérica de que MapaStaff está vacío por la lectura actual: cinco identidades/terceros, pero ausencia del singleton CONFIG_SISTEMA y del corte de activación. La matriz final sigue NO-GO comercial hasta pruebas Wix Runtime y cierre de gates legales/operativos.
