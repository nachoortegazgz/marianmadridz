# Punto de pausa técnica — MarianMadrid.es
**Fecha:** 2026-11-01  
**Repositorio:** nachoortegazgz/marianmadridz  
**Rama de checkpoint:** fix/wix-preview-ci-pty  
**PR activa:** #81 — https://github.com/nachoortegazgz/marianmadridz/pull/81

## 1. Estado consolidado

### Integrado en main
- PR #80, `fix: layer2 booking cancel integrity`, fusionada en `main`.
- Merge commit: `d0d14e0e40a622ecbf912d6a2d44efaecd428208`.
- Cambios: propagación correcta del resultado de persistencia; no marcar eventos procesados antes de persistir o confirmar NO_CHANGE; propagación de errores de lectura CMS; comprobación del resultado de recuperación fiscal; evitar respuestas ficticias OK ante excepciones.
- Pruebas de backend reportadas en el pipeline previo: 302 tests, 0 fallos (Layer 1: 183; Layer 2: 89), Node 24.22.1 y 26.12.1, ESLint. Esto valida código y pruebas offline, no ejecución en Wix publicado.

### Rama de trabajo y PR #81
- PR #81 abierta contra `main`, rama `fix/wix-preview-ci-pty`.
- HEAD de la rama al crear este checkpoint: `d913f3254697bc85a239e518d034c54c366cf8ab`.
- La rama contiene cambios del workflow Wix Preview y actualización del dossier con resultados de auditoría.
- El workflow vigente en la rama ha quedado limitado a `push` en `main` y `workflow_dispatch`; ya no se ejecuta en `pull_request`.
- El workflow vigente inicia `wix preview` en segundo plano y detecta patrones genéricos de arranque. No exige recuperar una URL `wix.to` ni verificar HTTP. Por tanto, NO constituye todavía una validación de Preview suficiente.
- Run #41338095228 se inició sobre el commit anterior `a0d39292b869b189c49dc535919a8bf28bb3efbb`; su último estado observado fue `in_progress` en el paso de creación/validación de Preview. No se confirmó URL ni resultado final.
- La ejecución de backend quality gates asociada al commit anterior había terminado correctamente. No asumir que el cambio posterior del workflow está validado por esa ejecución.

## 2. Auditoría viva Wix — solo lectura
- Colección `CitasF2`: 11 registros; 10 con bookingId y estado CMS `CONFIRMED`, con 10 reservas nativas correspondientes consultadas.
- Ocho reservas nativas figuran `CANCELED` mientras sus registros `CitasF2` siguen `CONFIRMED`.
- Cinco son QA con `paymentStatus=NOT_PAID`; tres históricas muestran `UNDEFINED` (no inferir pago ni impago).
- Las ocho muestran `createdBy.identityType=WIX_USER` y el mismo identificador interno. Esto no demuestra quién ni por qué canceló.
- `MovimientosCaja`: cero registros vinculados a esos bookingIds en la consulta realizada.
- `ControlOperativo`: cuatro eventos `BOOKING_CANCELED` completados consultados; ninguno coincide con esos ocho IDs.
- Causa de las discrepancias NO determinada. No atribuirlas sin evidencia a un defecto único del webhook.
- No se modificaron reservas, CMS, caja, pagos ni registros fiscales.

## 3. Arquitectura y criterios que se mantienen
- Wix Editor + Velo; Wix Bookings instalado; zona horaria Europe/Madrid.
- Wix Bookings V2; CMS como fuente de verdad del dominio; lógica sensible en backend; trazabilidad `traceId`; ledgers fiscales/operativos append-only.
- Reservas simples y duales F1 + gap + F2 coordinadas con `pairToken`; no usar multiservice para representar el servicio dual.
- No migrar a ciegas integraciones específicas (Resend, OpenAI o servicio fiscal) al SDK Wix.
- La nota SSOT de 25/10/2026 prevalece sobre la prohibición anterior del anexo respecto a Stores Catalog V3: planificar migración mediante ADR, no implementar sin análisis.
- `UPDATED` es tipo de evento webhook, no estado de reserva. Estado canónico `CANCELED` (una L).
- `skipSelectedPaymentOptionValidation: true` + `NO_FEE` en DUAL_F2 necesita prueba real controlada con Wix Bookings V2.

## 4. Pendiente priorizado para la próxima sesión

### P0 — Cerrar el checkpoint de CI/Preview
1. Revisar workflow y elegir una sola estrategia fiable para ejecutar Preview en el contexto correcto.
2. No declarar Preview válido sin URL real, comprobación HTTP y artefacto/log verificable.
3. Revisar el resultado final del run #41338095228 solo si sigue siendo necesario; evitar sondeos repetidos.
4. Corregir PR #81 y ejecutar CI pertinente. No fusionar hasta tener revisión y evidencia suficiente.

### P1 — Layer 1 funcional
1. Probar en navegador calendario, disponibilidad, fechas y mensajes.
2. Crear una reserva simple QA y comprobar bookingId y exactamente un registro CitasF2.
3. Verificar lectura, reprogramación y cancelación entre Bookings y CMS.
4. Probar dual F1-gap-F2 en QA aislado, sin pagos reales ni movimientos fiscales.
5. Alinear configuración nativa y dossier: ventana de reserva 14 vs 15 días; cancelación 12h vs 24h; políticas/enlace ODR; horarios/asignación de staff; notificaciones/automatizaciones y formularios admin.

### P2 — Layer 2 runtime e integridad
1. Validar webhook de cancelación en runtime publicado apto para QA; Preview no valida HTTP Functions y los handlers de eventos requieren entorno runtime adecuado.
2. Diseñar recuperación/reconciliación durable e idempotencia para eventos duplicados o desordenados.
3. Investigar las ocho discrepancias por separado; no autoactualizar CitasF2 ni generar rectificativas.
4. Revisar permisos efectivos/RBAC, atomicidad/concurrencia y duplicados.
5. Cerrar Z, continuidad de totales, hash-chain/tamper detection y estado del accounting writer.
6. Definir cancelaciones/rectificativas sin duplicar, perder ni alterar ledgers append-only.

## 5. Límites de seguridad y despliegue
- No publicar ni desplegar en producción desde esta pausa.
- No mutar CMS, Bookings, reservas, pagos, caja ni fiscalidad sin autorización expresa y alcance concreto.
- No inferir causas ni corregir discrepancias automáticamente.
- Mantener cambios pequeños, pruebas focalizadas, CI y evidencia reproducible.
- Credenciales y secretos nunca deben incluirse en commits, logs o documentación.

## 6. Regla para reanudar
Al abrir la próxima sesión:
1. Leer este checkpoint y el dossier técnico consolidado.
2. Consultar una sola vez el estado actual de PR #81 y su último CI.
3. Continuar desde P0; no repetir auditorías ya documentadas salvo que haya nueva evidencia o cambio de datos.
4. Actualizar este checkpoint/dossier solo cuando exista un avance verificable.
