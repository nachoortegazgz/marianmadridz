# Matriz de funcionalidades nativas frente a código personalizado

**Fecha:** 23-11-2026  
**Base:** main 26f51bcb3fb46c1c0e0e933ae6bb08c4c26d52f9 y lectura Wix del sitio QA.  
**Principio:** Nativo primero. Código personalizado solo para una necesidad demostrada que Wix no cubra satisfactoriamente.

## 1. Criterio de decisión

1. Identificar el requisito de negocio exacto.
2. Confirmar si la aplicación Wix instalada ya lo resuelve.
3. Si lo resuelve, utilizar su contrato y su dato nativo como autoridad.
4. Si existe una excepción de negocio, implementar únicamente esa excepción.
5. Mantener una proyección CMS solo cuando tenga un consumidor real y no compita con el dato nativo.
6. No conservar un módulo porque ya exista: debe demostrar responsabilidad, consumidor y valor.

## 2. Matriz por dominio

| Dominio | Autoridad nativa | Código personalizado observado | Decisión recomendada |
|---|---|---|---|
| Reservas simples | Wix Bookings V2 | bookingCore y WebMethods de reservas | Utilizar Bookings V2 para disponibilidad, creación, estado y políticas. Evitar replicar su motor. |
| Reservas duales F1/F2 | Wix Bookings V2 para cada booking | Orquestación dual, pairToken, locks, idempotencia y CitasF2 | Mantener solo la orquestación específica si Marian necesita dos fases con intervalo de exposición. No duplicar el estado nativo. |
| Proyección de reservas | Bookings Reader V2 | CitasF2 | Proyección mínima para consumidores internos. El estado nativo debe prevalecer y la proyección debe reconciliarse. |
| Catálogo de servicios | Wix Bookings Services V2 + ServiciosCatalogo para metadatos propios | Mapeo de servicios y reglas allowCombine | Mantener metadatos que no existan en Bookings. Retirar o derivar flags que contradigan payment.options nativo. |
| Productos y variantes | Wix Stores Catalog V3 | TPV catálogo consulta productsV3 | Consumir el catálogo nativo. No crear catálogo paralelo. |
| Inventario | Wix Stores Catalog V3 | Los handlers actuales indican que Wix gestiona stock nativo | No mantener reservas, movimientos o proyecciones custom de stock. Revaluar issue #237: el archivo histórico src/backend/inventario.web.js no existe en main y el handler ORDER_CREATED declara NO_CUSTOM_STOCK_WRITE. Falta búsqueda exhaustiva de páginas y consumidores antes de cerrar la issue. |
| Pedidos | Wix eCommerce | events.js procesa eventos, canal y conciliación fiscal | Wix eCommerce gobierna el pedido. El backend solo añade efectos de dominio justificados, idempotentes y sin recrear pedidos. |
| Pagos online | Wix Payments / checkout nativo | TPV sintético y lógica de checkout Cart V2 para reservas | No desarrollar pasarela propia. El backend no debe afirmar cobro hasta disponer de confirmación nativa. |
| TPV físico | No se ha confirmado una app Wix POS instalada en Site Context | TPV propio con ventas, pagos sintéticos, caja, X/Z y auditoría | Mantenerlo solo si existe un requisito de caja que las funciones nativas disponibles no cubran. Antes, confirmar disponibilidad/limitaciones de Wix POS para el sitio y negocio. |
| Tarjetas regalo | Wix Gift Cards | TARJETA_REGALO como medio sintético TPV | No tratar el enum sintético como canje real. Integrar la API nativa solo si se aprueba el requisito de redención en TPV. |
| Bonos | Depende del producto/servicio real que Marian defina | BONO como medio sintético | No equiparar un medio sintético con pasivo, saldo o consumo de bono. Definir primero el contrato de negocio. |
| Facturación | Wix Invoices V1 instalado; normativa española y SIF aplicables | cajas.web.js, eventLog y ledgers propios | No emitir dos facturas para una operación. Decidir formalmente si Wix Invoices cubre el flujo legal o si se necesita un SIF propio. Mantener writers deshabilitados hasta validación profesional. |
| Identidad de clientes | Wix Members / Contacts | Contexto de miembro y búsquedas TPV | Identidad/autorización nativas. No usar email como prueba de propiedad o permiso. |
| Identidad de Staff | Wix Bookings Staff + Members | security.js, MapaStaff y roles website | Usar IDs nativos y resolución backend. MapaStaff puede contener roles de negocio, pero no debe duplicar sin necesidad atributos ya gobernados por Wix Staff. |
| Automatizaciones | Wix Automations | Posibles jobs y procesos backend | Preferir Automations cuando cubra el caso y sus efectos estén controlados. Auditar triggers y acciones antes de E2E. |
| Formularios | Wix Forms & Payments | Formularios o WebMethods propios si existen | Usar la app nativa para captura estándar. Código solo para validación o proceso que no cubra la app. |
| Blog y SEO | Wix Blog y Promote SEO | No se ha acreditado una necesidad backend propia | Mantener administración nativa. |
| Evidencia documental | Microsoft 365 / SharePoint, si se habilita | Capa 3 descrita en dossiers | Posterior a la estabilización. SharePoint solo evidencia; no gobierna ni escribe en CMS transaccional. |

