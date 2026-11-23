# Plan maestro de ejecución — Marian Madrid

**Corte:** 2026-11-23  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Release:** **NO-GO**.

Este es el plan de ejecución. El estado real y las evidencias se mantienen en [PROJECT-STATUS.md](PROJECT-STATUS.md); el detalle de issues, en [BACKLOG-RECONCILIATION](qa/BACKLOG-RECONCILIATION-2026-11-23.md). No duplicar esas tablas aquí.

## 1. Invariantes de arquitectura y operación

- Wix CMS es SSOT transaccional de los datos propios.
- SharePoint es repositorio de evidencia documental; Capa 3 no modifica ni gobierna Capa 1.
- Frontend sin reglas de negocio ni autoridad de permisos; lógica, validación y autorización en backend/WebMethods.
- Constantes canónicas en `internalConfig.js`; validaciones compartidas en `validation.js`.
- Ledgers fiscales, contables, laborales, de caja y eventos de idempotencia son append-only. Corregir mediante nuevos registros trazables, nunca borrar o sobrescribir.
- Sandbox y Online se verifican por separado; nombres o flags no prueban aislamiento del data plane.
- CI offline no equivale a Wix Runtime, CMS live, autorización efectiva ni aceptación legal.
- No ejecutar pagos, reembolsos, facturación, comunicaciones externas ni escrituras económicas reales durante QA.

## 2. Prioridades y secuencia

| Prioridad | Trabajo | Criterio de avance |
|---|---|---|
| P0 | CajaActual / concurrencia (#525) | Lock compartido integrado por PR #528; ejecutar exclusión mutua, idempotencia, timeout y recuperación en Wix Sandbox Runtime. |
| P0 | Compensaciones y caja (#416) | Conciliar cada compensación con su origen y ledger; recuperación trazable sin mutar históricos. |
| P0 | Maestro fiscal (#415) | MapaStaff/consumidores alineados en main; PR #556 elimina fallback TERCERO/EMISOR. Falta CONFIG_SISTEMA legal verificado; no recrear colecciones por inferencia. |
| P0 | Automatizaciones Wix (#520) | Auditar las ocho automatizaciones ACTIVE y definir contención soportada, sin sortear restricciones Wix. |
| P0 | SIF/Veri*Factu (#209) | Validación normativa, técnica, proveedor y asesoría; writers, firma, QR y remisión deshabilitados hasta aceptación. |
| P1 | Protección de main (#210) | Ruleset/protección, PR obligatoria, checks requeridos, bloqueo force-push/borrado mediante administrador. |
| P1 | TPV E2E | Identidad/roles, sesión, ventas sintéticas, movimientos, devoluciones, X/Z, auditoría, retry y concurrencia en Wix Preview/Runtime. |
| P1 | Bookings/Payments E2E | Checkout, reservas, webhooks, cancelaciones y reembolsos solo en Sandbox y sin efectos externos reales. |
| P2 | Capa 3 e integraciones | Exportaciones, SharePoint y Power Automate como evidencia/transporte documental, sin gobernar Capa 1. |
| P3 | Calidad evolutiva | Accesibilidad, SEO, rendimiento, UX móvil y limpieza de código, después de P0/P1. |
| P4 | Release | Regresión completa, seguridad, sync Git-Wix, rollback, aceptación legal/operativa y autorización expresa. |

## 2.1. Trabajo de código ejecutado — 2026-11-23

| PR | Alcance | CI offline | Estado |
|---|---|---|---|
| #551 | Metadatos TPV neutrales y compatibilidad histórica | 79 suites / 726 tests PASS | Draft; Runtime pendiente |
| #554 | `AUDIT_LIST` conectado a eventos append-only de auditoría | 79 suites / 725 tests PASS | Draft; Preview/Runtime pendiente |
| #556 | Emisor fiscal solo desde singleton CONFIG_SISTEMA único | 79 suites / 728 tests PASS | Draft; configuración legal y Runtime pendientes |

Estas PR no están fusionadas ni desplegadas. Sus pruebas offline no acreditan instalación Wix, permisos efectivos, CMS Runtime ni ausencia de efectos externos.

## 3. Orden de ejecución obligatorio

1. Resolver integridad de CajaActual y compensaciones (#525, #416).
2. Cerrar maestro fiscal y automatizaciones (#415, #520), manteniendo bloqueados los efectos externos.
3. Habilitar protección de main (#210) mediante administración del repositorio.
4. Completar TPV E2E en Preview/Runtime, sin pagos reales.
5. Completar Bookings/Payments E2E y prueba negativa de no efectos externos.
6. Validar SIF/Veri*Factu con asesoría y proveedor; no emitir hasta aceptación.
7. Validar Capa 3 documental.
8. Ejecutar release readiness (#434) y decidir GO/NO-GO con evidencias.

## 4. Estabilización del repositorio — resultado y límite

**Completado en código, pruebas automatizadas y documentación:** corrección contractual TPV integrada por PR #543; consolidación documental #544 y actualización #545. PR #545 quedó integrada en main mediante merge commit `9dbeacfc505bdfb58e8e1cdf9d566c8662cda739`. Su HEAD pre-merge `57013eed25a5f8c755a2e5cd3434c792b3dec78c` pasó Backend offline quality gates (run [45112082881](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082881)) y Secret scanning (run [45112082897](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112082897)). El merge commit también pasó backend (run [45112229859](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229859)) y secret scanning (run [45112229890](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45112229890)).

**Pendiente de gobierno:** la rama `main` sigue sin protección efectiva (`protected=false`); issue #210 abierta. El CI verde no sustituye required checks ni reglas de protección.

## 5. Criterios de aceptación y release

- Cambios delimitados, consumidores y contratos revisados.
- CI completa y secret scanning SUCCESS en el SHA candidato.
- Diff revisado; sin escrituras CMS/ledgers no autorizadas.
- Pruebas proporcionales al riesgo, incluidas Runtime/E2E cuando corresponda.
- Sin riesgos P0 abiertos ni fallos de integridad, seguridad o recuperación.
- SHA instalado en Wix identificado y sincronizado; rollback probado.
- Fiscalidad y cumplimiento aceptados por profesionales/proveedor cuando aplique.
- Aprobación explícita antes de publicar o activar efectos externos.

## 6. Referencias

- [Estado operativo](PROJECT-STATUS.md)
- [Backlog e issues](qa/BACKLOG-RECONCILIATION-2026-11-23.md)
- [Matriz de aceptación TPV](qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md)
- [Gobierno documental](README.md)
- [Estándares de desarrollo](engineering/DEVELOPMENT-STANDARDS.md)