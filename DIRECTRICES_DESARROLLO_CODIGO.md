# Directrices de desarrollo, auditoría y QA

**Vigencia:** 19-11-2026 · **Repositorio:** `nachoortegazgz/marianmadridz`

Estado: [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md) · Plan: [PLAN_ACCION_QA.md](PLAN_ACCION_QA.md) · Arquitectura: [PROJECT_BASELINE.md](PROJECT_BASELINE.md).

## 1. Autoridad y evidencia

- El propietario define requisitos, prioridades y autorizaciones.
- Documentación oficial vigente de Wix y proveedores define contratos técnicos.
- Decisiones aprobadas se registran en `docs/DECISION-LOG.md`.
- Ante contradicción, detener el cambio afectado, registrar evidencia e impacto y solicitar resolución.
- Clasificar afirmaciones como **VERIFICADO**, **DECLARADO**, **INFERIDO** o **PENDIENTE**.

## 2. Invariantes

- Wix CMS propio es SSOT transaccional; Bookings gobierna reservas y Stores Catalog V3 gobierna catálogo/inventario.
- SharePoint es repositorio de evidencia; Capa 3 no modifica ni gobierna Capa 1.
- Frontend sin lógica de negocio, secretos ni autorización. Backend/WebMethods valida identidad, permisos y reglas.
- Constantes en `internalConfig.js`; validaciones en `validation.js`.
- Secretos en almacén aprobado; nunca en cliente, repositorio, logs ni fixtures.
- Ledgers fiscales, contables, laborales y de caja son append-only; rectificaciones mediante nuevos registros trazables.
- `MovimientosCaja` es histórico fuente; `CajaActual` es proyección.
- Webhooks/jobs asíncronos deben ser idempotentes, seguros ante concurrencia y recuperables.
- No escribir directamente en colecciones administradas por Wix Apps.

## 3. Antes de implementar

1. Fijar SHA, rama y estado del árbol.
2. Identificar módulo, consumidores, imports/exports y dependencias.
3. Revisar esquemas CMS, permisos, índices, enums y contratos externos.
4. Consultar documentación oficial vigente.
5. Definir comportamiento, aceptación y riesgos.
6. Diseñar cambio mínimo y reversión.

No reescribir módulos funcionales por estética ni introducir funciones sin requisito demostrado.

## 4. Eliminación y refactorización

Antes de retirar archivos, símbolos, campos o colecciones:
- Buscar consumidores en `src/`, páginas, tests, runners, workflows y contratos externos.
- Revisar fixtures, datos persistidos y compatibilidad histórica.
- Demostrar ausencia de consumidores o duplicidad.
- Ejecutar suites pertinentes y regresión.
- Revisar diff completo.

Evitar alias redundantes, legacy silencioso, APIs deprecated, código muerto, duplicidades demostradas, parámetros ignorados y abstracciones prematuras. No reducir líneas a costa de integridad.

## 5. Pruebas

Aplicar pruebas proporcionales al riesgo: unitarias, contratos SDK/WebMethods, integración CMS/hooks/permisos, regresión, concurrencia, idempotencia, seguridad y Wix Runtime/E2E cuando el entorno esté neutralizado y autorizado.

Informar por separado UNIT, MOCK, CI, WIX_PREVIEW, WIX_RUNTIME y E2E. Asociar cada resultado a SHA, workflow/testRunId, escenario y evidencia reproducible. CI verde no certifica runtime, proveedores, periféricos, facturación ni cumplimiento legal.

## 6. Seguridad y efectos externos

- Fail-closed ante identidad de sitio, usuario, permisos o configuración desconocidos.
- No confiar en datos, roles, importes o propiedad enviados por navegador.
- No exponer PII innecesaria, datos de tarjeta, tokens ni secretos.
- QA offline usa mocks/sinks sin red para pagos, reembolsos, comunicaciones, fiscalidad y exportaciones.
- No mutar ledgers ni ejecutar operaciones reales por inferencia.
- No probar automatizaciones o notificaciones sin neutralización comprobada.

## 7. PR y despliegue

- Cambios delimitados en rama, PR revisable, CI verde, diff revisado y reversión.
- No commits directos a `main` para cambios sustantivos.
- No fusionar con pruebas fallidas, riesgos críticos abiertos o sin recuperación.
- Vincular Preview/Publish a Site ID y SHA exactos.
- Confirmar documentación oficial del flujo aplicable a Editor Classic + Velo; no extrapolar comandos Headless o Wix Apps.
- Nunca ejecutar Publish sin autorización expresa.
- Tras despliegue autorizado, verificar y registrar evidencia.

## 8. Prioridades

- **P0:** integridad fiscal, seguridad crítica, pérdida/exposición de datos.
- **P1:** reservas, pagos, caja, concurrencia, ledgers y jornada.
- **P2:** integraciones, automatizaciones y exportaciones.
- **P3:** rendimiento, mantenibilidad y deuda técnica.
- **P4:** evolución funcional aprobada.
