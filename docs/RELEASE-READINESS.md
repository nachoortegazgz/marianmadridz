# Release readiness — 2026-11-27

**Estado: NO-GO MVP operativo y comercial.** Este estado se refiere a habilitación operativa/productiva; no impide desarrollar ni probar el código con fixtures sintéticos.

## Gates por contexto

| Dominio | Desarrollo / CI con fixtures | Wix Preview / integración aislada | Producción |
|---|---|---|---|
| Lógica TPV | Unitarias y contratos con fixtures, incluyendo casos fiscales incompletos | Mismo dominio con adaptadores simulados | Configuración, permisos y writers productivos validados |
| Pago | Proveedor simulado; sin cobro | Adaptador simulado, sin terminal real | Pago verificado y proveedor autorizado |
| Fiscal/SIF | Fixtures de impuestos/series marcados sintéticos; probar también configuración ausente | No requiere identidad fiscal productiva si todos los efectos están interceptados | Configuración legal, serie y writer validados |
| Caja/ledger | Repositorio de test/dobles; probar append-only e idempotencia | Fixture aislado; nunca caja singleton compartida | Writer y controles aprobados |
| Reservas | Fixtures Bookings V2/CitasF2 | Integración aislada de lectura o tenant de prueba | Reconciliación contra fuente nativa |
| Capa 3 | Transformación, minimización y checksum con datos sintéticos | Transporte simulado o tenant de pruebas | SharePoint/Graph y permisos reales autorizados |
| Runtime | No es requisito para unitarias/contrato | Pruebas de aplicación con fingerprint e identidad | Evidencia operativa posterior al despliegue |

## Bloqueos productivos vigentes

- Venta/cobro/persistencia comercial: no habilitados en Runtime según la última auditoría.
- Fiscal/SIF: la configuración legal única no está acreditada. Se retiró el interruptor global que impedía invocar writers; cada escritura sigue condicionada por validación de configuración fiscal, contrato, autorización y controles de integridad. Esto no acredita conformidad fiscal ni habilitación productiva.
- Recuperación fiscal: tres compensaciones PENDING_RECOVERY pendientes de correlación con sus operaciones fuente.
- Jornada laboral: writer deshabilitado; sin fichajes en el último read-back.
- Bookings ↔ CitasF2: seis proyecciones divergentes pendientes de reconciliación backend.
- Wix Preview/UI E2E, SHA Git ↔ Wix y transporte SharePoint/Graph: no acreditados.

Estos bloqueos no deben propagarse a pruebas unitarias, contractuales o de integración simulada. Cada defecto debe asignarse al nivel que realmente afecta.

## Restricciones de integridad

- No alterar ni borrar movimientos físicos, cierres, registros fiscales/contables/laborales ni auditoría append-only. Los registros sintéticos persistidos también son inmutables.
- No actualizar estados de reservas divergentes a mano; probar la reconciliación con fixtures y aplicar cambios solo a través del proceso backend sobre el ámbito autorizado.
- No activar cobros, reembolsos, remisión AEAT, terminales, notificaciones ni automatizaciones con efectos externos durante QA.
- No publicar ni habilitar actividad real por el mero hecho de que CI esté verde.

## Criterios GO de producción

1. Cerrar el fallo Bookings/CitasF2 con reconciliación verificable e idempotente.
2. Validar WebMethods TPV y bridge en Preview/Runtime sobre identidad y fixture aislados.
3. Confirmar destino de escritura y sincronización del SHA/fingerprint instalado.
4. Completar configuración fiscal real validada por fuente autorizada y revisión profesional; activar writers mediante procedimiento formal.
5. Resolver las tres compensaciones fiscales correlacionadas con sus operaciones fuente.
6. Completar pruebas de pagos simulados, devoluciones, caja, cierres, conciliación y no-efectos externos.
7. Validar transporte Capa 3 en tenant SharePoint aislado y read-back de evidencia.
8. Superar CI, revisión de diff, seguridad, reversión y aceptación posterior.

## Regla de evidencia

Cada PASS identifica commit, entorno, prueba y resultado. Etiquetas: estático/contrato, unitario, integración simulada, Wix Preview, Wix Runtime, producción. No extrapolar un nivel a otro.
