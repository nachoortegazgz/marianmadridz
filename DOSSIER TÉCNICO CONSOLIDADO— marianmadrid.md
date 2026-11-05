# DOSSIER TÉCNICO CONSULTIVO PARA DESARROLLO ASISTIDO POR IA — marianmadrid.es

> **Naturaleza y autoridad.** Documento de referencia consultiva y contexto técnico permanente. No es SSOT, no sustituye instrucciones vigentes del proyecto, decisiones ADR aprobadas, código, configuración real de Wix/CMS ni documentación oficial de los proveedores. No contiene un estado de ejecución ni un registro de tareas pendientes. Sus datos describen el diseño, las identidades técnicas y los contratos conceptuales del proyecto; deben contrastarse con sus fuentes primarias antes de realizar cambios.
>
> **Criterio editorial.** Se excluyen deliberadamente checkpoints fechados, resultados de CI/QA, estados de publicación, incidencias puntuales, recuentos de registros, tareas abiertas, resultados de auditorías temporales y cualquier afirmación que solo sea válida para un corte concreto. No se incluyen valores secretos, tokens, contraseñas ni códigos de recuperación.

# 1. Rol, misión y expertises del modelo IA

## 1.1 Rol principal

El modelo actúa como **arquitecto e ingeniero integral del proyecto Marian Madrid**, con capacidad para analizar, diseñar, implementar, probar, auditar y documentar soluciones para el sitio Wix y sus Wix Apps nativas e integraciones.

Su misión es mejorar la fiabilidad, seguridad, mantenibilidad y utilidad comercial del sistema, manteniendo coherencia entre reglas de negocio, arquitectura, código, CMS, APIs oficiales y operación real del negocio.

El modelo debe trabajar como un profesional técnico responsable: razonar antes de modificar, verificar contratos, minimizar cambios, aportar evidencia y distinguir hechos de hipótesis.

## 1.2 Expertises que debe integrar

| Expertise | Responsabilidad |
|---|---|
| Arquitectura de software y datos | Diseñar límites entre frontend, backend, CMS, servicios Wix e integraciones externas; mantener contratos e invariantes. |
| Wix Velo v3/v2 y Wix JavaScript SDK v2 . Aplicaremos version mas actual recomendada| Desarrollar backend y frontend sobre Wix; seleccionar APIs y SDK adecuados con documentación oficial vigente. |
| Wix Bookings | Diseñar disponibilidad, creación, modificación y cancelación de reservas simples y duales. |
| CMS y persistencia | Modelar colecciones, keyfields, índices, permisos, validaciones, consistencia e integridad. |
| Seguridad | Aplicar mínimo privilegio, autenticación, autorización, gestión de secretos, validación de entradas, rate limiting y protección de PII. |
| Integraciones y automatización | Conectar Wix con pagos, correo, IA y servicios externos mediante contratos explícitos y trazabilidad. |
| Calidad y QA | Diseñar pruebas unitarias, de integración, regresión, concurrencia y flujos de error; no confundir simulación con validación real. |
| Fiscalidad, contabilidad y laboral | Traducir requisitos a modelos y controles técnicos sin declarar cumplimiento legal sin validación profesional. |
| Documentación y gobernanza | Mantener decisiones, contratos, glosario y documentación coherentes; identificar cambios que requieren ADR. |
| Revisión adversarial | Buscar errores de diseño, fallos de seguridad, condiciones de carrera, duplicidades, efectos secundarios y supuestos ocultos. |

## 1.3 Forma de trabajo

1. Comprender la petición y el resultado esperado antes de editar.
2. Inspeccionar el código, configuración y documentación afectados.
3. Identificar las fuentes primarias aplicables y comprobar las versiones vigentes.
4. Separar hechos comprobados, datos declarados, inferencias y decisiones pendientes.
5. Proponer la solución mínima que preserve los contratos existentes.
6. Implementar en una rama de trabajo, con pruebas y revisión de diferencias.
7. Verificar el resultado mediante evidencias reproducibles.
8. Informar qué se ha cambiado, qué se ha probado y qué no se ha podido verificar.

## 1.4 Criterios de comportamiento

- No inventar nombres de métodos, campos, permisos, IDs, versiones, endpoints, enums, secretos ni resultados.
- No deducir que una integración está activa por aparecer en este dossier.
- No presentar código compilado o tests offline como prueba de funcionamiento en Wix.
- No publicar, cancelar reservas, emitir reembolsos, modificar datos reales ni alterar ledgers sin autorización expresa y específica.
- No exponer información personal ni valores secretos en código cliente, logs, commits, documentación o respuestas.
- Si falta información crítica, formular una pregunta concreta o indicar el comando/consulta necesaria para obtenerla.
- Preferir cambios pequeños, reversibles y cubiertos por pruebas.
- Documentar las decisiones estructurales mediante ADR cuando corresponda.

# 2. Resumen ejecutivo técnico

## 2.1 Identidad del proyecto

| Elemento | Identificador de referencia |
|---|---|
| Proyecto | Marian Madrid Peluquería y Estética |
| Sitio web | https://www.marianmadrid.es |
| Repositorio | https://github.com/nachoortegazgz/marianmadridz |
| Repositorio corto | `nachoortegazgz/marianmadridz` |
| Plataforma | Wix Editor / Wix Studio con Velo |
| Wix Site ID | `188bed94-177c-4bc9-a9f0-35080d874f3e` |
| Wix Location ID | `7a12abfd-bf30-4847-bcdf-00dc573d4802` |
| Staff Resource Type ID | `1cd44cf8-756f-41c3-bd90-3e2ffcaf1155` |
| Zona horaria de negocio | `Europe/Madrid` |
| Moneda | `EUR` |
| Idioma | `es-ES` |
| Localización del negocio | Zaragoza, España |

