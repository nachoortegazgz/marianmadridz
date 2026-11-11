# Referencia operativa — Wix Dashboard, Wix Apps y secretos

**Proyecto:** Marian Madrid Peluquería y Estética  
**Sitio:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Base de revisión:** contexto Wix leído el 2026-11-11; repositorio en la rama `fix/cms-datetime-write-contracts-2026-11-11`.  
**Naturaleza:** documento de consulta y checklist de auditoría. No acredita por sí mismo que cada ajuste esté configurado ni autoriza cambios en producción.

## 1. Estado verificado del sitio

| Elemento | Estado observado | Consecuencia técnica |
|---|---|---|
| Editor | Wix Editor (no Wix Studio) | Las instrucciones operativas deben aplicarse al editor real; no asumir menús exclusivos de Studio. |
| Publicación | Published | Cualquier cambio de Dashboard puede afectar al sitio en producción. |
| Velo | Enabled | Backend Velo disponible. |
| Idioma / región | es / ES | Textos, formatos y reglas regionales deben revisarse en español de España. |
| Zona horaria | `Europe/Madrid` | Horarios de Bookings y fechas de negocio deben interpretarse en esta zona; no aplicar conversiones dobles. |
| Moneda | EUR | Debe coincidir con el contrato de checkout, pagos y contabilidad. |
| Wix Bookings | Instalado | App nativa de reservas; su instalación no prueba que servicios, políticas, staff y horarios estén completos. |
| Wix Stores | Instalado, **Catalog V3** | La lectura live más reciente contradice el dossier histórico que menciona Catalog V1. Para operaciones Stores prevalece la versión live; revisar código/SDK antes de cualquier cambio. |
| Wix Invoices | Instalado, **V1** | No usar contratos ni endpoints de Invoices V2. |
| Members Area | Instalado | No implica que la privacidad de los campos de miembro esté correctamente configurada. |
| Gift Cards | Instalado | Verificar si el flujo está en uso y qué entidad nativa gobierna saldo y canje. |
| Wix Blog | Instalado | Gestionar contenido y SEO desde sus herramientas nativas. |
| Promote SEO | Instalado | SEO técnico y etiquetas se gestionan con la app/funciones SEO de Wix. |
| Wix Forms & Payments | Instalado | No asumir que sus formularios o métodos de pago están activos o aislados. |
| Wix Hotels | Instalado | No se ha acreditado dependencia de negocio; revisar uso y consumidores antes de considerar retirarlo. |

**Regla de precedencia:** contexto live y contratos oficiales actuales > código y pruebas de la rama > dossier histórico. La instalación de una app no demuestra configuración funcional, pagos habilitados, automatizaciones activas ni integración E2E.

## 2. Arquitectura y reglas de alineación

1. **Wix Apps nativas** son propietarias de sus entidades nativas (reservas Bookings, pedidos/checkout Stores-eCommerce, miembros y facturas nativas).
2. **Wix CMS (Capa 1)** es la SSOT transaccional de los dominios personalizados y sus proyecciones autorizadas. SharePoint/M365 (Capa 3) conserva evidencia documental; nunca escribe ni gobierna Capa 1.
3. **Backend Velo/WebMethods** ejecuta validación, autorización, reglas de negocio, idempotencia, conciliación y escrituras CMS. El frontend solo presenta/recoge datos y llama WebMethods.
4. Colecciones `WIX_APP`: lectura según contratos oficiales; no escribir directamente en colecciones internas de apps. Las mutaciones se realizan mediante la API/SDK oficial de la app.
5. Colecciones fiscales, contables y laborales append-only: no editar ni borrar para corregir QA. Las rectificaciones, cuando procedan, son nuevos registros trazables.
6. Permisos de CMS: comprobar permisos efectivos por colección y mantener acceso privilegiado en ledgers sensibles. Los permisos de UI no sustituyen las comprobaciones backend.
7. No activar automatizaciones ni enviar emails/cobros reales durante QA. El sitio está publicado y un reset posterior de datos sintéticos no aísla los efectos externos durante las pruebas.
8. No cambiar configuración, activar/desactivar apps, políticas, pagos, automatizaciones o publicar sin autorización específica y plan de reversión.

## 3. Configuración del Dashboard por área y Wix App

