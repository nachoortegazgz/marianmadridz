> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`nachoortegazgz@gmail.com`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](../qa/QA-ENVIRONMENT-SSOT.md).

---

# Registro histórico de automatizaciones — no acredita el aislamiento actual

**Actualización:** 2026-11-14.

El contenido anterior de este informe se obtuvo sobre un snapshot de sitio anterior. Sus conteos de automatizaciones, estados, destinatarios, restricciones y Site ID no deben trasladarse al sitio actual ni utilizarse como evidencia de aislamiento.

## Alcance vigente

- Sitio al que se refiere este corte histórico: referencia anterior de entorno, supersedida. No identifica el QA vigente `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Naturaleza declarada: banco de pruebas aislado, sin actividad real.
- La consulta GetSiteContext del 2026-11-14 no pudo resolver el Site ID.
- No se ha realizado una lectura actual de Wix Automations para este sitio en esta intervención.
- Por tanto, el estado de emails, SMS, WhatsApp, triggers, recipients y automatizaciones externas queda **pendiente de verificación**.

## Regla operativa

No disparar eventos ni ejecutar pruebas que puedan enviar comunicaciones, crear pagos, reembolsos, reservas, pedidos o tareas externas hasta verificar la configuración actual del propio sitio y utilizar destinatarios/proveedores de prueba controlados.

La referencia de aislamiento vigente es docs/audits/2026-11-13-current-site-isolation.md. Este documento histórico no la sustituye.
