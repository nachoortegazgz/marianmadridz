# Capa 1 — Auditoría de reservas (solo lectura)

**Fecha:** 2026-11-06 · **Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · **Zona:** `Europe/Madrid`  
**Repositorio:** `nachoortegazgz/marianmadridz` · **Base auditada:** `b28e0149d8ba1b98401d3bee88edde1724c296d0`

## 1. Alcance y conclusión

Auditoría de reservas simples y duales F1/F2, gap de exposición, disponibilidad, creación, persistencia y compensación. La configuración CMS ↔ Bookings V2 de las 24 reservas duales está alineada y Wix ofrece slots que dejan libre al profesional durante el gap. Se añadieron pruebas de integración offline para la escritura simple y dual; no se certifica aún la creación E2E en un entorno Wix de QA ni en producción.

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

## 5. Pruebas de escritura offline — Bookings Writer V2

Suite nueva `src/backend/tests/qa.dual-booking.writer.offline.test.mjs`:

- `QA-DUAL-BOOKING-01`: dos llamadas independientes a `createBooking`, consultas de disponibilidad separadas para F1 y F2, mismo `resourceId`, gap exacto, dos filas `CitasF2` con el mismo `pairToken`, F2 con `OFFLINE`/importe cero y confirmación de ambas reservas.
- `QA-DUAL-BOOKING-02`: fallo sintético de Writer F2 después de crear F1; se verifica cancelación de F1 con su revisión y ausencia de persistencia de una pareja incompleta.
- La prueba simple `qa.simple-booking.writer.offline.test.mjs` continúa pasando: una reserva nativa, una fila `CitasF2` y replay idempotente sin duplicado.

**Resultado observado en run #42205445202:** las dos suites de Writer pasan (4/4 pruebas); las suites de disponibilidad, concurrencia y saga pasan; Layer 2 y ESLint pasan. El run global falla únicamente en `qa.simulation-manifest.test.mjs`, porque el escenario nuevo se añadió sin `traceId` y `fixture`. Se corrigió el manifiesto en commit `454d4305b0ef9dea74cda9cdbc709d5ef6ebf072`; falta una nueva ejecución CI sobre ese head.

Run: https://github.com/nachoortegazgz/marianmadridz/actions/runs/42205445202

Run #42204139849: suite offline, gate Capa 1, gate Capa 2 y ESLint: **PASS** en el head anterior `45b189c`.

Las pruebas offline usan mocks; no equivalen a una prueba con Wix Bookings Writer real.

## 6. Decisión pendiente sobre F2

El Dossier P1.5 indica `skipAvailabilityValidation: true` para F2. No recomiendo activarlo: `SLOT_LOCK` solo coordina escritores que pasan por esta saga y no impide que Wix Bookings u otro canal consuma el slot. F2 debe conservar la validación nativa de disponibilidad como última barrera contra dobles reservas.

La configuración real de los 24 F2 ya es `NO_FEE` con pago presencial habilitado; no se ha demostrado que sea necesario omitir la validación de opción de pago.

**Resolución recomendada:** aclarar P1.5 mediante ADR: mantener validación de disponibilidad y no omitir validación de pago salvo rechazo reproducible y excepción justificada. No se ha modificado el Dossier ni la configuración de producción.

## 7. Gaps y pendientes para certificar

1. Ejecutar el CI completo tras la corrección del manifiesto `454d4305`.
2. Ejecutar reserva simple y dual contra un Wix QA/Local Editor con Writer real y CMS aislado.
3. Carrera con una reserva creada desde Wix nativo mientras la saga confirma; verificar rechazo nativo y compensación de la otra fase.
4. Inyectar fallo durante el segundo insert de `CitasF2`; verificar que la primera proyección queda marcada `CANCELLED` y las dos reservas nativas se compensan.
5. E2E de navegador: selección de servicio, día, opción F1/F2, datos, consentimiento, confirmación y mensajes de error.
6. E2E de reprogramación dual y cancelación completa. La reprogramación dual sigue sin escenario automatizado de extremo a extremo.
7. Resolver mediante ADR la diferencia entre Dossier P1.5 y la validación nativa de F2.
8. Resolver la política de fianza: el Dossier P10.4 menciona 30% para servicios >50 €, mientras RF-06 de Necesidades Web indica servicios >30 € y señal de 15 € o 20%. No se localizó `createDepositPaymentOrder` ni `cancellationPolicyHours` en el código. No implementar importes ni reglas de cobro hasta aprobar una única política y su contrato de checkout.

## 8. Límites

- No se crearon, modificaron ni cancelaron reservas reales.
- No se escribieron colecciones CMS ni se alteraron servicios, horarios, personal o pagos.
- No se publicó ni desplegó código.
- PR #153 permanece abierto y en borrador; no se ha integrado en `main`.
- No se han creado, modificado ni cancelado reservas reales, ni escrito en CMS de producción.
- No se ha desplegado ni publicado código.
