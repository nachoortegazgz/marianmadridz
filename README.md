# Marian Madrid — repositorio técnico

Sitio: https://www.marianmadrid.es/  
Repositorio: `nachoortegazgz/marianmadridz` · Rama principal: `main`  
Plataforma: Wix Editor clásico + Velo.

## Entrada recomendada para personas y modelos IA

**[AI-ENTRYPOINT](docs/AI-ENTRYPOINT.md)** — instrucciones de lectura, autoridad documental, arquitectura, reglas técnicas y flujo de trabajo.  
**[AI-INDEX](docs/AI-INDEX.md)** — mapa de recuperación por dominio y catálogo de documentos.

## Estado del proyecto

**MVP operativo/comercial: NO-GO.** El sitio permanece Draft/no publicado según el último read-back documentado. La CI offline de Capa 0 está validada para el HEAD correctivo de `main` tras PR #679 (91 suites / 816 tests PASS); no acredita Wix Local Editor, Preview E2E, Runtime ni producción. No publicar ni ejecutar cobros reales.

El estado y la evidencia fechada se mantienen exclusivamente en [docs/STATE-NOW.md](docs/STATE-NOW.md). No mantener aquí copias de SHAs, métricas CI ni recuentos CMS.

## Documentación rectora

1. [Estado actual](docs/STATE-NOW.md).
2. [Canon de arquitectura](docs/PROJECT-CANON.md).
3. [Contrato TPV](docs/TPV-UNIFIED-FLOW.md).
4. [Release readiness](docs/RELEASE-READINESS.md).
5. [Esquema físico CMS](docs/ESQUEMA_CMS.md).
6. [Índice documental](docs/INDEX.md).
7. [Archivo histórico](docs/ARCHIVE-MANIFEST.md).

## Backend y pruebas

- [Backend general](src/backend/README.md).
- [Backend TPV](src/backend/tpv/README.md).
- [Plan de aceptación Wix Runtime](tests/runtime/RUNTIME-TEST-PLAN.md).

## Invariantes esenciales

- Wix Apps gobierna sus dominios nativos; Wix CMS es SSOT de entidades propias; Git es SSOT del código; SharePoint custodia evidencias.
- Frontend presenta e interactúa; backend/WebMethods resuelve negocio, autorización, validación y persistencia.
- Un solo código de dominio; fixtures y adaptadores sustituyen efectos externos, no la lógica.
- Sin bloqueos globales por entorno ni fallbacks silenciosos que oculten fallos.
- No borrar registros ni alterar ledgers append-only; rectificaciones trazables.
- Pruebas sin cobros, pagos, reembolsos, remisiones ni efectos externos reales.
- CI PASS no equivale a Runtime PASS ni a producción verificada.

Para iniciar cualquier tarea, leer [AI-ENTRYPOINT](docs/AI-ENTRYPOINT.md) y [STATE-NOW](docs/STATE-NOW.md).
