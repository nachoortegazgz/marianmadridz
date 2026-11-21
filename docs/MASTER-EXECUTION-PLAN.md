# Plan maestro de ejecución — Marian Madrid Wix

**Fecha de baseline:** 2026-11-21  
**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e` — https://www.marianmadrid.es/  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**HEAD main:** `e75aec5d28dcb8560fe75dbd04d5eae95957c3d8`  
**Estado:** desarrollo/QA; release **NO-GO**.  
**Auditoría Wix read-only:** [baseline 2026-11-21](audits/2026-11-21-wix-site-readonly-baseline.md).

## 1. Objetivo final

Conseguir que Marian Madrid sea un sitio web y sistema de negocio completo, funcional, seguro, mantenible y verificable, basado en contratos oficiales actuales de Wix y en la normativa vigente en España.

La aceptación no se reduce a que GitHub CI pase. Deben funcionar conjuntamente:
- Web pública y navegación.
- Catálogo de servicios, reservas y disponibilidad.
- Área de clientes y miembros.
- Tienda, productos, inventario, promociones y tarjetas regalo.
- Pagos, anticipos, cancelaciones y devoluciones.
- Operativa interna: TPV, caja, cierres, personal y control laboral.
- Contabilidad, fiscalidad y trazabilidad.
- Automatizaciones, webhooks e integraciones externas.
- Exportación documental Capa 1 → Capa 2 → Capa 3.
- Seguridad, privacidad, accesibilidad, SEO, rendimiento y recuperación.

Cada función debe tener un contrato, dueño de datos, autorización, consumidores identificados, pruebas y criterio de aceptación. Lo no requerido por negocio o normativa no se construye.

## 2. Autoridad y principios

Precedencia:
1. Requisitos expresos de Marian Madrid y directrices vigentes del propietario.
2. Normativa legal aplicable en España.
3. Documentación oficial Wix y de las integraciones.
4. SSOT de entorno, decisiones vigentes y dossiers consolidados.
5. Código, issues e informes históricos como evidencia subordinada.

Principios obligatorios:
- Wix CMS es la SSOT transaccional.
- SharePoint almacena evidencia; no gobierna la Capa 1.
- Lógica, validación y autorización en backend/WebMethods.
- Frontend presenta y orquesta; nunca decide permisos ni reglas de negocio.
- Constantes en `internalConfig.js`; validación en `validation.js`.
- Ledgers fiscales, contables, laborales, de caja y eventos de idempotencia append-only.
- Correcciones mediante registros rectificativos trazables.
- Wix Apps se operan exclusivamente mediante APIs oficiales soportadas.
- Sandbox y Online se prueban por separado; una etiqueta de entorno no prueba el data plane.
- No ejecutar pagos, comunicaciones, emisión fiscal ni otras acciones externas reales durante QA.
- No declarar una prueba, sincronización o despliegue que no se haya ejecutado.

## 3. Estado de partida verificado

### 3.1 Repositorio
- HEAD `main`: `e75aec5d28dcb8560fe75dbd04d5eae95957c3d8`.
- Backend offline quality gates: SUCCESS, run [44867151597](https://github.com/nachoortegazgz/marianmadridz/actions/runs/44867151597).
- Secret scanning: SUCCESS, run [44867151605](https://github.com/nachoortegazgz/marianmadridz/actions/runs/44867151605).
- `main` no está protegida (`protected=false`).
- PR #495 sigue abierta y no es mergeable; no incorporarla sin análisis de diff. PR #516 es el baseline funcional TPV vigente.
- No se ha acreditado que el SHA de Git esté instalado en Wix Editor o publicado.

### 3.2 Sitio y CMS
- Wix Editor Classic, Velo habilitado, estado Wix Published.
- El propietario clasifica el sitio como QA único, sin actividad real y con registros sintéticos. Published es un metadato, no una reclasificación funcional.
- 42 colecciones CMS: 13 NATIVE y 29 WIX_APP.
- Site Data Usage: LIVE 203 elementos / 266.227 bytes; SANDBOX 109 / 206.023 bytes.
- CajaActual: 1 elemento en cada entorno.
- MovimientosCaja: 2 en LIVE y 2 en SANDBOX.
- TpvSandboxIdentities: 0 en ambos.
- ControlOperativo: 58 LIVE / 0 SANDBOX.
- CitasF2: 6/6; ServiciosCatalogo: 95/95; MapaStaff: 5/5.
- El contenido de los elementos Sandbox no se ha inspeccionado mediante el CMS Editor; el Site Data Usage API solo informa de recuentos y bytes.

### 3.3 Riesgos inmediatos
- CajaActual LIVE ABIERTA con `snapshotSource=MOVIMIENTOS_CAJA_RECONCILIADOS`, `traceId=0`, cash 320 EUR, expected 320 EUR, counted 0 EUR y difference 0 EUR. No satisface el marcador Sandbox.
- Dos movimientos LIVE: 25 EUR CARD y 20 EUR CASH, `traceId=0`; no muestran el contrato sintético completo.
- Tres compensaciones `FISCAL_LEDGER/PENDING_RECOVERY`, `attempts=0`.
- Ocho automatizaciones ACTIVE; siete preinstaladas bloqueadas y una automatización de aplicación programada que delega en un agente LLM, pendiente de inspección de tarea/efectos.
- Accessibility scan full-site terminó PARTIALLY_COMPLETED: 121 páginas descubiertas, 0 procesadas, 121 fallidas, todas con ANALYSIS_FAILED / “This page could not be checked”; 0 findings. URLs enumeradas bajo wixsite.com, causa pendiente. Un scan de https://www.marianmadrid.es/ devolvió SCAN_TARGET_NOT_AVAILABLE. Google Search Console Get Site Readiness: READY. Issues #520 (automatizaciones P0) y #521 (accesibilidad P1).
- El código actual importa `wix-web-module` en 21 archivos; la documentación SDK actual muestra `@wix/web-methods`. La compatibilidad con Editor Classic debe verificarse antes de una migración masiva.
- Los escritores de CajaActual necesitan una demostración única de serialización/CAS entre módulos; el helper normal de proyección usa lectura + actualización de elemento completo con reintentos.

## 4. Estrategia de ejecución

Se trabaja por dependencias y procesos completos, no por cantidad de commits. La secuencia es:

1. Seguridad de efectos y baseline.
2. Integridad de datos y contratos de escritura.
3. Aislamiento Sandbox/Online.
4. TPV E2E.
5. Reservas, tienda y pagos.
6. Fiscalidad, contabilidad y jornada laboral.
7. Automatizaciones, webhooks y Capa 3.
8. Web pública, accesibilidad, SEO y experiencia de usuario.
9. Auditoría final, reset preproducción y release.

Ninguna fase posterior puede compensar un gate anterior fallido.

## 5. Fases, entregables y criterios de salida

### F0 — Gobierno, baseline y contención de efectos

**Objetivo:** saber qué está ejecutándose y evitar que las pruebas disparen acciones no controladas.

**Bloqueo P0 #526:** el sitio está Published y 70 servicios visibles tienen reservas online habilitadas y ambos métodos de pago permitidos. Confirmar si el negocio quiere reservas públicas durante QA. Si no, aplicar contención reversible antes de probar.

Acciones:
- Mantener un único SHA de referencia y comprobar CI.
- Confirmar sincronización Git ↔ Wix Editor y read-back de archivos/widgets.
- Revisar las ocho automatizaciones activas: siete preinstaladas con restricciones y una de aplicación LLM programada. Obtener definición de tarea, propietario, trigger, acciones y evidencia de ejecución. No ejecutar ni sortear locks.
- Revisar Wix Bookings notifications, Forms, Members, Payments y automatizaciones que puedan enviar correos o notificaciones.
- Establecer inventario de crons, webhooks, jobs, apps y credenciales con sus efectos.
- Configurar protección de `main` y required checks mediante una capacidad administrativa soportada.

**Salida:** efectos externos identificados y contenidos; baseline de Git y Wix reproducible; ninguna automatización desconocida puede dispararse durante un E2E.

### F1 — Integridad CMS y recuperación

**Objetivo:** conciliar los datos existentes y asegurar los escritores.

**Bloqueo P0 #525:** `_updateCajaActual` es read-modify-full-update con reintentos, pero el helper no impone CAS/lock. Existen caminos de proyección preflight y de recuperación de webhook que no acreditan el mismo lock fiscal; TPV usa lock de sesión distinto. Unificar la serialización antes de E2E concurrente.

Acciones:
- Leer en paralelo LIVE y SANDBOX, con evidencia separada.
- Inspeccionar el singleton CajaActual y los dos movimientos de cada data plane desde el contexto correcto.
- Conciliar el smoke TPV íntegro y sus importes; no inferir ledger completo a partir de sumas.
- Investigar las tres compensaciones pendientes, pedidos y reservas asociados; no reintentar hasta identificar la saga original.
- Inventariar todos los productores de CajaActual, MovimientosCaja y ControlOperativo.
- Definir el contrato de transición y el mecanismo de concurrencia compartido (CAS/lock) con versión, idempotencia, recuperación de timeout incierto y auditoría.
- Probar lost update, reintento concurrente, lock expirado, colisión de clave, caída entre insert y proyección, y recuperación.
- Conservar ledgers append-only; rectificar con nuevos eventos.

**Salida:** datos conciliados, writers inventariados y pruebas de concurrencia ejecutadas en el entorno correcto. Ningún registro histórico se ha reescrito.

### F2 — Aislamiento de datos y TPV Sandbox

**Objetivo:** demostrar qué data plane usa cada invocación y completar una jornada sintética.

Acciones:
- Confirmar en Wix Editor que el entorno seleccionado es Sandbox.
- Crear/validar un marcador único solo desde el CMS Sandbox, no mediante WebMethod ambiguo ni Management API.
- Verificar que Preview puede leer el marcador y que Published/direct WebMethod falla antes de cualquier escritura.
- Inspeccionar los dos movimientos Sandbox y la caja Sandbox; determinar si los elementos existen y qué contrato tienen.
- Presembrar las seis identidades sintéticas `SANDBOX-CUSTOMER-01..03` y `SANDBOX-STAFF-01..03` con los campos exactos aprobados, únicamente desde el contexto Sandbox.
- Ejecutar TPV: handshake, permisos, catálogo, apertura, venta sintética, pagos simulados, movimientos, devolución, control X, arqueo por medio y cierre Z.
- Probar reintentos idempotentes y concurrencia.
- Comparar LIVE antes/después y demostrar cero cambios.
- Probar el cierre de sesión y bloqueo de operaciones posteriores.

**Salida:** jornada reproducible, ledger completo, importes conciliados, idempotencia/concurrencia validadas y LIVE sin modificaciones.

### F3 — Reservas y experiencia de cliente

**Objetivo:** completar los flujos Bookings y área privada sin atribuir reservas al propietario por error.

**Bloqueo adicional #523:** los seis bookingId de CitasF2 existen en Bookings V2 y los seis están CANCELED nativamente, mientras CitasF2 muestra cinco CONFIRMED y uno PENDING. ControlOperativo contiene 12 BOOKING_CREATED, 10 BOOKING_CONFIRMED, 2 BOOKING_RESCHEDULED y 0 BOOKING_CANCELED; el handler está exportado y tiene pruebas offline, pero su delivery/runtime no está acreditado. Bookings V2 contiene 353 reservas: 352 CANCELED y una CONFIRMED del 18/09/2026 que no aparece en CitasF2. Resolver la proyección, eventos y reserva histórica sin mutar reservas nativas antes de E2E.

**Estado de catálogo y personal:** 94/94 serviceId del catálogo custom mapean con Bookings V2; 70 precios fijos y monedas, visibilidad y 3 staff/resource IDs coinciden con MapaStaff e internalConfig. Los 94 servicios tienen schedule, form, categoría y staff asignado. **Bloqueo #522:** 16 flags onlinePayment permiten ONLINE cuando Bookings V2 lo deshabilita; 8 flags inPersonPayment son más restrictivos que Wix. Resolver la política por servicio antes de checkout E2E.

Acciones:
- Auditar servicios, horarios, personal, recursos, Time Slots V2, reglas de reserva y políticas de cancelación.
- Validar visitante anónimo/autenticado y token de visitante; no reutilizar credenciales de propietario en el checkout del cliente.
- Completar reserva simple y dual, cambios de horario, cancelación, recuperación y reintentos.
- Confirmar sincronización entre Bookings nativo y CitasF2 sin duplicar la autoridad.
- Validar login, registro, recuperación de contraseña, perfil y reservas del cliente.
- Probar notificaciones solo en un entorno/canal neutralizado.

**Salida:** booking lifecycle completo, atribución correcta, capacidad real no duplicada, estado de pago conciliado y cancelación/reprogramación recuperable.

### F4 — Tienda, catálogo, pagos y tarjetas regalo

**Objetivo:** usar la autoridad nativa Wix sin inventario o checkout paralelo.

**Baseline Stores V3:** 24 productos físicos, todos visibles, EUR e IN_STOCK; 22 con una variante, uno con dos y uno con seis; precios 9,95–38,50 EUR. Es una lectura de catálogo, no una prueba de checkout, inventario por variante ni pagos.

Acciones:
- Catalog V3 como autoridad de productos, variantes e inventario.
- Validar catálogo, precios, stock, categorías, cesta, checkout, pedidos y devoluciones en modo de prueba soportado.
- Validar Gift Cards mediante sus APIs nativas y permisos; no exponer códigos ni consultar saldos reales durante QA.
- Revisar pagos y transacciones por estado; no confundir pedido APPROVED con pago liquidado.
- Validar cancelación y reembolso con el contrato de eCommerce y el proveedor.
- No crear pedidos reales ni enviar notificaciones.

**Salida:** ciclo de venta reproducible en entorno de prueba, inventario nativo consistente y ausencia de cobros/efectos reales.

### F5 — Fiscalidad, contabilidad y jornada laboral

**Objetivo:** cerrar cumplimiento y trazabilidad antes de habilitar writers.

Acciones:
- Confirmar esquema maestro fiscal y de personal contra CMS actual; no usar colecciones legacy prohibidas.
- Revisar SIF/VERI*FACTU, facturas, rectificaciones, anticipos, IVA, hash chain, firma, remisión y conservación.
- Revisar el libro contable, PGC, asientos, conciliación y reversión mediante asientos rectificativos.
- Revisar fichajes, correcciones, jornada, pausas y autorización.
- Mantener los writers fiscales, contables y laborales deshabilitados hasta superar pruebas y revisión legal.
- Inspeccionar la automatización laboral LLM antes de decidir su activación/desactivación.

**Salida:** aprobación técnica y jurídica documentada; registros append-only y recuperables; ningún proceso de producción activado por defecto.

### F6 — Automatizaciones, webhooks e integraciones

**Objetivo:** procesos asíncronos idempotentes y Capa 3 fiable.

Acciones:
- Auditar todos los triggers/actions activos y sus permisos, locks y efectos.
- Claims atómicos, deduplicación, replay, orden de eventos y recuperación de webhooks.
- Verificar crons en Runtime y paridad con el código.
- Conectar SharePoint como repositorio de evidencia y Power Automate como orquestación documental, sin autoridad transaccional.
- Exportar snapshots con source ID, versión, hash, fecha, resultado y trazabilidad.
- Reintentos con backoff y DLQ/compensación según contrato.
- No activar automatizaciones de correo, marketing o mensajería sin aprobación específica.

**Salida:** integraciones reproducibles, sin duplicados, con auditoría y recuperación; SharePoint no modifica Capa 1.

### F7 — Web pública y calidad de experiencia

**Objetivo:** que el sitio público sea usable, coherente y accesible.

Cobertura:
- Home, navegación, servicios y fichas, reservas, boutique, promociones, gift cards, blog, miembros, contacto y páginas legales.
- Diseño responsive y comportamiento móvil/tablet/desktop.
- Formularios, validación, mensajes de error, estados de carga y accesibilidad por teclado/lector.
- WCAG según resultados de Accessibility Scans API y verificación manual de los casos que la herramienta no cubre.
- SEO técnico: títulos, descripciones, indexación, sitemap, canonical, redirects, structured data y alt text.
- Rendimiento: Core Web Vitals, imágenes, fuentes, JS y llamadas de datos.
- Privacidad, cookies, condiciones de reserva, precios y textos comerciales coherentes.
- Comprobación de enlaces, páginas rotas y rutas de conversión.

**Salida:** páginas críticas verificadas en desktop y móvil, accesibilidad revisada, SEO técnico correcto y textos comerciales/legalmente coherentes.

### F8 — Release, reset preproducción y operación

**Objetivo:** pasar de QA a uso real de forma reversible.

Acciones:
- Regresión completa sobre SHA final.
- Auditoría de seguridad, permisos, secretos, dependencias y exposición de datos.
- Reset preproducción de datos sintéticos con backup/evidencia, allowlist, aprobación, ejecución y read-back.
- Restaurar append-only, permisos mínimos y policies finales.
- Verificar configuración real de pagos, fiscalidad, emails, SMS y automatizaciones.
- Confirmar DNS, dominio, SEO, cookies, privacidad, condiciones y soporte.
- Validar backup/restore y rollback.
- Confirmar el SHA instalado, publicación autorizada y pruebas post-release.

**Salida:** aceptación firmada, reset verificado, sin datos de prueba residuales ni riesgos críticos abiertos. El despliegue se autoriza como decisión separada.

## 6. Matriz de prioridades y seguimiento

| Prioridad | Bloque | Issues de referencia | Gate |
|---|---|---|---|
| P0 | Automatizaciones/efectos externos | #520, SSOT QA; auditoría Automations | F0 |
| P0 | Exposición pública de reservas | #526 | F0 |
| P0 | Caja, ledger y compensaciones | #416, #525, H-01, #434, #441 | F1 |
| P0 | Fiscalidad y cumplimiento | #209, #415 | F5 |
| P1 | TPV Sandbox | #435, #495 (revisar, no integrar ciegamente) | F2 |
| P1 | Webhooks e idempotencia | #290, #159, #164 | F1/F6 |
| P1 | Permisos CMS | #261 | F1/F3 |
| P1 | Bookings y pagos | #211, #162, #188 | F3/F4 |
| P2 | Automatización documental | #173 | F6 |
| P2 | Gobierno de Git | #210 | F0 |
| P3 | Accesibilidad, SEO y rendimiento | Accessibility scan actual | F7 |
| Release | Aceptación y reset | #434 | F8 |

Los issues son unidades de seguimiento, no una autorización para fusionar ramas ni ejecutar operaciones. Cada issue debe actualizarse con la evidencia del gate correspondiente.

## 7. Reglas de implementación

Antes de modificar un módulo:
1. Identificar consumidores y contratos.
2. Revisar esquemas y permisos CMS.
3. Consultar la documentación oficial vigente.
4. Definir el comportamiento esperado y pruebas de aceptación.
5. Implementar el cambio mínimo.
6. Ejecutar unit, integración y regresión proporcional al riesgo.
7. Revisar diff y rollback.
8. Actualizar documentación y CI.
9. Validar en Wix Local Editor/Preview cuando aplique.

No migrar masivamente `wix-web-module` a `@wix/web-methods` sin una prueba de compatibilidad en Wix Editor Classic. La documentación SDK actual recomienda `@wix/web-methods` para Web Methods en archivos `.web.js`; confirmar la compatibilidad exacta del runtime del sitio antes de cambiar imports y permisos.

## 8. Definición de terminado

Una funcionalidad se cierra solo si:
- El requisito de negocio está cubierto.
- Respeta SSOT y autoridad de datos.
- Autorización backend efectiva.
- Contrato Wix oficial respetado.
- Persistencia, idempotencia y concurrencia verificadas cuando aplique.
- Pruebas ejecutadas y resultado documentado.
- Sin efectos externos no autorizados.
- Diff revisado, CI verde y rollback disponible.
- Documentación actualizada.

Un módulo no se declara terminado por compilar, por pasar mocks o por tener una interfaz operativa.

## 9. Decisión operativa inmediata

El primer objetivo no es añadir funcionalidades al TPV ni rediseñar la web. Es cerrar F0 y F1:
1. Inspeccionar y contener las ocho automatizaciones activas, en especial la tarea LLM programada.
2. Inspeccionar en Editor los datos Sandbox actuales.
3. Conciliar caja, movimientos y compensaciones.
4. Demostrar serialización compartida de los escritores CajaActual.
5. Recién entonces habilitar el TPV E2E en Preview.

Hasta completar estas condiciones, no ejecutar pruebas persistentes que puedan disparar automatizaciones ni publicar.

## 10. Documentación oficial de referencia

- [Wix CMS — Sandbox y colecciones Online](https://support.wix.com/es/article/cms-acerca-de-sandbox-y-las-colecciones-online)
- [Wix Site Data Usage API](https://dev.wix.com/docs/api-reference/business-solutions/cms/operations/site-data-usage/introduction)
- [Wix Web Methods](https://dev.wix.com/docs/sdk/core-modules/web-methods/introduction)
- [Wix webMethod()](https://dev.wix.com/docs/sdk/core-modules/web-methods/web-method)
- [Wix Bookings — visitor booking flow](https://dev.wix.com/docs/api-reference/business-solutions/bookings/skills/book-an-appointment)
- [Wix Automations V2](https://dev.wix.com/docs/api-reference/business-management/automations/automations/automations-v2/introduction)
- [Wix Accessibility Scans API](https://dev.wix.com/docs/api-reference/site/accessibility/introduction)
