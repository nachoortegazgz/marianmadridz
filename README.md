# Marian Madrid — repositorio técnico

**Sitio:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Plataforma:** Wix Editor clásico + Velo.

## Estado operativo

- **Release:** NO-GO. El sitio no está autorizado para operación comercial ni para activar pagos/writers fiscales.
- **Modelo TPV:** un único flujo de código y contrato de dominio para cualquier operación; no se bifurca por etiquetas de entorno ni por clasificación de datos. La migración está pendiente y el runtime actual aún conserva componentes heredados.
- **GitHub:** PR #612 integrada en `main` (`239fd8207d228bde56e9908055166980a87d4989`); preparación y contrato previo V1 integrados, pero sin writer operativo.
- **Wix Site Context (read-back 2026-11-25):** sitio Published; Velo habilitado; Editor; Premium; Wix Stores Catalog V3, Bookings, Payments e Invoices V1 instalados; EUR / Europe-Madrid. La sincronización Git-Wix no está verificada.
- **Documentación canónica:** [índice](docs/INDEX.md), [estado vigente](docs/STATE-NOW.md), [flujo TPV único](docs/TPV-UNIFIED-FLOW.md), [Hito TPV-01](docs/TPV-MILESTONE-01-UNIFIED-CORE.md) y [manifiesto histórico](docs/ARCHIVE-MANIFEST.md).
- **Límite:** CI offline no acredita sincronización Git-Wix, Preview/Runtime, integridad CMS live, aceptación fiscal ni pruebas E2E. TPV: `saleReady=false`, `paymentVerified=false`, `persisted=false`.

## Navegación canónica

- [Índice documental](docs/INDEX.md)
- [Estado vigente](docs/STATE-NOW.md)
- [Hito TPV-01 — núcleo único y persistencia canónica](docs/TPV-MILESTONE-01-UNIFIED-CORE.md)
- [Manifiesto del archivo histórico](docs/ARCHIVE-MANIFEST.md)
- [README backend TPV](src/backend/tpv/README.md)

## Validación

El estado de cada control debe asociarse al SHA y al entorno exactos. No declarar Wix Runtime, Preview, E2E ni producción a partir de pruebas offline.
