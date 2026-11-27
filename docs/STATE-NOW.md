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
- Ledgers append-only: no actualizar ni borrar históricos; rectificaciones mediante nuevos registros trazables.
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
- P1 cerrada en delegable para el alcance aprobado; bloqueos externos: Contract A (pagos) y Contract C (fiscal).
