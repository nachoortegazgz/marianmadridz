# Marian Madrid — repositorio técnico

**Sitio:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Plataforma:** Wix Editor clásico + Velo.

## Estado operativo

- **Release:** NO-GO. El sitio no está autorizado para operación comercial ni para activar pagos/writers fiscales.
- **Entorno:** QA/desarrollo único; el propietario declara que no ha tenido actividad real y que los datos de prueba son sintéticos.
- **Wix Site Context (read-back 2026-11-23):** Draft; Velo habilitado; plan Premium; dominio personalizado; EUR / Europe-Madrid.
- **Documentación canónica:** [índice](docs/INDEX.md), [estado vigente](docs/STATE-NOW.md) y [manifiesto histórico](docs/ARCHIVE-MANIFEST.md).
- **Límite:** CI offline no acredita sincronización Git-Wix, Preview/Runtime, integridad CMS live, aceptación fiscal ni pruebas E2E.

## Navegación canónica

- [Índice documental](docs/INDEX.md)
- [Estado vigente](docs/STATE-NOW.md)
- [Manifiesto del archivo histórico](docs/ARCHIVE-MANIFEST.md)
- [README backend TPV](src/backend/tpv/README.md)

## Invariantes

- Wix CMS es la fuente de verdad transaccional de los datos de dominio propios; las apps Wix gobiernan sus dominios nativos.
- SharePoint almacena evidencia documental; no gobierna Capa 1.
- Frontend sin lógica de negocio ni autoridad de permisos; validación y autorización en backend/WebMethods.
- Los ledgers declarados append-only permanecen inmutables; las correcciones se registran mediante eventos rectificativos trazables.
- Los datos sintéticos QA no se deben confundir con hechos económicos, laborales o fiscales reales. Cualquier limpieza preproducción debe ser selectiva, autorizada, respaldada y auditada; no habilita mutaciones indiscriminadas de ledgers.
- No habilitar pagos reales, writers fiscales, emisión Veri*Factu, automatizaciones externas ni publicación durante QA sin sus gates y autorización.
- No borrar informes históricos por parecer antiguos: se conservan como evidencia fechada y se etiquetan como no vigentes cuando corresponda.

## Validación

El estado de cada control debe asociarse al SHA y al entorno exactos. No declarar Wix Runtime, Preview, E2E ni producción a partir de pruebas offline.
