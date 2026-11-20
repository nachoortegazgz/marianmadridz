> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`nacho.pitt@example.test`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](qa/QA-ENVIRONMENT-SSOT.md).

---

# Estado del proyecto — sitio Marian Madrid

**Corte:** 2026-11-14  
**Sitio QA único de trabajo:** 188bed94-177c-4bc9-a9f0-35080d874f3e  
**Naturaleza:** entorno QA previo al despliegue real; nunca ha tenido actividad real y sus datos son sintéticos, según declaración expresa del propietario.  
**Plataforma:** Wix Editor Classic + Velo.  
**Repositorio:** nachoortegazgz/marianmadridz.

## Situación actual

El sitio es el único objeto de trabajo. No se mantiene una matriz de comparación con otro sitio. Los registros presentes se consideran sintéticos y no acreditan actividad comercial, fiscal ni laboral.

### CMS verificado

- 23 colecciones: 15 NATIVE y 8 WIX_APP; 524 campos físicos NATIVE.
- CajaActual: 39 campos, 1 registro; operationDate DATE, openingAmount NUMBER, sequenceCounters OBJECT y otherAmount. cashRegisterStatus=SIMULACION; isOpen=true no es autoridad.
- ControlOperativo: 42 campos, 0 registros; ownerToken, retryAfter y nextRetryAt ausentes; traceId es fencing token.
- ComplementosCatalogo: 18 campos, 36 registros; addonId = _id en 36/36.
- MapaStaff: 18 campos, 3 registros; mapa de identidades de personal. thirdPartyId es TEXT opaco, no coincide con DatosFiscales._id y no tiene consumidor localizado.
- DatosFiscales: 28 campos, 1 placeholder; recordType, taxId, legalName, thirdPartyType y datos de gestoría; sin traceId ni schemaVersion.
- ServiciosCatalogo: 42 campos, 95 registros; serviceId y pricingPlanId son identificadores nativos distintos de _id CMS.
- InventarioStockVenta y MovimientosInventario permanecen físicamente, pero sus contratos y writers están retirados.

La especificación de campos y tipos está en [la auditoría del esquema actual](audits/2026-11-14-current-site-cms-normalization.md) y en [el diccionario CMS](../DICCIONARIO_DATOS_CMS.md).

### Código y documentación

La rama fix/current-site-cms-contract-alignment separa los contratos de MapaStaff y DatosFiscales, migra los lectores/escritores fiscales a DatosFiscales, usa _id como keyfield CMS canónico de ComplementosCatalogo y consolida gestorName como nombre de gestoría.

PR #370 está abierto pero GitHub informa `dirty` (historial divergente respecto a main). No hay checks asociados al HEAD actual; los últimos checks exitosos son de 68a2f327 y no validan los cambios posteriores. Rebase y CI actual pendientes; no fusionar ni publicar.

### Seguridad y operaciones

- La decisión QA-2026-11-15-TEMP-MUTABILITY autoriza temporalmente correcciones de datos sintéticos, pero la mutabilidad no está habilitada técnicamente: la política central aún bloquea update/remove de ledgers append-only.
- No existe una bandera global de mutabilidad; no habilitarla sin identidad de sitio verificada server-side, ADMIN-only, allowlist por colección, backup y auditoría.
- Las colecciones WIX_APP y los claims/eventos de idempotencia permanecen protegidos.
- Writers fiscales/contables/laborales, pagos, reembolsos y envíos externos siguen fail-closed.
- No existe CONFIG_SISTEMA con identidad fiscal oficial verificada.

## Pendientes de cierre

1. Ejecutar CI completa, lint, contratos y secret scanning sobre la rama.
2. Revisar diff y abrir PR; no integrar con pruebas fallidas.
3. Validar hooks/WebMethods en Wix Editor y ejecutar pruebas sintéticas controladas.
4. Exportar código Velo del Editor y comparar con Git; la sincronización Editor↔Git no está acreditada.
5. Revisar consumidores externos antes de retirar físicamente campos espejo.
6. No habilitar writers fiscales ni afirmar cumplimiento Veri*Factu sin datos oficiales y pruebas end-to-end.

