# Auditoría de hardening P0/P1 — 2026-11-11

## Baseline

- Repositorio: `nachoortegazgz/marianmadridz`
- Rama base: `main`
- SHA de partida verificado: `d4eb1d62945f296d2a8f6eeb24e6f330a2eda385`
- Rama de trabajo: `audit/p0-p1-hardening`
- Alcance: endurecimiento de CI y restauración de una regla de lint. No se ha desplegado código en Wix.

## Cambios incluidos

1. `.github/workflows/backend-offline-quality.yml`: el workflow de calidad se ejecuta también en `push` a `main`, además de pull requests y ejecución manual.
2. `.eslintrc.json`: `@wix/cli/no-invalid-backend-import` pasa de `off` a `error`. El workflow de PR debe demostrar que el código actual satisface la regla; si aparecen infracciones, deben corregirse por consumidor y contrato, no volver a desactivar la regla sin justificación.

## Controles existentes confirmados

- `src/backend/internalConfig.js` declara `STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false` y `ADJUSTMENTS_ENABLED=false`.
- `src/backend/horario.web.js` importa la configuración canónica; la cobertura de cada WebMethod y de cada rama de escritura debe revisarse mediante pruebas antes de considerar certificado el bloqueo.
- `src/backend/booking/bookingCore.js` y `booking/bookingSaga.js` ya implementan locks, tokens de pareja, estados de escritor y replay inspection. No se introduce un segundo mecanismo de idempotencia genérico.

## Riesgos pendientes — no implementados deliberadamente

### P0 fiscal

No se añadió `process.env`: su disponibilidad y semántica no están acreditadas en Wix Velo. Tampoco se añadió un flag que no esté conectado a todos los puntos de emisión, firma, persistencia y envío fiscal. Antes de modificarlo hay que inventariar los writers y sus pruebas. El bloqueo debe ser fail-closed y no impedir la recuperación/compensación de operaciones ya iniciadas.

### P0/P1 caja y fichajes

No se añadió un interruptor operacional global: podría bloquear compensaciones y recuperaciones legítimas. Fichajes ya tienen flags canónicos desactivados; falta acreditar cobertura completa de los WebMethods. Caja requiere guards específicos por operación y pruebas de permisos/replay.

### P1 reservas y proyecciones

No se añadió una búsqueda-antes-de-insertar como garantía de unicidad: no es atómica bajo concurrencia. La siguiente intervención debe extender los locks/transaction writer existentes, validar igualdad de payload para una misma clave y demostrar replay concurrente. La identidad `sourceEventId` debe exigirse en proyecciones de eventos que realmente dispongan de ella; no en todas las proyecciones internas.

### Datos de prueba

No se añadió un filtro por substring `SMOKE_TEST`: es evadible y puede rechazar datos legítimos. Hace falta un marcador de entorno/origen tipado, controlado por backend y compatible con los esquemas CMS existentes, más pruebas que acrediten que se rechaza antes de persistir.

### Escaneo de secretos

No se añadió una regla `git grep` con `|| true`, porque no es un control bloqueante. Integrar un escáner dedicado requiere fijar versión/acción, revisar exclusiones y comprobar falsos positivos.

## Validación

- No se ejecutaron `npm test`, `npm run lint` ni los verificadores Wix en un checkout local: el entorno no dispone de checkout del repositorio ni de Wix CLI compatible.
- La validación real de la regla ESLint y del nuevo trigger corresponde al workflow de GitHub Actions del PR y al siguiente push a `main`.
- No se ha accedido a Wix Runtime, no se han mutado CMS/ledgers y no se ha publicado el sitio.

## Criterio de cierre

No fusionar si falla CI. No desplegar a Wix por el mero hecho de que CI offline pase. Los bloqueos fiscales, caja y fichajes requieren pruebas de integración y runtime en un sitio QA aislado, además de revisión de permisos, idempotencia, concurrencia y recuperación.