Los identificadores son referencias estáticas conocidas del proyecto, no credenciales. Antes de operar contra Wix, confirmar que el entorno y el sitio seleccionados son los correctos.

## 2.2 Integraciones y función arquitectónica

| Sistema | Función dentro del proyecto | Frontera de responsabilidad |
|---|---|---|
| Wix Editor / Velo | Plataforma web y runtime del sitio | Presentación, lógica de aplicación y ejecución backend |
| Wix Bookings | Agenda, servicios, slots, recursos y reservas | Fuente nativa para disponibilidad y reservas |
| Wix CMS | Persistencia de datos propios del negocio | Datos operativos y registros de aplicación |
| Wix Members | Identidad de miembros y personal autenticado | Identidad y contexto de usuario |
| Wix Stores | Catálogo de productos y stock comercial | Catálogo/stock nativo; no confundir con servicios de Bookings |
| Wix eCommerce | Carrito, checkout, pedidos y eventos de pago | Operaciones de comercio electrónico |
| Wix Invoices | Facturación nativa Wix | Subsistema independiente del ledger propio |
| Wix Secrets Manager | Almacenamiento de secretos backend | Los valores secretos no deben llegar al frontend |
| GitHub | Repositorio, ramas, revisiones y trazabilidad | Fuente del código versionado |
| GitHub Actions | Automatización de calidad y tareas CI | Evidencia reproducible asociada a commits |
| Wix CLI for Sites | Desarrollo y sincronización del sitio Wix existente | Herramienta de trabajo sobre el sitio conectado |
| Wix MCP | Consulta de documentación y, según herramienta, operaciones Wix | Usar con permisos mínimos y política de mutación controlada |
| Resend | Correo transaccional externo | Envío desde backend mediante credencial protegida |
| OpenAI API | Funciones de IA integradas | Llamadas backend con límites y control de tiempo |
| Microsoft Clarity | Analítica de comportamiento web | Analítica; no fuente de verdad transaccional |
| RustDesk | Soporte remoto | Acceso técnico sujeto a autorización |
| IONOS | Dominio/DNS y correo corporativo | Gestión de infraestructura de dominio/correo |

La presencia en esta tabla identifica el papel previsto o documentado de cada sistema; no acredita suscripción, credenciales, permisos ni activación actual.

## 2.3 Inventario seguro de secretos y credenciales

**Nunca incluir valores de secretos en este dossier.** El agente debe consultar la configuración real solo cuando la tarea lo requiera y sin imprimir valores.

| Nombre lógico / credencial | Ubicación de referencia | Uso |
|---|---|---|
| `CLI_API_KEY` | GitHub Actions Secrets | Autenticación de automatizaciones CLI cuando el workflow la requiera |
| Secretos de OpenAI y Resend | Wix Secrets Manager; nombres centralizados en `src/backend/mmSecrets.js` | Integraciones backend |
| Credenciales RustDesk | Gestor de secretos documentado para el proyecto | Soporte remoto |
| Credenciales de pagos y webhooks | Gestor del proveedor correspondiente y/o Wix Secrets Manager, según implementación | Verificación de eventos y operaciones de pago |
| OAuth/API key de Wix MCP | Flujo de autenticación del cliente MCP | Acceso al servidor MCP |
| Credenciales de Wix CLI | Sesión autenticada CLI o credencial de CI | Operaciones sobre el sitio Wix |

Reglas:
- Los valores se gestionan en el proveedor correspondiente, nunca en el repositorio.
- `CLI_API_KEY`, credenciales MCP y credenciales de Wix CLI son mecanismos distintos; no intercambiarlos.
- El catálogo real de nombres backend debe leerse en `src/backend/mmSecrets.js` y su acceso centralizado en `src/backend/secretAccess.js`.
- No crear nombres de secretos por intuición. Confirmar el identificador consumido por el código.
- Nunca guardar contraseñas, tokens, claves privadas, códigos MFA o códigos de recuperación en este documento.

## 2.4 Componentes del producto

1. **Reservas online:** servicios simples y servicios duales de dos fases con un intervalo (*gap*) entre F1 y F2.
2. **Operación comercial:** catálogo, productos, checkout, pedidos y pagos.
3. **Operación interna:** caja, movimientos, cierres, inventario y registros horarios.
4. **Trazabilidad y fiscalidad:** registros estructurados, integridad, exportaciones y controles relacionados con obligaciones legales.
5. **Integraciones:** correo transaccional, IA y herramientas de operación.

## 2.5 Principios de autoridad de datos

- Wix Bookings es la referencia nativa para servicios, disponibilidad, recursos y reservas.
- Wix CMS almacena los modelos propios de la aplicación; su esquema real debe consultarse antes de modificarlo.
- GitHub contiene el código versionado; una rama o PR no equivale a código desplegado en Wix.
- Los ledgers de negocio definidos como append-only no se corrigen mediante edición o borrado ordinario: se aplica el mecanismo rectificativo definido por el dominio.
- SharePoint/Microsoft 365, si se adopta, es repositorio de evidencia/exportación, no autoridad transaccional ni fuente alternativa de verdad.

# 3. Mapa de contenidos

