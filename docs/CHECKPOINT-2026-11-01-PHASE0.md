# Marian Madrid — Checkpoint técnico Phase 0

**Fecha:** 2026-11-01  
**Repositorio canónico:** https://github.com/nachoortegazgz/marianmadridz  
**Rama base:** `main`  
**HEAD base verificado:** `847a9d2481494c5ba804300c4ef9547e910eb220`  
**Último cambio integrado:** PR #63 — ventana de disponibilidad de 15 días.

## 1. Alcance de esta consolidación

Este documento registra el estado observado y el punto de continuación. No declara terminadas Layer 1 ni Layer 2. Distingue CI offline, lecturas reales de Wix, Preview y pruebas E2E.

No se han modificado CMS, reservas, pagos, ledgers, fichajes, inventario ni publicación Wix durante esta auditoría.

## 2. Estado de GitHub

- Rama principal: `main`.
- HEAD: `847a9d2481494c5ba804300c4ef9547e910eb220`.
- PR #63 integrada.
- Sin PR abiertas ni issues abiertas localizadas en la consulta del 2026-11-01.
- Backend quality gates run #548: SUCCESS (run ID `41300896674`).
- Wix Preview run #25: marcado SUCCESS por GitHub (run ID `41300896658`), pero **inválido como evidencia de Preview** por el falso positivo descrito en §3.

## 3. Bloqueo P0 — falso positivo en Wix Preview

El workflow actual `.github/workflows/wix-preview-validation.yml` considera iniciado Preview si el log coincide con:

```bash
grep -Eiq "ready|localhost|127\\.0\\.0\\.1|preview.*started|http"
```

El artefacto del run #25 contiene realmente:

- `NonInteractiveTerminal`
- `Raw mode is not supported`
- `This command is not supported in non-interactive terminals`

El workflow imprimió `Wix preview started successfully.` porque la coincidencia genérica `http` también puede aceptar URLs incluidas en mensajes de error/documentación. El proceso Wix no generó una URL de Preview. Por tanto:

- El run #25 NO acredita que Wix Preview funcione.
- No se debe usar su estado SUCCESS como puerta de aceptación.
- Corregir el workflow para fallar cerrado: exigir la señal específica y documentada de Wix de que el deployment Preview está creado y una URL válida de Preview; comprobar además el estado/exit code del proceso. No aceptar `http`, `ready`, `localhost` ni texto genérico.
- Conservar el log como artefacto y verificar el resultado en el run del commit candidato.

Evidencia: https://github.com/nachoortegazgz/marianmadridz/actions/runs/41300896658

## 4. Cambios funcionales integrados recientes

- PR #51: normalización estricta ASCII del slug y resolución inequívoca por GUID/slug.
- PR #52 y #53: alineación de parámetros del calendario, recuperación de contexto y query.
- PR #57: conserva identificador de servicio resuelto para contexto del widget.
- PR #61: restringe consulta de movimiento fiscal por reserva a personal cajero autorizado mediante `requireCajero(traceId)`.
- PR #62: prueba negativa que verifica denegación de personal no cajero antes de consultar el ledger.
- PR #63: disponibilidad ampliada de 14 a 15 días y prueba de paridad frontend/backend.

La PR #63 incluye consulta real de solo lectura a Bookings para el servicio objetivo durante 2026-11-02 a 2026-11-16: se observaron fechas disponibles en 11 días; 2026-11-02 no tenía slots. No se crearon reservas ni se modificaron pagos, CMS o notificaciones. La PR advierte que la selección inicial del calendario HTML no está representada en el código Velo revisado y requiere verificación runtime/componente HTML.

## 5. CMS en vivo

La auditoría de 2026-11-01 consultó Data Collections API: HTTP 200, 35 colecciones, incluidas las 13 colecciones NATIVE de negocio indicadas por SSOT.

Hallazgos:
- `MapaStaff` contiene físicamente `staffMemberId` y `active`, además de `memberId`, `resourceId`, `rolBookings`, `rolWebsite`, `scheduleId` y `sourceSystem`.
- No eliminar `staffMemberId` ni `active` hasta inventariar todos los consumidores y preparar migración de datos.
- La existencia/esquema de colecciones no demuestra permisos efectivos, integridad de registros ni comportamiento de hooks.
- Stores continúa en Catalog V1; Catalog V3 no está migrado.
- Cart V2 tiene verificación de exports SDK y tests mock; no equivale a compra real validada en runtime.

