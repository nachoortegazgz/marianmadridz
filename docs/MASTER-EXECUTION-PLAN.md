# Plan maestro de ejecución — Marian Madrid

**Corte verificado:** 2026-11-23  
**Repositorio:** nachoortegazgz/marianmadridz  
**main:** 956356db48ee9d0ba363023c14105474316f84dd  
**Sitio Wix:** 188bed94-177c-4bc9-a9f0-35080d874f3e  
**Estado global:** desarrollo/QA; release **NO-GO**.

Este documento es el plan operativo vigente. Los snapshots históricos se conservan en sus documentos de auditoría enlazados, pero no deben utilizarse como estado actual si contradicen este corte.

## 1. Objetivo y reglas de gobierno

Mantener el ecosistema funcional, seguro, verificable y alineado con contratos oficiales de Wix y normativa española. Mejorar el sistema existente con cambios mínimos y evidencia reproducible.

- Wix CMS es la fuente de verdad transaccional.
- SharePoint es repositorio de evidencia; no gobierna ni modifica Capa 1.
- Lógica, validación y autorización residen en backend/WebMethods.
- El frontend presenta y orquesta; no decide permisos ni reglas de negocio.
- Constantes canónicas en internalConfig.js; validaciones compartidas en validation.js.
- Ledgers fiscales, contables, laborales, de caja y eventos de idempotencia son append-only. Corregir mediante nuevos registros trazables, nunca borrando o sobrescribiendo históricos.
- Sandbox y Online se verifican por separado; los nombres o flags del entorno no prueban aislamiento del data plane.
- Ningún test offline equivale a Wix Runtime, CMS live, autorización efectiva ni aceptación legal.
- No ejecutar pagos, reembolsos, facturación, comunicaciones externas ni escrituras económicas reales durante QA.

## 2. Estado actual verificado

### 2.1 Repositorio e integración

- main HEAD: 956356db48ee9d0ba363023c14105474316f84dd.
- PR #541 integrada en main mediante merge commit e7a4827c4bf2ec683df72b83ba5f4908c1f36e9a.
- PR #540 integrada antes; PR #542 también se fusionó después y produjo el HEAD actual 956356db48ee9d0ba363023c14105474316f84dd. La ejecución CI de ese merge falló.
- PR #537 fue preservada en el historial de #541 mediante merge commit 1bd1e2d02a741cc4ebad883524f3652ed6aa905b.
- La rama main informa protected=false. No hay evidencia de required status checks ni protección efectiva.
- PR #210 permanece abierta. La integración disponible no expone una acción autorizada para modificar branch protection/rulesets; requiere permisos de administración del repositorio.

### 2.2 CI del HEAD actual

- Backend offline quality gates: **FAIL**, run [45105979742](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45105979742).
- Secret scanning: **SUCCESS**, run [45105979748](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45105979748).
- Main sigue fallida por la aserción TPV obsoleta integrada en PR #542. PR #543 corrige las expectativas de seis métodos, la clasificación de OTROS y el default/guard de movimientos de efectivo. En HEAD eee6d75e5cf843a38823e7fa4c908783db175208, Backend offline quality gates SUCCESS (run 45106697984): Layer 1 364/364, Layer 2 255/255, suite offline 736/736, npm audit 0, contratos Wix SDK/eCommerce/TPV y ESLint SUCCESS. Secret scanning SUCCESS (run 45106698016). La corrección aún no está integrada en main.

### 2.3 Contrato de pagos TPV

El enum centralizado actual contiene EFECTIVO, TARJETA, BIZUM, BONO, TARJETA_REGALO y OTROS. El validador, la conciliación de cierre y las devoluciones utilizan ese enum; el widget ofrece esos seis medios.

BONO y TARJETA_REGALO están soportados como medios sintéticos de registro y conciliación. No está acreditado el consumo de saldo, la integración transaccional con Wix Gift Cards, el pasivo contable del bono ni el canje de valor real. No habilitar pagos reales ni presentar esos medios como redención nativa.

### 2.4 Wix y entorno

Última lectura documental de Wix del 2026-11-23: Site ID 188bed94-177c-4bc9-a9f0-35080d874f3e, Editor Classic, Velo Enabled, EUR, Europe/Madrid, estado Draft. Apps observadas: Bookings, Forms & Payments, Gift Cards, Payments, Stores Catalog V3, Invoices V1, Members Area, Blog y Promote SEO.

La lectura de contexto no acredita que el SHA de Git esté sincronizado con Wix Editor, ni que Preview/Runtime esté validado. No se han ejecutado escrituras CMS, pagos, reembolsos, emisión fiscal ni despliegue durante esta estabilización.

## 3. Backlog vigente por prioridad

### P0 — integridad y contención

