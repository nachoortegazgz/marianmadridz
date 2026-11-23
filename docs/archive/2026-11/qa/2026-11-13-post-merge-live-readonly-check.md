# QA — verificación read-only posterior a merges y estado runtime Wix

**Fecha de consulta:** 2026-11-13  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Main verificado:** `3d8408dabefe2f0154b0196ca54fd53f76c9f1eb`  
**Sitio:** Marian Madrid Peluquería y Estética  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Alcance:** consulta REST read-only de CMS + contexto del sitio. Sin escrituras, invocación de Velo, ejecución manual de crons ni publicación.

## 1. Contexto del sitio

La consulta de contexto Wix devuelve el sitio como **Published**, con Velo habilitado y editor Wix Editor. La metadata de sitio indica última actualización el 2026-11-13 a las 15:18 (hora mostrada por Wix).

Esto **no identifica el SHA exacto del código Velo publicado**. No se dispone de una prueba que vincule la versión publicada con el HEAD actual de `main` (`3d8408d...`). Por tanto, no se declara que los merges #311, #313, #315 y #316 estén ejecutándose en el runtime publicado.

## 2. Lecturas CMS verificadas

Se consultaron `CitasF2`, `ControlOperativo` y `MovimientosCaja` con Wix Data Items API, `consistentRead=true`, sin mutaciones.

| Colección | Conteo | Resultado |
|---|---:|---|
| `CitasF2` | 0 | No hay proyecciones de reservas |
| `ControlOperativo` | 11 | Una alerta fiscal crítica continúa abierta; no se observan filas `WEBHOOK_EVENT` |
| `MovimientosCaja` | 10 | Nueve filas sintéticas y un movimiento online genuino |

### Alerta fiscal

- `alertType=FISCAL_CHAIN_CORRUPTED`
- `status=OPEN`
- `severity=CRITICAL`
- `resolvedAt=null`
- Trace histórico: `cron-health-mwbrs64p-fb034279-2650-45bf-bfe2-4337f828e492`
- El payload histórico conserva el mensaje de seis rupturas detectadas el 2026-11-11.

La alerta no se ha cerrado manualmente. El resultado read-only no demuestra que la auditoría del nuevo código haya corrido en producción ni que haya devuelto `SUCCESS`.

### Proyección de reservas

`CitasF2` sigue vacío. En `ControlOperativo` persiste el marcador QA `QA_BOOKING_CREATED_NO_CITAS_PROJECTION`, que registra que una reserva nativa de prueba fue confirmada sin proyección y que el origen no quedó determinado. No se ha creado ninguna proyección, alerta de revisión o reserva durante esta consulta.

### Ledger de caja

Las diez filas observadas se componen de nueve movimientos sintéticos identificados por `SIMULATED_*`, `TEST_ONLY` o `SMOKE_TEST`, y un movimiento genuino `VENTA_LINEA` / `VENTA_ONLINE` / `INTERNAL` / `ONLINE`. No se han modificado filas ni hashes.

La verificación criptográfica read-only anterior quedó documentada en el expediente `2026-11-13-fiscal-alert-and-citasf2-recovery.md`: el movimiento online reproduce el hash almacenado usando el contrato EventLog (`CuotaTotal`). Esta nueva lectura confirma que la fila sigue presente, pero no vuelve a ejecutar el verificador Velo.

## 3. Interpretación y límites

**Verificado:** el sitio figura Published; CitasF2=0; ControlOperativo=11; la alerta fiscal continúa OPEN/CRITICAL; MovimientosCaja=10; no hubo escrituras durante esta consulta.

**No verificado:** SHA Velo publicado, ejecución y resultado de `systemHealthCheck`, ejecución de `reconcileMissingConfirmedBookingProjections`, entrega de eventos Wix y logs backend.

No se atribuye la ausencia de proyecciones a una causa concreta. La persistencia del estado puede deberse a que el runtime no contiene el HEAD actual, a que los crons/eventos no se ejecutaron o a un fallo de ejecución; los datos disponibles no permiten distinguir esas hipótesis.

## 4. Próximas acciones seguras

1. Obtener del Wix Editor/Local Editor evidencia del código sincronizado y del SHA/versión efectivamente publicada.
2. Revisar logs de backend y ejecuciones programadas para los traceId de `systemHealthCheck` y `reconcileMissingConfirmedBookingProjections`.
3. Tras confirmar la versión runtime, volver a consultar CMS en modo read-only.
4. Resolver la alerta fiscal únicamente mediante el guard del backend tras auditoría completa y limpia.
5. Permitir que el reconciliador canónico gestione proyecciones y alertas; no insertar filas CitasF2 manualmente ni inferir profesional/recurso.
6. Mantener sin cambios los ledgers append-only, reservas, pagos, automatizaciones y comunicaciones.

## 5. Fuentes y contratos

- Wix [Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)
- Wix [Count Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/count-data-items)
- Wix [Bookings Reader V2 — Query Extended Bookings](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/query-extended-bookings)
- Código de reconciliación en `src/backend/crons.js` y configuración en `src/backend/jobs.config`.

**Conclusión:** el repositorio mantiene el hito de código integrado, pero el hito operativo Wix continúa **PENDIENTE DE IDENTIFICACIÓN DE VERSIÓN Y VALIDACIÓN RUNTIME**.