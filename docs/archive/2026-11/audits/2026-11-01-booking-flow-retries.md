# Auditoría de continuidad E2E y política de reintentos — 2026-11-01

## Alcance verificado

Repositorio: `nachoortegazgz/marianmadridz`  
Rama: `fix/booking-e2e-retry-windows-2026-11-01`

## Flujo de reserva rastreado

1. **Página de servicio** — `src/pages/Pagina de servicio 2.xnfr4.js`
   - Instala `createWidgetBridge` antes de resolver la URL y consultar el catálogo.
   - En `onContextReady`, resuelve el identificador y carga el servicio.
   - Al recibir `MM_BOOK`, navega al calendario o inicia una compra de Pricing Plan. La compra no se reintenta ciegamente desde frontend.

2. **Protocolo Wix ↔ HTML Component** — `src/public/widgetBridge.js`
   - Valida tipo, versión, tamaño y origen del mensaje.
   - `MM_READY` dispara la preparación del contexto y `MM_CONTEXT` se correlaciona con el ID del mensaje recibido.
   - La carga de contexto dispone de tres intentos como máximo, con esperas de 500 ms y 1.000 ms (backoff exponencial), timeout de 30 s por intento y ventana total de 120 s.
   - Las respuestas de contexto solo se publican si se obtiene un objeto de contexto válido.

3. **Calendario** — `src/pages/Calendario de reservas 2.q39h6.js`
   - Instala el bridge antes de resolver la URL o consultar el CMS.
   - No permite consultar disponibilidad hasta tener `currentServiceId` y `currentService`.
   - Las lecturas de días y slots tienen hasta tres intentos (1 inicial + 2 reintentos), con backoff 500/1.000 ms y timeout de 45 s por intento.
   - La ventana global de llamada frontend es 210 s.

4. **Backend de catálogo/disponibilidad** — `src/backend/reservas.web.js`
   - Expone la resolución de servicio, disponibilidad y slots certificados para servicios duales.
   - Usa el adaptador de Wix Bookings Time Slots V2 y las utilidades de reintento compartidas donde están aplicadas.

5. **Backend de reserva** — `src/backend/citasManager.web.js`, `src/backend/booking/bookingSaga.js`, `src/backend/booking/bookingCore.js`
   - `processDualBooking` delega la operación en la saga de reserva.
   - La saga gestiona validación, locks, creación de reservas, compensación y persistencia.
   - La suite offline `qa.simple-booking.writer.e2e.test.mjs` comprueba que repetir el mismo payload completado no crea una segunda reserva Wix ni un segundo registro `CitasF2`.
   - No se añade un reintento ciego de `MM_BOOK` en el navegador: el timeout de una petición no demuestra que el servidor no haya creado la reserva.

## Política de tiempos y reintentos aplicada

| Etapa | Ventana | Reintentos |
|---|---:|---|
| Handshake del bridge | 30 s | El bridge detecta timeout; el reenvío de `MM_READY` depende del HTML Component |
| Carga de contexto | 120 s total; 30 s por intento | 3 intentos, backoff 500/1.000 ms |
| Disponibilidad, por intento | 45 s | 3 intentos totales, backoff 500/1.000 ms |
| Llamada de disponibilidad frontend | 210 s | Límite global |
| Creación de reserva | Se mantiene el timeout y control transaccional del backend | No repetir desde frontend; usar la idempotencia de la saga |

## Pruebas añadidas

`src/backend/tests/booking.flow.retry.contract.test.mjs` verifica:
- valores de timeout y número de intentos;
- tres intentos del helper compartido;
- reintentos del contexto y correlación de `MM_CONTEXT`;
- orden de inicialización del bridge en la página de servicio;
- política de reintentos de disponibilidad y ausencia de reintento ciego de reserva.

## Limitación importante para el cierre E2E real

El árbol de GitHub no contiene el código fuente HTML/JavaScript de los componentes HTML (`#htmlWidgetCustomService` y `#html1`). Por tanto, no se puede verificar ni cambiar aquí cómo emiten/reintentan `MM_READY`, correlacionan `MM_CONTEXT`, esperan las respuestas `MM_AVAIL`/`MM_BOOK` o presentan los errores. El test nuevo valida el contrato del bridge y las páginas Velo; no sustituye una prueba del HTML real en Wix Preview.

**Criterio de cierre:** CI verde + revisión del código HTML real de ambos componentes + prueba manual en Wix Preview/QA con reserva simple y dual. No publicar a producción solo por superar los tests offline.
