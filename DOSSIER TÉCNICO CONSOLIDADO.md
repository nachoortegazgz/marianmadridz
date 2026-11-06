# Dossier técnico consolidado — Marian Madrid

**Fecha de actualización:** 6 de noviembre de 2026  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Web:** [www.marianmadrid.es](https://www.marianmadrid.es)  
**Entorno:** Wix Editor clásico + Velo

> Este documento resume la arquitectura vigente y la evidencia técnica disponible. No sustituye al código, a los esquemas vivos de Wix, a la documentación oficial ni a la evidencia de pruebas. Los elementos pendientes no deben tratarse como implementados.

## 1. Resumen ejecutivo

El proyecto debe operar sobre **Wix y sus Wix Apps nativas**, con **Microsoft 365** como capa documental. El código Velo se limita a las excepciones funcionales imprescindibles que Wix no cubra. Se evita añadir proveedores, middleware, integraciones o costes recurrentes.

Objetivos funcionales: reservas simples y duales, ventas online, operaciones presenciales, caja/cobros, preparación documental para gestoría, cumplimiento aplicable y análisis de negocio. El inventario es secundario y debe apoyarse en Wix Stores cuando cubra la necesidad.

## 2. Identificadores y entornos

| Elemento | Valor |
|---|---|
| Repositorio | `nachoortegazgz/marianmadridz` |
| Zona horaria | `Europe/Madrid` |
| Moneda / locale | EUR / `es-ES` |
| QA site ID | `4c2889a4-0e2f-4012-b376-bd1910240c7f` |
| Producción site ID | `188bed94-177c-4bc9-a9f0-35080d874f3e` |
| Location ID | `7a12abfd-bf30-4847-bcdf-00dc573d4802` |

No intercambiar identificadores de QA y producción. No ejecutar cambios de producción sin autorización expresa.

## 3. Arquitectura objetivo

### Capa operativa: Wix

Wix es la fuente de verdad para los dominios cubiertos por sus aplicaciones: Bookings, Stores/eCommerce, Payments, CRM, POS/Owner y Automations, sujetos a plan, país, configuración y disponibilidad efectiva.

- Servicios, staff, horarios, slots y reservas: Wix Bookings.
- Catálogo, carrito, pedidos y stock de venta: Wix Stores/eCommerce.
- Pagos: Wix Payments y los medios disponibles en la configuración contratada.
- Clientes y comunicaciones: CRM y automatizaciones Wix disponibles.
- Operaciones presenciales: Wix POS/Owner, si el hardware, plan y país lo permiten.

No mantener proyecciones CMS paralelas si la app nativa ya conserva la información necesaria. Los datos de Wix App se modifican mediante sus APIs/SDK oficiales, no mediante escritura directa en colecciones internas.

### Lógica propia: Velo

Velo queda reservado a:
- Adaptadores delgados a APIs Wix.
- Reglas específicas que Wix no cubra.
- Orquestación de reservas duales F1-gap-F2, mientras no exista alternativa nativa equivalente.
- Idempotencia, revalidación, compensación y controles de seguridad imprescindibles.

Cada módulo propio debe justificar necesidad, ausencia de alternativa nativa, fuente de verdad, consumidores y coste de mantenimiento.

### Capa documental: Microsoft 365

Flujo propuesto unidireccional: Wix backend → Power Automate → SharePoint. SharePoint conserva documentos y evidencias; no es fuente transaccional, no duplica la operativa Wix y no escribe de vuelta a Wix. No se usa correo intermedio.

La disponibilidad de Power Automate HTTP, conectores y autenticación Entra ID está pendiente de comprobación en el tenant y licencias reales. No se presupone que estén incluidos ni que no tengan coste.

## 4. Reservas: modelo simple y dual

### Servicio simple

Wix Bookings gestiona el servicio y la reserva. Velo puede validar el contexto de entrada y adaptar la experiencia, pero no debe recrear el motor de disponibilidad.

### Servicio dual

El requisito es una secuencia de dos fases del mismo servicio y profesional:

`F1 → gap de exposición → F2`

No es una reserva multiservicio. F2 es una fase interna y no debe exponerse como servicio reservable independiente al cliente.

La orquestación existente `bookingSaga.js` realiza revalidación de disponibilidad/staff, controla `pairToken` para idempotencia, bloquea ambos tramos, crea F1 y F2 secuencialmente, verifica respuestas y aplica compensación ante fallo. `CitasF2` conserva la relación y datos propios de F2. Debe mantenerse solo mientras Bookings no proporcione el comportamiento completo de forma nativa.

### Evidencia QA disponible

- Catálogo `ServiciosCatalogo`: 95 registros; 94 con `serviceId` de Wix Bookings, encontrados en la comprobación registrada. Un registro comercial no tiene serviceId: `Rayos V — Plan 5 sesiones`.
- 24 servicios duales con `linkedPhases` válido según auditoría registrada.
- Servicios vinculados: tipo `APPOINTMENT`, booking online habilitado y staff asignado en la comprobación.
- Fases F2 internas ocultas y no reservables por el cliente.
- Comprobación de disponibilidad QA del 6 al 13 de noviembre de 2026: 661 combinaciones Babylights F1/F2 con gap exacto de 40 minutos y mismo profesional. Ejemplo observado: F1 09:00–09:50, gap 40 min, F2 10:30–11:30.
- No se crearon reservas reales ni se ejecutó checkout E2E.

Esta evidencia es una comprobación de disponibilidad en QA, no certificación de reserva completa ni de producción.

## 5. CMS y contratos relevantes

El CMS propio no debe convertirse en un ERP paralelo. Se conserva únicamente donde aporta configuración diferencial, relaciones o datos que Wix no cubre.

Contratos confirmados en la auditoría QA del 6 de noviembre de 2026:

| Colección | Contrato canónico / observación |
|---|---|
| `MovimientosCaja` | `payloadFiscal`; no `payloadAEAT` |
| `HistoricoCierresZ` | `closeDate`; no `closingDate` |
| `LibroAsientosContablesDetalle` | `debitAmount`, `creditAmount` |
| `ControlOperativo` | `attempts`, `expiresAt`; aliases antiguos eliminados del esquema QA |
| `DatosFiscales` | `tipoUsoPosibleMultiOT`, `indicadorMultiplesOT` boolean |
| `MapaStaff` | `staffMemberId`, `resourceId`, `memberId` son identificadores distintos |
| `ServiciosCatalogo` | `staffMembers` y `name` multi-reference; `linkedPhases` texto |
| `CitasF2` | Relación de fase interna; conserva booking, servicio, staff/recurso, pairToken, estado y metadatos operativos necesarios |

No inferir el estado de producción a partir del esquema QA. No realizar más podas CMS sin auditoría y autorización.

### Limpieza QA documentada

En QA se eliminaron campos duplicados o no consumidos de varias colecciones, con respuesta HTTP 200 y lectura posterior. Entre ellos: aliases de `ControlOperativo`, `payloadAEAT`, referencias Wix duplicadas de inventario, campos de trazabilidad redundantes y campos obsoletos de `CitasF2`. La eliminación de un campo CMS borra sus valores de todos los ítems. Por ello, no repetir limpiezas sin análisis de consumidores e histórico.

## 6. Módulos propios: criterio de continuidad

| Área | Decisión vigente |
|---|---|
| `bookingSaga.js` | Conservar la orquestación dual mientras sea necesaria; auditar compensaciones y reprogramación |
| `bookingCore.js` | Reducir a adaptador de Wix Bookings |
| `reservas.web.js` | Reducir; disponibilidad y agenda proceden de Bookings |
| `CitasF2` | Mantener solo relación y datos exclusivos de fase interna |
| `ServiciosCatalogo` | Reducir a configuración diferencial; no duplicar catálogo nativo |
| `ComplementosCatalogo` | Evaluar Wix Bookings add-ons antes de mantener catálogo propio |
| `staff.js` / `MapaStaff` | Adaptador de identidades; evitar duplicar staff y recursos |
| `inventario.web.js` y colecciones propias | Evaluar sustitución por Wix Stores; mantener solo excepciones probadas |
| `cajas.web.js` / `eventLog.js` | No ampliar motores paralelos; auditar dependencias antes de consolidar o retirar |
| `LibroAsientosContablesDetalle` | Proyección propia; no asumir que debe mantenerse ni sustituirse por un proveedor externo |
| `fiscalAggregator.web.js` / `fiscalDocuments.web.js` | Evaluar contra capacidades Wix y necesidades documentales M365 |
| `ControlOperativo` | Mantener locks, idempotencia y controles técnicos que no cubra Wix |
| `horario.web.js` | Mantener temporalmente hasta evaluar una solución válida; no asumir que Bookings equivale al registro horario legal |
| `dataAccess.js` / `security.js` | Conservar como infraestructura mínima, revisando consumidores |

Esta tabla es una guía de evaluación, no autorización para borrar o migrar módulos. Las dependencias confirmadas en el análisis estático incluyen UI de administración, controlador frontend, `events.js` y `crons.js`; revisar consumidores actuales antes de cada cambio.

## 7. Capa documental M365: estado

- Diseño elegido: Wix backend → Power Automate HTTP trigger → SharePoint.
- Sin correo intermedio.
- Sitio SharePoint propuesto: `MarianMadrid_Gestion` (no consta creado).
- Biblioteca propuesta: `Registro_Documental_MarianMadridPeluqueria` (no consta creada).
- No reutilizar IDs legacy de sitios/listas anteriores sin auditoría.
- El endpoint `M365_POWER_AUTOMATE_ENDPOINT` debe apuntar al nuevo flujo cuando se cree; no consta actualmente en `mmSecrets.js`.
- `M365_GRAPH_SITE_ID` apunta a un sitio legacy y requiere revisión antes de uso.
- `POWER_AUTOMATE_TOKEN` está mapeado como `POWER_AUTOMATE` para autenticación entrante PA→Wix; no retirar hasta verificar consumidores.
- Revisar consumidores de `M365_GRAPH_CLIENT_ID`, `M365_GRAPH_CLIENT_SECRET`, `M365_GRAPH_TENANT_ID`, `M365_GRAPH_LIST_ID` y `SECRET_M365_WEBHOOK_HMAC_KEY`.
- Los controles de seguridad de Wix Secrets Manager bloquearon operaciones previas; no intentar sortearlos.
- No declarar flujo creado, conectado o E2E hasta su configuración y prueba autorizada.

## 8. Seguridad y datos personales

- Autorización en backend y permisos mínimos; nunca confiar en validaciones solo frontend.
- Idempotencia y revalidación en operaciones sensibles.
- Minimizar datos personales exportados y registrados en logs.
- Secretos en almacenes autorizados; no hardcodear ni imprimir valores.
- No exponer datos de tarjeta ni información innecesaria.
- No usar colecciones internas de Wix App como CMS de escritura.
- No desactivar controles de seguridad para resolver errores operativos.

## 9. Cumplimiento normativo

La arquitectura técnica no constituye por sí sola certificación legal. Revisar, según actividad y régimen aplicable, facturación y sistemas informáticos de facturación, IVA, conservación documental, contabilidad, registro horario, protección de datos, comercio electrónico y pagos.

No afirmar que Wix/M365 cubren íntegramente una obligación sin verificar la función concreta, su alcance, evidencias, configuración y normativa vigente en España. Confirmar con gestoría/asesoría las decisiones fiscales, contables y laborales. Evitar desarrollar un motor fiscal propio antes de verificar las funciones nativas y la necesidad jurídica real.

## 10. Pruebas, CI y estado de certificación

Evidencia registrada para PR #150:
- CI del HEAD de PR: run `42149561960` success; run `42149432291` success.
- 366/366 pruebas offline, 39 suites.
- Capa 1: 207/207; Capa 2: 116/116; ESLint correcto.
- La PR #150 contiene documentación, sin cambios runtime.
- No se confirmó un run asociado al merge commit; no atribuirle CI verde a ese SHA sin evidencia.

Los simulacros fiscales FACSIMIL son offline: serie `FACSIMIL-FAC-AAAA-NNNNN`, hash SHA-256 con prefijo `FACSIMIL-`, firma placeholder no X.509, `verificationQR:null`, `verifactuEligible:false`, `aeatSubmissionAllowed:false`. No escriben CMS ni presentan datos a AEAT.

**No certificado:** navegador E2E real, checkout, reserva real, pagos, webhooks con transacciones reales, impresión/cajón, publicación sincronizada con GitHub ni flujo M365 operativo.

No se han ejecutado en las comprobaciones descritas reservas, pagos, devoluciones, movimientos económicos, emails reales ni despliegues Wix.

## 11. Siguiente secuencia técnica

1. Mantener Wix Apps nativas como fuente de verdad y cerrar inventario de funciones/planes disponibles.
2. Completar pruebas autorizadas de reservas simples y duales en QA runtime, sin operaciones económicas reales.
3. Revisar la saga dual: compensación ante fallos, reprogramación integral e idempotencia en condiciones concurrentes.
4. Evaluar cada módulo duplicado con consumidores y alternativa Wix antes de proponer retirada.
5. Verificar licencias y capacidades M365; después crear SharePoint/Power Automate y probar el flujo documental en entorno controlado.
6. Validar por separado requisitos fiscales, laborales y de privacidad con fuentes oficiales y asesoría competente.
7. Ejecutar E2E solo con autorización expresa y documentar evidencia reproducible.

## 12. Referencias de autoridad

- Código y contratos actuales del repositorio.
- Esquemas y configuración vivos del entorno Wix correspondiente.
- Documentación oficial [Wix Developers](https://dev.wix.com/docs).
- Documentación oficial [Microsoft Learn](https://learn.microsoft.com/).
- Normativa publicada en BOE y criterios oficiales AEAT/AEPD/Seguridad Social, según materia.

Ante discrepancias, no elegir silenciosamente: registrar la diferencia, comprobar la fuente vigente y actualizar este dossier con evidencia.
