## Addendum vigente — sitio actual y alineación CMS/backend (2026-11-14)

- Sitio único de trabajo: 50b39f33-e753-4331-ab35-b2ed43dc97f7. Es un banco de pruebas aislado, sin actividad real, según declaración expresa del propietario. Los registros se tratan como sintéticos.
- Plataforma: Wix Editor Classic + Velo. No se mantiene una comparación operativa con otro sitio.
- CMS verificado: 23 colecciones (15 NATIVE, 8 WIX_APP), 524 campos físicos NATIVE. El manifiesto vigente está en DICCIONARIO_DATOS_CMS.md y docs/audits/2026-11-14-current-site-cms-normalization.md.
- MapaStaff es exclusivamente el mapa de identidad de personal: staffMemberId, resourceId, scheduleId y memberId. thirdPartyId es TEXT opaco, no es GUID ni coincide con DatosFiscales._id y no tiene consumidor localizado. No contiene recordType ni campos fiscales.
- DatosFiscales es el maestro fiscal y de terceros. No declara traceId ni schemaVersion; fechaInicioVerifactu es TEXT. No existe CONFIG_SISTEMA con identidad fiscal oficial verificada.
- ComplementosCatalogo usa _id como identidad CMS; addonId queda como espejo físico requerido por el esquema actual. addOnId se mantiene como campo de transporte Bookings.
- CajaActual: operationDate DATE, openingAmount NUMBER, sequenceCounters OBJECT; Bizum presencial se agrega en otherAmount. cashRegisterStatus=SIMULACION; isOpen=true no gobierna la sesión.
- La rama fix/current-site-cms-contract-alignment separa validadores/hooks, migra eventLog.js, fiscalAggregator.web.js y fiscalDocuments.web.js a DatosFiscales, alinea CajaActual y actualiza pruebas/documentación.
- La rama aún requiere rebase, CI completa sobre HEAD, revisión del diff y pruebas Wix Editor/E2E sintéticas. PR #370 no es mergeable en su estado actual. No se ha mutado el CMS ni se ha publicado código Wix.
- Wix Stores Catalog V3 sigue siendo la autoridad prevista del inventario comercial; InventarioStockVenta y MovimientosInventario permanecen como colecciones físicas legacy sin writers activos.
- Capa 3 (SharePoint/Power Automate) sigue siendo diseño documental, no integración operativa certificada.

---

## Vigencia operativa — estado actual

La autoridad del propietario, la política de mutabilidad del sitio aislado y los límites de efectos externos están consolidados en el addendum inicial y en TEC-037/TEC-038 de docs/DECISION-LOG.md. La rama fix/current-site-cms-contract-alignment tiene historial divergente respecto a main; PR #370 está dirty y no hay checks para el HEAD actual. Rebase y CI deben completarse antes de merge o publicación.

## Addendum de vigencia técnica — 2026-11-14

El estado de CMS, los contratos de código y los límites de validación están consolidados en ESTADO_ACTUAL_PROYECTO.md y docs/audits/2026-11-14-current-site-cms-normalization.md. El código versionado en Git no acredita por sí solo el código ejecutado por Wix. La sincronización Editor↔Git, CI de la rama actual y pruebas Wix Editor/E2E siguen pendientes.

El sitio actual es un banco de pruebas aislado y no tiene actividad real. No habilitar pagos, facturación, fichajes, comunicaciones ni automatizaciones externas sin los datos oficiales, las pruebas correspondientes y autorización expresa.

# HOJA DE CUMPLIMIENTO — WEB MARIANMADRID.ES

**Documento consolidado de requisitos, necesidades y criterios de aceptación**

**Proyecto:** Sitio web marianmadrid.es — Marian Madrid Peluquería y Estética
**Titular:** Marian Madrid (Propietaria y Directora)
**Desarrollador:** Nacho Ortega (Arquitectura Wix & Velo)
**Repositorio de referencia:** nachoortegazgz/marianmadridz
**Entorno:** Wix Editor Classic / Velo (Node.js)
**Fecha de revisión:** 09-11-2026
**Estado:** Requisitos conservados; estados actualizados con inspección de `main` `cad48c04` y consultas Wix read-only. Las pruebas runtime siguen pendientes.


> **Criterio de estados (revisión 09-11-2026):** «Verificado» requiere evidencia en código, API nativa o prueba identificada. Una app Wix instalada no acredita una personalización propia. Las consultas REST/CMS de esta revisión fueron de solo lectura; no equivalen a ejecución de WebMethods, E2E ni publicación del HEAD.

---

## 1. Resumen ejecutivo

El sitio web no debe ser un escaparate estático. Debe ser una **herramienta de gestión profesional** que:

1. Gestión profesional de las reservas online de servicios de peluquería y estética simples y duales con gap de tiempo entre sus fases que libere al profesional en la agenda de reservas, permitiendole aceptar otros servicios en ese hueco de tiempo entre fases.
2. Permita solapar servicios durante tiempos muertos (ejemplo: gap de tiempo entre fases para exposición de tintes).
3. Posibilidad de activar y detallar cantidad de la fianza en reservas online para protejer reservas online contra citas fantasma.
4. Cumpla estrictamente con la normativa fiscal española (Veri*factu / RD 1007/2023), laboral (RD-ley 8/2019) y de protección de datos (RGPD / AEPD).
5. Automatice la coordinación con la gestoría (exportación CSV/Excel normalizada).
6. Ofrezca una experiencia de cliente profesional, fiable y coherente con la marca.

---

## 2. Requisitos funcionales por área

### 2.1. Motor de reservas inteligente (Prioridad 🔴 Crítica)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-01 | Reserva online 24/7 | La clienta debe poder reservar sin depender del teléfono. | Flujo completo de selección de servicio, fecha, hora y confirmación funcional en producción. | PARCIAL; Wix Bookings devuelve servicios y disponibilidad en lectura. No se ha ejecutado creación de reserva, confirmación ni checkout E2E. |
| RF-02 | Tiempos fraccionados / solapables | Un servicio con fases (ej. Babylights: 150 min configurados en CMS/Bookings al 09-11-2026) debe dividirse en fases: aplicación (staff ocupado), exposición (staff liberado, sillón ocupado), lavado/peinado (staff ocupado). | El algoritmo de disponibilidad libera la agenda durante la fase de exposición para permitir cortes rápidos o servicios cortos simultáneos. | VERIFICADO EN CÓDIGO; `reservas.web.js` y saga dual presentes. Lectura Wix: 94/94 servicios CMS↔Bookings y 24/24 vínculos F2 coherentes. E2E runtime pendiente. |
| RF-03 | Configuración de fases por servicio | Cada servicio debe permitir configurar: duración total, minutos de aplicación, minutos de exposición, minutos de acabado. | Campos personalizados en Wix Bookings operativos y leídos correctamente por el backend. | PARCIAL; campos de fases en CMS y servicios nativos conciliados en lectura. Falta probar configuración/edición desde Wix y runtime. |
| RF-04 | Servicios cortos compatibles/complementos | Debe existir catálogo de complementos (ejemplo: secado, manicura) reservables durante la fase de exposición. | Verificado en pruebas: reserva simultánea de tinte + corte sin conflicto de agenda. | PENDIENTE; el catálogo de complementos aparece en código, pero no se ha ejecutado la reserva simultánea de servicios en Wix Editor. |
| RF-05 | Sincronización con Google Calendar | La agenda debe sincronizarse con el calendario del salón. | Wix Bookings configurado con sincronización activa. | PENDIENTE DE VERIFICAR; Wix Bookings está instalado, pero no se ha comprobado la sincronización Google Calendar en la configuración del sitio. |

### 2.2. Fianza online / Anti no-shows (Prioridad 🔴 Crítica)

