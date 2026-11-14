# Marian Madrid — Wix Editor Classic + Velo

Repositorio técnico del sitio Marian Madrid.

**Sitio objeto de auditoría:** `50b39f33-e753-4331-ab35-b2ed43dc97f7`  
**Naturaleza:** banco de pruebas aislado, sin actividad real, según declaración del propietario.  
**Plataforma:** Wix Editor Classic + Velo.  
**Código versionado:** rama `main`; el repositorio no demuestra por sí solo qué código está sincronizado en el Editor Wix.

## Referencias técnicas

- [Base maestra del proyecto](PROJECT_BASELINE.md)
- [Estado actual](ESTADO_ACTUAL_PROYECTO.md)
- [Diccionario CMS](DICCIONARIO_DATOS_CMS.md)
- [Auditoría del esquema live del sitio actual](docs/audits/2026-11-14-current-site-cms-normalization.md)

## Estado crítico

- CMS live: 23 colecciones (15 propias y 8 administradas por Wix Apps); 524 campos físicos en las colecciones propias.
- Los registros del sitio deben tratarse como datos sintéticos/de prueba; no acreditan actividad comercial, fiscal ni laboral real.
- Las mutaciones de registros propios están habilitadas por autorización expresa del propietario mediante `ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true`; se mantienen RBAC, permisos, validaciones, allowlists y exclusión de colecciones Wix Apps.
- No hay evidencia de sincronización íntegra Editor ↔ Git ni de release Wix vinculado a SHA.
- No publicar ni conectar procesos reales sin autorización expresa y revisión de los gates descritos en [PROJECT_BASELINE.md](PROJECT_BASELINE.md).
