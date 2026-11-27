# Marian Madrid — repositorio técnico

Sitio: https://www.marianmadrid.es/  
Repositorio: `nachoortegazgz/marianmadridz`  
Plataforma: Wix Editor clásico + Velo.

## Estado — 2026-11-27

**MVP operativo/comercial: NO-GO.** PR #650 integrada. PR #651 sigue abierta; código validado: `7771f4c6bb7da61ecf60bd58708b26d5331745dd`. Los commits posteriores son documentales. CI completo PASS; Wix Runtime E2E y sincronización Git-Wix no acreditados. No afirmar venta, cobro, cierre ni persistencia TPV validada en Runtime.

Último read-back CMS documentado (27-11-2026): `CajaActual=1` ABIERTA, `MovimientosCaja=5`, `HistoricoCierresZ=1`, `TransaccionesTPV=0`, `ControlOperativo=78`, `MapaStaff=5`, `CitasF2=11`, `LibroAsientosContablesDetalle=3`, `RegistrosHorariosStaff=0`. Es una instantánea histórica, no una lectura live. No reutilizar la caja abierta ni modificar históricos durante QA.

## Documentación activa

1. [Estado y pendientes](docs/STATE-NOW.md).
2. [Criterios de release](docs/RELEASE-READINESS.md).
3. [Canon de arquitectura](docs/PROJECT-CANON.md).
4. [Contrato TPV](docs/TPV-UNIFIED-FLOW.md).
5. [Índice](docs/INDEX.md).
6. [Backend TPV](src/backend/tpv/README.md) y [backend general](src/backend/README.md).
7. [Plan Runtime](tests/runtime/RUNTIME-TEST-PLAN.md).
8. [Archivo histórico](docs/ARCHIVE-MANIFEST.md).

## Invariantes

- Documentación oficial vigente de Wix e integraciones prevalece sobre suposiciones.
- Wix CMS es SSOT transaccional; Git es SSOT del código; SharePoint custodia evidencia y no gobierna Capa 1.
- Frontend presenta/orquesta. Backend/WebMethods validan identidad, permisos, datos, reglas y persistencia.
- Un único código y contrato de dominio para desarrollo, pruebas y producción. Fixtures sustituyen dependencias externas, no la lógica de negocio.
- Sin bloqueos globales por entorno: cada operación valida sus precondiciones concretas y devuelve errores explícitos.
- No se borra ningún registro. `bulkRemove` está prohibido; los registros efímeros permitidos se retiran lógicamente mediante CAS. Ledgers contabilizados y cierres se rectifican con nuevos registros trazables.
- Errores públicos usan código estable, mensaje seguro, remediation y `traceId`. El detalle técnico se reduce a un código seguro; nunca se envían mensajes brutos, secretos ni tokens al navegador.
- Marcadores explícitos de smoke identifican fixtures; etiquetas genéricas de entorno no clasifican negocio.
- No publicar Wix, activar pagos/remesas reales ni ejecutar mutaciones live durante QA sin gates y autorización específicos.

## Evidencia

CI PASS no acredita Preview, Runtime ni producción. Cada PASS identifica SHA, entorno y prueba. Distinguir estático, unitario, integración simulada, Preview, Runtime y producción.
