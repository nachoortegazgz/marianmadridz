# RELEASE-READINESS — 2026-11-25

Criterio vinculante: **NO-GO** mientras cualquiera de los cinco P0 carezca de evidencia Runtime PASS, fecha, ejecutor y JSON íntegro. CI offline no sustituye Wix Preview/Runtime. CONFIG_SISTEMA_FISCAL debe existir con datos legales verificados; los writers permanecen false hasta certificación.

## P0

| Issue | Gate de aceptación | Evidencia actual |
|---|---|---|
| #416 Caja/POS | P3/P4 PASS y conciliación/recovery trazable de #10032–#10034; no alterar registros originales | PENDIENTE. P1/P2/P3/P5 endurecidos en esta rama; bridge opaco rechazado y compatibilidad del handshake HTML Component pendiente (#416); P4 bloqueada: MovimientosCaja es el ledger físico canónico (TPV_LOGICAL_VENTAS → TPV_SALE, transactionId), pero su writer TPV sigue fail-closed; no crear TransaccionesTPV duplicada ni Draft Order sin idempotencia durable. |
| #415/#209 Fiscal/SIF | F1 singleton único y válido; F5 append-only PASS; revisión legal; flags false hasta certificación | PENDIENTE |
| #525 CajaActual | P1 concurrencia: una sola sesión bajo llamadas concurrentes | PENDIENTE. Envelope del controlador endurecido; ninguna prueba Runtime de concurrencia ejecutada. |
| #434 MovimientosCaja | M1–M3/M5 código; M4 Activity Logs/backups y discrepancia histórica explicada | PENDIENTE |
| #520 Automations | Siete PREINSTALLED en estado PAUSED y sin ejecuciones/efectos externos no autorizados; app laboral permanece INACTIVE | PENDIENTE |

## P1

| Issue | Gate de aceptación | Evidencia actual |
|---|---|---|
| #523 Bookings | Reconciliar CitasF2 con bookings nativos y ledger, sin inferir estados | PENDIENTE |
| #522 Canales | Validar flags de pago del catálogo frente a opciones nativas Bookings | PENDIENTE |
| #210 Main | Ruleset y checks requeridos acreditados | PENDIENTE |
| #435 TPV QA | Aislamiento y persistencia QA validados en Wix Runtime | PENDIENTE |

## Bloques de evidencia Runtime

| ID | Prueba | PASS |
|---|---|---|
| P1 | Concurrencia CajaActual | Una sesión creada; segundo intento rechazado o replay idéntico |
| P2 | Identidad Bookings | memberId vinculado autorizado; identidad distinta denegada |
| P3 | Idempotencia TPV | Mismo ID, un solo registro, replay sin pago nativo |
| P4 | Hook beforeInsert | Sobre válido normalizado; sobres sin siteId o con externalSideEffects rechazados |
| F5 | Append-only HistoricoCierresZ | update rechazado y lectura strong sin cambios |
| F1 | CONFIG_SISTEMA_FISCAL | Singleton único, campos completos, taxId válido; writers false |

La checklist detallada se conserva en [archive/2026-11/RUNTIME-EVIDENCE-CHECKLIST.md](archive/2026-11/RUNTIME-EVIDENCE-CHECKLIST.md). Ningún bloque consta como ejecutado en Wix Preview/Runtime a 2026-11-25.

## Evidencia CI de código integrado

| PR | Merge commit | CI offline | Secret scan |
|---|---|---|---|
| #600 | `7ffca8c4ceeea2af9be5bf0a697af15283ab214b` | run 45443104056 PASS | run 45443104106 PASS |
| #601 | `46a7e01e9c6bb328405da12a8423b735f934866f` | run 45448196443 PASS | run 45448196393 PASS |
| #603 | `f42ef7fb50925be7bfece15ff5391383cd33ee84` | run 45509432988 PASS (80/747) | run 45509433003 PASS |
| #604 | `0acb60df65bba1545d3a57cfa261d1de518eb39d` | run 45511826479 PASS (81/750) | run 45511827103 PASS |

Estado operativo: **NO-GO**. Site Context y CMS: último read-back documentado 2026-11-23; no se ha ejecutado Preview/Runtime ni verificado sincronización Git-Wix posterior.
