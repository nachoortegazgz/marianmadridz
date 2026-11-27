# Marian Madrid — repositorio técnico

Sitio: https://www.marianmadrid.es/  
Repositorio: `nachoortegazgz/marianmadridz`  
Plataforma observada: Wix Editor clásico + Velo.

## Estado — 2026-11-27

**MVP operativo/comercial: NO-GO.** PR #650 está integrada. PR #651 (`fix/tpv-actionable-errors-and-guards`) está abierta; el HEAD consultado es `235e78c48dab4e1c3d78518c24a3042b5165e257`. Su CI final y el Runtime E2E siguen pendientes. No se afirma venta, cobro, cierre ni persistencia TPV validada en Wix Runtime.

El último read-back documentado de CMS (27-11-2026) encontró `CajaActual=1` ABIERTA, `MovimientosCaja=5`, `HistoricoCierresZ=1`, `TransaccionesTPV=0`, `ControlOperativo=78`, `MapaStaff=5`, `CitasF2=11`, `LibroAsientosContablesDetalle=3` y `RegistrosHorariosStaff=0`. Es una instantánea histórica, no una lectura en vivo actual. No reutilizar la caja abierta ni modificar históricos durante QA.

## Documentos activos

1. [Estado actual y siguiente trabajo](docs/STATE-NOW.md).
2. [Criterios de release](docs/RELEASE-READINESS.md).
3. [Invariantes de arquitectura](docs/PROJECT-CANON.md).
4. [Flujo TPV, bloqueos y errores](docs/TPV-UNIFIED-FLOW.md).
5. [Índice documental](docs/INDEX.md).
6. [Backend TPV](src/backend/tpv/README.md) y [backend general](src/backend/README.md).
7. [Plan Runtime](tests/runtime/RUNTIME-TEST-PLAN.md).
8. [Archivo histórico](docs/ARCHIVE-MANIFEST.md).

## Reglas no negociables

- Documentación oficial vigente de Wix y de cada integración prevalece sobre suposiciones.
- Wix CMS es SSOT transaccional; Git es SSOT del código; SharePoint custodia evidencia, no gobierna Capa 1.
- Frontend presenta/orquesta. Backend/WebMethods validan identidad, permisos, datos, reglas y persistencia.
- Un solo código y contrato de dominio para desarrollo, pruebas y producción. Fixtures y dobles sustituyen dependencias externas, no la lógica de negocio.
- No hay bloqueos globales de escritura por entorno. Cada operación valida sus precondiciones concretas y falla de forma explícita cuando no se cumplen.
- No se borra ningún registro. Las escrituras pasan por DAL/hooks/writers canónicos. Los ledgers contabilizados y cierres se corrigen mediante nuevos registros trazables, no sobrescritura.
- Errores públicos conservan código estable, mensaje seguro, remediation y metadatos de persistencia/recuperación; detalle técnico limitado y trazado en backend.
- No publicar Wix, activar pagos/remesas reales ni ejecutar mutaciones live durante QA sin gate y autorización específicos.

## Evidencia

Distinguir estático, unitario, integración simulada, Preview, Runtime y producción. Toda afirmación PASS identifica SHA, entorno y prueba ejecutada. CI no acredita Runtime ni sincronización Git-Wix.
