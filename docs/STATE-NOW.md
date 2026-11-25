# STATE-NOW — 2026-11-25

**Main:** `738793743c677eafedd3aa8605fb84d4f81753f9` · **Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · **Entorno:** QA/Draft (último read-back 2026-11-23).
**Release:** NO-GO. No publicar, operar comercialmente ni activar pagos/writers fiscales.
**Fuente canónica:** [PROJECT-CANON.md](PROJECT-CANON.md). Detalle y criterios: [RELEASE-READINESS.md](RELEASE-READINESS.md).

## P0 — bloqueos abiertos

| Issue | Estado y evidencia | Responsable/dependencia |
|---|---|---|
| #416 Caja, compensaciones y pedidos POS | PR #587 integrada; compensaciones/pedidos pendientes de reconciliación; no reintentar ni mutar caja/ledgers | Propietario + QA |
| #415/#209 Fiscal/SIF | CONFIG_SISTEMA_FISCAL real ausente; flags de escritura false; PR #589 integrada | Propietario + asesoría fiscal |
| #525 CajaActual | CAS integrado en PR #587; evidencia de concurrencia Runtime pendiente | QA Preview |
| #434 MovimientosCaja | Append-only reforzado por PR #590; discrepancia histórica y M4 (Activity Logs/backups) pendientes | Propietario + administrador Wix |
| #520 Automations | Último read-back: siete PREINSTALLED ACTIVE; app laboral INACTIVE | Propietario + administrador Wix |

## P1 — pendientes

| Issue | Estado y evidencia | Responsable/dependencia |
|---|---|---|
| #523/#522 Bookings | Proyecciones/canales requieren reconciliación y pruebas Runtime | QA + propietario |
| #210 Main protection | Ruleset y checks obligatorios no acreditados | Administrador del repositorio |
| #435 TPV QA | Aislamiento/persistencia sin aceptación Runtime | QA Preview |

## Cambios integrados desde el corte anterior

- PR #600 y #601: escrituras TPV sintéticas nuevas retiradas; históricos preservados; metadatos operativos neutrales.
- PR #603: arnés Runtime F1–F6 creado; ciclo debt sweep 1 cerrado con 0 eliminaciones justificadas.
- PR #604: helper de errores accionables A/B; lock fiscal con retry acotado y replay contable verificado.
- CI offline de PR #603: 80 suites/747 tests PASS; PR #604: 81 suites/750 tests PASS; secret scanning PASS en ambas.
- PR #606 integrada (`7387937`): bridge opaco rechazado (handshake HTML Component pendiente #416), envelope desconocido devuelve ERROR, export sin consumidor eliminado y envelope TPV compartido.
- P4 BLOQUEADA: `MovimientosCaja` es el ledger físico canónico (`TPV_LOGICAL_VENTAS` → `TPV_SALE`/`transactionId`); writer fail-closed. No crear `TransaccionesTPV`. Catalog V3 `getProduct/queryProducts` y `@wix/ecom draftOrders.createDraftOrder` están disponibles en SDK; no invocar Draft Order sin idempotencia durable y fiscalidad resuelta.
- Follow-up TPV: retry genérico ahora deniega por defecto; timeout marca resultado incierto; permisos no resueltos bloquean contexto/escrituras; SALE_REGISTER envía solo IDs, variante, cantidad y medio de pago; logs bridge saneados.
- Wix Preview/Runtime no ejecutado; arnés pendiente de ejecución. Ningún merge de código equivale a autorización de publicación.

## Glosario mínimo

| Término | Significado |
|---|---|
| SSOT | Fuente única de verdad transaccional |
| CAS | Compare-and-swap para adquisición de lock |
| F1/F2 | Dos bookings nativos coordinados de un servicio dual |

