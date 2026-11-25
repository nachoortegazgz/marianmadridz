# Marian Madrid — repositorio técnico

**Sitio:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Plataforma:** Wix Editor clásico + Velo.

## Estado operativo

- **Release comercial:** NO-GO. El Site Context read-back más reciente (2026-11-25 17:53 CET) identifica el sitio como Draft. El propietario autoriza pruebas online durante desarrollo; no hay actividad real declarada ni autorización de pagos reales o remisión fiscal.
- **Modelo TPV:** un único código, contrato y writer para desarrollo y producción. Los registros comparten formato; recordNature se deriva en backend comparando recordTimestamp con productionActivationAt. Los registros anteriores al corte son sintéticos y los posteriores reales. La marca es metadato, no un selector de runtime. La migración sigue pendiente.
- **GitHub:** PR #612 integrada en `main` (`239fd8207d228bde56e9908055166980a87d4989`); preparación y contrato previo V1 integrados, pero sin writer operativo.
- **Wix Site Context (read-back 2026-11-25 17:53 CET):** sitio Draft; Velo habilitado; Editor; Premium; Wix Stores Catalog V3, Bookings, Payments e Invoices V1 instalados; EUR / Europe-Madrid. La sincronización Git-Wix no está verificada.
- **Documentación canónica:** [índice](docs/INDEX.md), [estado vigente](docs/STATE-NOW.md), [flujo TPV único](docs/TPV-UNIFIED-FLOW.md), [Hito TPV-01](docs/TPV-MILESTONE-01-UNIFIED-CORE.md) y [manifiesto histórico](docs/ARCHIVE-MANIFEST.md).
- **Pruebas online:** autorizadas por el propietario en el sitio y colecciones actuales durante desarrollo, una vez completados los gates técnicos y verificado el destino de escritura. Los datos sintéticos se resetearán antes de productionActivationAt. CI offline no acredita sincronización Git-Wix ni Runtime. TPV: `saleReady=false`, `paymentVerified=false`, `persisted=false`.

## Navegación canónica

- [Índice documental](docs/INDEX.md)
- [Estado vigente](docs/STATE-NOW.md)
- [Hito TPV-01 — núcleo único y persistencia canónica](docs/TPV-MILESTONE-01-UNIFIED-CORE.md)
- [Manifiesto del archivo histórico](docs/ARCHIVE-MANIFEST.md)
- [README backend TPV](src/backend/tpv/README.md)

## Validación

El estado de cada control debe asociarse al SHA y al entorno exactos. No declarar Wix Runtime, Preview, E2E ni producción a partir de pruebas offline.