Las filas de “configuración objetivo / comprobación” son criterios de auditoría, no afirmaciones de que el valor actual ya esté fijado. Antes de modificar un ajuste, leer el valor live, registrar evidencia y revisar consumidores.

### 3.1 Datos generales del sitio

**Dashboard → Settings / Configuración → Business Info / Información del negocio** (la etiqueta puede variar según la versión del Dashboard).

- Confirmar nombre comercial, dirección, país, teléfono y correo de contacto.
- Confirmar región ES, idioma es, zona horaria `Europe/Madrid` y moneda EUR.
- Evitar cambiar la moneda del sitio sin análisis de pedidos, precios, pagos y conciliación.
- La dirección/email públicos no sustituyen datos fiscales del emisor: el NIF fiscal se obtiene del secreto y de los datos fiscales autorizados.

**Alineación backend:** `src/backend/internalConfig.js` (`SDK_CONFIG.TZ`, `SDK_CONFIG.CURRENCY_CODE`, `SDK_CONFIG.LOCATION_ID`, `SDK_CONFIG.EMAIL`). No editar constantes para “hacerlas coincidir” sin verificar primero el dato real y sus consumidores.

### 3.2 Wix Bookings — reservas, servicios, staff y disponibilidad

**Dashboard → Booking Services / Servicios de reservas; Booking Calendar / Calendario; Staff / Personal; Booking Policies / Políticas.**

Checklist de configuración:

- Servicios: comparar cada servicio visible y activo con `ServiciosCatalogo`; revisar identificador Wix, nombre, duración, precio, modalidad, recursos/staff elegibles y complementos asociados. El contrato declarado del proyecto usa `ServiciosCatalogo` como configuración propia de servicios y `ComplementosCatalogo` para complementos; la sincronización debe verificarse antes de editar.
- Staff: comprobar que cada persona está vinculada al recurso Bookings correcto y que su agenda corresponde al horario aprobado. Los horarios de negocio y los horarios individuales no son equivalentes.
- Horarios: revisar horario general, horarios por recurso, descansos, excepciones, bloqueos y festivos. Wix puede copiar el horario de negocio al crear un miembro de staff; no asumir que los cambios posteriores se propagan retroactivamente.
- Políticas: identificar la política por defecto y las políticas específicas por servicio. Revisar antelación mínima/máxima, cancelación, reprogramación, lista de espera y participantes. No introducir plazos o penalizaciones sin decisión comercial aprobada.
- Reservas online y duales: Bookings es SSOT de slots/reservas nativas; el backend coordina el flujo dual y proyecta lo necesario en `CitasF2`. La lógica de hueco, mismo profesional, revalidación, compensación e idempotencia no debe duplicarse en el editor.
- Pagos de reservas: distinguir pago online, pago presencial/offline, depósitos y saldo. No probar con tarjetas/cobros reales. Cualquier configuración de depósitos requiere validar el contrato de Bookings, tratamiento fiscal/contable y cancelaciones antes de habilitarla.
- Notificaciones: verificar plantillas, destinatarios, idioma y eventos; deshabilitar pruebas de envío real salvo autorización y receptor de QA controlado.

**Backend relacionado:** `bookingSaga.js`, `bookingCore.js`, `staff.js`, `reservas.web.js`, `citasManager.web.js`, `events.js`, `internalConfig.js`; colección propia `CitasF2`; catálogo `ServiciosCatalogo` y `ComplementosCatalogo`; controles/idempotencia en `ControlOperativo`.

**Validación obligatoria:** contrastar servicios, IDs, recursos, horarios y políticas con las APIs Bookings oficiales; verificar que los webhooks se procesan una sola vez y que eventos tardíos no degradan el estado de la proyección. No hacer nuevas reservas sintéticas en el sitio publicado mientras no se aíslen los efectos externos.

### 3.3 Wix Stores / eCommerce — catálogo, stock, pedidos y checkout

**Dashboard → Store Products / Productos; Inventory / Inventario; Orders / Pedidos; Settings → Checkout, Payments, Shipping & Tax.**

