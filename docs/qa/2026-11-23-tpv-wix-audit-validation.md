# Read-back Wix Site Context — 2026-11-23

**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Fuente:** lectura directa de Wix Site Context (GetSiteContext), no inferencia documental.  
**Naturaleza:** consulta de contexto; no se realizaron cambios ni operaciones.

## Resultado observado

| Propiedad | Valor |
|---|---|
| Estado de publicación devuelto | **Draft** |
| Editor | Wix Editor |
| Velo | Habilitado |
| Plan | Premium |
| Dominio | Personalizado configurado |
| Moneda | EUR |
| Zona regional | Europe/Madrid |
| Apps observadas | Bookings, Forms & Payments, Gift Cards, Payments, Stores Catalog V3, Invoices V1, Members Area, Blog, Promote SEO |

## Reconciliación con evidencia histórica

La issue [#526](https://github.com/nachoortegazgz/marianmadridz/issues/526), cerrada el 2026-11-23, conserva una auditoría previa que describía el sitio como Published y reservas online habilitadas en 94/94 servicios. La lectura directa posterior de Site Context devuelve Draft. Esto resuelve únicamente el estado de publicación devuelto en el momento del read-back; no demuestra cuándo ni cómo cambió el estado, ni que el bloqueo de reservas se haya verificado en Runtime.

La issue [#520](https://github.com/nachoortegazgz/marianmadridz/issues/520) registra ocho automatizaciones ACTIVE: siete PREINSTALLED con restricciones de cambio y una APPLICATION. Su estado operativo y sus efectos requieren inspección específica; el estado Draft del sitio no demuestra que no puedan ejecutarse.

## Límites probatorios

- Draft no acredita sincronización entre el SHA Git y Wix Editor.
- La lectura de contexto no demuestra que Preview/Runtime ejecute el código del repositorio.
- No acredita permisos efectivos, aislamiento Sandbox/Online, configuración de CMS ni ausencia de efectos externos.
- No sustituye la prueba negativa de reservas, pagos, automatizaciones ni writers fiscales.
- No se han ejecutado escrituras CMS, pagos, reembolsos, facturación, emisión Veri*Factu, cambios de automatizaciones, publicación ni despliegue.

## Resultado

**Estado de publicación observado: Draft. Aceptación Runtime y producción: NO-GO.**

Para el estado global, backlog y aceptación TPV, consultar [PROJECT-STATUS](../PROJECT-STATUS.md), [BACKLOG](BACKLOG-RECONCILIATION-2026-11-23.md) y [matriz TPV](TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md).