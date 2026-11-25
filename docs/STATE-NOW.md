# STATE-NOW — 2026-11-25

**Main:** `b781f241692294f8fb3c455609d3248d9c01b71a` · **Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · **Entorno:** sitio publicado; lectura CMS de solo lectura.
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
| #435 TPV QA | Preparación de venta validada por código/CI pendiente; persistencia, idempotencia y aceptación Runtime no acreditadas | QA Preview |

## Cambios integrados desde el corte anterior

- PR #600 y #601: escrituras TPV sintéticas nuevas retiradas; históricos preservados; metadatos operativos neutrales.
- PR #603: arnés Runtime F1–F6 creado; ciclo debt sweep 1 cerrado con 0 eliminaciones justificadas.
- PR #604: helper de errores accionables A/B; lock fiscal con retry acotado y replay contable verificado.
- CI offline de PR #603: 80 suites/747 tests PASS; PR #604: 81 suites/750 tests PASS; secret scanning PASS en ambas.
- PR #606 y #607 integradas: bridge opaco rechazado (handshake HTML Component pendiente #416), envelope desconocido devuelve ERROR, export sin consumidor eliminado, envelope TPV compartido, retry genérico denegado por defecto, timeout incierto, permisos no resueltos bloquean escrituras, SALE_REGISTER transmite solo IDs/variante/cantidad/medio de pago y logs bridge saneados.
- PR #608 integrada en main: evidencia CMS/fiscal y estado NO-GO actualizados.
- PR #611 (Draft, no fusionada): incorpora preparación read-only con Catalog V3, Bookings, `taxSettings.getTaxSettings` y `taxCalculation.calculateTax`; el widget solicita cotización backend al cambiar líneas y presenta importes fiscales autoritativos. Los pagos y el registro permanecen bloqueados hasta superar todos los gates.
- CI offline de PR #611: PASS en commit de código `b3ed704fa6a7a37ddba4975e4c1136c681b4630f` (Layer 1, Layer 2, suite completa, SDK Wix y ESLint); Gitleaks full-history PASS. Los commits posteriores solo actualizan enlaces BOE en los dos documentos existentes; read-back completado. Wix Preview/Runtime sigue pendiente.
- Lectura Wix: 70 servicios Bookings de precio fijo en EUR; 24 productos Stores; grupos predeterminados Productos/Servicios y cálculo ES al 21%. `taxIncludedInItemPrices=false`; el código soporta modalidades inclusiva/exclusiva, pero el modo actual excluye IVA del precio base.
- Precio al consumidor: el RDL 1/2007, arts. 20.1.c y 60.2.c, exige informar el precio final completo incluidos impuestos. Con `taxIncludedInItemPrices=false` y sin verificación de la presentación pública del precio, se mantiene `CONSUMER_PRICE_PRESENTATION_UNVERIFIED`; no se autoriza cobro.
- Líneas personalizadas, descuentos no autorizados, bonos y tarjetas regalo sin consulta de saldo bloqueados. Sin mutaciones de inventario, Draft Orders, pagos ni escrituras en `MovimientosCaja`.
- Inventario Wix: 30 registros de inventario, todos con seguimiento de cantidad y todos asignados a `Default Online Stores Location` (virtual, ID `23c2eb92-6b87-471c-8397-6c54092d6f09`). La ubicación física del salón existe (`Marian Madrid Peluquería y Estética`, Stores Location `6a2d49cd-b009-47e1-a64b-d34da7a7df31`, Wix Location `7a12abfd-bf30-4847-bcdf-00dc573d4802`; Calle Maurice Ravel 35, Rosales del Canal, 50012 Zaragoza), pero tiene 0 registros de inventario. No transferir ni inicializar stock sin recuento físico.
- La preparación no acredita sesión de caja abierta, confirmación del lector externo, inventario, presentación legal del precio final ni writer fiscal. `saleReady=false`, `paymentVerified=false`, `persisted=false`; `inventoryVerified=false` para líneas de producto (las líneas de servicio no requieren stock).
- PR #609 (iteración anterior) y #610 (alternativa Draft Order) cerradas como supersedidas/no seleccionadas; no fusionadas ni con pedidos creados.
- Diagnóstico Wix CMS 2026-11-25: `MovimientosCaja`, `ControlOperativo`, `CajaActual` y `MapaStaff` existen. El repositorio adapta discriminadores lógicos TPV a `MovimientosCaja`; no crear un ledger paralelo sin rediseño probado.
- Bloqueo real de escritura TPV: `tpvVentas.registrarVenta()` termina en `TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED`; `tpvRepository.insertTpvEvent()` llama al guard incondicional `assertTpvOperationalLedgerConfigured()`; `MovimientosCaja_beforeInsert()` rechaza todos los registros con `recordSource`/ `movementType` TPV. Retirar solo una barrera no habilita una escritura válida.
- El builder `_buildTpvLedgerItem()` no construye el conjunto completo de campos fiscales exigidos por `assertMovimientosCajaRequiredFields()` (entre otros, número/fecha de factura, tipo impositivo y período fiscal). No es un writer comercial válido aunque se retirase el guard.
- El writer fiscal reutilizable `registrarEventoEconomico()` también está cerrado por `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false` y exige `CONFIG_SISTEMA_FISCAL`. La consulta real de Wix CMS devolvió cero registros `recordType=CONFIG_SISTEMA`; no se debe sortear ese control.
- Wix Stores del sitio es Catalog V3. Wix documenta `Get Product` con `taxGroupId` y `Create Draft Order`; un borrador no acredita cobro ni sustituye la factura/registro fiscal. No se creó ningún pedido ni se invocó ningún endpoint mutador.
- Normativa: el [RDL 15/2025 (BOE-A-2025-24446)](https://www.boe.es/eli/es/rdl/2025/12/02/15) fija adaptación antes del 01-01-2027 para contribuyentes del art. 3.1.a) y antes del 01-07-2027 para el resto del art. 3.1. El [RDL 1/2007](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555), arts. 20.1.c y 60.2.c, exige informar al consumidor del precio final completo, incluidos impuestos.
- Wix Preview/Runtime no ejecutado. No se han modificado datos CMS, configuración fiscal, secretos ni writers.

## Glosario mínimo

| Término | Significado |
|---|---|
| SSOT | Fuente única de verdad transaccional |
| CAS | Compare-and-swap para adquisición de lock |
| F1/F2 | Dos bookings nativos coordinados de un servicio dual |
