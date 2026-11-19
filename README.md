> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`nachoortegazgz@gmail.com`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](docs/qa/QA-ENVIRONMENT-SSOT.md).

---

# Marian Madrid — Wix Editor Classic + Velo

Repositorio técnico del ecosistema digital Marian Madrid.

**Sitio QA único:** `188bed94-177c-4bc9-a9f0-35080d874f3e` · [www.marianmadrid.es](https://www.marianmadrid.es/).
**Plataforma:** Wix Editor Classic + Velo.  
**Zona horaria / moneda:** `Europe/Madrid` / EUR.

## Estado de entorno

Por instrucción expresa del propietario, `188bed94-177c-4bc9-a9f0-35080d874f3e` es el único sitio QA del proyecto. Fue creado para pruebas previas al despliegue real, nunca ha tenido actividad real y todos sus datos son sintéticos. Cliente de prueba: Nacho Pitt (`nachoortegazgz@gmail.com`). La pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. El estado Wix Published es un metadato técnico y no cambia esta clasificación.

Mientras se resuelve el acceso QA, continuar únicamente con pruebas offline/mock y datos sintéticos. Los mocks de pago no llaman a proveedores ni acreditan transacciones reales. No enviar comunicaciones ni datos a servicios externos.

## Toolchain local y CI

- **Node.js:** Wix CLI for Sites requiere Node.js `24.22.1` o superior. CI fija exactamente `24.22.1`; en local se recomienda usar esa misma versión para reproducir los gates.
- **Wix CLI for Sites:** versión fijada en CI y en el procedimiento local: `@wix/cli@1.2.14`. Instalación local: `npm install --global @wix/cli@1.2.14`. Las actualizaciones de CLI deben aprobarse mediante un cambio deliberado y validarse en CI; no usar `@latest` en workflows.
- **GitHub Actions:** `actions/checkout@v6.0.0` y `actions/setup-node@v5.0.0` están fijadas por SHA en los workflows de calidad, Preview y secret scanning. Gitleaks también permanece fijado por SHA.
- **Wix Preview:** el workflow `.github/workflows/wix-tpv-preview.yml` solo se inicia manualmente (`workflow_dispatch`) desde `main`. La entrada `create_preview` tiene valor predeterminado `false`; solo si se activa explícitamente ejecuta `npm run wix preview`. No se ejecuta automáticamente en push/PR y nunca ejecuta `wix publish`. Requiere el secreto GitHub `CLI_API_KEY`.
- **Dependencias npm:** `package-lock.json` es el lockfile utilizado por `npm ci` en CI y sus dependencias raíz coinciden con `package.json`.
- **`wix.lock`:** está versionado y su cabecera lo identifica como artefacto generado automáticamente por Yarn Plug'n'Play; no editarlo manualmente. La auditoría del 19-11-2026 detectó una discrepancia en la dependencia raíz `@wix/stores`: `package.json` y `package-lock.json` declaran `1.0.997`, mientras que `wix.lock` resuelve `1.0.960`. El pipeline npm usa `package-lock.json`; la discrepancia de `wix.lock` queda pendiente de reconciliación en el checkout local conectado a Wix, usando el flujo oficial y comprobando el diff antes de aceptar cualquier cambio. No se ha regenerado ni modificado desde GitHub.

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
