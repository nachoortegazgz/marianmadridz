# Reconciliación del estado del ecosistema — 2026-11-11

## 1. Baseline y alcance

- Repositorio: `nachoortegazgz/marianmadridz`
- Rama: `main`
- Commit de referencia: `4efa85021bef253eb522e2290da6c18a8a59e485`
- Wix Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`
- Alcance: lectura de GitHub, árbol del repositorio, workflows, documentación QA y contexto actual Wix.
- No se han realizado escrituras CMS, cambios de permisos, reservas, pedidos, pagos, reembolsos, fichajes, movimientos fiscales, comunicaciones, publicación ni cambios de automatizaciones.

Este documento supersede los estados de repositorio anteriores que no reflejen el commit indicado. No certifica Wix Runtime, el Editor publicado, permisos efectivos de todos los roles ni integraciones externas.

## 2. Estado confirmado

### 2.1 Integración y CI

PR #289 está **MERGED** en `main` mediante merge commit `4efa85021bef253eb522e2290da6c18a8a59e485`.

El push de ese commit ejecutó correctamente:
- Backend offline quality gates.
- Secret scanning.

El job de calidad terminó correctamente en:
- Regresión offline completa.
- Contratos Wix SDK.
- Contrato eCommerce Order Transactions.
- Contrato Bookings Reader V2.
- ESLint.

La cifra de 61 suites / 573 pruebas corresponde a los checks previos del head de PR `4611975daf9693ac8786a47cbb6b2912cb49c735`; el workflow push del merge commit también concluyó en success. No se infiere una nueva cifra de tests del run de merge sin inspeccionar su log de resumen.

### 2.2 Cambios de seguridad incorporados

- Issue #291: `removeById()` valida el tipo persistido mediante strong read y aplica borrado condicional por tipo; la lectura no se considera barrera atómica.
- Issue #290: los ocho handlers Bookings/eCommerce adquieren claim determinista antes del efecto de dominio; lease de 10 minutos, CAS, fencing y recuperación.
- `WEBHOOK_EVENT` continúa append-only.
- `bulkInsert` y `bulkUpdate` permanecen fail-closed al no existir consumidores productivos revisados.
- Ledgers fiscales, contables y laborales mantienen su contrato insert-only.

#290 y #291 permanecen abiertos hasta pruebas controladas en Wix Runtime. CI offline no demuestra comportamiento real del SDK en el sitio.

## 3. Estado actual Wix

Consulta actual de contexto Wix:
- Estado: **Draft**.
- Editor: Wix Editor.
- Velo: habilitado.
- Zona horaria: `Europe/Madrid`.
- Moneda: EUR.
- Wix Bookings instalado.
- Wix Stores: Catalog V3.
- Wix Invoices: V1.
- Wix Members Area, Gift Cards, Blog y Forms & Payments instalados.

La lectura actual contradice informes anteriores que indicaban Published. La fecha de actualización de sitio mostrada por Wix es 2026-11-11 19:24.

Draft no acredita por sí mismo el aislamiento de automatizaciones, notificaciones o integraciones externas. No se han ejecutado operaciones E2E ni se ha cambiado ninguna automatización.

## 4. Deuda pendiente priorizada

| Prioridad | Issue | Estado verificado / siguiente gate |
|---|---|---|
| P0 | #209 Veri*Factu | Bloqueado: no se acredita transporte SOAP AEAT, certificado, XML/XSD completo, respuestas, estados ni modalidad SIF aprobada. No activar remisión ni anticipos. |
| P0 | #290 Webhook claims | Código integrado; falta Wix Runtime controlado y pruebas de recuperación/efectos de dominio. |
| P1 | #291 CMS remove policy | Código integrado; falta validación runtime de bulkRemove condicional en Wix. |
| P1 | #210 Protección main | Pendiente: main carece de protección y checks obligatorios. La conexión disponible permite lectura, pero no expone una operación de administración de rulesets/protección. |
| P1 | #261 Permisos CMS | Pendiente: discrepancia entre representaciones de Data Permissions v1 y Data Collections v2; falta identidad CMS_EDITOR aislada y prueba de denegación. No cambiar permisos hasta resolverlo. |
| P1 | #162 Reprogramación dual | Journal/locks integrados; falta reconciliador específico que compare ambas reservas nativas con el destino exacto y la proyección CMS. No reutilizar el reconciliador legacy debilitando su guard. |
| P1 | #223 Paquetes gestoría | Snapshot trimestral parcial; agregación mensual y despacho durable/idempotente pendientes. Envío permanece deshabilitado. |
| P1 | #224 ZONA STAFF | Lecturas implementadas según issue; writers de fichaje/caja siguen bloqueados. Faltan idempotencia, serialización y QA runtime. |
| P1 | #159 Display token | Idempotencia de emisión integrada; faltan pruebas de concurrencia runtime y auditoría de consumidores no versionados. |
| P1 | #164 Calendar widget bridge | Validación source/origin presente; falta handshake en navegador real. |
| P1 | #188 Área cliente | Runbook y contratos offline; faltan E2E autenticados Mis reservas/Mis pedidos, ownership y eventos reales. |
| P1 | #211 Campaña E2E | Bloqueada hasta acreditar sandbox de pagos y aislamiento de notificaciones/destinos. |
| P1 | #237 Inventario custom | Código custom retirado; Wix Stores Catalog V3 es autoridad. Falta E2E de venta/cancelación/refund/restock. |
| P2 | #173 Capa 3 | No implementada en repo: no existe `src/backend/exports/exportService.js` ni jobs de export. No afirmar SharePoint/Power Automate operativo. |

## 5. Limpieza documental y de deuda

1. Este documento pasa a ser el checkpoint posterior a la fusión de #289.
2. Los informes anteriores con baseline `e3499b1`, `8677538` u otros commits anteriores se conservan como histórico; no deben usarse como descripción del HEAD actual.
3. Los dossiers de necesidades y flujos se consideran especificación/objetivo, no evidencia de implementación. Cada requisito debe vincularse a ruta, consumidor, prueba y estado de runtime.
4. No se eliminan módulos, enums, pruebas ni dependencias en esta tanda: el inventario de árbol no basta para demostrar código muerto y no se ha ejecutado grep de consumidores sobre un checkout local.
5. `wix.lock` es generado automáticamente; no editarlo manualmente ni inferir desincronización solo a partir de una versión antigua del dossier.

## 6. Próximos pasos seguros

1. Obtener acceso administrativo al repositorio para activar ruleset de `main` y exigir los workflows de calidad.
2. Implementar reconciliador dual **read-only** con verificación exacta de ambas reservas y proyección, tests de estados mixtos y alertas deduplicadas.
3. Cerrar la discrepancia de permisos CMS con una identidad CMS_EDITOR aislada, sin insertar registros en ledgers.
4. Revisar #223 para diseñar snapshot mensual y outbox de envío durable, manteniendo deshabilitado el transporte.
5. Inventariar M365/SharePoint/Power Automate con acceso autorizado y datos sintéticos antes de diseñar Capa 3.
6. Preparar runtime QA únicamente cuando se haya demostrado aislamiento de automatizaciones, notificaciones, pagos y datos.

## 7. No-go invariants

- No publicar ni desplegar código Wix desde esta revisión.
- No activar depósitos Bookings ni remisión Veri*Factu.
- No ejecutar reservas/pedidos/pagos/reembolsos reales o sintéticos en CMS publicado sin sandbox aislado.
- No activar escritores fiscales, contables, laborales o de caja.
- No modificar permisos CMS, políticas de Bookings o automatizaciones sin autorización específica.
- No mutar ni borrar ledgers append-only.
- Wix CMS continúa siendo SSOT transaccional; SharePoint, si se implementa, será únicamente evidencia documental.

## 8. Validación y reversión

- Validación de esta actualización: revisión documental y de metadatos GitHub/Wix de solo lectura.
- No se ejecuta suite local ni se hacen cambios funcionales en este commit documental.
- La rama de documentación debe superar los checks automáticos antes de integrarse.
- Reversión: revertir únicamente el commit documental; no hay mutaciones de negocio ni datos Wix asociadas.