## 3. Hallazgos de integración con impacto inmediato

### 3.1 Bookings y ServiciosCatalogo

Lectura actual:
- Wix Bookings V2: 94 servicios.
- ServiciosCatalogo: 95 registros, de los cuales 94 son SERVICE y uno PRICING_PLAN.
- Los 94 serviceId tienen correspondencia nativa.
- 16 diferencias de onlinePayment frente a Bookings.payment.options.online.
- 8 diferencias de inPersonPayment frente a Bookings.payment.options.inPerson.
- Cero diferencias de visibilidad en la comparación efectuada.

La opción de pago permitida debe proceder de Bookings V2. ServiciosCatalogo puede seguir siendo SSOT de allowCombine, duración de fases, exposición y metadatos propios, pero no debe contradecir la configuración nativa de pagos.

Acción: resolver la issue #522 mediante lectura nativa al resolver el servicio o mediante una reconciliación controlada del catálogo. No cambiar 94 servicios en bloque sin revisión de cada discrepancia y autorización.

### 3.2 CitasF2

Los seis bookings nativos consultados están CANCELED; CitasF2 conserva cinco CONFIRMED y uno PENDING.

Acción: investigar entrega y claims de BOOKING_CANCELED, origen/fecha de las cancelaciones y reconciliación de proyección. Bookings V2 es la autoridad del estado. No recrear ni confirmar bookings para corregir CMS.

### 3.3 Inventario

El handler ORDER_CREATED declara que Wix Catalog gestiona el stock y registra NO_CUSTOM_STOCK_WRITE. El handler ORDER_CANCELED declara que la política nativa de cancelación/reposición gobierna el inventario. El archivo src/backend/inventario.web.js consultado no existe en main.

Acción: confirmar la retirada completa en páginas, HTML Components, imports, jobs y pruebas antes de cerrar la issue #237. No reintroducir colecciones legacy ni un ledger de stock paralelo.

### 3.4 TPV

El TPV propio registra operaciones sintéticas. No se ha acreditado integración transaccional de pagos nativos, redención de gift cards, emisión de recibos nativos ni facturación fiscal real.

La persistencia actual no utiliza nueve colecciones CMS TPV_QA_*: TPV_COLLECTIONS son discriminadores lógicos; tpvRepository los almacena en MovimientosCaja y proyecta sesiones en CajaActual. Esto es evidencia de que la migración prevista en #435 está implementada en el adaptador de main, aunque falta aceptar su comportamiento en Runtime y reconciliar los registros live. Acción: decidir si el TPV propio es necesario y acotar su alcance. Si se mantiene, usar Wix Bookings/Stores para leer catálogo y Wix Payments/checkout para pagos nativos autorizados; el TPV custom debe limitarse a funciones no cubiertas por Wix, por ejemplo una interfaz de caja interna y conciliación, sin simular una pasarela.

### 3.5 Facturación y fiscalidad

Wix Invoices V1 está instalado, pero la existencia de la app no demuestra que cubra todos los requisitos fiscales de Marian ni que el SIF/Veri*Factu esté certificado.

Acción: definir una única autoridad de emisión y evitar doble emisión. No activar writers, firma, QR o remisión AEAT hasta que el sistema elegido haya sido validado por asesoría y proveedor.

## 4. Decisiones que no deben tomarse todavía

- No eliminar bookingCore: la lógica dual puede ser una excepción funcional real.
- No eliminar CitasF2: primero hay que determinar consumidores y corregir divergencia.
- No borrar TPV: primero debe decidirse si el negocio necesita un TPV propio.
- No activar pagos reales para probar el TPV.
- No reactivar inventario personalizado.
- No duplicar la facturación nativa con un emisor custom sin decisión legal.
- No activar ni desactivar automatizaciones PREINSTALLED saltándose las restricciones de Wix.

## 5. Criterio de aceptación de la matriz

Cada módulo personalizado que permanezca debe documentar:
- Requisito exacto que satisface.
- Capacidad nativa que no cubre ese requisito.
- Consumidores reales.
- Datos nativos que consulta o modifica.
- Contrato y permisos oficiales.
- Pruebas de aceptación y reversión.

Si no puede justificarse, pasa a candidato de retirada, previa búsqueda completa de consumidores y revisión de datos.

## 6. Fuentes

- [Wix Bookings Services V2](https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/query-services)
- [Wix Bookings Reader V2](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/query-extended-bookings)
- [Wix Stores Catalog V3](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3)
- [Wix eCommerce](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce)
- [Wix Gift Cards](https://dev.wix.com/docs/api-reference/business-solutions/gift-cards)
- [Wix Automations V2](https://dev.wix.com/docs/api-reference/business-management/automations/automations/automations-v2/query-automations)
- [Issue #237 — inventario](https://github.com/nachoortegazgz/marianmadridz/issues/237)
- [Issue #522 — opciones de pago](https://github.com/nachoortegazgz/marianmadridz/issues/522)
- [Issue #523 — cancelaciones](https://github.com/nachoortegazgz/marianmadridz/issues/523)
