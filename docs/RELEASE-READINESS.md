# RELEASE-READINESS — 2026-11-25

Criterio vinculante: **NO-GO** mientras los gates P0/P1 no dispongan de evidencia reproducible del entorno Wix correspondiente. CI offline no sustituye Wix Preview/Runtime, aceptación de hardware, conciliación real ni revisión fiscal. Los writers y pagos permanecen deshabilitados.

## P0

| Issue | Gate de aceptación | Evidencia actual |
|---|---|---|
| #416 Caja/POS | Contrato de sesión/venta, conciliación/recovery trazable y pruebas de caja; no alterar históricos | PENDIENTE. PR #611 integra preparación de venta read-only y PR #612 contrato de preescritura V1 (una tasa, un tender físico, total exacto). El writer canónico de `MovimientosCaja` sigue sin implementarse/configurarse; fiscal singleton, pago externo, idempotencia y aceptación Runtime pendientes. |
| #415/#209 Fiscal/SIF | Singleton fiscal único y válido; writer append-only; revisión legal y flags false hasta autorización | PENDIENTE. Query CMS `MapaStaff` por `recordType=CONFIG_SISTEMA` devolvió 0 registros (2026-11-25); `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`. |
| #525 CajaActual | Una sola sesión bajo llamadas concurrentes | PENDIENTE. CAS integrado en código; ninguna prueba Runtime de concurrencia ejecutada. |
| #434 MovimientosCaja | M1–M3/M5 código; M4 Activity Logs/backups y discrepancia histórica explicada | PENDIENTE. No alterar ni borrar registros originales. |
| #520 Automations | Estado actual de automatizaciones y ausencia de efectos no autorizados acreditados | PENDIENTE. Último read-back documentado: siete PREINSTALLED ACTIVE y app laboral INACTIVE; requiere relectura. |

## P1

| Issue | Gate de aceptación | Evidencia actual |
|---|---|---|
| #523/#522 Bookings | Reconciliar CitasF2 con bookings nativos y opciones de pago, sin inferir estados | PENDIENTE |
| #210 Main | Ruleset y checks requeridos acreditados | PENDIENTE |
| #435 TPV QA | Preparación autoritativa, permisos, idempotencia y persistencia validados en Wix Runtime | PR #611 preparación Wix read-only + PR #612 contrato de preescritura V1 integrados; CI offline PASS; writer, persistencia real y Wix Preview/Runtime pendientes |

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
