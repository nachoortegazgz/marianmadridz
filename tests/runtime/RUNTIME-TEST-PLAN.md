# Wix Preview / Runtime — plan de aceptación TPV

**Estado:** NO EJECUTADO. El último intento documentado no obtuvo una sesión Wix autenticada ni acceso permitido a WebMethods. No se ha demostrado sincronización Git-Wix ni ejecución de flujos TPV en Runtime.

## Objetivo

Validar el bridge, permisos, WebMethods, persistencia, idempotencia, concurrencia y recuperación en Wix Preview sin publicar ni producir efectos externos.

## Precondiciones obligatorias

1. Abrir Preview del sitio correcto desde Wix Editor autenticado; no publicar.
2. Confirmar Site ID y fingerprint/build SHA del código que realmente carga Preview.
3. Usar identidad ADMIN de prueba autorizada y verificar permisos efectivos desde backend.
4. Preparar una sesión y datos sintéticos aislados mediante el flujo canónico y writer de aplicación. No utilizar ni cerrar la sesión singleton `CajaActual` existente ni reutilizar movimientos/cierres históricos.
5. Confirmar que el fixture no puede disparar pagos, remesas fiscales, notificaciones ni integraciones externas.
6. Definir explícitamente el alcance de cada prueba, los IDs de correlación y la estrategia de recuperación antes de ejecutar.

Si no se cumplen todas las precondiciones, detener la prueba. No insertar fixtures por REST/CMS directo ni añadir código temporal al sitio para saltarse los contratos.

## Secuencia de aceptación

1. **Bridge read-only:** handshake `MM_READY → MM_CONTEXT`, carga de catálogo y diagnóstico. Verificar rechazo de tipos no permitidos y payloads inválidos.
2. **Autorización:** probar roles permitidos y denegados en WebMethods sin realizar escrituras.
3. **Preflight TPV:** ejecutar `validarVentaBorrador()`; confirmar que los bloqueos esperados se devuelven y que no se persiste nada.
4. **Gate de venta:** invocar `registrarVenta()` con la misma operación no preparada; debe devolver `TPV_SALE_NOT_READY`, `persisted=false` y no crear intención.
5. **Idempotencia:** repetir una solicitud idéntica en entorno aislado; comprobar mismo resultado/ID sin duplicación. Payload conflictivo debe rechazarse.
6. **Concurrencia:** dos operaciones con la misma clave/recurso; comprobar una única adquisición/escritura y respuesta determinista para el competidor.
7. **Persistencia y recuperación:** solo sobre fixture aislado, verificar read-back de la escritura canónica, lock, auditoría y proyección. Simular timeout/reintento sin pagos ni efectos externos.
8. **Cierre/arqueo:** no ejecutar hasta disponer de sesión sintética aislada, aceptación de Ticket X/export y aprobación explícita del escenario. Cerrar la sesión es una mutación irreversible del fixture; nunca probar contra la sesión actual.

## Evidencia requerida

Por cada prueba guardar: commit/fingerprint, sitio/entorno, identidad/rol, método invocado, payload anonimizado, IDs de correlación, resultado, read-back y logs. No registrar secretos, datos de tarjeta ni datos personales innecesarios.

## Criterios PASS

- El fingerprint coincide con el commit esperado.
- Bridge funcional y rechazos de protocolo efectivos.
- Autorización backend aplicada.
- Gates de venta coherentes entre preflight y escritura.
- Persistencia exactamente una vez lógica bajo replay/concurrencia.
- Proyección y ledger coherentes; recuperación trazable.
- Cero efectos externos reales.
- No se modifica la caja singleton ni ningún ledger histórico.

Un smoke HTTP, un test estático, un mock o CI offline no acredita Runtime E2E.