| Bloque | Contenido |
|---|---|
| 1 | Rol, expertises, comportamiento y criterios de calidad del modelo IA |
| 2 | Resumen ejecutivo: identidad, integraciones, secretos y componentes |
| 4 | Arquitectura lógica y estructura del repositorio |
| 5 | Modelo de reservas Wix Bookings: simple y dual |
| 6 | CMS: colecciones, identificadores, integridad y convenciones |
| 7 | Seguridad, identidad, permisos y gestión de secretos |
| 8 | Integraciones Wix y externas |
| 9 | Backend, frontend, Velo y estándares de implementación |
| 10 | Jobs, eventos y procesos asíncronos |
| 11 | Calidad, pruebas, CI y ciclo de desarrollo |
| 12 | Operación fiscal, contable, laboral y privacidad: límites técnicos |
| 13 | Herramientas de desarrollo, CLI, MCP y documentación |
| 14 | Arquitecturas complementarias propuestas, no asumidas como implantadas |
| 15 | Glosario e identificadores |
| 16 | Fuentes oficiales de consulta |

# 4. Arquitectura lógica y estructura del proyecto

## 4.1 Capas

| Capa | Responsabilidad | Regla de diseño |
|---|---|---|
| Frontend Wix | Interfaz, navegación, interacción y validación de usabilidad | No custodiar secretos ni autoridad de negocio |
| Widgets HTML | Componentes embebidos que necesitan interfaz propia | Comunicación explícita y validada con el sitio |
| Web modules | API de aplicación expuesta al frontend | Contratos DTO, permisos mínimos y validación server-side |
| Backend de dominio | Reservas, caja, fiscalidad, inventario, personal y orquestación | Reglas de negocio centralizadas |
| Adaptadores Wix | Acceso a Bookings, CMS, Members, Stores, eCommerce y otras Apps | Encapsular contratos externos |
| Persistencia CMS | Datos propios de aplicación | Validación, integridad, índices y permisos |
| Integraciones externas | Correo, IA, pagos u otros proveedores | Acceso backend, timeouts, límites y trazabilidad |
| Automatización | Jobs, webhooks y CI | Idempotencia, reintentos y observabilidad |

## 4.2 Estructura de directorios de referencia

La estructura concreta del repositorio prevalece sobre este mapa. Consultar el árbol real antes de crear o mover archivos.

| Ruta / patrón | Responsabilidad |
|---|---|
| `src/backend/` | Lógica backend y módulos de dominio |
| `src/backend/*.web.js` | Web modules expuestos al frontend |
| `src/backend/booking/` | Núcleo de reservas y saga dual |
| `src/backend/tests/` | Pruebas backend |
| `src/public/` o `public/` | Código público frontend compartido, según estructura Wix del repo |
| `public/widgetBridge.js` | Puente de comunicación de widgets HTML |
| `src/backend/data.js` | Hooks de integridad CMS |
| `src/backend/jobs.config` | Declaración de jobs programados |
| `src/backend/crons.js` | Implementación de tareas programadas |
| `src/backend/mmSecrets.js` | Catálogo lógico de secretos |
| `src/backend/secretAccess.js` | Acceso centralizado a secretos |
| `.github/workflows/` | Automatizaciones CI y tareas de repositorio |
| `docs/adr/` | Registros de decisiones de arquitectura |
| `docs/` | Documentación técnica y auditorías |

## 4.3 Dependencias entre capas

- El frontend consume contratos publicados por web modules; no importa lógica privada del backend.
- Los módulos de dominio coordinan operaciones y no duplican directamente reglas de proveedores.
- Los adaptadores Wix encapsulan llamadas a SDK/API.
- El acceso a CMS debe pasar por las abstracciones y validaciones del proyecto cuando existan.
- Las integraciones externas se invocan desde backend y nunca reciben secretos del cliente.
- Los webhooks y jobs deben ser idempotentes y tolerar reintentos.

# 5. Modelo de reservas — Wix Bookings

## 5.1 Principios del dominio

Wix Bookings es la referencia nativa para servicios, disponibilidad, recursos y reservas. La aplicación añade orquestación y persistencia propia para cubrir los requisitos del negocio.

Conceptos:
- **Servicio:** servicio nativo de Wix Bookings, identificado por `serviceId`.
- **Recurso:** profesional/recurso de Bookings, identificado por `resourceId`.
- **Slot:** intervalo reservado o consultado, con inicio y fin.
- **Reserva:** booking nativo identificado por `bookingId`.
- **Reserva simple:** una única reserva nativa.
- **Reserva dual:** dos reservas nativas independientes F1 y F2, enlazadas por `pairToken`.
- **Gap:** intervalo libre entre el final de F1 y el inicio de F2; no constituye una reserva ni un multiservicio.

## 5.2 Reserva simple

Flujo conceptual:
1. El frontend solicita servicios y disponibilidad mediante los web methods públicos previstos.
2. El backend consulta los slots nativos de Bookings.
3. En la operación de creación, el servidor vuelve a validar la disponibilidad y los datos del slot.
4. El backend crea la reserva nativa mediante la API de Bookings autorizada.
5. Se persiste la relación y trazabilidad propia en CMS.
6. Se responde al frontend con un DTO mínimo, sin exponer datos internos innecesarios.

La disponibilidad mostrada al usuario no garantiza que el slot siga libre al confirmar. La comprobación definitiva debe realizarse en servidor.

## 5.3 Reserva dual F1 + F2 con gap

**Restricción de diseño:** no usar `createMultiServiceBooking` ni modelar la operación como un multiservice booking.

La reserva dual se compone de dos bookings independientes:
- F1: primera fase del servicio.
- F2: segunda fase del servicio.
- Gap: intervalo de exposición entre ambas fases, durante el cual el profesional puede quedar liberado si las reglas del servicio lo permiten.
- `pairToken`: identificador de correlación común para el par F1/F2.

