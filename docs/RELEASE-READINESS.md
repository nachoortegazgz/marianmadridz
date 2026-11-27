# Release readiness — 2026-11-27

<badge>NO-GO MVP operativo y comercial</badge>

La salida a producción y la habilitación de cobros/remisión fiscal permanecen bloqueadas. La evidencia offline no sustituye Preview/Runtime, conciliación de datos ni validación legal.

## Gates de aceptación

| Dominio | Estado | Evidencia / condición de salida |
|---|---|---|
| CI backend TPV | PASS offline | PR #640: 81 suites/764 tests; PR #641: 80 suites/762 tests. No acredita Runtime. |
| Clasificación temporal TPV | PASS código + CI | PR #640 integrada. Falta singleton `MapaStaff/CONFIG_SISTEMA` con corte UTC autorizado; mientras tanto, registros nuevos SYNTHETIC. |
| Gate venta TPV | PASS código + CI | `registrarVenta` rechaza `saleReady=false`; Runtime no probado. |
| Venta/cobro/persistencia TPV | BLOCKED | Widget MODO CONSULTA, `saleReady=false`; sin pago verificado ni writer comercial/ledger aceptado Runtime. |
| Caja y concurrencia | PARTIAL | Lock/CAS en código y tests offline; caja singleton está ABIERTA; no se ha probado concurrencia Wix Runtime. |
| Bookings ↔ CitasF2 | FAIL | 6 de 11 proyecciones conservan CONFIRMED/PENDING frente a Bookings V2 CANCELED. Reconciliación backend pendiente. |
| Fiscal/SIF | BLOCKED | Falta configuración legal única; writer fiscal deshabilitado. No crear identidad/series/impuestos ficticios. |
| Recuperación fiscal | BLOCKED | 3 compensaciones PENDING_RECOVERY; resolver desde la operación fuente con idempotencia y evidencia. |
| Jornada laboral | BLOCKED | Writer deshabilitado; 0 fichajes en el último read-back. |
| Capa 3 | PARTIAL | PR #641 prepara paquete determinista Admin-only en memoria; sin transporte SharePoint/Graph/Power Automate E2E. |
| Automatizaciones | PARTIAL | Inventario read-only: 7 ACTIVE PREINSTALLED con disableStatusChange=true; no se han ejercitado ni alterado. |
| Wix Preview / UI E2E | NOT RUN | Workflow manual no ejecutado; smoke existente no invoca WebMethods ni interactúa con la UI. |
| SHA Git ↔ Wix | NOT VERIFIED | No se ha leído fingerprint del build instalado desde Preview/Runtime. |

## Restricciones de integridad

- No reutilizar ni cerrar la sesión `CajaActual` ABIERTA para QA.
- No alterar ni borrar movimientos físicos, cierres, registros fiscales/contables/laborales ni auditoría append-only, aunque sean sintéticos.
- No actualizar estados de reservas divergentes a mano ni inventar eventos; reconciliar leyendo la fuente nativa.
- No activar cobros, reembolsos, remisión AEAT, terminales, notificaciones ni automatizaciones con efectos externos.
- No publicar ni habilitar actividad real por el mero hecho de que CI esté verde.

## Criterios GO

1. Cerrar el fallo Bookings/CitasF2 con reconciliación verificable e idempotente.
2. Probar los WebMethods TPV y bridge desde Wix Preview/Runtime sobre identidad y fixture sintéticos aislados; demostrar persistencia, permisos, idempotencia, concurrencia y recuperación.
3. Confirmar destino de escritura y sincronización del SHA/fingerprint instalado.
4. Completar configuración fiscal real validada por fuente autorizada y revisión profesional; activar writers mediante procedimiento formal.
5. Resolver las tres compensaciones fiscales correlacionadas con sus operaciones fuente.
6. Completar pruebas de pagos simulados, devoluciones, caja, cierres, conciliación y no-efectos externos.
7. Validar transporte Capa 3 en tenant SharePoint aislado y read-back de evidencia.
8. Superar CI, revisión de diff, seguridad, reversión y aceptación posterior.

## Regla de evidencia

Cada PASS debe identificar commit, entorno, prueba, resultado y evidencia. Etiquetas admitidas: estático/contrato, unitario, integración, Wix Preview, Wix Runtime, producción. No extrapolar un nivel a otro.
