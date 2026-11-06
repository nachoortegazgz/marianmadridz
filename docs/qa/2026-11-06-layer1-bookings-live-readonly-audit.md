# Capa 1 — Auditoría de reservas (solo lectura)

**Fecha:** 2026-11-06 · **Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · **Zona:** `Europe/Madrid`  
**Repositorio:** `nachoortegazgz/marianmadridz` · **Base auditada:** `b28e0149d8ba1b98401d3bee88edde1724c296d0`

## 1. Alcance y conclusión

Auditoría de reservas simples y duales F1/F2, gap de exposición, disponibilidad y compensación. La configuración CMS ↔ Bookings V2 de las 24 reservas duales está alineada y Wix ofrece slots que dejan libre al profesional durante el gap. No se certifica aún la creación E2E en producción: no se han creado reservas reales ni escrito en CMS.

## 2. Integridad CMS ↔ Bookings V2

Consultas de solo lectura a Wix CMS Data Items API (`ServiciosCatalogo`) y Bookings V2 Query Services:

- 95 registros CMS y 94 servicios Bookings.
- 24 registros con `allowCombine=true`.
- Los 24 servicios F1 y sus F2 vinculados existen en Bookings.
- 24/24 `phase1Duration` coinciden con la duración nativa F1.
- 24/24 `phase2Duration` coinciden con la duración nativa F2.
- 24/24 `totalDuration = phase1Duration + exposureDuration + phase2Duration`.
- Los 24 F2: `hidden=true`, `payment.rateType=NO_FEE`, `payment.options.online=false`, `payment.options.inPerson=true`.

**Resultado:** cero referencias ausentes y cero discrepancias de duración/configuración en los 24 pares. La diferencia entre 95 registros CMS y 94 servicios Bookings no se considera error sin clasificar primero qué registros CMS no representan servicios Bookings independientes.

## 3. Disponibilidad real — Time Slots V2

Consulta de solo lectura para el 2026-11-07, ubicación del negocio y recurso Staff:

| Servicio | Slots bookables |
|---|---:|
| F1 Babylights | 63 |
| F2 Babylights | 61 |
| Corte Clásico | 67 |

Se identificaron **43 pares F1/F2** cuyo inicio F2 es exactamente 40 minutos después del final F1 y comparten al menos un profesional disponible.

Ejemplo devuelto:
- F1: 08:30–09:20.
- Gap: 09:20–10:00.
- F2: 10:00–11:00.
- Corte Clásico: slot 09:20–09:50 disponible durante el gap para un profesional compartido.

Esto demuestra disponibilidad compatible con el solapamiento solicitado. Son slots disponibles, no reservas creadas ni bloqueos confirmados.

## 4. Defecto de saga y corrección

En `src/backend/booking/bookingSaga.js`, `BookingSagaOrchestrator.execute()` registraba un paso en `completedSteps` solo tras terminar correctamente. Si F1 se creaba y F2 fallaba dentro del mismo paso, el compensador del paso parcial no se ejecutaba. Lo mismo podía ocurrir con una persistencia parcial de `CitasF2`.

Corrección en rama `fix/booking-saga-partial-compensation`:
- Compensar el paso fallido primero.
- Compensar después los pasos completados en orden LIFO.
- No enmascarar el error original si falla la compensación parcial.
- Regresiones para fallo a mitad de paso y fallo del compensador.

PR: https://github.com/nachoortegazgz/marianmadridz/pull/153

## 5. CI

GitHub Actions run #203: suite offline, gate Capa 1, gate Capa 2 y ESLint: **PASS**.

https://github.com/nachoortegazgz/marianmadridz/actions/runs/42203700085

CI verde no equivale a prueba E2E con Wix Bookings Writer real.

## 6. Decisión pendiente sobre F2

El Dossier P1.5 indica `skipAvailabilityValidation: true` para F2. No recomiendo activarlo: `SLOT_LOCK` solo coordina escritores que pasan por esta saga y no impide que Wix Bookings u otro canal consuma el slot. F2 debe conservar la validación nativa de disponibilidad como última barrera contra dobles reservas.

La configuración real de los 24 F2 ya es `NO_FEE` con pago presencial habilitado; no se ha demostrado que sea necesario omitir la validación de opción de pago.

**Resolución recomendada:** aclarar P1.5 mediante ADR: mantener validación de disponibilidad y no omitir validación de pago salvo rechazo reproducible y excepción justificada. No se ha modificado el Dossier ni la configuración de producción.

## 7. Pendiente para certificar

1. Reserva simple completa en Local Editor/QA: Wix Booking + `CitasF2`.
2. Reserva dual completa: F1, F2, `pairToken`, dos filas CMS y liberación del lock.
3. Inyectar fallo entre F1 y F2; comprobar cancelación de F1 y cola de compensación.
4. Inyectar fallo durante persistencia CMS; comprobar que no quedan proyecciones activas huérfanas.
5. Carrera con reserva nativa concurrente; Wix debe rechazar el slot perdido y la saga compensar cualquier reserva parcial.
6. E2E de navegador: selección, fecha/hora, confirmación y errores.
7. Aprobar ADR sobre `skipAvailabilityValidation`.

## 8. Límites

- No se crearon, modificaron ni cancelaron reservas reales.
- No se escribieron colecciones CMS ni se alteraron servicios, horarios, personal o pagos.
- No se publicó ni desplegó código.
- PR #153 permanece abierto y en borrador; CI verde, sin integrar en `main`.
