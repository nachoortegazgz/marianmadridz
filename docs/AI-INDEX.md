# AI-INDEX — mapa de conocimiento y recuperación

**Vigencia:** 2026-11-28 · **Estado:** ACTIVE  
**Entrada obligatoria:** [AI-ENTRYPOINT](AI-ENTRYPOINT.md)

Este índice evita cargar el repositorio completo en cada consulta. Buscar primero en el dominio correcto y abrir el documento especializado; el archivo histórico no es fuente operativa.

## 1. Ruta de recuperación rápida

| Necesidad | Fuente primaria | Complementar con |
|---|---|---|
| ¿Cuál es el estado actual? | [STATE-NOW](STATE-NOW.md) | [RELEASE-READINESS](RELEASE-READINESS.md) |
| ¿Qué arquitectura y reglas prevalecen? | [PROJECT-CANON](PROJECT-CANON.md) | AI-ENTRYPOINT |
| ¿Cómo funciona TPV/caja/pago/cierre? | [TPV-UNIFIED-FLOW](TPV-UNIFIED-FLOW.md) | [TPV backend README](../src/backend/tpv/README.md) |
| ¿Cómo funciona Capa 3, registro externo y SharePoint? | [Dossier Capa 3 — registro externo](architecture/CAPA3-REGISTRO-EXTERNO-DOSSIER.md) | Auditoría de preparación [PR #641](audits/2026-11-27-capa3-export-preparation.md), esquema CMS y documentos históricos enlazados en el dossier |\n| ¿Cómo implementar VERI*FACTU, facturas simplificadas y QR tributario? | [Dossier VERI*FACTU y QR](architecture/VERIFACTU-QR-IMPLEMENTATION-DOSSIER.md) | BOE, especificaciones técnicas/FAQ AEAT, contrato SIF y pruebas Epson/Wix Runtime |
| ¿Qué APIs Wix usar? | Documentación oficial del método concreto | Backend README y tests del consumidor |
| ¿Cuál es el esquema físico CMS? | [ESQUEMA_CMS](ESQUEMA_CMS.md) | Auditorías CMS fechadas |
| ¿Qué se necesita para liberar? | [RELEASE-READINESS](RELEASE-READINESS.md) | [RUNTIME-TEST-PLAN](../tests/runtime/RUNTIME-TEST-PLAN.md) |
| ¿Cómo se estructura backend? | [Backend README](../src/backend/README.md) | Código y pruebas |
| ¿Qué se decidió y por qué? | ADRs y decision records | [ARCHIVE-MANIFEST](ARCHIVE-MANIFEST.md) |
| ¿Qué se observó en Wix en una fecha concreta? | Auditoría fechada correspondiente | Nunca tratarla como lectura live |
| ¿Qué se ejecutó en una sesión anterior? | Handoff archivado | Revalidar todo antes de actuar |

## 2. Documentos rectores activos

| Documento | Dominio | Vigencia / límite |
|---|---|---|
| [STATE-NOW](STATE-NOW.md) | Estado, commits, CI, pendientes y última evidencia Wix | Actualizar con cada cambio de estado |
| [PROJECT-CANON](PROJECT-CANON.md) | Arquitectura, autoridad, invariantes | Cambiar solo con decisión aprobada |
| [TPV-UNIFIED-FLOW](TPV-UNIFIED-FLOW.md) | Contrato funcional/técnico TPV | Cambiar solo con cambio de contrato |
| [RELEASE-READINESS](RELEASE-READINESS.md) | Gates de release por entorno | No confundir CI con Runtime |
| [ESQUEMA_CMS](ESQUEMA_CMS.md) | Esquema físico y recuentos Wix | Snapshot 27-11-2026; no es live |
| [Capa 3 — registro externo](architecture/CAPA3-REGISTRO-EXTERNO-DOSSIER.md) | Contrato export, transporte SharePoint, automatización, PGC y matrices de correspondencia | Diseño consolidado; transporte y E2E pendientes |
| [VERI*FACTU y QR](architecture/VERIFACTU-QR-IMPLEMENTATION-DOSSIER.md) | Requisitos SIF, modalidad VERI*FACTU, QR tributario, remisión AEAT, impresión térmica y pruebas | Diseño normativo/técnico documentado; implementación no acreditada |
| [INDEX](INDEX.md) | Catálogo de documentos especializados | Navegación humana |
| [ARCHIVE-MANIFEST](ARCHIVE-MANIFEST.md) | Política y localización de históricos | No es fuente de estado |

## 3. Evidencias y documentos especializados

- [Auditoría de persistencia operativa — 2026-11-28](audits/2026-11-28-operational-persistence-audit.md): lectura CMS real, Bookings V2, eCommerce Orders/Transactions y revisión estática de writers; identifica brechas y límites Runtime.

### Auditorías Wix / CMS / runtime

- [Verificación de sitio y capas — 2026-11-27](audits/2026-11-27-current-site-layer-verification.md): Site Context, CMS, revisión estática TPV y límites de prueba.
- [Auditoría integral CMS — 2026-11-27](audits/2026-11-27-full-cms-collections-audit.md): lectura de las 41 colecciones; revisar fecha y alcance.
- [Aceptación MVP read-only — 2026-11-27](audits/2026-11-27-mvp-runtime-readonly-acceptance.md): lectura anterior (ControlOperativo 78 / CitasF2 11), divergencias Bookings/CitasF2 y límites Runtime. La auditoría CMS integral posterior del mismo día registra 81 / 12; usar `ESQUEMA_CMS.md` como snapshot físico más reciente.
- [Auditoría Wix CLI/TPV — 2026-11-27](audits/2026-11-27-wix-site-and-tpv-cli-audit.md): baseline anterior a PR #640; histórico/supersedido para estado de implementación.
- [Auditoría TPV widget/action — 2026-11-27](audits/2026-11-27-tpv-widget-action-alignment.md): correspondencia de UI, bridge y acciones; verificar que no haya revisión posterior.
- [Auditoría Capa 0 — 2026-11-28](audits/2026-11-27-capa0-hardening.md): correcciones integradas y deuda pendiente. Nombre de archivo conserva fecha 27, contenido actualizado a 28.
- [Propagación de errores Staff/Members/DAL — PR #675](audits/2026-11-28-capa0-provider-error-propagation.md): cambios integrados y CI offline PASS (89 suites / 804 tests); queda pendiente verificar cobertura de service providers y resolver secretos.
- [Hardening posterior a PR #675 — PR #679](audits/2026-11-28-capa0-post-675-hardening.md): sort Wix estricto, redacción ampliada, metadatos JSON-safe y bookingType canónico; `main` 91 suites / 816 tests PASS en el SHA correctivo.
- [Conciliación bugs Capa 0 — 2026-11-28](audits/2026-11-28-capa0-bug-reconciliation.md): análisis BUG-001…020; hallazgos y resultados integrados en PR #670; contrastar el estado vigente con STATE-NOW.
- [Preparación export Capa 3 — PR #641](audits/2026-11-27-capa3-export-preparation.md): contrato JSON y WebMethod de preparación; no demuestra transporte M365.

### QA, contratos y decisiones

- [Contrato transactionId fiscal — 2026-11-27](qa/2026-11-27-p0-fiscal-transaction-contract.md).
- [Contrato de errores accionables TPV — 2026-11-27](qa/2026-11-27-tpv-actionable-error-contract.md).
- [ADR transporte HtmlComponent — 2026-11-26](architecture/ADR-2026-11-26-WIX-HTMLCOMPONENT-TRANSPORT.md).
- [Plan de aceptación Wix Runtime](../tests/runtime/RUNTIME-TEST-PLAN.md): procedimiento pendiente de ejecución.

### Código y contratos próximos a la implementación

- [Backend general](../src/backend/README.md): WebMethods, permisos, Wix Data, hooks, eventos y jobs.
- [Backend TPV](../src/backend/tpv/README.md): módulos, colecciones y límites TPV.
- [Código fuente](../src/backend/): prevalece como implementación actual solo tras inspeccionar el SHA.
- [Tests](../src/backend/tests/): comportamiento offline/contratos según suite ejecutada.

## 4. Documentos heredados fuera del árbol activo

- `/ESQUEMA_CMS.md` en la raíz del repositorio es un inventario antiguo resumido. Está supersedido por [`docs/ESQUEMA_CMS.md`](ESQUEMA_CMS.md), que contiene el baseline físico Wix del 27-11-2026. No usar ambos como fuentes equivalentes.

## 5. Archivo histórico

- [Manifiesto de archivo](ARCHIVE-MANIFEST.md): regla de uso.
- [Índice de archivo noviembre 2026](archive/2026-11/README.md): navegación por auditorías, ADR, QA, handoffs y dossiers.
- [Revisión individual del archivo — 28-11-2026](archive/2026-11/ARCHIVE-REVIEW-2026-11-28.md): inventario de los 161 documentos preexistentes, clasificación, supersedencias, datos personales redactados y reglas de reutilización.
- [Dossier consolidado histórico](archive/2026-11/DOSSIER CONSOLIDADO.txt): contexto histórico; revisar avisos de vigencia y no seguir instrucciones antiguas.
- [Dossier de flujos Capa 1–3](archive/2026-11/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md): diseño y snapshots históricos; no acredita implementación.
- [Base de conocimiento histórica](archive/2026-11/PROJECT-KNOWLEDGE-BASE.md): corte 23-11-2026; no es SSOT actual.
- [Decision log](archive/2026-11/DECISION-LOG.md): decisiones históricas; verificar si cada una sigue vigente.
- [Directriz de desarrollo histórica](archive/2026-11/PROJECT-OWNER-DIRECTIVE-2026-11-20.md): contexto de gobierno; las instrucciones explícitas posteriores del propietario prevalecen.

## 6. Reglas de indexación y obsolescencia

1. No indexar cada handoff o snapshot individual como documento activo. Mantenerlos agrupados en el índice del archivo.
2. Un documento histórico puede contener una decisión todavía vigente; recuperar la decisión y comprobar si existe una actualización posterior.
3. Un archivo con fecha antigua puede seguir siendo fuente de un contrato si no ha sido sustituido. La fecha por sí sola no determina obsolescencia.
4. Marcar como SUPERSEDED cuando exista documento/decisión sustituta demostrable. Mantener el archivo para trazabilidad.
5. No copiar datos personales, secretos, credenciales ni payloads operativos en índices IA. Resumir por contrato y enlazar la evidencia protegida.
6. Evitar duplicar contenido: cada dato factual tiene un documento rector; los demás enlazan a él.
7. Ante enlaces rotos, buscar el path real en GitHub antes de corregir. No inventar rutas.