## Decisiones

Consultar [DECISION-LOG.md](DECISION-LOG.md). TEC-038 describe la política técnica fail-closed actualmente implementada; QA-2026-11-15-TEMP-MUTABILITY autoriza la excepción temporal, cuya implementación segura sigue pendiente.


> **Nota de baseline CMS:** los inventarios y recuentos CMS que acompañan este estado son snapshots históricos; no constituyen baseline vigente del Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e` hasta repetir una lectura de solo lectura contra el sitio QA actual.


## Addendum de estado — 2026-11-17

El inventario histórico de este documento ha sido sustituido por el corte live del 2026-11-17. MapaStaff es el maestro fiscal/personas discriminado actual; DatosFiscales no existe; CONFIG_SISTEMA no existe. PR #418 y #419 tienen CI offline en verde, pero permanecen abiertas, no fusionadas y sin validar en Wix runtime. SiteContext devuelve Draft.

Bloqueos P0: issues #415 (maestro fiscal/configuración) y #416 (compensaciones, pedidos POS y caja). Main carece de rulesets/required checks; no se puede modificar protección desde la integración actual. No publicar ni habilitar writers.

Ver [estado completo de preparación](../docs/audits/2026-11-17-deployment-readiness.md).


---

## Addendum vigente — 2026-11-19

Este bloque sustituye el estado operativo de los addenda anteriores cuando exista contradicción. El documento rector es [DOSSIER TÉCNICO CONSOLIDADO.md](../DOSSIER%20T%C3%89CNICO%20CONSOLIDADO.md).

- Baseline actual de `main`: `f764a209d417027f07dc31bb86aa471f2aaed834` (PR #430 integrada).
- Wix Site Context informa **Published**, Editor Classic, Velo habilitado, EUR y Europe/Madrid. La clasificación del sitio como QA deriva de la declaración del propietario. Publicación no acredita SHA instalado ni runtime validado.
- CI offline y secret scanning SUCCESS en runs `44602059578` y `44602059662`, respectivamente, para el SHA actual.
- Auditoría estática: 15/15 jobs declarados tienen export en `crons.js`; un diagnóstico read-only adicional no está programado. Estado de ejecución/activación en Wix pendiente.
- `main` sigue sin protección ni required checks. Issue #210 abierto.
- Bloqueos P0 #415/#416 y #209 siguen abiertos. No activar escritores ni ejecutar compensaciones/cierres.
- Inventario personalizado pendiente de retirada controlada (#237); Wix Stores Catalog V3 es la autoridad aprobada.
- Release: **NO-GO para operación real**. Runtime, sincronización Wix y E2E no están acreditados.

La auditoría detallada de jobs, riesgos operativos y secuencia mínima está en el addendum del dossier maestro del 2026-11-19.


### Addendum de conciliación live — 2026-11-19

La revalidación consistente de Wix confirma 3 compensaciones FISCAL_LEDGER/PENDING_RECOVERY (0 intentos), CajaActual ABIERTA con 300 EUR esperados/contados, cero MovimientosCaja y cero HistoricoCierresZ, seis CitasF2 y MapaStaff con 3 STAFF, 1 TERCERO y 1 GESTORIA, sin CONFIG_SISTEMA. Pedidos asociados: #10033 totalmente reembolsado (18,15 EUR) y #10032 PAID/Cash (92,45 EUR; composición dos líneas Stores + una Bookings). No se ha mutado ningún registro. El detalle y la decisión de no reintentar están en el addendum vigente del dossier maestro y en issues #415/#416.

La retirada de inventario custom (#237) está completada en código; falta QA runtime nativo. La persistencia de snapshots trimestrales (#223) está implementada con hash y create-only; agregador mensual y registro de despacho append-only pendientes. Release NO-GO.


### Addendum live de automatizaciones y permisos — 2026-11-19

La API oficial de Wix devuelve 158 automatizaciones: 8 ACTIVE y 150 INACTIVE; las ocho activas son PREINSTALLED. Una automatización activa se dispara por `wix_bookings-sessions_booked` y contiene acción `triggered-emails`; destinatario pendiente de verificar. No se han modificado automatizaciones.

Los permisos de MovimientosCaja, LibroAsientosContablesDetalle, HistoricoCierresZ, RegistrosHorariosStaff y PaquetesGestoria son PRIVILEGED para insert/update/remove, sin special permissions. La jerarquía oficial sitúa CMS_EDITOR por debajo de PRIVILEGED; el nivel mínimo PRIVILEGED excluye al CMS_EDITOR sin privilegios superiores. No hay special permissions. Issue #261: configuración alineada; prueba runtime de CMS_EDITOR y de writers backend elevada pendiente. No se han modificado permisos.

`CajaActual.sequenceCounters` se almacena como string JSON válido (`{}`), y el hook normaliza ese valor; no se clasifica como corrupción confirmada. Release NO-GO.


---

## Addendum live — 2026-11-20 (prevalece sobre los snapshots anteriores)

La consulta actual de Wix Site Context devuelve **Draft** para el Site ID 188bed94-177c-4bc9-a9f0-35080d874f3e. Este es el estado observado ahora; las menciones anteriores a Published no son vigentes.

### CMS live
- CajaActual: revisión 18, 81 campos, 1 singleton. Esquema actualizado el 17/11/2026. Incluye openingCashAmount, openingCardAmount, openingBizumAmount, openingOtherAmount, bizumAmount y operationDateHour.
- MovimientosCaja: revisión 109, 113 campos, 0 elementos.
- HistoricoCierresZ: revisión 44, 66 campos, 0 elementos.
- ControlOperativo: revisión 93, 32 campos, 58 elementos; 3 compensaciones FISCAL_LEDGER/PENDING_RECOVERY, attempts=0.
- CitasF2: revisión 60, 29 campos, 6 elementos.
- LibroAsientosContablesDetalle: revisión 9, 103 campos, 0 elementos.
- Las seis colecciones consultadas devuelven permisos ADMIN para read/insert/update/remove.

### CajaActual
El singleton sigue ABIERTA con openingCashAmount/cashAmount/expectedCash/countedCash=300 EUR, difference=0, snapshotSource=APERTURA_CAJA y traceId vacío. closedAt y lastMovementAt (12/11) son anteriores a openedAt (14/11). sequenceCounters está persistido como texto JSON aunque el esquema declara OBJECT. No se ha cerrado ni modificado.

### Pedidos y reservas vinculados
- Pedido #10033: POS, APPROVED/FULLY_REFUNDED, 18,15 EUR; booking nativo CONFIRMED/PAID, mientras CitasF2 continúa CONFIRMED/PENDING_LEDGER y totalAmount=0.
- Pedido #10032: POS, APPROVED/PAID, 92,45 EUR, Cash, composición mixta Stores+Bookings; booking nativo CONFIRMED/PAID, mientras CitasF2 continúa CONFIRMED/PENDING_LEDGER y totalAmount=0.
- Las tres compensaciones históricas siguen pendientes; no se reintentan ni modifican. Véase issue #416 y [reconciliación live 20/11](qa/2026-11-20-live-caja-schema-and-reconciliation.md).

El detalle de esquema, permisos, evidencia nativa, riesgos y límites de validación está en [reconciliación live de CajaActual y reservas](qa/2026-11-20-live-caja-schema-and-reconciliation.md). No se han ejecutado escrituras Wix, reintentos, cierres ni publicación. Writers fiscales/contables siguen deshabilitados; release **NO-GO**.
