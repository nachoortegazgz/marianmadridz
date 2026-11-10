# Auditoría de contaminación de ledgers y caja en simulación — 2026-11-10

**Sitio:** Marian Madrid · Wix CMS live, consultas de solo lectura.  
**Baseline:** `main` · `b2edc535f2802b796d9eaeb716d743ce53c556d0`.  
**Alcance:** caja, ledger fiscal, libro contable, fichajes y proyecciones de reservas.  
**Mutaciones:** ninguna. No se han insertado, actualizado ni eliminado registros.

## Evidencia live

| Colección | Filas | Hallazgo |
|---|---:|---|
| `MovimientosCaja` | 5 | Cuatro filas marcadas `recordSource=SMOKE_TEST`, `eventType=SIMULATED_*`, `sequenceNumber=0`, con hashes de simulación. Una fila real `VENTA_LINEA`, secuencia 1 y hash SHA-256 de 64 caracteres. |
| `CajaActual` | 1 | `cashRegisterStatus=SIMULACION`, `isOpen=true`, saldo 300 €, `sequenceCounters.seqGlobal=0`. Estado no operativo y fuera del enum ABIERTA/CERRADA. |
| `LibroAsientosContablesDetalle` | 1 | Fila `origenTipo=SMOKE_TEST`, `accountCode=SIMULATED`, 25 € al debe y 0 € al haber, con hashes de marcador. No es un asiento PGC válido. |
| `HistoricoCierresZ` | 0 | No hay cierres Z persistidos. |
| `PaquetesGestoria` | 0 | No hay snapshots de gestoría persistidos. |
| `RegistrosHorariosStaff` | 2 | Dos fichajes con traceId `QA_LIVECMS_...`; ambos carecen de `signature`. No se han modificado. |
| `CitasF2` | 55 | 54 registros no tienen `sourceEventId`; se conserva como hallazgo pendiente de reconciliar con el contrato de eventos actual. |

Las filas de prueba de caja y contabilidad están identificadas por marcadores explícitos de smoke test, no por inferencia sobre sus importes. Las filas son históricas y los ledgers están protegidos como append-only: no se borran ni se sobrescriben.

## Riesgos comprobados en código

1. `fiscalAggregator.web.js` consultaba por `fiscalPeriod` y acumulaba todos los registros; no excluía los cuatro `SMOKE_TEST`. Los borradores fiscales podían incluir importes de prueba.
2. `cajas.web.js` consultaba los movimientos del día y la cadena sin excluir secuencias no positivas ni filas de smoke. Los registros podían contaminar recuentos, auditoría y cierre Z.
3. `eventLog.js` seleccionaba el último movimiento sin filtro de secuencia/origen y el reconciliador podía procesar filas de prueba.
4. `accountingLedger.js` elegía el último registro contable sin excluir el asiento `SMOKE_TEST`; una nueva cadena podía enlazarse al hash marcador.
5. `getCashierState` devolvía el saldo de la caja en estado `SIMULACION`; `registerManualTransaction`, la proyección `CajaActual` y el cierre Z no tenían un guard específico para ese estado.

## Cambios incluidos en esta rama

- Añade en `validation.js` una clasificación pura que reconoce únicamente marcadores explícitos de simulación.
- Excluye filas de smoke y secuencias no positivas de informes fiscales, head del ledger, recuentos diarios, cierre Z, auditoría de cadena y reconciliación.
- Evita que el escritor contable encadene un nuevo asiento al registro `SMOKE_TEST`/`SIMULATED`.
- Caja en estado `SIMULACION`: `getCashierState` falla cerrado; no permite transacciones manuales, proyección de saldos ni cierre Z.
- No se cambia el contenido de ninguna fila histórica.

## Límites y pendientes

- No se ha ejecutado el runtime Velo contra el sitio publicado.
- No se ha abierto, cerrado ni normalizado la caja real.
- Los cuatro registros SMOKE_TEST y el asiento simulado siguen persistidos y auditables; no se reclasifican mediante una escritura.
- Los dos fichajes QA sin firma requieren un procedimiento laboral de revisión y, si procede, asientos rectificativos trazables. Nunca recalcular firmas ni editar registros originales.
- La ausencia de 54 `sourceEventId` en `CitasF2` debe contrastarse con el contrato vigente de webhooks/proyección; no se añade un campo por inferencia.
- No declarar Fase 2 fiscal/contable operativa hasta superar pruebas en un entorno QA aislado, revisar la cadena AEAT oficial y validar el proceso con asesoría.

**Conclusión:** el estado live no permite tratar la caja como operativa ni considerar los informes fiscales/contables actuales como libres de datos de simulación. La corrección es de lectura y fail-closed; los datos históricos permanecen intactos.