Secuencia conceptual:
1. Resolver servicio, recurso, fecha, duración y slots de F1 y F2.
2. Calcular y validar el gap de acuerdo con la configuración del servicio.
3. Adquirir protección de concurrencia para los intervalos que se van a reservar.
4. Revalidar en servidor la disponibilidad nativa de ambas fases.
5. Crear F1.
6. Crear F2.
7. Persistir los vínculos y completar la operación.
8. Si F2 falla después de crear F1, ejecutar compensación para cancelar/liberar F1 de forma controlada.
9. Registrar resultado, errores y trazabilidad sin duplicar operaciones ante reintentos.

La implementación debe preservar la semántica de saga: la operación completa puede requerir compensación y no debe tratarse como una transacción ACID distribuida.

## 5.4 Identidad de cliente y profesional

- El identificador de miembro autenticado (`memberId`) no equivale al identificador de recurso de Bookings (`resourceId`).
- El identificador de contacto (`contactId`) tampoco debe confundirse con `memberId`.
- En reservas de visitantes no autenticados no debe suponerse que existe una identidad de miembro.
- La asociación entre reserva nativa y registro propio debe realizarse mediante el identificador de reserva (`bookingId`) y los datos de correlación definidos.
- Los datos personales se minimizan y solo se persisten cuando existe finalidad funcional.

## 5.5 Integridad y resiliencia de reservas

- Idempotencia para evitar duplicados por doble clic, reintento o replay.
- Protección de concurrencia en slots.
- Revalidación de disponibilidad en servidor.
- Compensación de fases parcialmente creadas.
- Webhooks autenticados/validados y procesados de forma idempotente.
- Correlación end-to-end mediante `traceId`.
- No cancelar reservas reales como parte de pruebas sin autorización específica.
- No inferir el éxito por una respuesta parcial del frontend.

# 6. CMS — modelo de datos e integridad

## 6.1 Colecciones de dominio conocidas

| Colección | Dominio |
|---|---|
| `CitasF2` | Persistencia propia asociada a reservas |
| `ServiciosCatalogo` | Catálogo interno de servicios |
| `ComplementosCatalogo` | Catálogo de complementos |
| `CajaActual` | Estado/contadores de caja |
| `MovimientosCaja` | Ledger de movimientos de caja |
| `DatosFiscales` | Configuración y datos fiscales |
| `HistoricoCierresZ` | Historial de cierres Z |
| `LibroAsientosContablesDetalle` | Detalle de asientos contables |
| `InventarioStockVenta` | Estado de inventario comercial |
| `MovimientosInventario` | Movimientos de inventario |
| `ControlOperativo` | Controles técnicos y operativos |
| `RegistrosHorariosStaff` | Registro horario del personal |
| `MapaStaff` | Relación de identidad, roles y recursos del personal |
| `QAE2ESimulaciones` | Datos auxiliares para simulaciones QA |
| `RegistroIntegracion` | Trazabilidad de integraciones |

Esta relación es un mapa conceptual de colecciones documentadas. No es una garantía de que todas existan con el mismo nombre o contrato en cualquier entorno. Consultar CMS vivo antes de cualquier operación.

## 6.2 Identificadores canónicos

| Identificador | Significado | No confundir con |
|---|---|---|
| `_id` | ID del elemento dentro de una colección CMS | IDs de entidades externas |
| `bookingId` | ID de una reserva Wix Bookings | `_id`, `serviceId`, `resourceId` |
| `serviceId` | ID del servicio Wix Bookings | `catalogId`, `_id` |
| `resourceId` | ID del recurso/profesional de Wix Bookings | `memberId`, `staffMemberId` |
| `memberId` | ID de miembro Wix | `resourceId`, `contactId` |
| `contactId` | ID de contacto CRM asociado | `memberId`, `bookingId` |
| `catalogId` | ID de un registro del catálogo propio | `serviceId` |
| `pairToken` | Correlación entre fases de una reserva dual | `bookingId` |
| `traceId` | Correlación de una operación a través de módulos | IDs de entidad |
| `dedupeKey` | Clave de deduplicación/idempotencia | `traceId` |
| `transactionId` | Identificador de una transacción de negocio/técnica | `bookingId` |
| `eventId` | Identificador de evento recibido/procesado | `bookingId` |

No renombrar ni reutilizar identificadores con semánticas diferentes. Antes de crear un campo, buscar si Wix ya proporciona un identificador nativo equivalente.

## 6.3 Convenciones de keyfields

- Nombres técnicos en `camelCase`, sin espacios.
- Etiquetas visibles en español, claras y diferenciadas.
- Respetar nombres nativos Wix cuando se almacenen IDs externos.
- Campos de sistema Wix: `_id`, `_createdDate`, `_updatedDate`, `_owner`.
- `DATE` para fechas sin hora; `DATETIME` para instantes; `NUMBER` para cantidades; `BOOLEAN` para booleanos; `OBJECT` para estructuras; `ARRAY_STRING` para listas.
- Validar enums en backend: un campo CMS de tipo TEXT no garantiza por sí mismo valores restringidos.
- Rechazar alias no canónicos en escrituras.
- Mantener separados `amount`, `totalAmount`, `taxBase`, `taxAmount` y `accountingAmount` hasta documentar fórmulas, impuestos, redondeo y signo.
- En ledgers, distinguir la huella del registro y el enlace con el registro anterior según el contrato de cada colección.

## 6.4 ControlOperativo

Colección auxiliar para coordinación técnica y operativa. Entre los tipos de control documentados se encuentran:
- `SLOT_LOCK`: protección temporal de slots.
- `DUAL_CACHE`: datos temporales asociados al flujo dual.
- `IDEMPOTENCY`: deduplicación de operaciones.
- `WEBHOOK_EVENT`: registro de eventos webhook.
- `RATE_LIMIT`: control de frecuencia.
- `DISPLAY_TOKEN`: tokens temporales de visualización.
- `SYSTEM_FLAG` y registros de alerta/operación, según el contrato implementado.

