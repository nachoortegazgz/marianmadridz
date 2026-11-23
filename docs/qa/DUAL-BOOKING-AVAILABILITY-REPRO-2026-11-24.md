# QA — Reproducción de disponibilidad dual F1/F2

**Fecha de comprobación:** 2026-11-23  
**Fecha de disponibilidad consultada:** 2026-11-24  
**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e` (Draft, Europe/Madrid)  
**Tipo:** lectura de Wix CMS + Wix Bookings Time Slots V2. Sin escrituras.

## 1. Log investigado

El log aportado contiene:
- `serviceId=fc05f4c9-f118-4a07-bde3-a972c7b08a49`
- `linkedServiceId=4b68d8c8-ca2f-42b8-a6a9-a40b514b950f`
- `dateYMD=2026-11-24`
- `totalSlotsF1=124`
- `discardedForNoResources=0`
- `discardedForNoF2=124`
- `exposureMinutes=20`
- `timestamp=2026-11-23T15:09:20.689Z`

El log es anterior al merge de PR #574 (2026-11-23 16:15:58Z), que corrigió el filtro de disponibilidad de F2 oculto. La diferencia temporal es de 1 h 6 min 37 s. Por tanto, el log no demuestra un fallo del código posterior a #574.

## 2. Configuración CMS comprobada

Colección `ServiciosCatalogo`, 95 filas:
- F1: `_id=0bdadf61-15ad-4ea0-96cd-45f85943e249`, duración `phase1Duration=45`, `exposureDuration=20`, `phase2Duration=55`, `totalDuration=120`, visible.
- F2: `_id=fa18a626-ca8e-4f05-a2ae-80bed960353a`, oculta, enlazada desde F1.
- Ambas fases usan la ubicación `7a12abfd-bf30-4847-bcdf-00dc573d4802`.

## 3. Reproducción con Wix Bookings Time Slots V2

Consulta de disponibilidad para el 24-11-2026, zona `Europe/Madrid`, recurso de staff incluido y filtros de política:
- F1: `bookable=true`, `bookOnlineDisabled=false`, `tooEarlyToBook=false`, `tooLateToBook=false`.
- F2 interna: sin filtro `bookable=true` ni filtro que exija reserva online; `tooEarlyToBook=false`, `tooLateToBook=false`.

Resultados:
| Métrica | Resultado |
|---|---:|
| Slots F1 | 124 |
| Slots F2 internos | 122 |
| Slots F2 con `bookOnlineDisabled=true` | 122 |
| Slots F2 bookable | 0 |
| Recursos de staff distintos | 2 |
| Parejas con hora exacta y mismo `resourceId` | 109 |
| F1 sin slot F2 exacto posterior | 15 |

Ejemplo: F1 09:00–09:45 → F2 10:05–11:00, gap exacto 20 minutos y mismo profesional.

Los 15 F1 sin pareja son los slots desde 18:05 en adelante: el último F2 disponible comienza a las 19:05; el primer F2 requerido para ese conjunto empieza a las 19:10. No es un error de `resourceId` ni una razón para redondear el gap.

## 4. Conclusión

1. El error histórico `discardedForNoF2=124` se produjo antes de #574, cuando el filtro público descartaba F2 por `bookOnlineDisabled=true`.
2. Después de #574, la lectura nativa confirma que el motor puede formar 109 parejas F1/F2 válidas, manteniendo el mismo profesional y los 20 minutos exactos.
3. Los 15 descartes restantes son coherentes con la ausencia de slots F2 posteriores dentro del horario disponible.
4. No se debe modificar `exposureDuration`, el `resourceId`, la política de F1 ni permitir recursos diferentes.
5. El nuevo diagnóstico distingue: ausencia de hora F2 exacta, ausencia de mismo profesional e invalidez del rango/gap.

## 5. Validación pendiente

- Aplicar/sincronizar el código de `main` en Wix Draft.
- Repetir la consulta desde la página de reservas en Preview y comprobar la disponibilidad visible.
- Verificar el nuevo log `[dual] no se pudieron formar pares F1+F2` y comparar los contadores.
- No completar reservas reales ni invocar Booking Writer en esta prueba.

**No ejecutado:** Wix Preview/Runtime, creación de reservas, modificación de catálogo o staff.  
**Estado:** reproducción nativa de solo lectura verificada; Runtime pendiente.
