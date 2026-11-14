> **Addendum de vigencia — 2026-11-14:** este informe conserva una lectura anterior de contexto Wix. La designación del propietario para QA es `50b39f33-e753-4331-ab35-b2ed43dc97f7`; declara el sitio despublicado y pasarela desconectada. El conector de auditoría actual no resuelve ese ID, por lo que el estado runtime permanece pendiente. El estado Published descrito en la sección de producción no debe extrapolarse al QA.

# Compatibilidad de plataforma Wix — corte 2026-11-14

**Fecha:** 2026-11-14  
**Site ID único:** 50b39f33-e753-4331-ab35-b2ed43dc97f7  
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

La consulta GetSiteContext repetida el 2026-11-14 no devolvió contexto para este Site ID. Por tanto, el estado Published/Draft, el plan Premium, las propiedades y el inventario actual de aplicaciones quedan pendientes de nueva lectura contextual. No se infieren a partir de la captura histórica.

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