> **Decisión de negocio 2026-11-10:** señal/anticipo fijo de 15 € únicamente para servicios cuyo precio sea estrictamente superior a 100 €; 100 € exactos no activa el anticipo. Se descuenta del precio total. Política ordinaria: cancelación con ≥24 h → devolución íntegra del anticipo o reprogramación sin coste; reprogramación con ≥24 h → transferir íntegro el anticipo a la nueva cita; si cancela el negocio → devolución íntegra. Para menos de 24 h o inasistencia, revisión manual caso por caso; sin retención ni devolución automática hasta aprobar condiciones claras y proporcionadas. Preferencia técnica: depósito nativo Wix Bookings; no crear un motor propio. **Bloqueo P0:** al ser un anticipo, IVA se devenga al cobro (LIVA art. 75.Dos) y debe documentarse con factura (RD 1619/2012 art. 2.1). No activar hasta cerrar Veri*Factu/SIF, ledger del anticipo, saldo y rectificación de devoluciones (issue #209).


| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-06 | Anticipo fijo de reserva para servicios > 100 € | Cobro de un anticipo fijo de 15 € en la reserva para servicios cuyo precio sea estrictamente superior a 100 €. | Servicios ≤100 €: sin anticipo obligatorio. Servicios >100 €: anticipo de 15 €, aplicado al precio total; saldo restante en el salón. | POLÍTICA APROBADA (2026-11-10); NO CONFIGURAR — BLOQUEO P0 FISCAL. 7 servicios visibles elegibles, 0 depósitos activos. No activar hasta demostrar factura/IVA del anticipo, ledger, aplicación del saldo y rectificación de devoluciones bajo SIF/Veri*Factu (issue #209). Wix nativo es preferente; no crear writer propio. |

**Auditoría de servicios y depósitos nativos (Wix REST read-only, 2026-11-10):** 94/94 servicios consultados; 70 `FIXED`, 24 `NO_FEE` (auxiliares F2 ocultos), 0 `VARIED`; 0 depósitos activos. Siete servicios visibles superan 100 EUR; sus IDs, precios y configuración actual están en `docs/adr/2026-11-10-deposit-and-native-inventory.md`. Todos muestran `online=true` e `inPerson=true`; no se detecta `requireManualApproval=true`. No se ha modificado ningún servicio.

| RF-07 | Pasarela de pago segura | Integración mediante Wix Payments, proveedor de pagos nativo de Wix. Los métodos concretos se limitan a los que estén disponibles y habilitados para España y esta cuenta. | Pago procesado por Wix Payments y confirmación recibida mediante el flujo nativo de Wix eCommerce/webhook. | Declarado por el propietario; activación y métodos de la cuenta pendientes de comprobación en el panel. |
| RF-08 | Política de cancelación | Cancelación con ≥24 h: devolución íntegra del anticipo o reprogramación sin coste. Reprogramación con ≥24 h: transferir el anticipo íntegro a la nueva cita. Si cancela el negocio: devolución íntegra. Menos de 24 h/no-show: revisión manual, sin retención ni devolución automática hasta revisión jurídica. | Política Wix Bookings 1440 minutos; devolución/traslado del anticipo y webhook deben probarse en Wix Editor en el sitio aislado. | PARCIAL; 1440 minutos aparece en la política nativa. No se ha probado refund ni webhook E2E. No activar retención automática. |
| RF-09 | Aplicación de la fianza al saldo | El depósito nativo pagado online forma parte del precio del servicio; el cliente abona únicamente el saldo pendiente en persona. | Wix Bookings muestra depósito y saldo pendiente coherentes; el pago inicial y el saldo no duplican ingresos ni IVA. | NATIVO SOPORTADO POR WIX; configuración por servicio y conciliación fiscal/ledger pendientes de pruebas. No implementar un segundo cobro/descuento personalizado. |

### 2.3. Asistente de IA capilar (Prioridad 🟡 Media)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-10 | Asesoramiento IA | Interfaz interactiva que orienta sobre servicios según facciones, tipo de cabello y necesidades. | Respuesta generada y mostrada al usuario. | NO OPERATIVO; `aiAgent.web.js` devuelve `AI_PROVIDER_NOT_CONFIGURED` y no genera respuestas. |
| RF-11 | Aviso legal obligatorio | Disclaimer visible: "Presupuesto y diagnóstico orientativos sujetos a valoración capilar previa en tocador". | Texto presente en toda respuesta de la IA. | NO OPERATIVO; al no existir respuesta IA activa, no se puede acreditar el aviso legal en cada respuesta. |
| RF-12 | Cuestionario previo obligatorio | Antes de responder, la IA debe recoger: (1) longitud del cabello, (2) tratamientos químicos previos en últimos 6 meses, (3) necesidad principal. | Los 3 campos son obligatorios y se validan antes de llamar a la API. | NO IMPLEMENTADO/NO VERIFICADO; no hay proveedor IA activo ni cuestionario ejecutable en el flujo actual. |
| RF-13 | Prohibición de garantizar resultados | La IA no puede garantizar resultados de color sobre cabellos teñidos previamente sin prueba de mecha. | System prompt con regla no negociable; verificado con test de prompt malicioso. | NO OPERATIVO; no hay proveedor ni system prompt activo que aplique esta regla. |
| RF-14 | Protección de API key | La clave de OpenAI/Claude debe almacenarse en `wix-secrets-backend`, nunca expuesta en cliente. | Verificado: `getSecret("OPENAI_API_KEY")` usado en backend. | NO OPERATIVO; no hay llamada a proveedor IA activa. No se acredita uso de una clave en este flujo. |
| RF-15 | Timeout y fallback | Si la IA tarda > 9 s o devuelve JSON malformado, debe haber respuesta de fallback sin congelar la página. | `AbortController` a 9 s y try/catch de deserialización implementados. | NO OPERATIVO; el backend falla cerrado con `AI_PROVIDER_NOT_CONFIGURED`; no existe respuesta IA de fallback. |

### 2.4. Tarjetas regalo con QR (Prioridad 🟡 Media)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-16 | Emisión de tarjeta regalo | Generación de código único y registro en base de datos (`GiftCards`). | Campos: `cardCode`, `signature`, `initialBalance`, `currentBalance`, `status`. | NO IMPLEMENTADO EN CÓDIGO PROPIO. Wix Gift Cards nativo tiene 1 producto configurado y 0 tarjetas emitidas; no existe `giftCards.web.js` ni writer propio. |
| RF-17 | Firma HMAC-SHA256 | Cada tarjeta debe llevar firma criptográfica infalsificable. | `crypto.createHmac('sha256', secret)` aplicado sobre código + importe. | NO IMPLEMENTADO EN CÓDIGO PROPIO; no se encuentra firma HMAC de tarjetas regalo en `src/`. |
| RF-18 | Generación de QR | El voucher descargable debe incluir código QR único. | Paquete `qrcode` instalado y QR generado en backend. | NO IMPLEMENTADO EN CÓDIGO PROPIO; no se encuentra generador QR propio ni flujo de voucher personalizado. Función nativa pendiente de verificación. |
| RF-19 | Escáner en salón | Página privada `/admin-scanner` protegida por rol para escanear QR desde móvil. | Solo admin/equipo autorizado puede acceder. | NO IMPLEMENTADO; no existe página/controlador `/admin-scanner` en `src/`. |
| RF-20 | Canje con saldo parcial | Al escanear, leer saldo, descontar importe y actualizar estado (`ACTIVE` → `EXHAUSTED`). | Verificado: saldo insuficiente rechazado; saldo parcial actualizado. | NO IMPLEMENTADO EN CÓDIGO PROPIO; no se encuentra writer de saldo parcial/canje de tarjetas regalo. |
| RF-21 | Prevención de fraude/duplicidad | Sanitización de código (`trim().toUpperCase()`) y comprobación atómica de saldo. | Test de manipulación de saldo con firma inválida → rechazado. | NO IMPLEMENTADO EN CÓDIGO PROPIO; no se acredita control atómico ni test de saldo de tarjetas regalo. |
| RF-22 | Envío por email con diseño | Emisión automática por email con diseño elegante del salón. | PENDIENTE DE VERIFICAR EN WIX GIFT CARDS; la app está instalada y existe un producto, pero no se han emitido tarjetas ni probado email. |

### 2.5. Comercio electrónico / La Boutique (Prioridad 🟡 Media)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-23 | Catálogo de productos | Venta de cosmética/capilar con precios y stock. | Wix Stores configurado. | VERIFICADO NATIVO EN LECTURA; Wix Stores Catalog V3 responde, con 24 productos visibles. Checkout E2E pendiente. |
| RF-24 | Gestión y sincronización de stock | Stock y disponibilidad comercial gestionados exclusivamente en Wix Stores Catalog V3 y sus herramientas nativas (panel/app Wix). | El checkout nativo deduce stock al pago; cancelaciones previas a fulfillment restock en Wix si procede; reembolsos solo reponen unidades devueltas y vendibles. Sin proyecciones ni movimientos custom. | MÓDULO CUSTOM RETIRADO EN PR #238; 30/30 inventory items con tracking en una ubicación; Orders Settings `ON_ORDER_PAID`. pruebas de checkout/cancelación/refund nativo pendientes. |
| RF-25 | Upselling en checkout | Sugerir tratamiento hidratante exprés (+12 €) al reservar Corte de Autor; champú matizador con 10% dto. al comprar bono de mechas. | ⚠️ No declarado en código — **requiere verificación/implementación** |
| RF-26 | Derecho de desistimiento 14 días | Excepción del Art. 103 para cosméticos desprecintados debe estar explícita en Términos y Condiciones. | ⚠️ No declarado — **requiere verificación** |

### 2.6. Fidelización y recurrencia (Prioridad 🟢 Baja)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-27 | Recordatorio WhatsApp/SMS | Mensaje automático a las 4-5 semanas de tinte/corte con enlace de reserva. | ⚠️ No declarado — **requiere implementación** |
| RF-28 | Confirmación y recordatorio 24 h | Mensaje automático de confirmación de cita y recordatorio 24 h antes con enlace para cancelar/modificar. | ⚠️ No declarado — **requiere implementación** |
| RF-29 | Promociones flash horas valle | Programar descuentos dinámicos (ej. 15% cortes martes 10:00-13:00). | ⚠️ No declarado — **requiere implementación** |
| RF-30 | Bonos/suscripciones | Bono de 4 peinados mensuales, bono barba, etc. | ⚠️ No declarado — **requiere implementación** |

### 2.7. Área de usuario y contenido (Prioridad 🟡 Media)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RF-31 | Registro/login de clientes | Área privada para gestionar perfil, historial de citas y compras. | Wix Members configurado. | APP NATIVA INSTALADA; Wix Members Area. Rutas, permisos y flujo completo de perfil/reservas/compras pendientes de E2E. |
| RF-32 | Blog y contenido social | Integración con Instagram, TikTok, Facebook, YouTube y sección de noticias/consejos. | Wix Blog está instalado y existe la página `/blog`; la integración con redes sociales no está verificada. |
| RF-33 | Formulario de contacto + mapa | Formulario web, Google Maps, teléfonos y WhatsApp directos. | Wix Forms v4: 4 formularios activos. Contacto actualiza CRM; caja manual, X y fichaje no tienen trigger backend. Wix Automations v2: 0 workflows activos y 0 borradores para envíos de formularios. Ubicación de formularios pendiente de verificar en Editor. |
| RF-34 | Catálogo de servicios estructurado | Clasificación por categorías (Básicos & Luxury, Babylights, Corte de Autor, Ritual Barba, Pack Madre e Hija) con precios claros. | VERIFICADO EN LECTURA PARCIAL; CMS y Wix Bookings contienen 94 servicios, 70 visibles y 24 ocultos. La presentación por categorías y precios en la UI publicada requiere revisión visual. |

---

## 3. Requisitos legales y normativos (Prioridad 🔴 Crítica)

### 3.1. Fiscal — Veri*factu / RD 1007/2023 (Ley Antifraude)

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RL-01 | Registro de facturación simplificada inalterable | Toda venta web y cada anticipo cobrado (incluida señal de reserva) debe generar la factura/registro fiscal correspondiente, con serie, fecha, base imponible e IVA desglosado. | Serie correlativa sin saltos; anticipo y saldo vinculados sin duplicidad; rectificaciones trazables. | P0 NO VERIFICADO: el SIF/Veri*Factu no está listo; no declarar conformidad ni activar anticipos hasta cerrar issue #209. |
| RL-02 | IVA 21% desglosado | Servicios de peluquería y cosmética tributan al 21%. Precios mostrados con IVA incluido. | Verificado matemáticamente: Babylights 89 € → Base 73,55 € + IVA 15,45 €; Corte 39 € → Base 32,23 € + IVA 6,77 €; etc. Cero desviación por redondeo. | ✅ Declarado |
| RL-03 | Cadena de hashes SHA-256 | Cada movimiento fiscal contiene la huella del anterior (hashChain) para garantizar no alteración. | `previousRecordHash` enlazado; `hash` canónico en caja; `recordHash` en contabilidad. | ✅ Declarado (matriz CMS) |
| RL-04 | Endpoint AEAT ValidarQR | Integración con `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR`. | ⚠️ Declarado en versión inicial; **verificar implementación real** | 🟡 Pendiente verificar |
| RL-05 | Exportación CSV/Excel para gestoría | Archivo normalizado con columnas: Fecha, Nº Factura, Concepto, Base Imponible, % IVA, Cuota IVA, Total, Método Pago. | Delimitador `;`, decimal con `,`, UTF-8 BOM (`\uFEFF`), compatible con A3ASESOR, Contasol, Sage. | NO IMPLEMENTADO; no existe `accountingExport.web.js`, `exportService.js` ni job de exportación CSV/Excel/SharePoint en el árbol actual. |
| RL-06 | Verificación de cuadre | Fila de totales con suma de bases, cuotas y totales. | Verificado: suma exacta al céntimo. | ✅ Declarado |
| RL-07 | NIF emisor/destinatario | Cada factura incluye NIF del salón y NIF/datos del cliente si los solicita. | Campos `NIFEmisor`, `NIFDestinatario` en colección. | ✅ Declarado |

### 3.2. Laboral — Registro de jornada RD-ley 8/2019

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RL-08 | Fichaje inmutable | Registro de entrada, salida y pausa sellado criptográficamente. | Firma HMAC-SHA256 por evento; registros append-only. | PARCIAL; código de jornada en backend, pero el formulario nativo no acredita conexión con el writer y ZONA STAFF mantiene fichaje deshabilitado. E2E runtime pendiente. |
| RL-09 | No manipulación posterior | Ante inspección de trabajo, los datos no pueden haber sido alterados. | Hash chain + registro de `previousRecordHash`. | ✅ Declarado |
| RL-10 | Registro horario staff | Colección `RegistrosHorariosStaff` con `resourceId`, `memberId`, `recordedAt`, `clockEventType`, `traceId`. | PARCIAL/BLOQUEADO; `FORM REGISTRO HORARIO` está activo, pero su `upsertContact` tiene mapping vacío y no invoca el ledger. Wix Automations v2 no devuelve workflows de envío de formularios. ZONA STAFF mantiene flags desactivados; writer/permisos/E2E pendientes. |

### 3.3. RGPD / AEPD — Protección de datos

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RL-11 | Ficha técnica capilar y de salud | Base de datos privada (`ClientHealthAndConsent`) con alergias PPD, sensibilidad cuero cabelludo, historial de fórmulas. | Permisos `Admin Only`; no indexable por Google; no accesible por API pública. | ✅ Declarado (`gdprHealth.web.js`) |
| RL-12 | Consentimiento expreso datos de salud | Casilla independiente, no premarcada, para tratamiento de datos de salud/bienestar. | Registro con fecha, hora e IP. | ✅ Declarado |
| RL-13 | Consentimiento de imagen | Casilla separada para autorizar publicación de fotos "antes y después" en web y redes. | Registro con fecha, hora e IP; revocable. | ✅ Declarado |
| RL-14 | Banner cookies AEPD | Panel con dos botones al mismo nivel: "Aceptar todas" y "Rechazar todas"; configuración granular. | Bloqueo de Meta Pixel, Google Analytics y TikTok Pixel hasta consentimiento. | PENDIENTE DE VERIFICAR CONFIGURACIÓN NATIVA; `masterPage.js` no implementa banner ni bloqueo de scripts. Debe revisarse Consent Manager y comportamiento real en el sitio publicado. |
| RL-15 | Minimización de datos | Solo recoger datos necesarios para la finalidad. | ✅ Declarado |
| RL-16 | Derecho de acceso/rectificación/supresión | La clienta debe poder ejercer sus derechos. | ⚠️ No declarado explícitamente — **requiere verificación** |

### 3.4. Consumo — LSSI-CE y TRLGDCU

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RL-17 | Aviso Legal | Enlace visible en web. | ⚠️ Declarado como "marco legal básico"; **verificar contenido actualizado** | 🟡 Pendiente |
| RL-18 | Política de Privacidad | Enlace visible en web. | ⚠️ **Verificar contenido actualizado** | 🟡 Pendiente |
| RL-19 | Política de Cookies | Enlace visible y coherente con el banner. | ⚠️ **Verificar contenido actualizado** | 🟡 Pendiente |
| RL-20 | Términos y Condiciones de compra | Debe incluir derecho de desistimiento 14 días y excepción Art. 103 para cosméticos desprecintados. | ⚠️ No declarado — **requiere implementación** | 🟡 Pendiente |
| RL-21 | Precios con IVA incluido | Todo precio mostrado al consumidor debe indicar "IVA incl.". | ✅ Declarado en frontend (`reserva-online.js`) | PENDIENTE DE VERIFICAR; no existe controlador `reserva-online.js` en `src/pages/`. La lectura CMS/Bookings devuelve importes, pero no demuestra que la UI publicada indique «IVA incl.» en todos los precios. |

---

## 4. Requisitos técnicos y de calidad

### 4.1. Arquitectura y seguridad

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RT-01 | Web Modules Velo | Los módulos invocables desde frontend usan `.web.js`, `webMethod` y permisos por función. | Todos los módulos backend invocables usan el contrato `.web.js` vigente. | ✅ Declarado |
| RT-02 | Permisos por función | Público: `Permissions.Anyone` (catálogo, disponibilidad, IA). Sensible: `Permissions.Admin` (exportación fiscal, canje bonos, fichas salud). | Verificado en código declarado. | ✅ Declarado |
| RT-03 | Secretos en `wix-secrets-backend` | Claves API y HMAC nunca en cliente. | `getSecret()` usado en backend. | ✅ Declarado |
| RT-04 | `suppressAuth: true` en operaciones admin | Inserciones/consultas administrativas protegidas. | Aplicado en `wixData.insert/query/update` sensibles. | ✅ Declarado |
| RT-05 | `consistentRead: true` | En consultas críticas para erradicar inconsistencias de lectura. | ⚠️ Declarado en dossier inicial; **verificar en código real** | 🟡 Pendiente |
| RT-06 | Extractor polimórfico de precio | Soportar `service.price` como número, objeto `{ amount }` o `service.payment.rate`. | `extractServicePrice()` implementado. | NO IMPLEMENTADO COMO SE ESPECIFICA; `extractServicePrice()` no existe en `src/`. El DTO de reservas convierte `price` con `Number(...)`; no se ha acreditado compatibilidad polimórfica con `{ amount }` o `payment.rate`. |
| RT-07 | Timeout IA | `AbortController` a 9 s. | ⚠️ Declarado en auditoría; **verificar en código real** | NO OPERATIVO; no hay proveedor IA configurado, por lo que no se ejecuta llamada con timeout. |
| RT-08 | Fallback IA | Respuesta estructurada si falla el parseo JSON. | Objeto fallback con claves esperadas. | NO OPERATIVO; no se acredita fallback de respuesta IA porque el proveedor está deshabilitado y el backend falla cerrado. |
| RT-09 | Prevención race condition gift cards | Sanitización + comprobación atómica de saldo. | Test de doble lectura rápida → segunda rechazada. | NO IMPLEMENTADO EN CÓDIGO PROPIO; no hay módulo Gift Cards ni saldo propio sobre el que verificar concurrencia. |
| RT-10 | CSV UTF-8 BOM + `;` + decimal `,` | Compatibilidad con Excel Windows y software contable español. | Cuando se implemente: delimitador `;`, decimal `,`, UTF-8 BOM y pruebas de compatibilidad. | NO IMPLEMENTADO; no existe `accountingExport.web.js` ni serializador CSV de gestoría. |

### 4.2. Persistencia (Wix Data Collections)

| ID | Requisito | Descripción | Estado de verificación |
|---|---|---|---|
| RT-11 | `Bookings/Services` | Catálogo nativo Wix Bookings. | ✅ Declarado |
| RT-12 | `PaidTransactions` | Libro inalterable de auditoría Ley Antifraude. | ✅ Declarado |
| RT-13 | `GiftCards` | Registro de bonos, firmas y saldos. | NO IMPLEMENTADO EN CÓDIGO PROPIO; la app Wix Gift Cards está instalada, pero no existe colección/writer propio `GiftCards` en `src/`. |
| RT-14 | `ClientHealthAndConsent` | Fichas médicas capilares confidenciales. | ✅ Declarado |
| RT-15 | `CitasF2` | Reservas con fases duales y estados; depósito gestionado por Wix Bookings nativo. | La colección no es autoridad del cobro del depósito. Conciliación de pago/depósito pendiente de pruebas. |
| RT-16 | `MovimientosCaja` | Movimientos fiscales con hash chain. | ✅ Declarado (matriz CMS) |
| RT-17 | `MapaStaff` | Maestro mixto consultivo: STAFF, GESTORIA, TERCERO y CONFIG_SISTEMA; NIF, régimen y Veri*factu. | Migrado live; retirada de DatosFiscales pendiente de despliegue backend |
| RT-18 | `HistoricoCierresZ` | Cierres con totales, hashes y firmas. | ✅ Declarado (matriz CMS) |
| RT-19 | `LibroAsientosContablesDetalle` | Asientos contables con debe/haber. | ✅ Declarado (matriz CMS) |
| RT-20 | `InventarioStockVenta` | Proyección personalizada de stock (LEGACY, no SSOT). | Módulo y writers retirados y fusionados en PR #238; no crear/actualizar maestros. Datos existentes preservados; CI offline verde, pruebas runtime en Wix Editor pendientes. |
| RT-21 | `MovimientosInventario` | Histórico de movimientos personalizado (LEGACY append-only, no SSOT de stock). | No generar nuevos movimientos de stock. Hooks append-only preservan filas existentes sin editar ni borrar; su archivo/retención requiere decisión separada. |
| RT-22 | `ControlOperativo` | Control de reintentos, alertas, deduplicación. | ✅ Declarado (matriz CMS) |
| RT-23 | `RegistrosHorariosStaff` | Fichajes con firma y trazabilidad. | ✅ Declarado (matriz CMS) |
| RT-24 | `MapaStaff` | Relación staff-recursos-servicios. | ✅ Declarado (matriz CMS) |

### 4.3. Calidad y testing

| ID | Requisito | Descripción | Criterio de aceptación | Estado de verificación |
|---|---|---|---|---|
| RT-25 | Parseo de módulos | Todos los módulos deben validar sintácticamente. | 32/32 módulos validados. | CI OFFLINE VERDE en PR #232, run #42671109488: 50 suites, 479 tests, 0 fallos; SDK contracts y ESLint SUCCESS. No equivale a runtime Wix. |
| RT-26 | Integridad de importaciones | Todas las importaciones resueltas. | 524 importaciones verificadas sin errores. | ✅ Declarado — **verificar tras refactor** |
| RT-27 | Test desglose IVA | Conciliación exacta al céntimo en todos los servicios. | 5/5 servicios verificados con 0,00 € desviación. | ✅ Declarado |
| RT-28 | Test criptografía gift cards | Firma HMAC válida; manipulación rechazada. | Test de alteración de saldo → firma inválida. | NO IMPLEMENTADO/NO VERIFICADO; no hay HMAC de Gift Cards propio ni test de manipulación de saldo. |
| RT-29 | Test filtro seguridad IA | Prompt malicioso no altera comportamiento. | Redirección a catálogo oficial. | NO OPERATIVO; proveedor IA no configurado. Los tests offline no acreditan un asistente activo. |
| RT-30 | Tests antirregresión | Detección de 5 riesgos graves subsanados: precio NaN, JSON IA, race condition gift cards, CSV incompatible, RGPD sin control de roles. | PENDIENTE DE RECONCILIAR; los cinco riesgos enumerados son históricos y no están demostrados individualmente por el estado actual de CI. |

---

## 5. Criterios de aceptación globales

El sitio se considerará **APTO PARA PRODUCCIÓN** cuando se cumplan **TODOS** los siguientes:

1. **Verificación real del repositorio:** El desarrollador debe entregar el árbol completo de `src/` (`tree src` o `find src -maxdepth 3`) y demostrar que los módulos declarados existen y contienen la lógica descrita, testada, funcional y fiable. **La solución debe ser honesta, profesional, real y testada para despliegue publico. No se aceptan soluciones greenfield ni nombres inventados.**

2. **Correspondencia módulo ↔ requisito:** Cada módulo del repositorio debe mapearse a los requisitos RF/RL/RT de esta hoja.

3. **Tests ejecutados sobre código real:** Los tests de IVA, HMAC, IA y antirregresión deben ejecutarse contra el código del repositorio, no contra versiones ideales.

4. **Cumplimiento legal verificado:**
   - Facturación simplificada inalterable con serie correlativa.
   - Cadena de hashes SHA-256 operativa.
   - Exportación CSV/Excel compatible con A3/Contasol/Sage.
   - Banner cookies AEPD con dos botones al mismo nivel.
   - Consentimiento imagen y salud registrado con fecha/IP.
   - Registro de jornada con firma HMAC y append-only.

5. **Operativa del salón validada en sesión de pruebas presencial:**
   - Reserva con tinte + corte simultáneo sin conflicto.
   - Escaneo de bono regalo desde móvil.
   - Descarga de CSV para gestoría y validación por el asesor.
   - Flujo de fianza con pago real (entorno de pruebas).

6. **Calidad técnica documentada:** El dossier de calidad debe reflejar el estado real tras cada intervención.

7. **Aprobación de la propietaria:** Marian Madrid debe confirmar que la operativa en pantalla es "tan cómoda como tener las tijeras en la mano".

---

ADDENDUM DE ESTADO Y CRITERIOS DE ACEPTACIÓN — 2026-11-14

Este bloque describe el sitio y la rama objeto de trabajo. Los inventarios anteriores se conservan únicamente como historia y no definen el esquema actual.

## Estado del ecosistema

- Sitio único: 50b39f33-e753-4331-ab35-b2ed43dc97f7. Banco de pruebas aislado, sin actividad real, según declaración del propietario.
- Plataforma: Wix Editor Classic + Velo.
- Repositorio canónico: nachoortegazgz/marianmadridz. Rama de alineación: fix/current-site-cms-contract-alignment.
- CMS actual: 23 colecciones (15 NATIVE, 8 WIX_APP), 524 campos NATIVE.
- MapaStaff: 18 campos, exclusivamente identidades de personal; no contiene recordType ni campos fiscales.
- DatosFiscales: 28 campos, una fila placeholder; no contiene traceId ni schemaVersion. No existe CONFIG_SISTEMA.
- ComplementosCatalogo: _id es identidad CMS; addonId es espejo físico temporal. El DTO addOnId pertenece al transporte Bookings.
- CajaActual: operationDate DATE, openingAmount NUMBER, sequenceCounters OBJECT; Bizum presencial se acumula en otherAmount. operationDateHour, bizumAmount y los cuatro opening*Amount no existen. ControlOperativo.ownerToken, retryAfter y nextRetryAt no existen.
- Wix Stores Catalog V3 es la autoridad de stock comercial. Los contratos de inventario personalizado permanecen retirados.

## Criterio de clasificación obligatorio

Cada requisito RF/RL/RT debe clasificarse con evidencia y fecha:
1. Implementado en código: existe código identificable; no implica runtime operativo.
2. Verificado en CI: suite y commit exactos, resultado y workflow identificados.
3. Verificado en Wix Editor: caso y resultado reproducible.
4. Verificado en operación real: solo tras autorización expresa y evidencia del resultado.
5. Declarado/documentado: figura en documentación o configuración, pero no ha superado una prueba ejecutada.
6. No implementado / pendiente / no aplicable: justificarlo; no inferir cumplimiento.

No marcar como cumplido un requisito legal o de negocio únicamente por existir una colección, un campo, un módulo o una prueba mock.

## Bloqueos y criterios de aceptación vigentes

- Fiscal/contable/laboral: writers permanecen fail-closed. No existe CONFIG_SISTEMA con identidad fiscal oficial verificada.
- La rama actual separa MapaStaff y DatosFiscales y migra los consumidores fiscales; CI y revisión del diff pendientes.
- Capa 3: SharePoint / Power Automate no están acreditados como flujo operativo.
- La correspondencia entre el código Velo del Editor y Git no está acreditada mediante exportación/hash.
- La retirada física de campos espejo requiere revisar automatizaciones, vistas CMS y contratos externos.
- El detalle del esquema, pruebas y bloqueos se mantiene en ESTADO_ACTUAL_PROYECTO.md.

## Checklist mínimo antes de declarar apto

- [ ] Mapear cada RF/RL/RT a código, contrato, consumidor y prueba existente.
- [ ] Ejecutar CI sobre el SHA exacto candidato y registrar suites/workflow.
- [ ] Vincular el código Velo del Editor con Git mediante exportación y comparación.
- [ ] Validar hooks/WebMethods en Wix Editor y pruebas sintéticas.
- [ ] Validar reservas simples/duales, concurrencia e idempotencia.
- [ ] Validar privacidad, consentimientos, roles y minimización de datos.
- [ ] Obtener aprobación de asesoría para procesos fiscales, contables y laborales.
- [ ] Validar exportación documental end-to-end sin retorno de datos a Capa 1.
- [ ] Obtener aceptación operativa de la propietaria.

---

## Addendum de autoridad y pruebas en sitio aislado — 2026-11-14

### Jerarquía de autoridad y SSOT

1. **USUARIO / PROPIETARIO DEL PROYECTO — SSOT de negocio y gobierno.** El usuario es la única fuente de verdad para objetivos, requisitos, prioridades, criterios de aceptación, decisiones funcionales y autorizaciones del proyecto. Sus instrucciones expresas prevalecen sobre cualquier regla, restricción, supuesto o estado histórico de esta documentación. Las decisiones relevantes se registran en el Decision Log para trazabilidad; el registro no sustituye ni limita la autoridad del usuario.
2. **Documentación oficial vigente de Wix y de cada integración — autoridad técnica.** Define contratos, APIs, permisos, límites y comportamiento de plataforma. Se aplica para ejecutar la decisión del usuario de forma técnicamente válida; si una limitación oficial impide cumplirla, se informa y se propone alternativa, sin cambiar unilateralmente el requisito.
3. **Decisiones expresas del usuario registradas en el repositorio.** Son la memoria documental de las decisiones vigentes. Si un registro antiguo contradice una instrucción posterior, prevalece la instrucción posterior del usuario.
4. **Dossier Técnico Consolidado, Dossier de Flujos, Directrices, Necesidades Web, diccionario CMS y estado del proyecto.** Son documentación derivada y subordinada a los niveles anteriores. No pueden crear autorizaciones, bloqueos o requisitos nuevos por inferencia.
5. **Código, configuración Wix, CMS y pruebas.** Acreditan el estado implementado, no la autoridad para redefinir requisitos. Las diferencias entre lo solicitado, documentado e implementado se registran como discrepancias verificables.

### Política temporal de desarrollo y pruebas

**Vigencia:** fase actual de desarrollo, depuración y pruebas, hasta que el usuario ordene expresamente habilitar las protecciones para el despliegue.

- Queda **en pausa la política append-only** durante esta fase. Ninguna colección o registro se considerará intocable únicamente por estar etiquetado como ledger, histórico, fiscal, contable, laboral, documental o append-only.
- Queda **en pausa toda prohibición genérica de edición o eliminación de registros**, tanto individual como masiva, cuando la única causa del bloqueo sea la inmutabilidad/append-only o una restricción temporal de mutabilidad del sitio aislado. La edición y eliminación forman parte de las operaciones permitidas durante las pruebas.
- No se exigirán registros rectificativos como única vía de corrección durante esta fase de pruebas. Esa regla se reconsiderará cuando el usuario habilite expresamente las protecciones previas al despliegue.
- Se mantienen las validaciones de esquema y tipos, la autenticación, autorización y permisos de acceso, la protección de secretos, la separación de capas, los controles de seguridad no relacionados con la inmutabilidad y la trazabilidad técnica de las pruebas. Esta pausa no autoriza accesos anónimos ni saltarse controles de identidad.
- No se habilitan por esta decisión writers fiscales, contables, laborales, pagos, devoluciones, comunicaciones ni automatizaciones externas que tengan gates funcionales independientes. Esos gates solo se modificarán por instrucción expresa o por una decisión técnica aprobada por el usuario.
- La pausa es temporal y **no se revierte automáticamente**. Solo el usuario puede ordenar la restauración y habilitación de las protecciones para despliegue. Antes de una publicación productiva, el estado de las protecciones debe revisarse con el usuario y quedar expresamente autorizado.

### Estado de implementación y publicación

El usuario declara que el código está integrado y publicado en Wix. Esta declaración se registra como **declaración del propietario**. En la consulta de GitHub de este corte, el PR #344 (feat/consolidate-fiscal-master-mapastaff-v2) figura fusionado el 2026-11-14 mediante el merge commit f3b1311eead05282e47f538afd506fe49e227141, que es el HEAD actual de main. La integración del cambio en Git está verificada. El usuario declara además que el código está publicado en Wix; no se dispone de un identificador de publicación Wix que vincule el runtime con ese SHA concreto.

**Nota de ejecución:** este addendum modifica la autoridad documental y la política de trabajo. No demuestra por sí mismo que todos los hooks, WebMethods, políticas de escritura o permisos CMS del runtime Wix hayan sido modificados para permitir todas las operaciones de edición y eliminación. Esa correspondencia debe verificarse en código y en Wix antes de afirmar que la pausa está aplicada técnicamente de extremo a extremo.

## Vigencia operativa — fase de desarrollo y pruebas (2026-11-14)

**Autoridad:** el usuario/propietario es la SSOT de negocio, requisitos, prioridades, criterios de aceptación y autorizaciones. Las instrucciones expresas posteriores del usuario prevalecen sobre decisiones y restricciones documentales anteriores. La documentación oficial de Wix y de las integraciones gobierna únicamente los contratos y límites técnicos de la plataforma.

**Mutabilidad CMS durante las pruebas en el sitio aislado:** append-only e inmutabilidad están temporalmente en pausa. Se habilitan update y remove individuales y masivos para todas las colecciones CMS propias del proyecto, incluidas las históricamente tratadas como ledgers. Las operaciones masivas deben identificar explícitamente los registros por ID. No se habilitan escrituras en colecciones propiedad de Wix Apps ni se eluden autenticación, autorización/RBAC, permisos, validaciones de esquema, integridad técnica, secretos o límites de plataforma. La inserción mantiene su allowlist; los writers fiscales/contables/laborales, pagos, reembolsos, comunicaciones y efectos externos conservan sus gates funcionales independientes.

**Restauración:** esta política no se revierte automáticamente. Solo el usuario puede ordenar la restauración de append-only y de las restricciones de mutación para preparar el despliegue. No iniciar actividad real basándose únicamente en esta excepción temporal del sitio aislado.

**Estado Git/Wix:** PR #344–#351 están integradas en main; HEAD al inicio de la reconciliación `79b6238fe4c23206bb8e81327191ab48425e3a0d`. PR #351 introdujo una regresión al retirar validadores aún consumidos; su recuperación está en PR #352 y CI queda pendiente. La publicación del sitio está declarada/verificada como estado del sitio, pero no existe release ID que vincule runtime y SHA. No se ha publicado esta tanda.

**CMS maestro:** MapaStaff revisión live 105, 56 campos físicos. Inventario live: 41 colecciones (12 NATIVE, 29 WIX_APP), 980 campos. `DatosFiscales`, `InventarioStockVenta` y `MovimientosInventario` no existen en este corte (404 / WDE0025); sus menciones en este documento son históricas salvo nueva evidencia.

---

## Addendum histórico — mutabilidad del CMS

La política vigente del sitio aislado se documenta en TEC-037 y en ESTADO_ACTUAL_PROYECTO.md. ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true permite update/remove individual y masivo sobre colecciones propias, con IDs explícitos y límite de 1.000 elementos. WIX_APP queda excluido; se mantienen RBAC, permisos, validaciones, allowlist de inserción y gates de efectos externos.

El estado físico vigente de CajaActual es 39 campos, no el inventario histórico de revisión 64. La definición actual está en DICCIONARIO_DATOS_CMS.md y en la auditoría de 2026-11-14. La existencia de campos CMS no demuestra que un WebMethod los persista o consuma.

DIRECTRICES DE ARQUITECTURA, DESARROLLO Y PRUEBAS
Proyecto: Marian Madrid — www.marianmadrid.es
Repositorio: nachoortegazgz/marianmadridz
Revision: 2026-11-09

1. AUTORIDAD Y FUENTES

1.1. Orden de autoridad
1) SSOT. Documentacion oficial vigente de Wix, Wix Apps y SDKs integrados. Comprueba que consultas la version correcta recomendada y actualizada de cada documento.
2) Referencia. Dossier Tecnico Consolidado y Dossier de Flujos End-to-End.
3) Este documento.
4) Necesidades Web y criterios de aceptacion.

