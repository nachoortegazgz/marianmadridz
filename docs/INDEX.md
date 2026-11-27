# Índice documental

## Fuentes activas

- [STATE-NOW](STATE-NOW.md): estado, evidencia fechada y pendientes.
- [RELEASE-READINESS](RELEASE-READINESS.md): gates por contexto y condiciones GO.
- [PROJECT-CANON](PROJECT-CANON.md): invariantes de arquitectura y seguridad.
- [TPV-UNIFIED-FLOW](TPV-UNIFIED-FLOW.md): contrato TPV, bloqueos y errores explícitos.
- [ESQUEMA_CMS](ESQUEMA_CMS.md): esquema físico Wix vigente, inventario y auditoría read-only de datos.
- [Backend TPV](../src/backend/tpv/README.md) y [backend general](../src/backend/README.md): módulos y contratos de código.
- [Plan Runtime](../tests/runtime/RUNTIME-TEST-PLAN.md): ejecución Wix aislada.
- [Archivo histórico](ARCHIVE-MANIFEST.md): informes y decisiones sustituidos.

## Evidencia vigente (27-11-2026)

- [Auditoría multicapa Wix/CMS](audits/2026-11-27-current-site-layer-verification.md).
- [Alineación del widget TPV y colecciones nativas](audits/2026-11-27-tpv-widget-action-alignment.md).
- [Auditoría integral de las 41 colecciones CMS](audits/2026-11-27-full-cms-collections-audit.md).
- [Aceptación MVP read-only](audits/2026-11-27-mvp-runtime-readonly-acceptance.md).
- [Preparación Capa 3](audits/2026-11-27-capa3-export-preparation.md).
- [Estado normativo RRSIF](audits/2026-11-27-rrsif-deadline-update.md).
- [Contrato transactionId fiscal](qa/2026-11-27-p0-fiscal-transaction-contract.md).
- [Contrato de errores TPV](qa/2026-11-27-tpv-actionable-error-contract.md).
- [ADR transporte HtmlComponent](architecture/ADR-2026-11-26-WIX-HTMLCOMPONENT-TRANSPORT.md).

## Mantenimiento

STATE-NOW y RELEASE-READINESS reflejan cambios de estado. PROJECT-CANON y TPV-UNIFIED-FLOW solo cambian cuando cambia una decisión o contrato. No crear resúmenes duplicados. Los informes antiguos se conservan en `docs/archive` como evidencia histórica, nunca como instrucciones vigentes.