Campos conceptuales relevantes: `controlType`, `dedupeKey`, `traceId`, `status`, `eventId`, `expiresAt`, `bookingId`, `pairToken`, `resourceId`, `serviceId`, `slotStart`, `slotEnd`, `dateYmd`, `transactionId`, `orderId`, `refundId`, `kind`, `attempts`, `maxAttempts`, `nextRetryAt`, `lastError`, `totalAmount`, `operationDescription`, `severity`, `alertType`, `message`, `surface`, `requesterKey`, `requestCount`, `windowStart`, `retryAfter`, `payload`, `version` y `processedAt`.

La lista anterior es un vocabulario de referencia, no un contrato de escritura completo. Antes de implementar consultas o mutaciones, consultar el esquema CMS vigente, sus tipos, obligatoriedad, índices y permisos.

## 6.5 Integridad CMS

Los hooks de `backend/data.js` y las funciones de acceso deben proteger, según el dominio:
- campos obligatorios y tipos;
- enums canónicos;
- unicidad de identificadores y tokens;
- invariantes entre colecciones;
- restricciones de borrado;
- inmutabilidad de ledgers;
- integridad de referencias;
- consistencia de importes y estados.

No utilizar una operación de reemplazo completo cuando se necesita una actualización parcial. Verificar siempre el contrato exacto del SDK utilizado.

# 7. Seguridad, identidad y permisos

## 7.1 Principios

- Mínimo privilegio en frontend, web methods, backend, CMS, GitHub y proveedores.
- Validación de todos los datos recibidos del cliente y de proveedores externos.
- Secretos exclusivamente en gestores seguros y accesibles desde backend.
- PII minimizada, enmascarada en logs y protegida por finalidad.
- Operaciones críticas autenticadas, autorizadas y auditables.
- Rate limiting y protección contra abuso en endpoints públicos.
- Webhooks verificados antes de procesar sus datos.
- Errores públicos genéricos; detalle técnico solo en logs protegidos.

## 7.2 Roles de aplicación

El modelo de roles del proyecto utiliza `MapaStaff.rolWebsite` para autorización propia. Los roles documentados incluyen:
- `ADMIN`
- `GESTION`
- `ESTILISTA`

Los roles de aplicación no sustituyen los permisos nativos Wix ni los permisos de CMS. Cada endpoint debe comprobar el contexto de identidad y rol requerido en servidor.

## 7.3 Web modules y HTTP functions

- Configurar cada web method con el permiso más restrictivo compatible con su uso.
- Los métodos públicos deben validar payload, aplicar rate limit y limitar datos devueltos.
- Las HTTP functions de Velo se ejecutan en contexto de visitante anónimo; no asumir que una llamada interna las eleva automáticamente.
- La elevación de permisos debe ser explícita y conforme a la documentación oficial de Wix.
- Nunca confiar en un rol, ID o permiso enviado por el navegador como prueba de autorización.

## 7.4 Criptografía y trazabilidad

- Usar algoritmos criptográficos estándar y APIs soportadas por el runtime.
- No inventar esquemas de firma ni reutilizar claves entre propósitos.
- HMAC y hash deben tener contratos documentados, versionado y pruebas.
- La cadena de integridad debe definir canonicalización, encoding, orden, campos incluidos y política de rectificación.
- `traceId` correlaciona; no autentica ni autoriza.
- Los tokens de idempotencia no sustituyen la autorización.

# 8. Integraciones Wix y externas

## 8.1 Wix Bookings

Uso:
- Consulta de servicios y disponibilidad.
- Creación, consulta, modificación y cancelación de reservas.
- Resolución de recursos y localización.
- Procesamiento de webhooks de reservas.

Reglas:
- Usar la API/SDK oficial de Bookings y validar la forma de los objetos según SDK o REST.
- No intercambiar `_id` de SDK con `id` REST sin respetar el contrato de cada interfaz.
- Revalidar slots en servidor al crear.
- Mantener separadas reservas simples y saga dual.
- Consultar documentación oficial actual antes de introducir métodos o campos.

## 8.2 Wix CMS / Data

Uso:
- Persistencia de registros de aplicación.
- Consultas y mutaciones de colecciones.
- Hooks de integridad y restricciones de acceso.

Reglas:
- Preferir el SDK documentado que ya utilice el proyecto y migrar solo mediante cambio revisado.
- Distinguir operaciones de inserción, reemplazo y parche.
- Comprender consistencia eventual y opciones de lectura consistente.
- No asumir que agregaciones o métodos están disponibles en todas las clases de colección.
- Comprobar permisos e índices en CMS real.

## 8.3 Wix Secrets

Uso:
- Recuperar secretos desde backend.
- Centralizar el acceso y evitar exposición de credenciales.

Reglas:
- No leer secretos desde frontend.
- No registrar el valor devuelto.
- No incluirlo en errores, respuestas, trazas ni fixtures.
- Aplicar elevación de permisos solo cuando el contrato oficial lo exija.

## 8.4 Wix Members y CRM

Uso:
- Identidad de miembros.
- Relación con contactos CRM.
- Resolución del usuario autenticado y datos mínimos de contacto.

Reglas:
- No asumir que un visitante anónimo tiene `memberId`.
- No equiparar member, contact y resource.
- No confiar en IDs enviados por el cliente para representar al usuario actual.

## 8.5 Wix Stores y eCommerce

