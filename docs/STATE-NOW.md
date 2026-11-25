# STATE-NOW — 2026-11-25

**Main:** `67e62955d89ab5a1ff12f0a61c3ab735199e52f5` · **Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · **Entorno:** sitio publicado; lectura CMS de solo lectura.
**Release:** NO-GO para operar comercialmente o activar writers fiscales/pagos. El código integrado no equivale a validación de Runtime.
**Criterio de autoridad de esta revisión:** documentación oficial Wix vigente, código en `main` inspeccionado, objetivo funcional y normativa BOE vigente. Los documentos de proyecto y decisiones previas son editables si contradicen esa evidencia.

## P0 — bloqueos abiertos

| Issue | Estado y evidencia | Responsable/dependencia |
|---|---|---|
| #416 Caja, compensaciones y pedidos POS | PR #587 integrada; compensaciones/pedidos pendientes de reconciliación; no reintentar ni mutar caja/ledgers | Propietario + QA |
| #415/#209 Fiscal/SIF | `CONFIG_SISTEMA_FISCAL` ausente: consulta Wix CMS a `MapaStaff` por `recordType=CONFIG_SISTEMA` devolvió 0 registros (2026-11-25). `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`; no se activa por código | Propietario + asesoría fiscal |
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
- PR #606 y #607 integradas: bridge opaco rechazado (handshake HTML Component pendiente #416), envelope desconocido devuelve ERROR, export sin consumidor eliminado, envelope TPV compartido, retry genérico denegado por defecto, timeout incierto, permisos no resueltos bloquean escrituras, SALE_REGISTER transmite solo IDs/variante/cantidad/medio de pago y logs bridge saneados.
- Diagnóstico Wix CMS 2026-11-25: `MovimientosCaja`, `ControlOperativo`, `CajaActual` y `MapaStaff` existen. El repositorio adapta discriminadores lógicos TPV a `MovimientosCaja`; no crear un ledger paralelo sin rediseño probado.
- Bloqueo real de escritura TPV: `tpvVentas.registrarVenta()` termina en `TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED`; `tpvRepository.insertTpvEvent()` llama al guard incondicional `assertTpvOperationalLedgerConfigured()`; `MovimientosCaja_beforeInsert()` rechaza todos los registros con `recordSource`/ `movementType` TPV. Retirar solo una barrera no habilita una escritura válida.
- El builder `_buildTpvLedgerItem()` no construye el conjunto completo de campos fiscales exigidos por `assertMovimientosCajaRequiredFields()` (entre otros, número/fecha de factura, tipo impositivo y período fiscal). No es un writer comercial válido aunque se retirase el guard.
- El writer fiscal reutilizable `registrarEventoEconomico()` también está cerrado por `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false` y exige `CONFIG_SISTEMA_FISCAL`. La consulta real de Wix CMS devolvió cero registros `recordType=CONFIG_SISTEMA`; no se debe sortear ese control.
- Wix Stores del sitio es Catalog V3. Wix documenta `Get Product` con `taxGroupId` y `Create Draft Order`; un borrador no acredita cobro ni sustituye la factura/registro fiscal. No se creó ningún pedido ni se invocó ningún endpoint mutador.
- Normativa: el RDL 15/2025 publicado en BOE fija adaptación antes del 01-01-2027 para contribuyentes del art. 3.1.a) y antes del 01-07-2027 para el resto del art. 3.1. La nota ministerial de 05-10-2026 que anunció una posible alineación posterior no es una modificación publicada en BOE; no se usa como plazo vigente.
- Wix Preview/Runtime no ejecutado. No se han modificado datos CMS, configuración fiscal, secretos ni writers.

## Glosario mínimo

| Término | Significado |
|---|---|
| SSOT | Fuente única de verdad transaccional |
| CAS | Compare-and-swap para adquisición de lock |
| F1/F2 | Dos bookings nativos coordinados de un servicio dual |