- Versión live: **Catalog V3**. El dossier histórico que dice V1 queda marcado como desactualizado para la configuración observada el 2026-11-11. Antes de modificar SDK, webhooks o catálogo, comprobar la versión en contexto live y el paquete/contrato del código.
- Catálogo: revisar productos, variantes, SKU, visibilidad, precios, impuestos y categorías. No recrear en CMS productos que Wix Stores ya gobierna.
- Inventario: confirmar ubicación y seguimiento de stock, reglas de decremento y política de artículos sin seguimiento. La documentación/QA reciente indica que el decremento nativo observado está ligado a `ON_ORDER_PAID`; confirmar el ajuste live antes de cambiarlo.
- Pedidos: Wix Orders/eCommerce es fuente de verdad del pedido y del estado de pago. Los marcadores de conciliación en `ControlOperativo` no sustituyen al pedido nativo.
- Checkout/pagos: revisar métodos realmente disponibles en España, estados autorizados/capturados y moneda EUR. Un estado AUTHORIZED no equivale a cobro liquidado. No realizar transacciones reales como prueba.
- Envíos/impuestos: comprobar que solo aplican reglas que el negocio utiliza; no inventar zonas, tarifas ni tipos fiscales.

**Backend relacionado:** `internalConfig.js` (`WIX_CATALOG_APP_IDS`, moneda/ubicación); `events.js` y handlers eCommerce; `ControlOperativo` para idempotencia/reconciliación; `MovimientosCaja` y ledgers solo para hechos económicos confirmados. `CajaActual` refleja exclusivamente efectivo físico; tarjeta, Bizum, transferencias y pagos online no alteran ese saldo.

**Bloqueo:** discrepancia V1/V3 histórica resuelta a favor de V3 por lectura live, pero la compatibilidad integral del repositorio debe revisarse antes de cualquier cambio funcional.

### 3.4 Wix Invoices V1 y proceso fiscal

- La app observada es **Wix Invoices V1**. No utilizar documentación o endpoints de V2.
- La factura nativa de Wix y el ledger fiscal personalizado no deben considerarse equivalentes sin conciliación de número, fecha, tercero, impuestos, líneas, estado y vínculo con pedido/reserva.
- No activar emisión automática, envío al cliente o procesos fiscales por el mero hecho de que la app esté instalada.
- El backend fiscal conserva secuencia, hash, referencias y trazabilidad; las colecciones de ledger no se sobrescriben.
- La existencia de hashes/firma interna no acredita por sí sola cumplimiento Veri*Factu ni conexión/remisión efectiva a AEAT.

**Backend relacionado:** `cajas.web.js`, `eventLog.js`, `fiscalAggregator.js`, `fiscalDocuments.web.js`, `securityEngine.js`, `mmSecrets.js`; colecciones `MovimientosCaja`, `DatosFiscales`, `HistoricoCierresZ`, `PaquetesGestoria` y ledgers contables.

**Pendiente crítico:** el audit de preparación fiscal indica que no está acreditado un transporte de remisión AEAT ni la configuración de certificado cualificado/PKCS#12/proveedor de firma TLS para AEAT. El servicio de firma externo no debe confundirse con el transporte AEAT.

### 3.5 Members Area y privacidad

- Mantener roles de negocio en `MapaStaff.rolWebsite` (ADMIN / GESTION / ESTILISTA) y validar permisos en backend.
- No utilizar etiquetas/roles visuales del Dashboard como única autorización.
- Auditar privacidad y exposición de campos de perfil, especialmente datos de contacto y cualquier campo personal/sensible. La colección nativa `Members/FullData` tiene restricciones propias de Wix; no cambiar permisos o migrar campos sin inventario de consumidores y plan RGPD.
- No almacenar datos sensibles innecesarios en perfiles públicos ni en logs.

**Backend relacionado:** `security.js`, `securityEngine.js`, `staff.js`, `internalConfig.js`, `MapaStaff`, `secretAccess.js`.

### 3.6 Gift Cards, Forms & Payments, Blog y Promote SEO

- **Gift Cards:** comprobar si el producto está habilitado, denominaciones, caducidad, restricciones, saldo y canje. El estado de una tarjeta regalo debe proceder del sistema nativo que la gobierna; no duplicar su saldo en CMS.
- **Forms & Payments:** inventariar formularios activos, campos recogidos, finalidad, consentimiento, destinatarios y acciones posteriores. Verificar si un formulario crea contactos, envía emails o inicia automatizaciones; no enviar formularios de prueba en producción.
- **Blog:** comprobar autoría, publicación, URLs, categorías, idioma y políticas de moderación. Evitar automatizaciones de publicación sin aprobación editorial.
- **Promote SEO:** revisar título, descripción, canonical, indexación/noindex, sitemap y redirecciones. No cambiar etiquetas masivamente ni publicar modificaciones SEO sin lectura previa y comparación del estado actual.