1.2. Resolucion de contradicciones
- El contrato oficial del proveedor prevalece sobre comentarios o ejemplos internos.
- El codigo ejecutable y sus pruebas describen el comportamiento implementado.
- El dossier debe reflejar el comportamiento comprobado, no definir contratos distintos.
- Cada decision debe registrar la opcion elegida y su razon tecnica. No mantener instrucciones incompatibles.

2. INVARIANTES DE ARQUITECTURA

- Wix CMS es la fuente de verdad transaccional.
- SharePoint custodia evidencia documental y no gobierna transacciones.
- La Capa 3 no modifica ni dirige datos de la Capa 1.
- El frontend presenta y recoge datos; la logica de negocio reside en backend y WebMethods.
- Las constantes compartidas se centralizan en internalConfig.js.
- Las validaciones puras se centralizan en validation.js.
- La autenticacion, autorizacion y permisos se comprueban en backend.
- Los secretos nunca se incluyen en frontend, DTOs ni logs.
- Los eventos, webhooks y procesos asincronos son idempotentes.
- Los ledgers fiscales, contables y laborales son append-only. Las rectificaciones se registran como nuevos documentos trazables.
- No se realizan escrituras de prueba en datos reales del CMS.

3. CONTRATOS WIX ADOPTADOS

3.1. Web Modules
- Los modulos de acceso frontend usan archivos .web.js.
- Cada WebMethod declara su permiso mediante webMethod(Permissions.Anyone), Permissions.SiteMember o Permissions.Admin, segun el caso de uso.
- La autorizacion de negocio se vuelve a comprobar dentro del backend.
- processDualBooking exige Permissions.SiteMember y resuelve memberId/contactId desde la sesion Wix.
- No se utiliza permissions.json porque el backend no contiene modulos .jsw. La autorizacion de los modulos .web.js se define en cada WebMethod.

