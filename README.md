## Directriz de gobierno vigente (2026-11-27)

Los objetivos del proyecto son la única SSOT de decisión funcional. Las directrices humanas previas son editables y no bloquean por sí mismas el desarrollo. Los datos sintéticos y de QA pueden resetearse o eliminarse cuando sea necesario para repetir pruebas; no existe un objetivo autónomo de conservar históricos de prueba. Se mantienen únicamente los requisitos legales y contratos externos que resulten aplicables y estén acreditados. Las pruebas deben usar simuladores para evitar efectos externos reales.

---

# Marian Madrid — repositorio técnico

**Sitio:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Plataforma:** Wix Editor clásico + Velo.

## Estado operativo

- **Release comercial:** NO-GO. Wix Site Context read-back 2026-11-27 05:37: sitio Draft, Editor clásico, Velo habilitado; `published=false`. No hay autorización de pagos reales ni remisión fiscal durante QA.
- **TPV:** HTML `#htmlTPV` en MODO CONSULTA; `saleReady=false` por gates fiscales, de pago y presentación de precios. PR #640 unifica los blockers UI/WebMethod, implementa clasificación UTC y mantiene separados `TransaccionesTPV` (intención comercial) y `MovimientosCaja` (ledger físico). No habilita cobros reales.
- **Clasificación temporal:** implementada en backend por PR #640. El corte `productionActivationAt` está en el esquema CMS, pero no existe fecha de activación; por ello los nuevos registros continúan como `SYNTHETIC`.
- **GitHub:** PR #638, #640 y #641 integradas en `main`. CI #640: 81 suites / 764 tests PASS; CI #641: 80 suites / 762 tests PASS. Esto acredita CI offline, no runtime Wix.
- **Wix read-back 2026-11-27:** 9 páginas estáticas y 2 dinámicas; TPV ID `yl5th`, ruta `/blank`. CMS: HistoricoCierresZ=1, CajaActual=1 ABIERTA, MovimientosCaja=5, TransaccionesTPV=0, ControlOperativo=78. Se añadieron campos opcionales de clasificación a los esquemas, sin modificar registros.
- **Wix CLI:** workflow manual `wix-tpv-preview.yml` preparado para Preview no publicador y smoke read-only. No ejecutado desde esta sesión; no acredita runtime TPV ni sincronización Git-Wix.
- **Capa 3:** contrato de exportación trimestral y WebMethod Admin-only preparados en memoria; sin envío externo. La configuración fiscal legal y el corte real no están configurados. [Auditoría Capa 3](docs/audits/2026-11-27-capa3-export-preparation.md).
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