**Backend relacionado:** formularios y comunicaciones solo deben llegar a WebMethods cuando exista necesidad real; Blog/SEO son principalmente configuración/contenido Wix. No crear secretos para estas apps salvo que exista un consumidor backend identificado y una integración externa aprobada.

### 3.7 Wix Hotels

La app aparece instalada, pero no se ha acreditado un proceso de negocio hotelero ni un consumidor backend. Mantener como **instalada / uso no verificado**. No desinstalar ni configurar sin revisar páginas, datos, automatizaciones, permisos y posibles dependencias.

### 3.8 Wix Automations

- Auditoría anterior: 149 automatizaciones, 27 activas y 122 inactivas; debe repetirse una lectura actual antes de cualquier decisión. Algunas pueden ser propiedad de Wix o de una app.
- Inventariar nombre/ID, propietario, trigger, filtros, condiciones, acciones, destinatarios, frecuencia, estado y efecto externo.
- Etiquetar cada automatización por proceso: reservas, pedidos/pagos, contactos/forms, comunicaciones, facturación y otros.
- Confirmar que los webhooks/backend no duplican una acción ya ejecutada por Wix.
- Toda automatización que envíe emails, modifique pedidos, cobre, notifique clientes o llame servicios externos es un sink externo: no ejecutar ni activar para QA.
- No desactivar en bloque. Cambiar una automatización exige leer configuración y revisión actual, preservar condiciones y validar read-after-write.

**Backend relacionado:** `events.js`, `crons.js`, `jobs.config`, `ControlOperativo`, WebMethods y webhooks idempotentes.

## 4. Secretos requeridos por consumidores backend

### 4.1 Fuente canónica y acceso

- Nombres canónicos definidos en `src/backend/mmSecrets.js`.
- Lectura centralizada en `src/backend/secretAccess.js` mediante `@wix/secrets` y `auth.elevate(secrets.getSecretValue)`.
- Los secretos se crean/configuran en **Wix Dashboard → Developer Tools / Herramientas para desarrolladores → Secrets Manager** (el nombre/ruta puede variar por versión).
- El código obtiene el valor por nombre; un secreto ausente o no disponible devuelve cadena vacía. Los consumidores deben fallar de forma segura.
- No añadir valores a `internalConfig.js`, archivos `.env`, CMS, frontend, logs, issues, PRs o documentación.

### 4.2 Inventario

| Nombre exacto en Secrets Manager | Obligatorio para | Consumidor / finalidad | Formato correcto o ejemplo seguro | Estado documental |
|---|---|---|---|---|
| `SECRET_FISCALKEY` | Firma HMAC de registros fiscales/laborales | `SECRETS.FISCAL_KEY`; `cajas.web.js`, `securityEngine.js`, `horario.web.js`. El código fiscal valida longitud mínima de 32 caracteres. | Generar una clave aleatoria criptográficamente segura de al menos 32 bytes. Ejemplo ilustrativo no utilizable: `<64_HEX_CHARS_GENERADOS_ALEATORIAMENTE>`. No usar una cadena literal de ejemplo. | Nombre y consumidor verificados; valor real pendiente de validar sin revelarlo. |
| `FISCAL_NIF_EMISOR` | Identificación fiscal del emisor | `cajas.web.js`, `events.js`, `fiscalAggregator`; se incorpora a datos fiscales/AEAT. | NIF/CIF real del titular/emisor, exactamente conforme a documentación fiscal y validación aplicable. Ejemplo de formato, no identidad válida: `<NIF_EMISOR_REAL>`. | Nombre/consumidor verificados; valor real pendiente de confirmación contra DatosFiscales y documentación del titular. |
| `FISCAL_SIGNER_ENDPOINT` | Firma externa X.509 delegada | `cajas.web.js`; URL del servicio de firma que recibe la petición de firma. | URL HTTPS del endpoint productivo contratado y controlado. Ejemplo no enrutable: `https://<dominio-del-signer-controlado>/sign`. Nunca usar `signer.mock.local` en producción. | Consumidor verificado; endpoint productivo/servicio y contrato de firma pendientes de acreditar. |
| `FISCAL_SIGNER_BEARER` | Autenticación del servicio de firma externa | `cajas.web.js`; bearer token enviado al signer. | Token de acceso vigente emitido por el servicio signer. Ejemplo ficticio: `<BEARER_TOKEN_EMITIDO_POR_EL_SIGNER>`. | Consumidor verificado; credencial real pendiente. |
| `RESEND_API_KEY` | Envío de documentos a gestoría mediante Resend | `fiscalDocuments.web.js`; el nombre está definido como literal en el consumidor, no incluido actualmente en `SECRETS` de `mmSecrets.js`. | API key emitida por la cuenta Resend con permisos mínimos para enviar. Ejemplo ficticio de forma: `re_<TOKEN_FICTICIO_NO_VALIDO>`. El remitente procede de `SDK_CONFIG.EMAIL.FROM_ADDRESS` y el dominio debe estar verificado en Resend. | Consumidor/nombre verificados; centralización del nombre en `mmSecrets.js` no realizada. Envío a gestoría está fail-closed (`ACCOUNTANT_SEND_ENABLED: false`). |

