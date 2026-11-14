# Compatibilidad de plataforma Wix — corte 2026-11-14

## Fuente y alcance

Lectura de solo contexto mediante Wix GetSiteContext para el sitio principal y el sitio QA. No se han realizado llamadas de escritura, cambios de configuración ni publicación.

## Sitio principal — producción

- Nombre: Marian Madrid Peluquería y Estética.
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Estado: Published.
- Editor Type devuelto por Wix: `Editor`.
- Velo: Enabled.
- Zona horaria: `Europe/Madrid`.
- Moneda: EUR.
- Wix Stores: Catalog V3.
- Wix Invoices: V1.
- Wix Bookings, Members Area, Gift Cards, Blog y Forms & Payments instalados.

## Sitio QA

- Nombre: Marian Madrid QA - Aislado 2026-11.
- Site ID: `50b39f33-e753-4331-ab35-b2ed43dc97f7`.
- Estado: Draft.
- Editor Type devuelto por Wix: `Editor`.
- Velo: Enabled.
- Zona horaria: `Europe/Madrid`.
- Moneda: EUR.
- Wix Stores: Catalog V3.
- Wix Invoices: V2.
- Wix Bookings, Members Area, Gift Cards, Blog y Forms instalados.

## Hallazgos y consecuencias

### P1 — discrepancia entre plataforma declarada y plataforma live

El rol/documentación de proyecto describe Wix Studio, pero Wix devuelve `Editor Type: Editor` para el sitio principal y para el QA. No hay evidencia en esta lectura de que el sitio principal sea Wix Studio o Studio Two.

Consecuencia: no asumir disponibilidad de workflows, export/import o herramientas exclusivas de Wix Studio. La base actual debe tratarse como Wix Editor/Velo hasta que el propietario confirme otra cosa. No migrar de editor ni reconstruir el sitio por esta discrepancia sin decisión explícita.

### P1 — versiones de Wix Invoices distintas entre entornos

Producción tiene Wix Invoices V1 y el sitio QA tiene Wix Invoices V2. El backend actual no consume Wix Invoices API según las auditorías de código; la instalación de la app no demuestra emisión efectiva ni integración con el ledger fiscal propio.

Consecuencia:
- No asumir paridad de Invoices entre producción y QA.
- No usar una API V2 en producción mientras Wix mantenga la aplicación V1 y la consulta de Invoices V2 devuelva `428 INVOICES_API_UNAVAILABLE`.
- Mantener el ledger fiscal propio separado; no activar un segundo motor ni modificar series/numeración sin ADR y revisión fiscal.

### QA no certificado

El sitio QA está en Draft y usa un Site ID distinto, pero esta lectura no verifica aislamiento de permisos, datos CMS, secretos, automatizaciones, integraciones externas ni paridad de esquemas. Su nombre “Aislado” no es evidencia suficiente de aislamiento. Invoices V2 difiere de producción V1.

No ejecutar E2E que creen reservas, pedidos, facturas, pagos, reembolsos, emails o movimientos de ledger hasta auditar ese entorno y confirmar los guards fail-closed.

### Sincronización Editor ↔ GitHub pendiente

GetSiteContext no expone el contenido fuente de Velo ni el snapshot de archivos del Editor. Por tanto, esta lectura no permite comparar los archivos del Editor con `main`, ni resolver los diagnósticos de lint comunicados anteriormente.

Para cerrar la discrepancia se necesita una exportación/captura reproducible del código backend/frontend del Editor (o acceso autorizado a la fuente mediante el mecanismo oficial de Velo disponible para este sitio), con fecha y versión. Hasta entonces:
- GitHub `main` es la referencia del código versionado.
- El runtime/editor publicado no se considera sincronizado con el SHA de Git.
- No se declara E2E runtime validado.
- No publicar ni ejecutar un despliegue correctivo a ciegas.

## Estado de ingeniería asociado

- Git `main` en este corte documental: `331c572b9fbba4eaff9bf53a894e6c2377a13c22` (merge documental PR #355).
- Último baseline de código/configuración: `fde9466552b6819980475a682dc06395b57487f0` (PR #354).
- PR #352, #353 y #354 integradas con CI offline completo verde; detalles en `docs/qa/2026-11-14-baseline-reconciliation.md`.
- `QA_RECORD_MUTATIONS_ENABLED=true` sigue activa por autorización de QA y bloquea producción.
- No se ha publicado código ni cambiado configuración Wix en esta intervención.

## Decisiones pendientes del propietario

1. Confirmar si el uso de Wix Editor (en lugar de Wix Studio) es intencional y constituye la plataforma objetivo.
2. Confirmar si el sitio QA con Invoices V2 es el entorno de pruebas previsto, aun cuando producción usa V1.
3. Facilitar la fuente/export de Velo del Editor para reconciliarla con GitHub y cerrar la discrepancia de diagnósticos.
