# Índice documental

**Vigencia:** 2026-11-28.  
**Entrada IA:** [AI-ENTRYPOINT](AI-ENTRYPOINT.md) · [AI-INDEX](AI-INDEX.md).

## Documentos rectores

- [STATE-NOW](STATE-NOW.md): estado, evidencia fechada y pendientes. Fuente del estado actual.
- [PROJECT-CANON](PROJECT-CANON.md): arquitectura, autoridad e invariantes.
- [TPV-UNIFIED-FLOW](TPV-UNIFIED-FLOW.md): contrato TPV, bloqueos y errores.
- [RELEASE-READINESS](RELEASE-READINESS.md): gates por contexto y condiciones GO.
- [ESQUEMA_CMS](ESQUEMA_CMS.md): esquema físico Wix y lectura CMS; snapshot 27-11-2026, no live.
- [Dossier Capa 3 — registro externo](architecture/CAPA3-REGISTRO-EXTERNO-DOSSIER.md): consolidación de obligaciones, arquitectura de exportación, SharePoint, automatización, PGC, matrices y flujos; transporte aún pendiente.\n- [VERI*FACTU y QR tributario — dossier de implementación](architecture/VERIFACTU-QR-IMPLEMENTATION-DOSSIER.md): normativa BOE/AEAT vigente, plazo actualizado, facturas/tickets, modalidades SIF, QR, remisión XML, incidencias, arquitectura Wix/Velo y plan de pruebas.
- [ARCHIVE-MANIFEST](ARCHIVE-MANIFEST.md): política y localización de documentos históricos.

## Código y ejecución

- [Backend general](../src/backend/README.md): WebMethods, permisos, Wix Data, hooks, eventos y jobs.
- [Backend TPV](../src/backend/tpv/README.md): módulos, colecciones y contratos TPV.
- [Plan Runtime](../tests/runtime/RUNTIME-TEST-PLAN.md): pruebas Wix aisladas y criterios de aceptación.

## Evidencia y auditorías

- [Auditoría de persistencia operativa — 28-11-2026](audits/2026-11-28-operational-persistence-audit.md): lectura Wix de colecciones propias, conciliación Bookings/eCommerce y brechas de persistencia por dominio.

- [Verificación del sitio y capas — 27-11-2026](audits/2026-11-27-current-site-layer-verification.md).
- [Auditoría integral de colecciones CMS — 27-11-2026](audits/2026-11-27-full-cms-collections-audit.md).
- [Aceptación MVP read-only — 27-11-2026](audits/2026-11-27-mvp-runtime-readonly-acceptance.md).
- [Alineación widget TPV / acciones — 27-11-2026](audits/2026-11-27-tpv-widget-action-alignment.md).
- [Auditoría Capa 0 — 28-11-2026](audits/2026-11-27-capa0-hardening.md): correcciones integradas y deuda pendiente; el nombre del archivo conserva la fecha original.
- [Conciliación de bugs Capa 0 — 28-11-2026](audits/2026-11-28-capa0-bug-reconciliation.md): hallazgos BUG-001…020 y resultados integrados en PR #670.
- [Propagación de errores Staff/Members/DAL — PR #675](audits/2026-11-28-capa0-provider-error-propagation.md): cambios integrados y CI offline PASS.
- [Hardening Capa 0 posterior a PR #675 — PR #679](audits/2026-11-28-capa0-post-675-hardening.md): sort Wix estricto, redacción ampliada, metadatos JSON-safe y bookingType canónico; 91 suites / 816 tests PASS en el SHA correctivo.
- [Preparación export Capa 3 — PR #641](audits/2026-11-27-capa3-export-preparation.md): contrato JSON y preparación backend; no acredita transporte SharePoint.
- [Secretos, importes y configuración Capa 0](audits/2026-11-28-capa0-secrets-money-config.md): errores de secretos, validación monetaria y constantes canónicas.
- [Contrato transactionId fiscal — 27-11-2026](qa/2026-11-27-p0-fiscal-transaction-contract.md).
- [Contrato de errores TPV — 27-11-2026](qa/2026-11-27-tpv-actionable-error-contract.md).
- [ADR transporte HtmlComponent — 26-11-2026](architecture/ADR-2026-11-26-WIX-HTMLCOMPONENT-TRANSPORT.md).

## Archivo histórico

- [Índice histórico de noviembre 2026](archive/2026-11/README.md).
- [Revisión documento a documento del archivo — 28-11-2026](archive/2026-11/ARCHIVE-REVIEW-2026-11-28.md): inventario de 161 documentos, clasificación y supersedencias.
- [Dossier consolidado histórico](archive/2026-11/DOSSIER CONSOLIDADO.txt).
- [Dossier de flujos Capa 1–3](archive/2026-11/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md).
- [Base de conocimiento histórica](archive/2026-11/PROJECT-KNOWLEDGE-BASE.md).
- [Decision log](archive/2026-11/DECISION-LOG.md).
- [Directriz de desarrollo 20-11-2026](archive/2026-11/PROJECT-OWNER-DIRECTIVE-2026-11-20.md).

Los informes, snapshots, ADRs, handoffs y QA anteriores se conservan bajo `docs/archive/2026-11/`. No se cargan todos por defecto; consultar el índice histórico y recuperar solo el documento pertinente.

## Mantenimiento

- STATE-NOW se actualiza cuando cambia estado/evidencia.
- PROJECT-CANON se modifica solo al cambiar una decisión/invariante aprobada.
- TPV-UNIFIED-FLOW y ESQUEMA_CMS se modifican solo cuando cambia su contrato o se obtiene un nuevo read-back.
- AI-ENTRYPOINT y AI-INDEX orientan la recuperación; no sustituyen fuentes técnicas.
- No duplicar resúmenes ni copiar snapshots/CI completos en múltiples documentos.
- Los históricos se conservan para trazabilidad; marcar claramente lo supersedido y enlazar su sustituto.