### 4.3 No crear todavía / no acreditados como secretos activos

| Integración o necesidad | Hallazgo | Decisión |
|---|---|---|
| `OPENAI_API_KEY` | Figura en necesidades funcionales históricas, pero la auditoría de requisitos indica que la IA no está operativa y el backend falla cerrado sin proveedor configurado. No se encontró consumidor activo en el código revisado. | No crear hasta aprobar e implementar el proveedor IA, cuestionario, prompt, privacidad, límites y pruebas. |
| MONEI | Aparece como integración/proveedor en documentación de negocio, pero la búsqueda del repositorio no acredita un nombre de secreto ni consumidor activo. | No inventar `MONEI_API_KEY` ni credenciales. Identificar producto/API, contrato, flujo y módulo antes. |
| IONOS | DNS/correo de dominio; no se ha identificado consumidor runtime Velo. | Gestionar credenciales en IONOS y MFA; no copiarlas a Wix Secrets Manager salvo integración backend demostrada. |
| Microsoft 365 / SharePoint / Power Automate | La arquitectura de Capa 3 contempla conexiones y flujos, pero no se ha acreditado E2E operativo ni un consumidor de secreto Wix. | Preferir conexiones OAuth/identidad administrada del conector. No inventar secretos ni almacenar contraseñas de Microsoft en CMS. |
| Certificado cualificado AEAT / PKCS#12 | El audit fiscal no acredita certificado, almacén ni proveedor de firma TLS de remisión AEAT. | Requisito pendiente de diseño/validación fiscal y legal. No añadir una clave genérica sin arquitectura y contrato del proveedor. |

### 4.4 Procedimiento de alta/rotación

1. Confirmar consumidor activo y entorno destino (producción o QA aislado).
2. Generar/obtener la credencial en el proveedor oficial. No reutilizar tokens de pruebas ni credenciales personales.
3. Crear el secreto con el **nombre exacto** de la tabla en Wix Secrets Manager.
4. Dar acceso solo a los módulos/identidades necesarios; nunca exponerlo mediante WebMethod.
5. Validar presencia/ausencia con una prueba backend que no imprima el valor. Verificar formato y respuesta del proveedor en entorno aislado.
6. Rotar mediante alta de nueva credencial, cambio controlado y revocación de la anterior después de confirmar el consumidor.
7. Registrar fecha, responsable, proveedor, finalidad, entorno y fecha de rotación; nunca registrar el valor.
8. Si falta una credencial crítica, mantener el proceso bloqueado (fail-closed); no sustituirla por un valor de prueba.

## 5. Configuración que no debe confundirse con secretos

Los siguientes valores son configuración no secreta o conexiones gestionadas, y no deben añadirse a Secrets Manager sin motivo:

- Zona horaria `Europe/Madrid`, moneda `EUR`, IDs de app y ubicación: `internalConfig.js` y configuración de sitio.
- Remitente Resend: `SDK_CONFIG.EMAIL.FROM_NAME` y `FROM_ADDRESS`; el dominio remitente debe estar verificado por Resend.
- Roles ADMIN/GESTION/ESTILISTA: `MapaStaff.rolWebsite` y autorización backend, no listas de emails en secretos.
- SharePoint site/library IDs y configuración de flujos: configuración de conexión/entorno, no contraseñas en CMS.
- URL pública del sitio y datos de contacto: configuración de sitio, no credenciales.