- Wix Stores gestiona catálogo/stock comercial.
- Wix eCommerce gestiona carrito, checkout, pedidos y pagos.
- Wix Bookings gestiona servicios y reservas.
- Mantener separados los dominios y sus identificadores.
- No activar migraciones de catálogo o checkout sin analizar compatibilidad, impacto y decisión arquitectónica.
- Los eventos de pago deben validarse y procesarse idempotentemente.

## 8.6 Wix Invoices

Las facturas nativas Wix y el ledger fiscal propio son subsistemas distintos. No asumir que la existencia de una factura nativa satisface por sí sola los requisitos de registro fiscal o contable del proyecto.

## 8.7 Integraciones externas

| Integración | Patrón de integración esperado |
|---|---|
| Resend | Llamada backend; secreto protegido; control de errores y límites |
| OpenAI API | Llamada backend; secreto protegido; timeout y límites de coste/uso |
| Clarity | Script/analítica web conforme a consentimiento y privacidad aplicables |
| RustDesk | Acceso de soporte controlado; credenciales fuera del código |
| IONOS | Administración de dominio, DNS y correo; no forma parte de la lógica transaccional Wix |

# 9. Backend, frontend y estándares de implementación

## 9.1 Backend

- Mantener la lógica de negocio en módulos de dominio.
- Mantener adaptadores externos separados de reglas de negocio.
- Validar entradas en la frontera del sistema y volver a validar invariantes antes de persistir.
- Devolver DTOs explícitos; no exponer directamente documentos CMS o respuestas completas de proveedores si no es necesario.
- Gestionar errores con códigos estables y mensajes públicos seguros.
- Usar logs estructurados con `traceId`, sin PII ni secretos.
- Evitar dependencias circulares y acceso directo a CMS disperso por la aplicación.

## 9.2 Frontend

- El navegador es un entorno no confiable.
- El frontend no contiene secretos ni lógica de autorización definitiva.
- La validación de interfaz mejora la experiencia, pero el backend valida de nuevo.
- Los widgets HTML se comunican mediante un puente explícito y mensajes tipados.
- Verificar origen, estructura y tipo de los mensajes entre iframe y sitio.
- Mantener el estado visual separado de la autoridad transaccional.

## 9.3 Estándar G10 y nomenclatura

El dossier de origen documenta un estándar interno denominado **G10 ASCII Strict** y convenciones N1–N5. Antes de añadir o modificar reglas concretas, consultar la definición aprobada en la SSOT/guías del repositorio. No inventar cabeceras, etiquetas ni reglas de lint a partir del nombre.

## 9.4 Errores y resultados

Los errores deben:
- tener código estable;
- distinguir validación, autorización, conflicto, dependencia externa y fallo interno;
- no revelar secretos, PII ni stack traces al usuario;
- incluir contexto de correlación en logs;
- permitir reintento solo cuando la operación sea segura e idempotente.

# 10. Jobs, webhooks y procesos asíncronos

## 10.1 Jobs programados

Los jobs de Velo se declaran en `backend/jobs.config` y se implementan en el backend correspondiente. Las tareas habituales de este proyecto incluyen:
- limpieza de bloqueos y cachés temporales;
- recuperación de compensaciones pendientes;
- mantenimiento de cachés de disponibilidad;
- verificaciones de integridad y cierres;
- comprobaciones de salud;
- retención de logs técnicos.

No copiar horarios de ejecuciones o estados de jobs desde documentos históricos. Consultar `jobs.config` y el código de cada función para conocer el contrato vigente.

## 10.2 Reglas de jobs

- Una ejecución repetida no debe duplicar efectos.
- Usar límites de lote y paginación para colecciones grandes.
- Borrar solo registros cuyo tipo y condición de expiración se hayan vuelto a comprobar.
- No eliminar eventos históricos ni ledgers por una regla genérica de limpieza.
- Registrar resultado, errores y métricas sin PII.
- Definir límites de reintento y backoff.
- Hacer que cada job pueda recuperarse de una interrupción parcial.

## 10.3 Webhooks

- Verificar autenticidad según el mecanismo oficial del proveedor.
- Validar identificador del evento y del objeto de negocio.
- Persistir o deduplicar el evento antes de ejecutar efectos no idempotentes.
- Procesar replay de forma segura.
- Marcar como procesado solo después de completar la operación y su persistencia.
- Mantener separados el ID del evento y el ID de la entidad afectada.

# 11. Calidad, pruebas y ciclo de desarrollo

## 11.1 Tipos de pruebas

| Tipo | Objetivo |
|---|---|
| Unitarias | Reglas de dominio y funciones puras |
| Integración con mocks | Contratos entre módulos y adaptadores |
| Regresión | Preservar comportamientos ya aceptados |
| Concurrencia | Evitar doble reserva, doble cobro o doble procesamiento |
| Idempotencia | Repetición/replay sin duplicar efectos |
| Compensación | Recuperar operaciones parciales |
| Contrato | Alinear DTOs y respuestas con Wix/proveedores |
| QA en Wix Preview | Validar runtime e integración en entorno Wix |
| Producción controlada | Validación final solo con autorización y plan de reversión |

## 11.2 Reserva dual: casos mínimos

- F1 y F2 disponibles.
- F1 disponible y F2 no disponible.
- Conflicto de concurrencia en F1 o F2.
- Reintento de la misma petición.
- Doble envío desde el frontend.
- Error de proveedor tras crear F1.
- Compensación y reintento de compensación.
- Webhook duplicado o fuera de orden.
- Cliente autenticado y visitante anónimo.
- Recurso explícito y asignación automática.

Las pruebas automatizadas deben usar fixtures sintéticos. No crear reservas reales para validar una regresión sin autorización expresa.

## 11.3 CI y Git

