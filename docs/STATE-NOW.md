# STATE-NOW — 2026-11-25

**Base de código TPV:** PR #612 squash merge `239fd8207d228bde56e9908055166980a87d4989` (árbol probado `632c85edbd765a291abe7b411fe08af75da5e571`) · **Documentación:** consolidada en main mediante PR #613 · **Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · **Entorno:** lectura CMS/Wix de solo lectura; Preview/Runtime no ejecutado.
**Release:** **NO-GO** para ventas reales, pagos, devoluciones o activación de writers fiscales.
**Autoridad:** código integrado en `main` + CI ejecutada sobre el commit indicado + lectura Wix fechada. La fusión GitHub no acredita sincronización Git-Wix ni validación Runtime.

## Decisión arquitectónica nueva — TPV de flujo único (2026-11-25)

El propietario establece un único flujo de código para operaciones con cualquier dato. No se crearán ni conservarán ramas de negocio, runtimes, flags, enums o contratos que separen Sandbox/Live, sintético/real o Preview/Published. La decisión queda desarrollada en [TPV-UNIFIED-FLOW.md](TPV-UNIFIED-FLOW.md) y prevalece sobre directrices históricas incompatibles.

**Avance documental realizado:** criterio incorporado al índice, canon del proyecto, README y README backend TPV. **Código aún no migrado:** tpvPageController.js continúa importando tpvTestRuntime.web.js; tpvRepository.js mantiene el guard de escritura y internalConfig.js conserva discriminadores históricos. No se han eliminado módulos ni se ha abierto el writer porque el builder aún no satisface el esquema físico obligatorio de MovimientosCaja. No se han ejecutado pruebas ni mutaciones Wix en esta intervención.

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
- V1 admite un único medio de pago físico: EFECTIVO, TARJETA o BIZUM. El importe aplicado tras descontar el cambio debe igualar exactamente el total calculado por Wix.
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
- Falta writer operativo válido para `MovimientosCaja`; no crear ledger alternativo `TransaccionesTPV`.
- El hook y el guard de repository continúan cerrados. Retirar una sola barrera no constituiría un writer válido: faltan campos fiscales y contrato de sesión/venta.
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

- `MovimientosCaja` es el ledger físico canónico; no crear `TransaccionesTPV`.
- Ledgers append-only: no actualizar ni borrar históricos; rectificaciones mediante nuevos registros trazables.
- Wix CMS es SSOT transaccional; SharePoint solo custodia evidencia.
- El frontend no contiene lógica de negocio ni autoridad de permisos.
- No mutar inventario sin recuento físico; no alterar tax settings/precios para hacer pasar pruebas.
- No activar pagos, writers fiscales, pedidos, devoluciones o automatizaciones externas durante QA.
- No eliminar documentos históricos: conservar evidencia y mantener solo los documentos canónicos como entrada operativa.

## 8. Siguiente secuencia técnica

1. Verificar read-only del singleton fiscal y cerrar su contrato de campos con asesoría competente; no crear datos legales por defecto.
2. Cerrar contrato de sesión/caja y confirmación manual del lector, incluyendo referencia y evidencia del justificante.
3. Diseñar el writer append-only de `MovimientosCaja` reutilizando los controles del writer manual; completar campos fiscales, numeración F1/F2 separada, idempotencia durable y compatibilidad exacta de hook/DAL.
4. Resolver precio final al consumidor y recuento/asignación de inventario físico por variante.
5. Ejecutar pruebas Runtime de concurrencia, idempotencia, permisos, caja, impresión/hardware y conciliación antes de cualquier release.

**Decisión:** NO-GO. No desplegar ni habilitar ventas reales hasta cerrar todos los gates y documentar rollback.


## 9. TPV — implementación heredada de runtime diferenciado (PR #615; decisión supersedida 2026-11-25)

- PR #615 documenta el runtime anterior. Su separación por clasificación de datos queda supersedida por [TPV-UNIFIED-FLOW.md](TPV-UNIFIED-FLOW.md); el código no se ha retirado todavía.
- Lectura Wix CMS 2026-11-25: 40 colecciones; existen `ControlOperativo`, `MapaStaff`, `MovimientosCaja` y `CajaActual`; no existe colección TPV física independiente ni `TransaccionesTPV`.
- Catálogo consultado: 94 servicios Bookings (70 visibles y 24 ocultos), 3 profesionales y 24 productos Stores Catalog V3 visibles en POS.
- El catálogo TPV filtra `hidden=false` para excluir servicios F2 ocultos. La identidad de los 3 profesionales se valida por `resourceId` y `staffMemberId` nativos.
- Medios de pago de prueba limitados a EFECTIVO/TARJETA; Bizum, bonos, tarjetas regalo y OTROS permanecen deshabilitados.
- CI offline PASS en commit de código `a23a4db1154c004c1d29fabbcc666c73845c441a`. El commit de documentación se valida en su propio workflow.
- Wix Preview/Runtime sigue pendiente; por tanto, no declarar hito finalizado ni TPV operativo.

Detalle y gates: [docs/TPV-ONLINE-TEST-READINESS.md](TPV-ONLINE-TEST-READINESS.md).

## 10. Revisión arquitectónica del runtime QA TPV (PR #616)

- La auditoría de PR #615 detectó que el runtime persiste eventos sintéticos en `ControlOperativo`. Se confirma y documenta como persistencia auxiliar QA real, no como ausencia de persistencia.
- Se mantiene el registro `TPV_TEST_RUN` por sesión para conservar estado entre invocaciones WebMethod, verificar idempotencia/CAS/hash-chain y probar cierres X/Z. No es ledger comercial.
- Corregida la colisión entre el lock QA y el lock operativo: QA usa `TPV_TEST_SESSION_LOCK`, ID `TPVT...` y dedupe `TPV_TEST_SESSION:`; el lock operativo conserva `TPV_SESSION_LOCK` / `TPVS...`.
- Corregido el helper de ID ausente en `tpvTestRuntimeRepository.js`: ahora genera un ID QA determinista SHA-256.
- Añadidos tests para política CAS del lock QA y para impedir consumo de discriminadores QA por módulos operativos de caja, ledger, cierres, movimientos y devoluciones.
- `allowOpaqueOrigin` continúa deshabilitado en TPV. Se documenta el opt-in existente solo en los dos flujos de reservas; no se afirma que el handshake esté validado en Runtime.
- PR #616 abierta como Draft: https://github.com/nachoortegazgz/marianmadridz/pull/616. CI PASS en `bf60067a08a7f3db4003c489b470eb81e0294c09`: 80 suites / 759 tests / 0 fallos; ESLint, npm audit, verificaciones SDK Wix y Secret scanning PASS. Wix Preview/Runtime no ejecutado.
- No se han tocado datos Wix, `MovimientosCaja`, `CajaActual`, pagos, pedidos, facturas, reservas ni inventario. Writers fiscales continúan bloqueados.

**Estado:** CI PASS y diff revisado; mantener PR en Draft y no fusionar ni publicar hasta pruebas Wix Preview/Runtime controladas y verificación de aislamiento en CMS live.