## 6. Matriz de trazabilidad Dashboard → App → backend → CMS

| Área de Dashboard / App | Sistema autoritativo | Backend / módulo | CMS o estado relacionado |
|---|---|---|---|
| Bookings servicios, staff, políticas y calendario | Wix Bookings | `bookingSaga.js`, `bookingCore.js`, `staff.js`, `events.js` | `CitasF2`, `ServiciosCatalogo`, `ComplementosCatalogo`, `ControlOperativo` |
| Stores catálogo, inventario y pedidos | Wix Stores Catalog V3 / Wix eCommerce | handlers eCommerce, `events.js`, reconciliación | entidades Wix nativas; `ControlOperativo`; ledgers solo tras hecho económico confirmado |
| Facturas y cierres | Wix Invoices V1 + backend fiscal según proceso | `cajas.web.js`, `eventLog.js`, `fiscalAggregator.js`, `fiscalDocuments.web.js` | `MovimientosCaja`, `DatosFiscales`, `HistoricoCierresZ`, `PaquetesGestoria`, ledgers |
| Identidad y roles | Wix Members + CMS de roles propio | `security.js`, `staff.js`, `securityEngine.js` | `MapaStaff`; colección nativa Members sujeta a privacidad Wix |
| Formularios y comunicaciones | Wix Forms / proveedor de envío según flujo | WebMethods de backend cuando estén implementados | contactos y colecciones solo según contrato; automatizaciones deben inventariarse |
| SEO y Blog | Wix Promote SEO / Wix Blog | Principalmente configuración/contenido Wix | No crear proyecciones CMS sin requisito |
| Automatizaciones | Wix Automations / app propietaria | webhooks, `events.js`, `crons.js`, `jobs.config` | `ControlOperativo` para deduplicación/estado de procesos |

## 7. Checklist de auditoría antes de cualquier cambio

- [ ] Leer contexto live y confirmar versión de cada app.
- [ ] Capturar valores actuales del Dashboard y exportar/registrar configuración relevante.
- [ ] Identificar el propietario de cada dato (Wix App, CMS propio o integración externa).
- [ ] Revisar consumidores, WebMethods, hooks, webhooks, crons y automatizaciones.
- [ ] Confirmar permisos CMS efectivos y clasificación de colecciones.
- [ ] Revisar sinks externos y asegurar aislamiento antes de QA runtime.
- [ ] Definir aceptación, pruebas y rollback.
- [ ] Aplicar cambio mínimo autorizado.
- [ ] Leer de nuevo la configuración y contrastar el resultado.
- [ ] No desplegar/publicar sin autorización y CI vigente.

## 8. Fuentes y referencias

### Evidencia del proyecto
- `src/backend/mmSecrets.js`
- `src/backend/secretAccess.js`
- `src/backend/internalConfig.js`
- `src/backend/cajas.web.js`
- `src/backend/securityEngine.js`
- `src/backend/horario.web.js`
- `src/backend/fiscalDocuments.web.js`
- `docs/qa/2026-11-09-verifactu-readiness-audit.md`
- `docs/DECISION-LOG.md`
- Dossier técnico consolidado y dossier de flujos End-to-End Capa 1 → Capa 3.

### Documentación oficial Wix
- [Wix Secrets — API reference](https://dev.wix.com/docs/api-reference/wix-secrets)
- [Get installed apps](https://dev.wix.com/docs/api-reference/business-management/app-installation/app-installation/get-installed-apps)
- [Wix Bookings — Booking Policies](https://dev.wix.com/docs/api-reference/business-solutions/bookings/policies/booking-policies)
- [Wix Bookings — Services V2](https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2)
- [Wix Stores Catalog V3](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3)
- [Wix Invoices V1](https://dev.wix.com/docs/api-reference/business-solutions/invoices)
- [Wix CMS Data Permissions](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-permissions)
- [Wix Members collections](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/wix-app-collections/wix-members-collections)
- [Wix Automations activation status](https://dev.wix.com/docs/api-reference/business-management/automations/skills/automations-activation-status)

---

**Estado:** referencia documental inicial creada en rama. No se han modificado ajustes del Dashboard, Wix Apps, Secrets Manager ni datos CMS. Las configuraciones actuales no consultadas expresamente se mantienen como pendientes de auditoría.