- Trabajar en ramas de feature/fix/docs; no modificar `main` directamente.
- Abrir PR con propósito, alcance, riesgos, pruebas y evidencia.
- Revisar el diff completo y los archivos afectados.
- Asociar resultados CI a commit y run concretos.
- No afirmar que algo está desplegado porque el PR se haya fusionado.
- No editar lockfiles generados manualmente si Wix CLI es su autoridad.
- Evitar repositorios Git anidados o clones desincronizados; verificar el repositorio raíz antes de operar.

## 11.4 Wix Preview y publicación

- Preview es una validación previa y distinta de publicación.
- Publicar requiere autorización específica.
- Antes de publicar, confirmar rama, commit, CI, dependencias, configuración y entorno destino.
- No utilizar un estado visual de Wix como única prueba de qué commit está desplegado.
- Tras publicar, verificar el comportamiento real y los efectos secundarios permitidos.
- Si Preview o publicación fallan, conservar request IDs y logs; no repetir operaciones destructivas a ciegas.

# 12. Fiscalidad, contabilidad, laboral y privacidad

## 12.1 Dominios funcionales

El proyecto contempla necesidades técnicas relacionadas con:
- facturación y registros fiscales;
- Veri*Factu y trazabilidad de registros;
- caja, movimientos y cierres Z;
- proyección contable y exportación para gestoría;
- inventario y movimientos;
- registro horario del personal;
- privacidad, consentimientos y protección de datos.

## 12.2 Separación entre diseño técnico y cumplimiento legal

El modelo puede:
- mapear requisitos a campos, flujos y controles;
- identificar documentación oficial;
- preparar matrices de cumplimiento;
- detectar huecos técnicos;
- generar preguntas para asesoría fiscal/laboral.

El modelo no debe:
- declarar certificación o conformidad AEAT sin evidencia y validación aplicable;
- inventar plazos de conservación;
- interpretar una norma dudosa como asesoramiento definitivo;
- cambiar numeración, series, tipos impositivos o asientos sin decisión y validación profesional;
- borrar o editar registros legalmente inmutables.

## 12.3 Ledgers y rectificaciones

Las colecciones que actúan como ledger deben preservar trazabilidad e inmutabilidad conforme al contrato aprobado. La corrección se realiza mediante registro rectificativo o procedimiento de dominio, no mediante borrado silencioso.

Mantener separados:
- importe bruto/total;
- base imponible;
- cuota tributaria;
- importe contable;
- método y estado de pago;
- identificador de movimiento;
- identificador de factura;
- huella del registro y enlace de integridad.

# 13. Herramientas de desarrollo, CLI y MCP

## 13.1 Wix CLI for Sites frente a Wix CLI unificado

No confundir herramientas:
- **Wix CLI for Sites** se utiliza para trabajar con un sitio Wix existente conectado mediante Git Integration.
- **Wix CLI unificado** se orienta a crear y desplegar aplicaciones Wix y proyectos headless.

Para este proyecto de sitio existente, la herramienta de referencia es Wix CLI for Sites. Confirmar los comandos soportados en la documentación oficial vigente antes de ejecutarlos.

## 13.2 Comandos de referencia CLI for Sites

| Comando | Uso conceptual |
|---|---|
| `wix login` | Autenticación interactiva |
| `wix whoami` | Consultar identidad de sesión |
| `wix logout` | Cerrar sesión |
| `wix dev` | Desarrollo local sincronizado con Local Editor |
| `wix install <pkg>` | Instalar paquete en el proyecto |
| `wix update <pkg>` | Actualizar paquete |
| `wix uninstall <pkg>` | Desinstalar paquete |
| `wix preview` | Crear versión de Preview |
| `wix publish` | Publicar; requiere autorización expresa |
| `wix -h` | Consultar ayuda |

No asumir que flags o comandos del CLI unificado funcionan en CLI for Sites.

## 13.3 Git Integration y UI Versions

Los cambios realizados desde el editor Wix pueden generar nuevas versiones de UI. La sincronización con el entorno de desarrollo debe preservar la coherencia entre código, páginas, configuración y repositorio. Antes de editar archivos generados o sincronizar cambios, revisar la documentación vigente de Git Integration y la configuración del proyecto.

## 13.4 Wix MCP

Endpoint remoto documentado:
`https://mcp.wix.com/mcp`

Capacidades MCP descritas en la documentación del ecosistema Wix:
- búsqueda de documentación de Wix Design System, REST y SDK;
- lectura de artículos y esquemas completos de métodos;
- consulta de flujos de negocio;
- listado de sitios;
- llamadas a APIs del sitio y gestión de operaciones a nivel de sitio, según las herramientas y permisos disponibles.

La lista real de herramientas puede cambiar. Descubrir las herramientas disponibles en la sesión antes de invocarlas. Distinguir:
- OAuth interactivo;
- API key para entornos no interactivos;
- credenciales de Wix CLI;
- secreto de GitHub Actions.

La conexión MCP no concede autorización implícita para mutar datos de negocio.

## 13.5 Diagnóstico y agentes IA

El plugin `@wix/wix-code-diagnostics-plugin` se documenta como mecanismo para transportar diagnósticos de build/preview/dev y errores de runtime al entorno de desarrollo. Su configuración y variables deben comprobarse en el repo y documentación oficial antes de depender de él.

Los agentes de código pueden trabajar mediante:
- repositorio Git y herramientas de desarrollo;
- Wix MCP para documentación y operaciones autorizadas;
- CLI for Sites para ciclo de desarrollo del sitio;
- CI para validación reproducible.

No permitir que un agente publique, modifique ledgers o realice operaciones reales irreversibles sin una autorización explícita y un alcance definido.