3.2. Backend events
- `events.js` contiene manejadores Velo gestionados por Wix.
- Wix entrega al handler el objeto de evento ya verificado y decodificado.
- Los eventos se procesan como handlers Velo; no se implementa un endpoint HTTP de recepción de webhooks.
- Los handlers de este sitio aceptan objetos de evento y no procesan JWT raw.
- La verificacion manual de JWT pertenece a endpoints HTTP autoalojados; este proyecto no implementa esa ruta.
- La entrega puede repetirse o llegar fuera de orden. La deduplicacion se realiza mediante eventId y ControlOperativo.WEBHOOK_EVENT.

3.3. Wix Bookings V2
- La disponibilidad usa timeZone.
- La creacion de reservas usa timezone.
- Los objetos Writer usan resource._id y location._id conforme al contrato SDK adoptado.
- La saga dual crea dos reservas independientes F1/F2 con pairToken y SLOT_LOCK.
- El Writer conserva las validaciones nativas de disponibilidad y opcion de pago. No se habilitan bypasses en la saga dual.
- No se utiliza createMultiServiceBooking para el servicio con gap de exposicion.
- rescheduleBooking recibe bookingId, slot y options; revision pertenece a options.

4. CMS Y VALIDACION

4.1. ControlOperativo
- beforeInsert normaliza y ejecuta assertControlOperativo.
- beforeUpdate recupera el registro persistido mediante lectura fuerte, fusiona la modificacion, impide cambiar controlType, protege tipos inmutables y valida el resultado completo.
- beforeRemove recibe itemId; recupera el registro y bloquea la eliminacion de WEBHOOK_EVENT.
- Toda operacion de parche atomico valida sus invariantes en el writer antes de ejecutar el cambio y usa condiciones de version cuando corresponda.
- WEBHOOK_EVENT es inmutable.
- SLOT_LOCK exige resourceId GUID y expiresAt valido.
- WEBHOOK_EVENT exige eventId.
- Todos los controles exigen controlType, dedupeKey y traceId.

