# Documentación operativa — Marian Madrid

Usar solo estas fuentes activas:

1. [Estado actual y relevo](STATE-NOW.md): estado Git/Wix/CMS, bloqueos y próxima secuencia.
2. [Release readiness](RELEASE-READINESS.md): criterios GO/NO-GO y evidencia por entorno.
3. [Canon de arquitectura](PROJECT-CANON.md): fuentes de verdad, límites de capas, seguridad e invariantes.
4. [Flujo TPV](TPV-UNIFIED-FLOW.md): contrato único, clasificación, persistencia y gates.
5. [Backend TPV](../src/backend/tpv/README.md): mapa de módulos y pruebas.
6. [Backend general](../src/backend/README.md): contratos Velo, CMS, eventos y jobs.
7. [Plan Runtime](../tests/runtime/RUNTIME-TEST-PLAN.md): procedimiento de aceptación Wix Preview, sujeto a precondiciones de seguridad.
8. [Manifiesto de archivo](ARCHIVE-MANIFEST.md): política y localización de evidencia histórica.

## Evidencia fechada vigente

- [Auditoría multicapa Wix/CMS](audits/2026-11-27-current-site-layer-verification.md).
- [Aceptación MVP read-only](audits/2026-11-27-mvp-runtime-readonly-acceptance.md).
- [Preparación de exportación Capa 3](audits/2026-11-27-capa3-export-preparation.md).
- [Actualización normativa RRSIF](audits/2026-11-27-rrsif-deadline-update.md).
- [Auditoría Wix/TPV/CLI anterior a PR #640](audits/2026-11-27-wix-site-and-tpv-cli-audit.md), solo como baseline histórico.
- [ADR del transporte HtmlComponent](architecture/ADR-2026-11-26-WIX-HTMLCOMPONENT-TRANSPORT.md).

## Regla de mantenimiento

No crear informes de estado duplicados ni conservar planes operativos superados. Actualizar STATE-NOW y RELEASE-READINESS cuando cambie el estado; PROJECT-CANON y TPV-UNIFIED-FLOW solo cuando cambien decisiones o contratos. La evidencia histórica se conserva separada y nunca sustituye al código o a una lectura actual del entorno.
