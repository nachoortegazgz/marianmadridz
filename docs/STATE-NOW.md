# STATE-NOW — 2026-11-25

**Main:** `62fdcb7b560f7eab16f1188ecf9227ae7b45d5cf` · **PR #611:** MERGED · **Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · **Entorno:** lectura CMS/Wix de solo lectura; Preview/Runtime no ejecutado.
**Release:** **NO-GO** para ventas reales, pagos, devoluciones o activación de writers fiscales.
**Autoridad:** código integrado en `main` + CI ejecutada sobre el commit indicado + lectura Wix fechada. La fusión GitHub no acredita sincronización Git-Wix ni validación Runtime.

## 1. Estado ejecutivo

- PR #611, `feat(tpv-authoritative-sale-preparation-v2-20261125`, fusionada en `main` mediante `62fdcb7b560f7eab16f1188ecf9227ae7b45d5cf`.
- La preparación de venta TPV es autoritativa y read-only: backend resuelve catálogo y calcula impuestos mediante APIs Wix; el navegador no determina precios ni totales.
- `saleReady=false`, `paymentVerified=false`, `persisted=false`. No hay writer operativo TPV habilitado.
- No se creó `TransaccionesTPV`, Draft Order, pedido, movimiento, pago ni devolución. No se alteraron CMS, inventario, configuración fiscal, precios ni secretos.
- Los históricos sintéticos existentes permanecen preservados; no se generan nuevos registros sintéticos de venta/pago/devolución/cierre.

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
| #435 TPV QA | Preparación read-only integrada y CI offline PASS | Persistencia, idempotencia, permisos y flujos TPV en Preview/Runtime |

## 4. TPV — preparación de venta integrada por PR #611

### Código integrado
- `src/backend/tpv/tpvSalePreparationCore.js`: normalización estricta, cantidades enteras, importes en céntimos y reconciliación fiscal por línea.
- `src/backend/tpv/tpvSalePreparation.js`: resolución Catalog V3/Bookings, profesional autorizado, tax settings y `taxCalculation.calculateTax`.
- `src/backend/tpv/tpvVentas.web.js`: `validarVentaBorrador` ignora precios/impuestos/totales del cliente y devuelve importes calculados en backend.
- `src/public/tpvPageController.js` y widget TPV: solicitan cotización backend, descartan respuestas obsoletas y bloquean pago/registro si no se cumplen todos los gates.
- Descuentos no configurados, líneas PERSONALIZADA y BONO/TARJETA_REGALO sin validación de saldo quedan bloqueados.
- El gate de inventario solo afecta a líneas PRODUCTO; los servicios no requieren stock.

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
| Commit de código probado | `b3ed704fa6a7a37ddba4975e4c1136c681b4630f` |
| Backend offline quality gates | Run `45555933654` PASS: package/lock, dependencias, npm audit, Layer 1, Layer 2, suite completa, SDK Wix, ESLint |
| Secret scan | Gitleaks full-history run `45555933681` PASS |
| Commits posteriores a CI | Solo actualizaciones documentales/enlaces BOE y evidencia; no alteraron código |
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

1. Verificar read-only del estado actual de catálogo, inventario por variante/ubicación y configuración fiscal.
2. Diseñar contrato de sesión/venta y confirmación manual de pago externo, sin simular captura bancaria.
3. Diseñar writer append-only de `MovimientosCaja` con campos fiscales completos, idempotencia y hook compatible; no abrir escrituras hasta validar el contrato.
4. Resolver presentación de precios finales al consumidor y configuración fiscal con asesoría competente.
5. Ejecutar pruebas Runtime de concurrencia, idempotencia, permisos, caja, impresión/hardware y conciliación antes de cualquier release.

**Decisión:** NO-GO. No desplegar ni habilitar ventas reales hasta cerrar todos los gates y documentar rollback.

