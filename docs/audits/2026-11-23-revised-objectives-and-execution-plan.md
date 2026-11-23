# Directriz técnica y plan de ejecución revisados

**Fecha:** 23-11-2026  
**Estado:** propuesta de consolidación derivada de la auditoría read-only.  
**Release:** NO-GO.

## 1. Objetivo principal

Completar un sitio profesional de peluquería y estética con las funcionalidades realmente solicitadas por Marian Madrid, aprovechando primero las aplicaciones nativas de Wix y desarrollando únicamente el código personalizado imprescindible.

El resultado debe ser funcional, fiable, seguro, mantenible y legalmente preparado, con el menor número de módulos, dependencias y procesos personalizados que permitan conservar las garantías necesarias.

## 2. Principios rectores

### Nativo primero

Wix Bookings, Stores Catalog V3, eCommerce, Payments, Gift Cards, Invoices, Members, Automations, Forms y Blog son la primera opción para sus dominios nativos.

No se implementará una réplica custom de:
- disponibilidad y reservas simples;
- catálogo de productos y variantes;
- stock comercial;
- pedidos y checkout;
- pagos y devoluciones nativas;
- login y gestión de miembros;
- funciones estándar de formularios, blog o SEO;
- automatizaciones ya cubiertas por Wix.

El código personalizado solo se justificará por una diferencia funcional concreta.

### Código mínimo

- Una sola autoridad por dato y proceso.
- Cero duplicidades demostradas.
- Cero código muerto demostrado.
- Cero APIs deprecated activas.
- Cero alias o compatibilidad legacy sin motivo, métrica y fecha de retirada.
- Cero validaciones de negocio duplicadas entre frontend y backend.
- Cero abstracciones prematuras.
- Cada módulo debe tener consumidores y responsabilidad documentados.

### Seguridad y fiabilidad

- El frontend no autoriza operaciones ni decide reglas de negocio.
- La identidad procede de Wix y se resuelve en backend.
- Los permisos se validan en cada WebMethod.
- Los secretos permanecen en backend/Secrets Manager.
- Los webhooks y procesos asíncronos son idempotentes.
- Los locks/CAS se conservan hasta demostrar que son redundantes.
- Los ledgers y registros regulados mantienen su política de integridad.
- La autorización para pruebas sintéticas no activa pagos, facturación, comunicaciones o servicios externos reales.

### Fuentes de autoridad

1. Requisitos y criterios de aceptación expresos de Marian Madrid y del propietario.
2. Normativa legal vigente aplicable en España.
3. Documentación oficial vigente de Wix y de las integraciones.
4. Estado real consultado en Wix Editor, Runtime, CMS y aplicaciones.
5. Código versionado en GitHub como evidencia de lo implementado en el commit observado.
6. Dossiers, ADR, inventarios e informes históricos como artefactos derivados.

GitHub no demuestra qué código está instalado en Wix. Wix Site Context no devuelve el SHA de Velo. La sincronización requiere evidencia específica.

## 3. Objetivos de aceptación

1. Reservas simples gestionadas por Bookings nativo.
2. Reservas duales únicamente si Marian confirma la necesidad de las dos fases y el intervalo de exposición.
3. Estado nativo Bookings conciliado con cualquier proyección CMS.
4. Opciones de pago alineadas con Bookings V2.
5. Productos, variantes, inventario y pedidos gobernados por Stores/eCommerce nativo.
6. Pagos y reembolsos reales únicamente por la solución nativa y autorizada.
7. TPV propio solo si una necesidad de negocio no está cubierta por Wix POS/Payments disponible.
8. Facturación y SIF con una única autoridad de emisión y validación legal.
9. Registro horario con integridad, permisos y concurrencia probados.
10. Automatizaciones sin efectos externos no controlados durante QA.
11. Reset preproducción verificable de registros sintéticos.
12. CI, Runtime, E2E, rollback y autorización antes del release.

## 4. Estado actual

### Completado en esta auditoría

