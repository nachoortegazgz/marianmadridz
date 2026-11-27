# Estado actual — 2026-11-27

**Estado: NO-GO para MVP operativo/comercial.** Desarrollo y QA con fixtures permitidos. Esta instantánea no sustituye nuevas lecturas del repositorio, Wix o CMS.

## Git y cambios

- Repositorio: `nachoortegazgz/marianmadridz`.
- PR #650 integrada: `transactionId` obligatorio en el writer fiscal manual, fingerprint de replay y validación del movimiento antes de persistir. CI reportada PASS para esa revisión. El mapping AEAT no está integrado.
- PR #651 abierta: `fix/tpv-actionable-errors-and-guards`; HEAD consultado `235e78c48dab4e1c3d78518c24a3042b5165e257`. Propone normalización común de errores, guards dentro de try/catch, política no-delete y consolidación de writers/lectores. CI final sobre este HEAD pendiente; no tratar como integrado.
- CI no acredita Wix Runtime ni sincronización Git-Wix.

## Wix/CMS — último read-back documentado

- Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`; Editor clásico, Velo habilitado, Draft.
- TPV page ID `yl5th`, ruta `/blank`.
- Recuentos observados: `CajaActual=1` (ABIERTA), `MovimientosCaja=5`, `HistoricoCierresZ=1`, `TransaccionesTPV=0`, `ControlOperativo=78`, `MapaStaff=5`, `CitasF2=11`, `LibroAsientosContablesDetalle=3`, `RegistrosHorariosStaff=0`.
- No había `recordType=CONFIG_SISTEMA` ni `productionActivationAt` en los cinco MapaStaff consultados.
- Lectura fechada 27-11-2026; no es una consulta live actual. No se hicieron escrituras en esas auditorías.

## TPV

- No se ha acreditado venta, cobro, movimiento físico ni cierre en Wix Runtime.
- `TransaccionesTPV` es intención comercial; `MovimientosCaja` ledger físico; `CajaActual` proyección; `ControlOperativo` locks/auditoría.
- El bloqueo global fiscal/contable no debe sustituir validaciones específicas. Configuración o datos obligatorios ausentes deben producir error de dominio accionable antes de persistir.
- La política común de errores está definida por `tpvError.js` en PR #651: código estable, mensaje público seguro, remediation, detalle técnico acotado, retryability, `traceId` y metadatos de persistencia/recuperación. Pendiente de CI/merge para considerar integrada.
- Borrado prohibido: DAL, operaciones bulk y hooks CMS deben denegar explícitamente. Los crons no purgan físicamente.
- Edición validada solo para registros operativos/comerciales permitidos. Ledgers contabilizados, cierres y registros laborales se rectifican mediante nuevos eventos trazables.
- No clasificar registros por entorno ni por etiquetas REAL/SYNTHETIC/SIMULATION. Los marcadores explícitos de smoke/simulación son exclusivos de fixtures y no convierten una operación en real.

## Otros dominios

- Bookings/CitasF2: última auditoría encontró 6 proyecciones CONFIRMED/PENDING divergentes de Bookings V2 CANCELED. Reconciliación backend pendiente.
- Capa 3: paquete trimestral determinista preparado en código; transporte SharePoint/Graph/Power Automate E2E no acreditado.
- Jornada laboral: writer no validado; último read-back sin fichajes.

## Pendientes ordenados

1. Revisar PR #651: diff, imports/consumidores, DAL/hooks/bulk/crons no-delete, errores de todos los WebMethods, persistencia parcial e idempotencia/concurrencia.
2. Ejecutar CI completa sobre el HEAD final de PR #651; corregir fallos antes de merge.
3. Auditar `eventLog.js` y consumidores; establecer alcance real de `transactionId`.
4. Completar mapping AEAT oficial contra especificación y esquema canónico; no inferirlo desde el hash interno ni tocar históricos.
5. Preparar Wix Runtime E2E con fixture/sesión aislada y writer canónico. No reutilizar `CajaActual` ABIERTA ni activar pagos/remesas.
6. Reconciliar Bookings/CitasF2 con proceso backend idempotente y pruebas de fixture.
7. Validar Capa 3 con transporte simulado y, después, tenant SharePoint aislado.

## Regla de evidencia

Cada PASS debe identificar SHA, entorno, comando/flujo ejecutado y resultado. Distinguir estático, unitario, integración simulada, Preview, Runtime y producción. No declarar E2E ni despliegue validado sin ejecución real.
