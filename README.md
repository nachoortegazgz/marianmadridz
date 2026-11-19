# Marian Madrid — documentación del ecosistema Wix

Repositorio del sitio **Wix Editor Classic + Velo**.

- **Repositorio:** [nachoortegazgz/marianmadridz](https://github.com/nachoortegazgz/marianmadridz)
- **Sitio:** [www.marianmadrid.es](https://www.marianmadrid.es/) · **Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`
- **Corte:** 19-11-2026

## Guías operativas

| Para consultar | Documento |
|---|---|
| Estado, bloqueos y trabajo pendiente | [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md) |
| Arquitectura y fuentes de verdad | [PROJECT_BASELINE.md](PROJECT_BASELINE.md) |
| Próximas tareas y gates | [PLAN_ACCION_QA.md](PLAN_ACCION_QA.md) |
| Reglas de ingeniería y despliegue | [DIRECTRICES_DESARROLLO_CODIGO.md](DIRECTRICES_DESARROLLO_CODIGO.md) |
| Hardware TPV física | [HARDWARE_TPV.md](HARDWARE_TPV.md) |
| Esquema CMS documentado | [DICCIONARIO_DATOS_CMS.md](DICCIONARIO_DATOS_CMS.md) |
| Flujos Capa 1 → Capa 3 | [DOSSIER FLUJOS END TO END CAPA 3.md](DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md) |
| Decisiones técnicas | [docs/DECISION-LOG.md](docs/DECISION-LOG.md) |

## Estado resumido

- Último `main` conocido antes de esta actualización documental: `be10ca00211fc04b4452024aee01480af959f416`.
- Los workflows backend offline quality gates y secret scanning pasaron en ese SHA.
- CI offline no acredita Wix Runtime, periféricos, proveedor bancario ni E2E.
- Último estado Wix observado: **Draft**. No existe evidencia que vincule una publicación con un SHA de GitHub.
- Checkout local y sincronización automática del Local Editor: pendientes.
- La TPV física está en diseño; terminal, impresora y cajón concretos aún no están identificados.

## Principios esenciales

1. Wix CMS propio es la fuente transaccional de datos de dominio; Bookings y Stores gobiernan sus dominios nativos mediante APIs oficiales.
2. Los ledgers fiscales, contables, laborales y de caja son append-only. Las correcciones se registran mediante rectificaciones trazables.
3. SharePoint es repositorio de evidencia; Capa 3 no modifica ni gobierna Capa 1.
4. La lógica de negocio y las autorizaciones residen en backend/WebMethods.
5. Pagos, facturación, comunicaciones y automatizaciones externas permanecen bloqueados durante QA offline.
6. No publicar sin autorización expresa, CI verde, diff revisado, entorno validado y reversión preparada.

## Toolchain

- Wix CLI for Sites: `@wix/cli@1.2.14`.
- CI: Node.js `24.22.1`.
- `package-lock.json` es el lockfile npm utilizado por CI.
- `wix.lock` es generado automáticamente; no editar manualmente. La discrepancia de `@wix/stores` sigue pendiente de reconciliación local.

## Mantenimiento

Estado cambiante: `ESTADO_ACTUAL_PROYECTO.md`. Arquitectura: `PROJECT_BASELINE.md`. Trabajo: `PLAN_ACCION_QA.md`. Reglas: `DIRECTRICES_DESARROLLO_CODIGO.md`. Hardware: `HARDWARE_TPV.md`. Los dossiers extensos conservan contexto histórico y no prevalecen sobre el estado operativo actualizado.