4.2. ServiciosCatalogo
- En servicios duales, totalDuration es la suma exacta de phase1Duration, exposureDuration y phase2Duration.
- Si totalDuration no se informa y las fases suman un valor positivo, el hook calcula el total.
- Si se informa un total distinto, la escritura se rechaza.
- Las duraciones deben ser valores numericos finitos no negativos.

4.3. MapaStaff y DatosFiscales
- MapaStaff es exclusivamente el mapa de identidades de personal: staffMemberId (Bookings Staff Member), resourceId (Bookings Resource), scheduleId (agenda) y memberId (Wix Members). thirdPartyId es TEXT opaco, no es GUID ni coincide con DatosFiscales._id y no tiene consumidor localizado.
- _id identifica el elemento CMS. resourceId no se fusiona con _id aunque coincidan en las tres filas actuales: son identidades de dominios distintos.
- active es BOOLEAN y se usa junto con staffMemberId para la correlacion de proyecciones Bookings.
- MapaStaff no es autoridad RBAC. security.js resuelve roles mediante Wix Members, Bookings Staff Members API e internalConfig.STAFF.WEBSITE_ROLE_BY_RESOURCE_ID.
- DatosFiscales es el maestro de terceros, gestoría y configuración fiscal. recordType admite TERCERO, GESTORIA y CONFIG_SISTEMA.
- DatosFiscales no declara traceId ni schemaVersion; fechaInicioVerifactu es TEXT. No escribir campos no declarados.
- gestorName es el campo canónico de nombre de gestoría; gestorNombre es un espejo físico en retirada controlada.
- Los hooks y validation.js mantienen contratos separados. Los escritores fiscales siguen fail-closed mientras no exista CONFIG_SISTEMA con identidad fiscal oficial verificada.
4.4. Datos historicos fiscales
- Los documentos fiscales append-only no se reescriben para normalizar nombres de campo.
- Los lectores de `MovimientosCaja`, `ControlOperativo` y `CitasF2` pueden interpretar valores historicos exclusivamente en lectura, con `warn` trazable y fecha `REVIEW-BY`.
- Los campos `ONLINE` de `paymentMethod`, `payloadJson` y `meta.paymentMethod` no se aceptan en escrituras nuevas.
- Toda escritura nueva utiliza `WIX_PAYMENTS`, `payload` y `channelType` como contratos canonicos.
- No se retira un lector historico hasta verificar el contenido CMS y demostrar cero lecturas.

