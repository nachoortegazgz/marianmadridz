# Marian Madrid — repositorio técnico

**Sitio:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Plataforma verificada:** Wix Editor clásico + Velo.  
**Repositorio:** `nachoortegazgz/marianmadridz`

## Estado ejecutivo — 2026-11-27

**MVP operativo: NO-GO.**

La rama de trabajo `remove-global-ledger-write-gates` elimina los interruptores globales de escritura fiscal/contable; no elimina validación fiscal, autorización, integridad, idempotencia ni concurrencia. La aceptación Runtime y la habilitación productiva siguen pendientes. El repositorio contiene implementación y pruebas offline de varios flujos, pero no existe aceptación E2E de la aplicación en Wix Runtime ni evidencia de que el SHA actual de `main` esté sincronizado con el Editor/Preview.

- **Main:** `f0b30c31c8ad924e42f8790338fa223716026420` (consolidación documental PR #645).
- **TPV:** PR #640 integrada. Clasificación temporal server-side y gate de venta alineado con `validarVentaBorrador()`. El TPV continúa en MODO CONSULTA; `saleReady=false`. No se acredita venta persistida, pago, movimiento físico ni cierre Runtime.
- **Clasificación:** `recordTimestamp` y `recordNature` los genera/deriva backend. La ausencia del singleton `MapaStaff/CONFIG_SISTEMA` y de `productionActivationAt` mantiene los registros nuevos como `SYNTHETIC`.
- **Colecciones:** `TransaccionesTPV` contiene intenciones comerciales pendientes no contables; `MovimientosCaja` es el ledger físico canónico; `ControlOperativo` guarda locks/auditoría; `CajaActual` proyecta la sesión.
- **Bookings:** lectura read-only de 11 IDs: 6 proyecciones `CitasF2` muestran CONFIRMED/PENDING mientras Bookings V2 devuelve CANCELED. Es un fallo de coherencia abierto; no se han mutado reservas.
- **Capa 3:** PR #641 integrada; paquete trimestral determinista Admin-only en memoria. No hay transporte SharePoint/Graph/Power Automate E2E.
- **CMS:** último read-back documentado: CajaActual=1 ABIERTA; MovimientosCaja=5; HistoricoCierresZ=1; TransaccionesTPV=0; ControlOperativo=78 (3 recuperaciones fiscales pendientes); MapaStaff=5 sin CONFIG_SISTEMA; CitasF2=11; RegistrosHorariosStaff=0.
- **Wix:** último read-back directo documentado: Draft, Editor clásico, 9 páginas estáticas + 2 dinámicas; TPV ID `yl5th`, ruta `/blank`. No se ha probado sincronización Git-Wix.
- **CI:** PR #640 PASS (81 suites/764 tests); PR #641 PASS (80 suites/762 tests). Son pruebas offline; el HEAD documental actual no tiene runs asociados.
- **Efectos externos:** no habilitar pagos reales, reembolsos, remisión fiscal/AEAT ni automatizaciones con efectos externos durante QA.

## Entrada documental canónica

1. [Estado actual y siguiente sesión](docs/STATE-NOW.md).
2. [Release readiness y matriz de aceptación](docs/RELEASE-READINESS.md).
3. [Canon de arquitectura y decisiones](docs/PROJECT-CANON.md).
4. [Índice documental](docs/INDEX.md).
5. [Flujo TPV único](docs/TPV-UNIFIED-FLOW.md).
6. [Backend TPV](src/backend/tpv/README.md).
7. [Manifiesto de archivo histórico](docs/ARCHIVE-MANIFEST.md).

## Reglas de evidencia

- Distinguir código integrado, CI offline, lectura de APIs Wix, ejecución WebMethod, Preview, Runtime E2E y producción.
- Toda afirmación de estado Wix/CMS lleva fecha y alcance de lectura.
- No declarar PASS de runtime por pruebas estáticas, mocks o CI.
- CMS es SSOT transaccional; SharePoint es repositorio de evidencia, no fuente de verdad.
- El frontend presenta/orquesta; backend/WebMethods validan permisos, identidad, catálogo, importes y reglas.
- No aceptar clasificación temporal enviada por cliente ni exponer secretos.
- Los ledgers físicos, fiscales, contables, laborales y cierres append-only no se borran ni sobrescriben; correcciones mediante registros rectificativos trazables.
- No modificar la caja singleton existente ni históricos durante QA sin una precondición de aislamiento demostrada.

## Validación

El estado de cada control se vincula al SHA y al entorno exactos. La integración GitHub no acredita sincronización con Wix. No publicar ni habilitar actividad real mientras permanezcan gates P0/P1 abiertos.
