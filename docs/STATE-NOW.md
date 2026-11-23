# Estado actual — 2026-11-23

**Repositorio:** nachoortegazgz/marianmadridz  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · **Draft** · `published=false`  
**Release:** **NO-GO**. No autorizado publicar, operar comercialmente ni activar pagos/writers fiscales.  
**Evidencia:** lectura Wix/CMS de solo lectura; no equivale a validación Runtime.

## P0 abiertos

1. **#416 — Caja, compensaciones y pedidos POS.** `CajaActual`: singleton `ABIERTA`, apertura 300 EUR, esperado 320 EUR, contado 0, `traceId=0`, sin envelope TPV V2 canónico. Tres compensaciones `PENDING_RECOVERY`: +92,45 EUR (#10032), +18,15 EUR y −18,15 EUR (#10033). Hay cinco pedidos POS (#10030–#10034): #10032/#10033 fueron declarados QA por el titular, pero Wix devuelve `demo=false`; #10030, #10031 y #10034 siguen sin clasificación. No reintentar, completar manualmente ni modificar caja, pedidos o ledgers. **Fuente:** docs/PROJECT-STATUS.md; docs/audits/2026-11-23-fiscal-recovery-root-cause.md; docs/qa/TPV-WIX-NATIVE-RECONCILIATION-AUDIT-2026-11-23.md.
2. **#415 / #209 — Maestro fiscal y SIF/VERI*FACTU.** No existe `CONFIG_SISTEMA_FISCAL`/`CONFIG_SISTEMA` canónico verificado; `LEDGER_WRITES_ENABLED=false` y `ACCOUNTING_LEDGER_WRITES_ENABLED=false`. No crear valores ficticios ni activar writers/remisión. **Fuente:** docs/audits/2026-11-23-fiscal-recovery-root-cause.md; docs/DECISION-LOG.md.
3. **#525 — Concurrencia de CajaActual.** No está acreditada una sección crítica/CAS común para todos los escritores. No declarar segura la concurrencia Runtime. **Fuente:** docs/qa/2026-11-23-tpv-session-handoff.md; docs/PROJECT-STATUS.md.
4. **#434 — Integridad MovimientosCaja.** Discrepancia P0 entre snapshots; la colección es append-only y la desaparición aparente de una fila previamente clasificada como no sintética sigue sin causa acreditada. No hacer update/remove ni reconstruir saldos. **Fuente:** docs/audits/2026-11-23-movimientos-caja-count-drift.md.
5. **#520 — Automatizaciones Wix.** Siete automatizaciones `PREINSTALLED` permanecen `ACTIVE`; la APPLICATION «Configuración de control laboral» está `INACTIVE`. No presumir ausencia de efectos externos. **Fuente:** docs/audits/2026-11-23-repository-wix-cms-reconciliation.md.

## P1 abiertos

1. **#523 — Bookings/CitasF2.** Seis proyecciones: cinco `CONFIRMED`, una `PENDING`; los seis bookings nativos están `CANCELED`. Dos bookings nativos `PAID` conservan proyección `PENDING_LEDGER`. No reinyectar eventos ni corregir proyecciones por inferencia. **Fuente:** docs/audits/2026-11-23-bookings-revalidation.md.
2. **#522 — Canales Bookings.** Diferencias entre flags de pago de `ServiciosCatalogo` y opciones nativas Bookings; no cambiar flags masivamente. **Fuente:** docs/audits/2026-11-23-bookings-revalidation.md.
3. **#210 — Protección de main.** `main` sin protección efectiva ni checks obligatorios según última lectura documentada. **Fuente:** docs/PROJECT-STATUS.md; issue #210.
4. **#435 — Persistencia TPV QA.** Migración/aislamiento de persistencia TPV en Sandbox Wix sin aceptación Runtime acreditada. **Fuente:** issue #435; docs/qa/2026-11-23-tpv-session-handoff.md.

## Decisiones irreversibles y reglas vigentes

- «La única SSOT de requisitos de negocio y aceptación funcional es la petición de Marian Madrid para su negocio, junto con las instrucciones vigentes del propietario.» **Fuente:** docs/PROJECT-OWNER-DIRECTIVE-2026-11-20.md.
- «Las fuentes oficiales vigentes de Wix y de cada integración son la autoridad para contratos, APIs, permisos, límites y comportamiento técnico; la normativa legal vigente aplicable en España es obligatoria y no puede ser dispensada por una decisión técnica o de pruebas.» **Fuente:** docs/PROJECT-OWNER-DIRECTIVE-2026-11-20.md.
- «Los ledgers de caja, contabilidad, fiscalidad, jornada, cierres y eventos webhook permanecen inmutables también en QA.» «No reabrirlos mediante flags ni por conveniencia de pruebas.» **Fuente:** docs/DECISION-LOG.md (TEC-038).
- «MovimientosCaja conserva cada ticket/movimiento original como ledger append-only.» «No se duplica ni reescribe el ticket fuente.» **Fuente:** docs/DECISION-LOG.md (TEC-032).
- «Wix CMS continúa siendo la única fuente de verdad transaccional.» **Fuente:** docs/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md.
- «SharePoint es repositorio de evidencia, no autoridad de corrección.» «Capa 3 no modifica ni gobierna Capa 1.» **Fuente:** docs/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md.
- «Wix Bookings V2 no se utiliza como motor de multiservicio.» «La composición de dos fases es responsabilidad del backend Marian Madrid: dos bookings individuales e independientes (F1 y F2), vinculados por la identidad de pareja del flujo dual. Entre ambas existe un gap de exposición que no constituye una reserva F1/F2. F2 debe comenzar exactamente en F1.end + exposureDuration; la disponibilidad de ambas fases debe corresponder al mismo resourceId (profesional/recurso).» **Fuente:** docs/PROJECT-STATUS.md.
- «F2 se crea con selectedPaymentOption=OFFLINE, totalAmount=0, noFee=true, sin segundo checkout/cobro.» **Fuente:** docs/audits/2026-11-23-bookings-revalidation.md.
- «El frontend no contiene lógica de negocio ni autoridad de permisos; validación y autorización en backend/WebMethods.» **Fuente:** README.md; docs/PROJECT-OWNER-DIRECTIVE-2026-11-20.md.
- «No declarar Wix Runtime, Preview, E2E ni producción a partir de pruebas offline.» **Fuente:** README.md.

## Glosario

| Término | Significado |
|---|---|
| SSOT | Fuente única de verdad |
| Capa 1 | Wix CMS y sistemas transaccionales nativos |
| Capa 3 | Custodia documental/evidencia externa |
| CajaActual | Proyección mutable de sesión y efectivo físico |
| MovimientosCaja | Ledger de movimientos append-only |
| CitasF2 | Proyección de reservas simples/duales |
| ControlOperativo | Locks, claims, eventos y compensaciones |
| F1 / F2 | Bookings nativos independientes de una reserva dual |
| Gap de exposición | Intervalo entre F1 y F2; no es una reserva |
| resourceId | Identidad del recurso/profesional de Bookings |
| PENDING_RECOVERY | Compensación pendiente de recuperación trazable |
| SIF / VERI*FACTU | Sistema informático de facturación y remisión fiscal |
| sourceType | Clasificación de origen del registro |
| processingMode | Modo de procesamiento |
| reconciliationStatus | Estado de conciliación del registro |

