# Marian Madrid — Wix Editor Classic + Velo

Repositorio técnico del ecosistema digital Marian Madrid.

**QA objetivo declarado:** `50b39f33-e753-4331-ab35-b2ed43dc97f7`.  
**Producción identificada:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · [www.marianmadrid.es](https://www.marianmadrid.es/).  
**Plataforma:** Wix Editor Classic + Velo.  
**Zona horaria / moneda:** `Europe/Madrid` / EUR.

## Estado de entorno

Por instrucción del propietario, el Site ID `50b39f33-e753-4331-ab35-b2ed43dc97f7` es el destino QA del proyecto. El inventario CMS de 2026-11-14 documenta 23 colecciones (15 propias y 8 Wix Apps). Sin embargo, la conexión Wix disponible en la sesión de auditoría no resolvió ese ID y solo identificó el sitio productivo `188bed94-177c-4bc9-a9f0-35080d874f3e`. El acceso runtime y el aislamiento efectivo de QA siguen pendientes de comprobación. **No ejecutar E2E de negocio sobre producción ni utilizar producción como fallback.**

Mientras se resuelve el acceso QA, continuar únicamente con pruebas offline/mock y datos sintéticos. Los mocks de pago no llaman a proveedores ni acreditan transacciones reales. No enviar comunicaciones ni datos a servicios externos.

## Documentos canónicos

- [Plan de acción QA](PLAN_ACCION_QA.md)
- [Directrices de desarrollo, auditoría y QA](DIRECTRICES_DESARROLLO_CODIGO.md)
- [Base maestra del proyecto](PROJECT_BASELINE.md)
- [Estado actual](ESTADO_ACTUAL_PROYECTO.md)
- [Diccionario CMS](DICCIONARIO_DATOS_CMS.md)
- [Estándar detallado de desarrollo](docs/engineering/DEVELOPMENT-STANDARDS.md)
- [Fixtures y cobertura mock](docs/qa/QA-SIMULATION-2026-11.md)
- [Auditoría del esquema CMS QA](docs/audits/2026-11-14-current-site-cms-normalization.md)
- [Registro de decisiones](docs/DECISION-LOG.md)

## Principios no negociables

- Wix CMS propio es SSOT transaccional; Wix Apps se operan mediante APIs oficiales.
- Frontend sin lógica de negocio; permisos y reglas en backend/WebMethods.
- `internalConfig.js` centraliza constantes canónicas; `validation.js` centraliza validaciones.
- Caja: `MovimientosCaja` es fuente histórica; `CajaActual` es proyección.
- Pagos, emails, SMS, gestoría, AEAT y demás salidas se simulan offline durante QA.
- No utilizar datos personales o credenciales reales en fixtures.
- No publicar ni desplegar sin autorización expresa, CI verde, diff revisado y rollback.
- El repositorio no demuestra por sí solo qué código está sincronizado/publicado en Wix.