5. SEGURIDAD Y PRIVACIDAD

- No confiar en IDs, roles, permisos, importes ni propiedad enviados por el navegador.
- Validar en backend identidad Wix, propiedad del recurso y rol requerido.
- Aplicar minimo privilegio y usar elevation solo para operaciones de sistema justificadas.
- No exponer hashes fiscales, claves, tokens bearer, PII innecesaria ni notas internas.
- Los tokens de visualizacion son opacos, ligados a una reserva, de un solo uso y con caducidad.
- Los errores publicos no deben permitir enumerar reservas, miembros ni datos fiscales.

6. CONCURRENCIA E IDEMPOTENCIA

- Las reservas simples y duales revalidan disponibilidad en servidor.
- SLOT_LOCK usa version, lockToken y expiracion.
- La saga dual mantiene journal de reprogramacion en ControlOperativo con estados propios del dominio.
- Un resultado incierto de Writer bloquea el reintento ciego y requiere reconciliacion por identidad e idempotencia.
- Los webhooks se deduplican por eventId antes de mutar datos.
- Los claims durables de DEDUPE_KEY y LEDGER_IDEMPOTENCY no se purgan con la retencion corta de IDEMPOTENCY.
- DISPLAY_TOKEN se consume mediante eliminacion condicionada; la garantia de concurrencia debe probarse en Wix Editor.