Auditoría: `docs/audits/2026-11-01-live-cms-reconciliation.md`.

## 6. Layer 1 — reservas

### Evidencia existente
- Suites offline Layer 1 ejecutadas correctamente en CI.
- Ventana de disponibilidad frontend/backend alineada a 15 días.
- Consulta real de disponibilidad Bookings en modo lectura para el servicio probado.
- Resolución de servicio por GUID y normalización de slug reforzadas.

### Pendientes
1. Verificar en runtime el calendario HTML y su fecha inicial seleccionada.
2. Validar consulta de slots real con identificadores canónicos: `serviceId`, `resourceId`, `scheduleId` y ubicación según el contrato de cada endpoint.
3. Validar reserva simple en entorno QA autorizado.
4. Validar selección y persistencia del profesional/recurso y la asociación con el horario nativo.
5. Verificar consulta/gestión de cita, cancelación controlada, compensación y notificaciones.
6. Comprobar checkout Cart V2 y Bookings Writer V2 en runtime, sin cobros online.
7. No afirmar que CI offline certifica integración real.

**Reserva dual E2E real excluida expresamente por el propietario.** No es un test pendiente ni un test superado.

## 7. Layer 2 — caja, ledger y fiscalidad

### Evidencia existente
- Suites offline Layer 2 ejecutadas correctamente en CI.
- Consulta fiscal por booking protegida con autorización de cajero.
- Prueba negativa de denegación antes de consulta de ledger.
- Esquemas CMS de `MovimientosCaja`, `CajaActual`, `HistoricoCierresZ`, `LibroAsientosContablesDetalle`, `ControlOperativo` y `RegistrosHorariosStaff` observados en la auditoría CMS.

### Pendientes
1. Auditar permisos efectivos CMS y autorización de cada WebMethod fiscal/operativo.
2. Probar atomicidad/compare-and-set de movimientos y saldo en runtime/concurrencia.
3. Verificar unicidad/idempotencia y continuidad SHA-256 sobre registros QA controlados.
4. Confirmar ejecución, reintento y recuperación de cierre Z sin duplicidad.
5. Confirmar si existe escritor activo para `LibroAsientosContablesDetalle` y validar la proyección contable antes de activarla.
6. Verificar tratamiento de cancelaciones, devoluciones y rectificaciones mediante registros nuevos, sin alterar ledgers append-only.
7. Verificar rate limiting persistente en `ControlOperativo`; revisar expresamente la limitación de identidad anónima `anon:noip`.
8. Validar la parte fiscal y normativa independientemente de CI y sin emitir documentos fiscales reales durante QA.

## 8. Calidad y dependencias

El run #548 terminó SUCCESS con:
- regresión offline,
- suites Layer 1 y Layer 2,
- ESLint,
- instalación limpia,
- comprobación de exports Cart V2,
- matriz Windows Node.js 24.22.1 y 26.12.1.

El log de Preview del mismo commit muestra avisos de dependencias deprecated y 10 vulnerabilidades moderadas reportadas por npm audit. No ejecutar `npm audit fix --force` sin análisis de impacto; inventariar dependencias directas/transitivas y preparar corrección compatible separada.

## 9. Secuencia de continuación

1. Corregir y verificar el workflow Preview (P0).
2. Generar `src/velo.dependencies.json` únicamente mediante Wix CLI for Sites; nunca crearlo manualmente. Después evaluar reactivar `@wix/cli/no-invalid-backend-import`.
3. Repetir CI completo en commit candidato.
4. Continuar Layer 1 con calendario HTML, slots y reserva simple QA.
5. Continuar Layer 2 con permisos, atomicidad, ledger y cierres.
6. Actualizar este checkpoint con evidencia, commits y pruebas reales.
7. No publicar con `wix publish` ni modificar datos de producción sin validación y autorización expresa.

## 10. Regla de estado

Usar etiquetas separadas:
- **CI PASS:** pruebas automatizadas offline.
- **WIX READ PASS:** consulta real de solo lectura.
- **PREVIEW PASS:** deployment Preview confirmado por Wix con URL verificable.
- **E2E PASS:** flujo real ejecutado en entorno QA autorizado.
- **PRODUCTION:** solo después de aprobación y publicación explícitas.

Nunca convertir una etiqueta en otra por inferencia.
