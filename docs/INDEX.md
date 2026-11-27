# Índice documental — Marian Madrid

## Fuentes operativas

| Propósito | Documento | Regla |
|---|---|---|
| Estado actual y relevo de sesión | [STATE-NOW.md](STATE-NOW.md) | Única referencia de continuidad; actualizar tras cada intervención. |
| Gates y decisión de release | [RELEASE-READINESS.md](RELEASE-READINESS.md) | Fuente de NO-GO/GO y evidencia por entorno. |
| Arquitectura, contratos e invariantes | [PROJECT-CANON.md](PROJECT-CANON.md) | Decisiones vigentes; no usar snapshots históricos como estado actual. |
| TPV flujo único | [TPV-UNIFIED-FLOW.md](TPV-UNIFIED-FLOW.md) | Contrato técnico TPV vigente. |
| Hito de núcleo TPV | [TPV-MILESTONE-01-UNIFIED-CORE.md](TPV-MILESTONE-01-UNIFIED-CORE.md) | Estado implementado y gaps restantes. |
| Backend TPV | [README backend](../src/backend/tpv/README.md) | Mapa de módulos, gates y pruebas. |
| Manifiesto de archivo | [ARCHIVE-MANIFEST.md](ARCHIVE-MANIFEST.md) | Ubicación y supersesión documental. |

## Auditorías vigentes del 2026-11-27

- [Auditoría Wix/TPV/CLI](audits/2026-11-27-wix-site-and-tpv-cli-audit.md): baseline anterior a PR #640; conservar como evidencia histórica, no como estado de código actual.
- [Verificación multicapa del sitio](audits/2026-11-27-current-site-layer-verification.md): Site Context, CMS y estructura.
- [Aceptación MVP read-only](audits/2026-11-27-mvp-runtime-readonly-acceptance.md): divergencia Bookings/CitasF2 y límites de Runtime.
- [Preparación de exportación Capa 3](audits/2026-11-27-capa3-export-preparation.md): paquete en memoria, sin transporte externo.
- [Actualización RRSIF](audits/2026-11-27-rrsif-deadline-update.md): fuentes BOE y calendario normativo.

## QA y archivo

- [Fixtures y escenarios QA](qa/): datos de prueba, no estado vivo.
- [Archivo histórico 2026-11](archive/2026-11/): auditorías, handoffs, decisiones y diseños sustituidos; solo consulta histórica.
- [TPV readiness anterior](archive/2026-11/qa/TPV-ONLINE-TEST-READINESS-2026-11-25-SUPERSEDED.md): copia archivada; no es instrucción operativa.

## Mantenimiento

- No duplicar estado actual en auditorías, README o handoffs.
- Actualizar STATE-NOW y RELEASE-READINESS cuando cambie la aceptación.
- PROJECT-CANON y TPV-UNIFIED-FLOW gobiernan decisiones/contratos.
- Archivos en archive son evidencia histórica fechada; no deben guiar ejecución si contradicen fuentes vigentes.
- Toda afirmación Wix/CMS incluye fecha de read-back y alcance.
- CI offline nunca acredita Wix Preview/Runtime ni producción.