7. TESTING Y CRITERIOS DE ACEPTACION

Cada cambio debe incluir pruebas proporcionales al riesgo:
- Unitarias de validacion y transformacion.
- Contratos de SDK y WebMethods.
- Integracion de acceso CMS y hooks.
- Regresion de reservas, pagos y sagas.
- Idempotencia y concurrencia.
- Seguridad y permisos.
- Pruebas end-to-end en Wix Preview y en sitio publicado cuando proceda.

Los mocks offline no acreditan comportamiento de Wix CMS, permisos efectivos, hooks ni concurrencia real. El informe debe separar:
- Verificado en codigo.
- Verificado en CI.
- Verificado en Wix Preview.
- Verificado en sitio publicado.
- Pendiente de comprobar.

8. CONTROL DE CAMBIOS

1) Identificar HEAD y estado del repositorio.
2) Crear rama de trabajo.
3) Localizar consumidores, contratos y dependencias.
4) Consultar documentacion oficial vigente.
5) Definir comportamiento y pruebas de aceptacion.
6) Implementar el cambio minimo.
7) Ejecutar lint y suites pertinentes.
8) Revisar diff y resultados de CI.
9) Preparar reversibilidad.
10) Abrir PR para revision.
11) Fusionar solo con aprobacion.
12) Desplegar Wix solo con autorizacion expresa y validación aprobada.
13) Verificar el resultado en el entorno destino.

No fusionar ni desplegar con pruebas fallidas, riesgos criticos abiertos o sin estrategia de recuperacion. No modificar workflows de CI sin necesidad demostrada y aprobacion.

9. DECISIONES CONSOLIDADAS DE LA REVISION CAPA 1 — 2026-11-09

- ControlOperativo: validacion completa en insercion y actualizacion; update fusiona el estado persistido y la modificacion; remove recibe itemId y consulta el registro.
- Journal dual: mantiene su enum especifico en booking/dualRescheduleJournal.js; no se mezcla con CONTROL_STATUS.
- MapaStaff: maestro consultivo mixto; solo los registros STAFF participan en la correlacion de eventos nativos; nunca gobierna RBAC.
- Eventos Wix: se consumen como objetos Velo verificados por la plataforma; no se procesa JWT dentro de events.js.
- Permisos: .web.js controla acceso en cada webMethod; no existe manifiesto permissions.json aplicable al backend actual.
- Control types: DEDUPE_KEY y LEDGER_IDEMPOTENCY se conservan porque tienen productores activos y retencion duradera.
- Servicios duales: `totalDuration` debe coincidir exactamente con la suma de las tres fases; si se omite, el hook lo calcula.
- BOOKING_STATUS.UPDATED no existe como estado. CANCELED es la grafia canonica.
- PAYMENT_STATUS.NOT_PAID es el valor persistido; no se utiliza UNPAID en el contrato CMS.
- Los lectores de documentos fiscales y de proyecciones operativas historicas se conservan en modo lectura, con aviso trazable y `REVIEW-BY`; no pueden generar escrituras con valores o nombres anteriores.

10. VALIDACION PENDIENTE EN WIX

La implementacion en GitHub no acredita por si sola el comportamiento del runtime. Antes de fusionar o desplegar deben ejecutarse:
- Hook ControlOperativo_beforeUpdate con heartbeat, renovacion, liberacion y parche parcial.
- Hook ControlOperativo_beforeRemove con WEBHOOK_EVENT y SLOT_LOCK.
- Invocacion anonima y autenticada de processDualBooking.
- Doble consumo simultaneo de DISPLAY_TOKEN.
- Reprogramacion dual: bulkPatch, fencing, heartbeat, expiracion y recuperacion.
- Entrega repetida y desordenada de eventos Bookings/eCommerce.
- Duracion exacta de servicios duales mediante CMS.



11. CHECKPOINT DE VALIDACION GITHUB — 2026-11-09

- Rama: fix/capa1-audit-final-2026-11-09.
- Commit validado: 5dbc3df90fc22f7eb9e4a5359b5dc6f0b3569708.
- GitHub Actions run: 42656024671 — SUCCESS.
- Regresion offline: 50 suites, 477 tests, 0 fallos.
- Contratos SDK: Wix eCommerce Cart V2, Wix Data items.patch/items.bulkPatch y Bookings Reader V2 — SUCCESS.
- ESLint: ejecucion SUCCESS.
- Runtime Wix: pendiente; CI offline no acredita hooks, permisos, concurrencia ni eventos en sitio publicado.
- Workflow CI usa actions/checkout@v5 y actions/setup-node@v5 con Node 24.22.1.

12. BLOQUEO DE HERRAMIENTA DE LINT

- El paquete oficial @wix/eslint-plugin-cli@1.0.2 declara peerDependency eslint ^8.0.0.
- La version instalada eslint@8.25.0 esta fuera de soporte y npm marca tambien dependencias transitivas de esa cadena.
- No se fuerza la instalacion de ESLint 10 ni se ignora la incompatibilidad de peerDependencies: hacerlo ocultaria un contrato no soportado.
- Se conserva el plugin Wix actual hasta disponer de una version compatible mantenida o una sustitucion validada que conserve las reglas necesarias para el proyecto.
- Este bloqueo afecta exclusivamente a la herramienta de desarrollo; no cambia el runtime Wix ni el codigo funcional.
- El criterio de cierre de cero dependencias sin soporte queda pendiente de resolver este bloqueo. No se declara cumplimiento total de ese criterio.

FIN DEL DOCUMENTO


13. DECISIONES VINCULANTES — 2026-11-10

