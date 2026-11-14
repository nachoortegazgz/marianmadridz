# Estado actual del proyecto — Marian Madrid

**Corte:** 2026-11-14  
**Fuente de autoridad operativa:** [PROJECT_BASELINE.md](PROJECT_BASELINE.md). Este documento es un resumen ejecutivo; no duplicar aquí el historial de sesiones ni addenda antiguos.

## Estado verificado

- **Plataforma:** Wix Editor Classic + Velo, confirmada por el propietario.
- **Repositorio:** `nachoortegazgz/marianmadridz`, rama `main`, HEAD `ee2a2f8aee6a00cbe3733b4b8d6325a6cb54bb51` (PR #357 integrada).
- **Producción:** Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`, Published, Velo habilitado, Stores Catalog V3, Invoices V1.
- **QA:** Site ID `50b39f33-e753-4331-ab35-b2ed43dc97f7`, Draft, Velo habilitado, Stores Catalog V3, Invoices V2.
- **CMS producción:** 41 colecciones (12 NATIVE, 29 WIX_APP), 980 campos según inventario live del 2026-11-14.
- **Stock comercial:** Wix Stores Catalog V3; inventario custom retirado.
- **Capa 3:** SharePoint/Power Automate solo diseño documental; no operativa certificada.

## Bloqueos

1. No está demostrada la igualdad del código Velo en Wix Editor con GitHub `main`; falta exportación/copia reproducible del Editor y diff/hash por archivo.
2. QA no tiene aislamiento integral certificado.
3. Invoices difiere entre producción (V1) y QA (V2).
4. `QA_RECORD_MUTATIONS_ENABLED=true` sigue activa y bloquea producción.
5. No existe release Wix vinculado al SHA ni certificación E2E del runtime.

## Política de cambios

- No publicar ni desplegar sin autorización expresa.
- No cambiar CMS, permisos, apps o datos fuera del alcance autorizado.
- Mantener auth/RBAC, validación, secretos, idempotencia y límites de plataforma.
- Restaurar protecciones de mutabilidad antes de producción; la excepción QA no es política productiva.
- Validar cambios con diff revisado, CI, pruebas proporcionales al riesgo y rollback.
- Consultar [PROJECT_BASELINE.md](PROJECT_BASELINE.md) para arquitectura, prioridades, requisitos y fuentes de autoridad.

## Evidencias detalladas
- [Diccionario CMS](DICCIONARIO_DATOS_CMS.md).
- [Compatibilidad de plataforma Wix](docs/qa/2026-11-14-wix-platform-compatibility.md).
- [Reconciliación de baseline](docs/qa/2026-11-14-baseline-reconciliation.md).

Los estados históricos se conservan en commits, PRs e informes fechados para auditoría; no deben copiarse como estado actual.
