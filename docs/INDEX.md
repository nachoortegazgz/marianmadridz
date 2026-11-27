# Índice documental — Marian Madrid

**Entrada principal:** [PROJECT-CANON.md](PROJECT-CANON.md). Para decisiones operativas prevalecen [STATE-NOW.md](STATE-NOW.md) y [RELEASE-READINESS.md](RELEASE-READINESS.md).

| Necesidad | Documento |
|---|---|
| Identidad, arquitectura, decisiones e invariantes | [PROJECT-CANON.md](PROJECT-CANON.md) |
| Estado técnico vigente, evidencia Wix y bloqueos P0/P1 | [STATE-NOW.md](STATE-NOW.md) |
| Gates GO/NO-GO, CI y aceptación Runtime | [RELEASE-READINESS.md](RELEASE-READINESS.md) |
| Ubicación de documentación histórica | [ARCHIVE-MANIFEST.md](ARCHIVE-MANIFEST.md) |
| Auditoría Wix, TPV, CMS y CLI del 27-11-2026 | [audits/2026-11-27-wix-site-and-tpv-cli-audit.md](audits/2026-11-27-wix-site-and-tpv-cli-audit.md) |
| Verificación multicapa y read-back directo Wix del 27-11-2026 | [audits/2026-11-27-current-site-layer-verification.md](audits/2026-11-27-current-site-layer-verification.md) |
| Actualización legal RRSIF tras RDL 43/2026 del 27-11-2026 | [audits/2026-11-27-rrsif-deadline-update.md](audits/2026-11-27-rrsif-deadline-update.md) |
| Contrato de exportación Capa 3 y gates de registro externo | [audits/2026-11-27-capa3-export-preparation.md](audits/2026-11-27-capa3-export-preparation.md) |
| Evidencia, auditorías y decisiones históricas | [archive/2026-11/](archive/2026-11/) |
| Fixtures/snapshots QA (datos de prueba, no estado vivo) | [qa/](qa/) |
| Criterio vinculante del flujo TPV único | [TPV-UNIFIED-FLOW.md](TPV-UNIFIED-FLOW.md) |
| Esquema fiscal sintético, pruebas online de desarrollo y reset previo a producción | [TPV-SYNTHETIC-FISCAL-ACCEPTANCE.md](TPV-SYNTHETIC-FISCAL-ACCEPTANCE.md) |
| Contratos y estado TPV backend | [src/backend/tpv/README.md](../src/backend/tpv/README.md) |

## Reglas de mantenimiento

- Actualizar primero STATE-NOW y RELEASE-READINESS cuando cambie el estado operativo.
- Actualizar PROJECT-CANON cuando cambien decisiones, contratos o arquitectura.
- No duplicar informes de sesión como documentos vivos.
- Archivar evidencia histórica; no eliminarla si puede sustentar trazabilidad, decisiones o auditorías.
- Una fecha/estado de read-back debe acompañar toda afirmación sobre Wix CMS, apps o configuración.
- CI offline no equivale a Preview/Runtime ni a despliegue Wix.