- Wix Stores Catalog V3 y sus herramientas nativas son la única autoridad operativa del inventario comercial.
- Orders Settings live: inventoryUpdateTrigger=ON_ORDER_PAID. Los webhooks de eCommerce no reservan, descuentan, reponen ni proyectan stock en CMS.
- Los handlers eCommerce mantienen idempotencia, ledger fiscal, estado de reservas y reembolsos, pero no realizan escrituras de inventario.
- Excepción temporal de desarrollo TEC-033 (2026-11-14): los hooks append-only permiten update/remove individual en la rama `chore/temporary-append-only-mutation-window`. Esta excepción no se publica; antes del despliegue productivo se restaura ENABLED=false y las allowlists/hooks append-only. No usar sobre datos reales sujetos a conservación legal.
- La capa custom inventario.web.js, sus WebMethods, el panel de staff y los tests de su writer se retiran cuando no quedan consumidores. La retirada requiere CI y Wix Editor para venta, cancelación y reembolso.
- Depósito de reserva: 15 EUR solo para servicios >100 EUR; Wix Bookings nativo es primera opción. No configurar hasta resolver discrepancia de contrato REST vs Wix Help sobre inPerson y verificar la capacidad de la cuenta.
- Cancelación/reprogramación gratuita con 24 h; devolución íntegra si cancela el negocio. No retención automática tardía/no-show sin revisión jurídica de proporcionalidad.
- Registro central de decisiones: docs/DECISION-LOG.md y ADR docs/adr/2026-11-10-deposit-and-native-inventory.md.


---

ADDENDUM DE CONTROL DE CAMBIOS, PUBLICACIÓN Y PRUEBAS — 2026-11-13

Estas directrices prevalecen sobre las instrucciones de pruebas del addendum 2026-11-11 cuando difieran respecto a la naturaleza aislada del sitio actual.

## Repositorio y publicación

- GitHub `main` consultado: `738eb78faaa48502532c83c3e4b8b53db1144950`.
- El sitio principal Wix figura Published y Velo enabled; el propietario declara que el sitio se ha actualizado y publicado.
- No se dispone de un release/deployment ID que vincule el runtime publicado con el SHA actual de GitHub. No confundir “sitio Published” con “SHA publicado demostrado”.
- El HEAD documental `738eb78...` no tiene estados combinados ni workflow runs asociados en la consulta. Los resultados de CI de PR #330 son históricos y no certifican automáticamente el HEAD actual.
- Volver al proceso obligatorio rama → cambios delimitados → pruebas → diff → PR → CI/revisión → merge. Los commits documentales directos a main realizados en el corte anterior fueron una desviación de proceso; no repetirla.

## Estado del sitio actual

El único sitio objeto de trabajo es 50b39f33-e753-4331-ab35-b2ed43dc97f7. Es un banco de pruebas aislado, sin actividad real. No se presupone la existencia de un sitio de staging adicional ni se extrapolan configuraciones de otros sitios. Las automatizaciones, conexiones y efectos externos se mantienen bajo sus gates independientes y deben verificarse antes de habilitar cualquier actividad real.
## Estado CMS y restricciones

- Producción: inventario CMS sujeto a actualización tras TEC-035. MapaStaff revision 36 / 5 registros; DatosFiscales legacy revision 21 / 1 placeholder. Recuentos NATIVE: CajaActual 1; CitasF2 1; ComplementosCatalogo 36; ControlOperativo 3; DatosFiscales 1; HistoricoCierresZ 0; InventarioStockVenta 1; LibroAsientosContablesDetalle 0; MapaStaff 3; MovimientosCaja 0; MovimientosInventario 1; PaquetesGestoria 0; RegistroIntegracion 0; RegistrosHorariosStaff 2; ServiciosCatalogo 95.
- Wix Stores Catalog V3 es la autoridad del inventario comercial; Wix Invoices V1 en producción.
- CitasF2 sigue con una proyección `CONFIRMED / NOT_PAID`; la última lectura nativa Bookings Reader V2 registrada devolvió `CANCELED / NOT_PAID` para el mismo bookingId. No editar manualmente la proyección ni borrar la reserva; resolver mediante handler/evento y reconciliación idempotente demostrada.
- Mantener writers fiscales, contables y laborales deshabilitados; mantener `ACCOUNTANT_SEND_ENABLED=false`. No realizar pagos, reembolsos, movimientos de caja, cierres, asientos, fichajes ni exports reales durante las pruebas en el sitio aislado.
- SharePoint / Power Automate Capa 3 no está verificado live.

## Regla de evidencia

Todo informe separa explícitamente:
- Verificado por lectura live.
- Declarado por el propietario.
- Verificado en código.
- Verificado en CI (SHA y workflow).
- Verificado en Wix Preview del sitio aislado.
- Verificado en producción.
- Inferido o pendiente.

Una publicación solo se certifica como correspondiente al código cuando existe una referencia comprobable del artefacto/SHA desplegado o una verificación equivalente reproducible. No elevar una declaración a verificación.

---

## Addendum de autoridad y pruebas en sitio aislado — 2026-11-14

### Jerarquía de autoridad y SSOT

1. **USUARIO / PROPIETARIO DEL PROYECTO — SSOT de negocio y gobierno.** El usuario es la única fuente de verdad para objetivos, requisitos, prioridades, criterios de aceptación, decisiones funcionales y autorizaciones del proyecto. Sus instrucciones expresas prevalecen sobre cualquier regla, restricción, supuesto o estado histórico de esta documentación. Las decisiones relevantes se registran en el Decision Log para trazabilidad; el registro no sustituye ni limita la autoridad del usuario.
2. **Documentación oficial vigente de Wix y de cada integración — autoridad técnica.** Define contratos, APIs, permisos, límites y comportamiento de plataforma. Se aplica para ejecutar la decisión del usuario de forma técnicamente válida; si una limitación oficial impide cumplirla, se informa y se propone alternativa, sin cambiar unilateralmente el requisito.
3. **Decisiones expresas del usuario registradas en el repositorio.** Son la memoria documental de las decisiones vigentes. Si un registro antiguo contradice una instrucción posterior, prevalece la instrucción posterior del usuario.
4. **Dossier Técnico Consolidado, Dossier de Flujos, Directrices, Necesidades Web, diccionario CMS y estado del proyecto.** Son documentación derivada y subordinada a los niveles anteriores. No pueden crear autorizaciones, bloqueos o requisitos nuevos por inferencia.
5. **Código, configuración Wix, CMS y pruebas.** Acreditan el estado implementado, no la autoridad para redefinir requisitos. Las diferencias entre lo solicitado, documentado e implementado se registran como discrepancias verificables.

### Política temporal de desarrollo y pruebas

**Vigencia:** fase actual de desarrollo, depuración y pruebas, hasta que el usuario ordene expresamente habilitar las protecciones para el despliegue.

- Queda **en pausa la política append-only** durante esta fase. Ninguna colección o registro se considerará intocable únicamente por estar etiquetado como ledger, histórico, fiscal, contable, laboral, documental o append-only.
- Queda **en pausa toda prohibición genérica de edición o eliminación de registros**, tanto individual como masiva, cuando la única causa del bloqueo sea la inmutabilidad/append-only o una restricción temporal de mutabilidad del sitio aislado. La edición y eliminación forman parte de las operaciones permitidas durante las pruebas.
- No se exigirán registros rectificativos como única vía de corrección durante esta fase de pruebas. Esa regla se reconsiderará cuando el usuario habilite expresamente las protecciones previas al despliegue.
- Se mantienen las validaciones de esquema y tipos, la autenticación, autorización y permisos de acceso, la protección de secretos, la separación de capas, los controles de seguridad no relacionados con la inmutabilidad y la trazabilidad técnica de las pruebas. Esta pausa no autoriza accesos anónimos ni saltarse controles de identidad.
- No se habilitan por esta decisión writers fiscales, contables, laborales, pagos, devoluciones, comunicaciones ni automatizaciones externas que tengan gates funcionales independientes. Esos gates solo se modificarán por instrucción expresa o por una decisión técnica aprobada por el usuario.
- La pausa es temporal y **no se revierte automáticamente**. Solo el usuario puede ordenar la restauración y habilitación de las protecciones para despliegue. Antes de una publicación productiva, el estado de las protecciones debe revisarse con el usuario y quedar expresamente autorizado.

### Estado de implementación y publicación

El usuario declara que el código está integrado y publicado en Wix. Esta declaración se registra como **declaración del propietario**. En la consulta de GitHub de este corte, el PR #344 (feat/consolidate-fiscal-master-mapastaff-v2) figura fusionado el 2026-11-14 mediante el merge commit f3b1311eead05282e47f538afd506fe49e227141, que es el HEAD actual de main. La integración del cambio en Git está verificada. El usuario declara además que el código está publicado en Wix; no se dispone de un identificador de publicación Wix que vincule el runtime con ese SHA concreto.

**Nota de ejecución:** este addendum modifica la autoridad documental y la política de trabajo. No demuestra por sí mismo que todos los hooks, WebMethods, políticas de escritura o permisos CMS del runtime Wix hayan sido modificados para permitir todas las operaciones de edición y eliminación. Esa correspondencia debe verificarse en código y en Wix antes de afirmar que la pausa está aplicada técnicamente de extremo a extremo.
