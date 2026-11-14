# Directrices de desarrollo, auditoría y QA — Marian Madrid

**Estado:** estándar raíz del proyecto.  
**Detalle técnico mantenido en:** [docs/engineering/DEVELOPMENT-STANDARDS.md](docs/engineering/DEVELOPMENT-STANDARDS.md).  
**Plan operativo QA:** [PLAN_ACCION_QA.md](PLAN_ACCION_QA.md).

## Autoridad y gobierno

- El propietario define objetivos, requisitos, prioridades y autorizaciones.
- La documentación oficial vigente de Wix y de cada integración define contratos, permisos, límites y comportamiento técnico.
- El código, CMS y pruebas acreditan implementación y estado; no sustituyen requisitos ni autorizaciones.
- Ante contradicciones, registrar la discrepancia, la evidencia y el impacto. No completar huecos mediante suposiciones.
- Distinguir siempre: VERIFICADO, DECLARADO, INFERIDO y PENDIENTE.

## Arquitectura obligatoria

- Wix CMS es SSOT transaccional para datos de dominio propios.
- Wix Bookings gobierna servicios, disponibilidad y reservas nativas.
- Wix Stores Catalog V3 gobierna catálogo e inventario comercial.
- Colecciones WIX_APP no se manipulan como CMS propio: utilizar APIs oficiales.
- SharePoint es repositorio documental de evidencias; Capa 3 no gobierna ni modifica Capa 1.
- Frontend de presentación; reglas de negocio y autorizaciones en backend/WebMethods.
- Constantes canónicas en `internalConfig.js`; validaciones compartidas en `validation.js`.
- Secretos exclusivamente en backend/secret stores.
- Webhooks, crons y procesos asíncronos deben ser idempotentes y recuperables.
- `MovimientosCaja` es el histórico fuente; `CajaActual` es una proyección. No actualizar la proyección sin su movimiento fuente.
- Anulaciones, devoluciones y rectificaciones deben conservar la relación con el hecho original; no borrar evidencia económica.

## Seguridad QA

- Site ID QA autorizado: `50b39f33-e753-4331-ab35-b2ed43dc97f7`, según decisión del propietario y baseline documental.
- Site ID producción: `188bed94-177c-4bc9-a9f0-35080d874f3e`; no usarlo como fallback de QA.
- Backend valida identidad de sitio, entorno y allowlists antes de operar. Configuración ausente o contradictoria => fail-closed.
- No confiar en una constante de frontend, query param, cookie o selector UI para definir TEST.
- Datos sintéticos exclusivamente; no copiar PII, credenciales, clientes, pedidos, reservas ni datos fiscales reales.
- Pagos se simulan mediante adaptadores locales/offline sin llamadas a proveedores. MOCK no equivale a SANDBOX ni a pago confirmado.
- Email, SMS, WhatsApp, gestoría, SharePoint, Power Automate, AEAT y Veri*Factu se sustituyen por sinks/mocks sin entrega.
- Ninguna prueba debe producir cargos, facturas reales, tickets a clientes, cambios de stock real o comunicaciones externas.
- La pausa de append-only/mutaciones declarada para QA no elimina gates independientes de writers fiscales/contables/laborales, pagos, reembolsos ni efectos externos.
- No borrar ni reiniciar datos sin identificar el entorno, allowlist, alcance y plan de recuperación.

## Desarrollo y cambios

Antes de programar:
1. Identificar módulo responsable y consumidores.
2. Inspeccionar contratos, enums, esquemas, permisos, índices y dependencias.
3. Consultar documentación oficial vigente.
4. Definir comportamiento, riesgos y pruebas de aceptación.
5. Diseñar el cambio mínimo.

Antes de retirar símbolos o datos:
1. Buscar consumidores en `src/`, páginas, tests, runners y workflows.
2. Comprobar contratos externos documentados.
3. Demostrar código muerto/duplicidad/obsolescencia.
4. Revisar diff completo.
5. Ejecutar suites pertinentes y regresión en el mismo SHA.

Cero deuda injustificada: sin alias innecesarios, legacy silencioso, APIs deprecated activas, código muerto, contratos zombis, parámetros ignorados ni abstracciones prematuras. No reducir líneas a costa de garantías.

## Testing y aceptación

- Vitest y runners canónicos del repositorio.
- Unitarias, integración, regresión, concurrencia, idempotencia, seguridad y E2E según riesgo.
- Separar resultados UNIT, MOCK, SANDBOX, WIX_RUNTIME y E2E.
- CI verde acredita únicamente las pruebas ejecutadas; no certifica runtime Wix ni proveedor externo.
- No afirmar una prueba como ejecutada si no existe resultado/artefacto reproducible.
- Cada iteración registra SHA, testRunId, scenarioId, traceId, resultado, defecto, corrección y re-test.
- P0/P1 abiertos, tests fallidos o rollback inexistente impiden despliegue.

## Release y despliegue

- Rama delimitada, PR revisable, CI verde, diff revisado y estrategia de rollback.
- Vincular publicación a un SHA exacto y a un Site ID allowlisted.
- No usar scripts que seleccionen automáticamente “último commit” sin comprobar SHA/destino.
- No inventar flags CLI. Confirmar el mecanismo en documentación oficial Wix para Wix Editor Classic + Velo.
- Publicar únicamente con autorización expresa y después de validar el entorno correspondiente.
- Restaurar las protecciones previas a producción y verificar el comportamiento en runtime antes de cualquier despliegue real.

## Prioridades

- P0: integridad fiscal, seguridad crítica, pérdida o exposición de datos.
- P1: reservas, pagos, concurrencia, caja, ledgers y jornada laboral.
- P2: integraciones, automatizaciones y exportaciones.
- P3: rendimiento, mantenibilidad y deuda técnica.
- P4: evolución funcional aprobada.

## Referencia operativa

El plan secuencial y sus gates están en [PLAN_ACCION_QA.md](PLAN_ACCION_QA.md). El estado live y las discrepancias deben mantenerse en [ESTADO_ACTUAL_PROYECTO.md](ESTADO_ACTUAL_PROYECTO.md) y [PROJECT_BASELINE.md](PROJECT_BASELINE.md).
