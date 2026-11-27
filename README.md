## Directriz de gobierno vigente (2026-11-27)

Los objetivos del proyecto son la única SSOT de decisión funcional. Las directrices humanas previas son editables y no bloquean por sí mismas el desarrollo. Los datos sintéticos y de QA pueden resetearse o eliminarse cuando sea necesario para repetir pruebas; no existe un objetivo autónomo de conservar históricos de prueba. Se mantienen únicamente los requisitos legales y contratos externos que resulten aplicables y estén acreditados. Las pruebas deben usar simuladores para evitar efectos externos reales.

---

# Marian Madrid — repositorio técnico

**Sitio:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Plataforma:** Wix Editor clásico + Velo.

## Estado operativo

- **Release comercial:** NO-GO. Wix Site Context read-back 2026-11-27 05:37: sitio Draft, Editor clásico, Velo habilitado; `published=false`. No hay autorización de pagos reales ni remisión fiscal durante QA.
- **TPV:** HTML `#htmlTPV` en MODO CONSULTA; `saleReady=false` por gates fiscales, de pago y presentación de precios. La tarifa personalizada y Bizum/bonos/tarjeta regalo/otros siguen deshabilitados. `registrarVenta()` puede crear una intención `PENDING_PAYMENT` sin confirmar cobro; el gate de WebMethod debe alinearse con el de la cotización.
- **Clasificación temporal:** `recordTimestamp`/`productionActivationAt`/`recordNature` siguen documentados pero no implementados en `src/`; `sourceType` se fija como `SYNTHETIC`. P0 antes de actividad real.
- **GitHub:** `main` en `d95c2321f5227e987b22455150fd7a62b4129fa0` (PR #638 integrada). CI run `45948074849`: 80 suites, 759 tests, 0 fallos.
- **Wix read-back 2026-11-27:** 9 páginas estáticas y 2 dinámicas; TPV página ID `yl5th`, ruta `/blank`. CMS: HistoricoCierresZ=1, CajaActual=1 ABIERTA, MovimientosCaja=5, TransaccionesTPV=0, ControlOperativo=78. Sin escrituras.
- **Wix CLI:** workflow manual `wix-tpv-preview.yml` preparado para Preview no publicador y smoke read-only. No ejecutado desde esta sesión; no acredita runtime TPV ni sincronización Git-Wix.
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