- Lectura del repositorio main y del commit 26f51bcb3fb46c1c0e0e933ae6bb08c4c26d52f9.
- Lectura de Site Context: Wix Editor clásico, Velo y Draft.
- Lectura de inventario CMS: 42 colecciones, 13 NATIVE y 29 WIX_APP.
- Recuento y esquema de colecciones críticas.
- Reconciliación de los seis bookings de CitasF2 con Bookings Reader V2.
- Reconciliación de 94 servicios Bookings V2 con ServiciosCatalogo y sus opciones de pago.
- Lectura de estado actual de automatizaciones.
- Revisión estática de módulos críticos seleccionados.
- Creación de entregables en una rama separada; no se ha modificado main ni código de producción.

### Pendiente / NO-GO

- SHA del código instalado en Wix Editor.
- Compatibilidad del workflow Preview con Wix Editor clásico y significado de --source remote.
- #525: concurrencia de CajaActual en Runtime.
- #416: tres compensaciones PENDING_RECOVERY.
- #415: conciliación del maestro fiscal y consumidores.
- #520: siete automatizaciones PREINSTALLED ACTIVE; definición/historial y contención de efectos.
- #209: SIF/Veri*Factu y aceptación normativa/proveedor.
- #210: protección efectiva de main.
- #523: seis proyecciones CitasF2 divergentes frente a bookings nativos CANCELED.
- #522: 16 discrepancias de pago online y 8 presenciales.
- #188: E2E de Mis reservas/Mis pedidos y reservas duales.
- #435: el adaptador actual ya persiste discriminadores TPV lógicos en MovimientosCaja y sesiones en CajaActual; reconciliar la issue abierta con este código y cerrar solo tras validar Runtime.
- #237: verificar consumidores restantes del inventario custom antes de cerrar.
- #173: Capa 3 no certificada.
- #521: accesibilidad; el scanner anterior no procesó páginas y no equivale a cero findings.
- Runtime/E2E de pagos, webhooks, concurrencia, TPV y seguridad.
- Reset preproducción y autorización final.

## 4.1 Directriz de inicio TPV incorporada

Se añade como documento de referencia obligatorio el [Baseline de adaptación neutral del TPV](2026-11-23-tpv-neutral-adaptation-baseline.md). La adaptación debe continuar sobre `internalConfig.js`, `tpvUtils.js` y `tpvRepository.js`; no crear un segundo repositorio ni un módulo `tpvRuntimePolicy.js`. La política única, persistencia, IDs, estados, envelope, locks y contratos se consideran diseño objetivo pendiente de reconciliación y pruebas. No se autoriza aún ningún cambio de código ni migración de datos.

## 5. Plan de acción priorizado

### HITO 0 — Reconciliación de fuentes (en curso)

- Mantener SHA Git observado y Site ID como baseline.
- Obtener el SHA instalado en Wix Editor mediante mecanismo soportado.
- Confirmar Git Integration y comportamiento del workflow Preview para Editor clásico.
- Completar árbol del repositorio y mapa de consumidores desde un checkout local/CLI autorizado.
- Repetir inventario CMS antes de cada cambio de esquema.

**Aceptación:** Git, Editor y CMS identificados sin asumir sincronización.

### HITO 1 — Integridad de caja, compensaciones y fiscalidad P0

- #525: inventariar todos los writers de CajaActual y demostrar exclusión/CAS global, idempotencia y recuperación en Runtime.
- #416: conciliar cada compensación con pedido, ledger y transacción origen. No reintentar ni corregir por inferencia.
- #415: reconciliar MapaStaff y sus consumidores; no crear DatosFiscales ni CONFIG_SISTEMA sin decisión y datos verificados.
- #209: mantener writers fiscales, firma, QR y remisión deshabilitados hasta validación legal/técnica.
- #441: verificar el guard de pedidos POS y su recuperación histórica.

**Aceptación:** no se pierden importes, no se duplican movimientos y ninguna operación fiscal se emite sin autorización.

### HITO 2 — Corregir coherencia nativa de reservas y pagos P1

- #523: investigar las seis cancelaciones nativas, claims y entrega de eventos. Corregir solo la proyección CitasF2, con mecanismo autorizado y trazabilidad.
- #522: revisar los 24 servicios discrepantes (16 online y 8 presenciales) y alinear los flags custom con Bookings V2.
- #188: ejecutar E2E autenticado de Mis reservas, Mis pedidos y reservas duales después de corregir divergencias.
- Confirmar que la reprogramación/cancelación de fases duales no rompe la pareja.

