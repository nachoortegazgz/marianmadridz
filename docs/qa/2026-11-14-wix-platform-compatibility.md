> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`nachoortegazgz@gmail.com`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](./QA-ENVIRONMENT-SSOT.md).

---


> **Validez del inventario:** los snapshots de CMS, catálogo y aplicaciones que aparecen en el cuerpo de este documento son históricos. La SSOT actual designa `188bed94-177c-4bc9-a9f0-35080d874f3e` como único QA, pero no demuestra que esos recuentos o esquemas pertenezcan al corte actual de ese Site ID. No usarlos como baseline para escrituras, migraciones o E2E hasta repetir una lectura de solo lectura contra el sitio vigente.

> **Estado vigente:** el único sitio QA es `188bed94-177c-4bc9-a9f0-35080d874f3e`. GetSiteContext consultado el 2026-11-14 confirma URL `https://www.marianmadrid.es/`, estado Published, dominio personalizado, Wix Editor y Velo habilitado. El propietario confirma que el sitio nunca ha tenido actividad real, que los datos son sintéticos y que la pasarela está desconectada.

# Compatibilidad de plataforma Wix — corte 2026-11-14

**Fecha:** 2026-11-14  
**Site ID único:** 188bed94-177c-4bc9-a9f0-35080d874f3e  
**Uso declarado:** banco de pruebas aislado, sin actividad real.

## Estado de plataforma conocido

La última lectura de contexto disponible en el historial del proyecto registró:

- Wix Editor Classic.
- Velo habilitado.
- Idioma/región es-ES.
- Zona horaria Europe/Madrid.
- Moneda EUR.
- Wix Bookings instalado.
- Wix Stores Catalog V3.
- Wix Invoices V2.
- Wix Members Area, Gift Cards, Blog y Forms & Payments.

GetSiteContext del 2026-11-14 sí resolvió el Site ID único y confirmó los metadatos de publicación y las aplicaciones instaladas. El estado Published no cambia la clasificación funcional QA declarada por el propietario.

## Compatibilidad de APIs

- El código debe seguir usando contratos compatibles con Wix Editor Classic + Velo; no se debe asumir Wix Studio.
- Wix Stores Catalog V3 es la autoridad del catálogo y stock comercial.
- La instalación de Wix Invoices V2 no demuestra que el backend use la API de facturas ni que exista integración con el ledger fiscal.
- No se ha acreditado un release Wix que vincule el runtime con un SHA de Git.
- La correspondencia entre el código Velo del Editor y el repositorio requiere exportación y comparación.

## Aislamiento y efectos externos

El propietario declara que el sitio es un banco de pruebas aislado y que no tiene actividad real. Esta declaración define el alcance funcional, pero no demuestra por sí sola el aislamiento técnico de:

- permisos CMS y roles;
- secretos y credenciales;
- Wix Automations;
- emails, SMS y WhatsApp;
- pasarelas de pago, reembolsos y webhooks;
- integraciones externas.

No se deben activar ni ejecutar esos efectos hasta verificar la configuración del propio sitio y disponer de destinatarios, credenciales y proveedores de prueba. No se ejecutaron triggers, pagos, comunicaciones, cambios de configuración ni publicaciones en esta auditoría.

## Referencias vigentes

- docs/audits/2026-11-13-current-site-isolation.md
- docs/audits/2026-11-14-current-site-cms-normalization.md
- docs/audits/2026-11-14-cajaactual-live-schema-audit.md
- ESTADO_ACTUAL_PROYECTO.md