| Issue | Estado | Siguiente acción |
|---|---|---|
| [#525](https://github.com/nachoortegazgz/marianmadridz/issues/525) CajaActual | Abierta | Unificar serialización/CAS de todos los escritores; probar concurrencia, retry, idempotencia y recuperación en Sandbox Runtime. |
| [#416](https://github.com/nachoortegazgz/marianmadridz/issues/416) Compensaciones y caja | Abierta | Conciliar las tres compensaciones pendientes con evidencia fuente; no reintentar ni alterar ledgers o CajaActual por inferencia. |
| [#415](https://github.com/nachoortegazgz/marianmadridz/issues/415) Maestro fiscal CMS | Abierta | Verificar MapaStaff, esquema y consumidores; no recrear DatosFiscales ni CONFIG_SISTEMA sin evidencia/ADR. |
| [#520](https://github.com/nachoortegazgz/marianmadridz/issues/520) Automatizaciones Wix | Abierta | Inspeccionar tarea e historial de la automatización APPLICATION y determinar contención soportada de las siete PREINSTALLED activas. No sortear bloqueos Wix. |
| [#434](https://github.com/nachoortegazgz/marianmadridz/issues/434) Release readiness | Abierta | Mantener NO-GO hasta cerrar todos los gates P0/P1 y aceptación Runtime/legal. |
| [#209](https://github.com/nachoortegazgz/marianmadridz/issues/209) Veri*Factu/SIF | Abierta según backlog previo; confirmar estado antes de cerrar | Completar diseño con asesoría/proveedor y normativa AEAT; mantener writers y remisión deshabilitados. |

### P1 — gobierno y aceptación funcional

| Issue | Estado | Siguiente acción |
|---|---|---|
| [#210](https://github.com/nachoortegazgz/marianmadridz/issues/210) Protección de main | Abierta | Administrador debe exigir PR, checks requeridos, bloquear force-push y borrado. |
| [#526](https://github.com/nachoortegazgz/marianmadridz/issues/526) Reservas online en QA | Cerrada el 2026-11-23 | La issue declara contención aplicada; mantener no reactivación hasta autorización y prueba negativa Runtime. |
| TPV E2E | Pendiente | Validar identidad y roles, apertura, ventas, seis medios sintéticos, movimientos, devoluciones, X/Z, auditoría, retry y concurrencia en Wix Preview. |
| Bookings/Payments E2E | Pendiente | Validar checkout, reservas, webhooks, cancelaciones y reembolsos exclusivamente en Sandbox y sin efectos externos reales. |

### P2 — integraciones y evidencia

- Capa 3: validar exportaciones, SharePoint y Power Automate como repositorio/proceso documental, sin gobernar Capa 1.
- Automatizaciones y webhooks: verificar idempotencia, permisos, destinatarios, historial y efectos.
- Documentación: mantener este plan y PROJECT-STATUS como resúmenes canónicos; conservar los informes especializados como evidencia.

### P3 — experiencia y optimización

Accesibilidad, SEO, rendimiento, experiencia móvil, limpieza de código y dependencias. No desplazar trabajo P0/P1 para adelantar estas mejoras.

## 4. Secuencia de ejecución

1. **Fase 1 — estabilización de repositorio:** corregir la prueba contractual desactualizada, obtener CI verde en PR, limpiar documentación obsoleta, revisar diff y resolver protección de main con administrador.
2. **Fase 2 — integridad transaccional:** CajaActual (#525), compensaciones (#416) y maestro fiscal (#415).
3. **Fase 3 — contención de efectos:** automatizaciones (#520), permisos y aislamiento de entorno.
4. **Fase 4 — TPV E2E:** flujo completo de caja y conciliación en Wix Runtime.
5. **Fase 5 — reservas y pagos:** pruebas de extremo a extremo en Sandbox.
6. **Fase 6 — fiscalidad:** SIF/Veri*Factu, rectificaciones y evidencia profesional; no activar antes de aceptación.
7. **Fase 7 — Capa 3:** exportación y archivo documental.
8. **Fase 8 — QA global y release:** regresión, revisión de seguridad, sincronización Git-Wix, rollback y autorización expresa.

## 5. Gates de salida de Fase 1

- La prueba TPV comprueba el enum canónico, no una lista histórica duplicada.
- CI completa y secret scanning SUCCESS sobre el commit de la PR.
- Diff limitado a test y documentación; sin cambios de runtime ni CMS.
- MASTER-EXECUTION-PLAN, PROJECT-STATUS y documentación TPV coherentes con main y PR actual.
- Protección de main y required checks habilitados por un administrador; hasta entonces Fase 1 queda parcialmente bloqueada por #210.
- PR revisada y mergeada solo después de todos los checks verdes. No hacer push directo ni mergear una rama con CI fallida.

## 6. Documentos operativos

- Estado resumido: PROJECT-STATUS.md.
- Backlog actual: qa/BACKLOG-RECONCILIATION-2026-11-23.md.
- Aceptación TPV: qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md.
- Relevo TPV: qa/2026-11-23-tpv-session-handoff.md.
- Auditoría Wix TPV: qa/2026-11-23-tpv-wix-audit-validation.md.
- Contrato e implementación: ../src/backend/tpv/README.md.