**Aceptación:** estado, propiedad, pago y disponibilidad coherentes con Wix nativo.

### HITO 3 — Automatizaciones y gobierno de repositorio

- #520: inspeccionar acciones e historial de las siete automatizaciones PREINSTALLED ACTIVE. No sortear restricciones de Wix.
- #210: configurar protección de main, PR obligatoria y checks requeridos mediante administrador.
- Revisar #290 y #261: claims webhook y permisos de inserción manual en ledgers.
- No disparar triggers externos durante E2E sin una barrera verificada.

**Aceptación:** efectos externos conocidos/controlados y proceso de integración protegido.

### HITO 4 — Decisión y simplificación del TPV

Antes de programar:
1. Definir si se necesita TPV propio y qué funciones concretas faltan en las soluciones nativas disponibles.
2. Aprobar roles y permisos de caja.
3. Definir si se necesita venta de productos, servicios, gift cards o bonos desde TPV.
4. Definir qué debe ocurrir con recibo, pedido, pago, inventario y factura.

Si se mantiene:
- catálogo leído de Bookings/Stores nativos;
- pagos nativos cuando proceda, nunca simulados como reales;
- caja interna solo para las funciones que no cubra Wix;
- persistencia sintética identificada;
- locks e idempotencia probados;
- X/Z y auditoría con contratos mínimos.

Revisar flags duplicados y legacy solo después del mapa de consumidores.

**Aceptación:** el TPV añade una capacidad necesaria sin duplicar catálogo, inventario, pagos o facturación.

### HITO 5 — Validación funcional y de seguridad

- Unitarias, integración y regresión offline.
- Contratos SDK oficiales.
- Wix Local Editor y Runtime.
- E2E Bookings, Cart/Checkout, cancelación, pagos sandbox, webhooks y TPV.
- Concurrencia, idempotencia, replay, timeout y recuperación.
- Pruebas negativas de pagos, comunicaciones y writers fiscales.
- Verificación de roles y permisos con identidades QA.

**Aceptación:** evidencias reproducibles por SHA y entorno.

### HITO 6 — Capa 3, fiscalidad y cumplimiento

- Resolver si se necesita exportación documental.
- Implementar solo los procesos M365/SharePoint aprobados.
- Confirmar que Capa 3 no modifica ni gobierna Capa 1.
- Validar SIF/Veri*Factu, facturación, registro horario, RGPD/LOPDGDD, consumo y conservación con profesionales/proveedores cuando corresponda.

**Aceptación:** cumplimiento técnico y legal acreditado; no solo documentación o código.

### HITO 7 — Reset y preparación de uso real

- Inventariar y respaldar evidencia de pruebas.
- Identificar exclusivamente registros sintéticos a retirar.
- Comprobar entorno y allowlists.
- Ejecutar reset controlado con verificación posterior.
- Restaurar restricciones de producción e integridad.
- Revisar secretos, automatizaciones, permisos, dominios, pagos y comunicaciones.
- Probar rollback.
- Obtener autorización expresa.

**Aceptación:** decisión GO/NO-GO sustentada por pruebas, cumplimiento y recuperación.

## 6. Reglas para cada intervención

- No editar main directamente.
- Rama aislada y PR revisable.
- Cambio mínimo con consumidores identificados.
- Documentación oficial consultada para cada contrato afectado.
- No borrar datos históricos ni ledgers por simplificación.
- No ejecutar pagos, reembolsos, facturación o emails reales durante QA.
- No declarar pruebas no ejecutadas.
- No cerrar issues por cambio de código sin validar criterios de aceptación.
- No publicar sin autorización expresa.

## 7. Criterio final

El éxito no se mide por líneas eliminadas ni por cantidad de módulos desarrollados.

Se mide por un sitio que satisface los requisitos de Marian Madrid usando Wix nativo siempre que sea suficiente, con el mínimo código propio necesario, sin procesos duplicados, sin divergencias de datos y con seguridad, fiabilidad y cumplimiento demostrables.

**Prioridad: funcionalidad nativa fiable > código personalizado mínimo > optimización.**