# 14. Arquitecturas complementarias — propuestas no asumidas

## 14.1 Microsoft 365 / SharePoint como repositorio de evidencia

El material de diseño del proyecto contempla una posible arquitectura Wix → Power Automate → SharePoint para exportar evidencia documental.

Principios propuestos:
- Wix conserva la autoridad de los datos transaccionales.
- SharePoint conserva copias documentales/exportaciones.
- El flujo sería unidireccional: lectura desde Wix y escritura en SharePoint.
- Una corrección se realiza en Wix y genera una nueva exportación.
- OneDrive/Excel no se convierten en fuente de verdad.
- Purview podría gestionar retención, clasificación y auditoría.

**No interpretar esta sección como integración desplegada ni como decisión aprobada.** Requiere análisis de licencias, seguridad, RGPD, retención, permisos y ADR específico antes de implementarse.

## 14.2 Migraciones de APIs y Apps

Las migraciones entre versiones de Wix (por ejemplo, Stores Catalog o eCommerce Cart) deben tratarse como cambios arquitectónicos:
1. identificar el contrato actual en el código y lockfiles;
2. revisar documentación oficial y fechas de soporte;
3. mapear cambios de tipos, campos y métodos;
4. analizar impacto sobre CMS, frontend, webhooks y datos;
5. definir compatibilidad y rollback;
6. aprobar ADR cuando corresponda;
7. implementar con pruebas y migración controlada.

No deducir una migración obligatoria a partir de un plazo antiguo recogido en documentación histórica.

# 15. Glosario

| Término | Definición |
|---|---|
| SSOT | Fuente única de verdad definida por la gobernanza del proyecto |
| ADR | Architecture Decision Record; decisión arquitectónica registrada |
| Velo | Entorno de desarrollo de Wix para lógica frontend/backend |
| SDK v2 | Familia de SDK JavaScript de Wix con contratos y módulos versionados |
| Bookings | App Wix para servicios, disponibilidad, recursos y reservas |
| Slot | Intervalo de disponibilidad/reserva |
| F1 / F2 | Primera y segunda fase de una reserva dual |
| Gap | Intervalo entre F1 y F2 |
| Saga | Orquestación de pasos con compensaciones ante fallos parciales |
| Compensación | Acción que revierte o neutraliza un efecto previo de una saga |
| Idempotencia | Propiedad por la que repetir una operación no duplica su efecto |
| Webhook | Evento HTTP enviado por un proveedor a una URL del sistema |
| Ledger | Registro cronológico de movimientos que preserva trazabilidad |
| Cierre Z | Cierre diario de caja |
| PII | Información personal identificable |
| RBAC | Control de acceso basado en roles |
| CMS | Sistema de gestión de contenido/datos de Wix |
| Preview | Entorno/version de prueba de Wix previo a publicar |
| CLI | Interfaz de línea de comandos |
| MCP | Model Context Protocol |

# 16. Fuentes oficiales de consulta

Las referencias de este bloque son puntos de partida. El agente debe abrir la documentación oficial aplicable y confirmar el contrato vigente antes de implementar.

## 16.1 Wix Developers

| Área | Recurso |
|---|---|
| Wix Developers | https://dev.wix.com/docs |
| Wix JavaScript SDK | https://dev.wix.com/docs/sdk |
| Wix Developers — documentación de APIs | https://dev.wix.com/docs/api-reference.md |
| Wix Data / CMS | https://dev.wix.com/docs/api-reference.md |
| Wix Secrets | https://dev.wix.com/docs/api-reference.md |
| Wix Members | https://dev.wix.com/docs/api-reference.md |
| Wix eCommerce | https://dev.wix.com/docs/api-reference.md |
| Wix CLI for Sites | https://dev.wix.com/docs/wix-cli.md y https://dev.wix.com/docs/velo.md |
| Wix MCP | https://dev.wix.com/docs/overview/ai-the-wix-platform/the-wix-mcp |
| Wix Site MCP | https://dev.wix.com/docs/llms.txt (índice oficial; localizar la sección Site MCP) |

## 16.2 Repositorios y herramientas

| Recurso | URL |
|---|---|
| Repositorio del proyecto | https://github.com/nachoortegazgz/marianmadridz |
| Wix MCP | https://github.com/wix/wix-mcp |
| Wix Skills | https://github.com/wix/skills |
| Plugin de diagnósticos | https://www.npmjs.com/package/@wix/wix-code-diagnostics-plugin |

## 16.3 Regla de verificación documental

- Priorizar documentación oficial de Wix Developers y documentación oficial del proveedor.
- Confirmar que la página corresponde al producto, API y versión usados.
- No usar ejemplos antiguos como contrato vigente.
- Si SDK y REST difieren, documentar explícitamente cuál se está usando y respetar su shape.
- Registrar la URL, fecha de consulta y versión relevante en el PR/ADR cuando el contrato afecte a una implementación.

---

## Nota de mantenimiento

Este dossier debe evolucionar lentamente y contener solo contexto reutilizable: identidad técnica, arquitectura, reglas de dominio, convenciones, integraciones, límites de seguridad y fuentes de consulta.

No incorporar:
- estado actual de ramas, PR, CI, despliegues o Preview;
- tareas pendientes, prioridades de sprint o planes de próxima sesión;
- resultados puntuales de auditorías o pruebas;
- datos de reservas, clientes, pagos o registros reales;
- recuentos, revisiones CMS o métricas que cambian con el tiempo;
- valores de secretos o credenciales;
- afirmaciones de cumplimiento o activación que no sean estructurales.

La información temporal debe mantenerse en artefactos separados: issues, PR, ADR, informes de auditoría, evidencias CI y checkpoints operativos.
