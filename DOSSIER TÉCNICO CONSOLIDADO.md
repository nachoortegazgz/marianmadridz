# DOSSIER TÉCNICO CONSOLIDADO
## Marian Madrid Peluquería y Estética

> **Estado documental:** Documentación de referencia técnica de apoyo.
>
> **Solo la DOCUMENTACION OFICIAL DE WIX y WIX APPS INTEGRADAS y los OBJETIVOS y DIRECTRICES y NORMATIVA VIGENTE son SSOT en este proyecto.** Todo lo que obstaculice alcanzar los objetivos finales marcados puede ser editable presentando una justificación profesional avalada por documentación oficial, excepto SSOT.
> 
> **Este dossier consolidado NO ES SSOT, ES REFERENCIA CONSULTIVA EDITABLE SI SE DETECTAN ERRORES O INCOHERENCIAS  en su contenido que afecten al desarrollo del proyecto.** En particular:
> - No se deben publicar, copiar ni solicitar claves API en documentación. Los secretos se gestionan exclusivamente mediante Wix Secrets Manager/entorno seguro; nunca incluir valores en Git.
> - Los registros TPV históricos sintéticos deben conservarse intactos. No se borran ni sobrescriben; cualquier corrección debe ser trazable y append-only.
> - No generar nuevas ventas/pagos/devoluciones sintéticas ni habilitar operaciones reales para probar.
> - Wix CMS es SSOT únicamente para entidades personalizadas; las aplicaciones Wix gobiernan sus respectivos dominios nativos.
> - Los hechos históricos y registros append-only de CMS, TPV, auditoría, informes y exportaciones no se editan ni eliminan; las rectificaciones son nuevos registros enlazados.
> - Estado confirmado comunicado por el propietario tras la última acción: sitio **NO PUBLICADO**. No se presenta como lectura live independiente.
> - Estado del release TPV: **NO-GO PARA PRODUCCIÓN**. La publicación permanece bloqueada salvo autorización expresa y superación de gates.
> - `saleReady`, `paymentVerified` y `persisted` describen exclusivamente una ejecución TPV concreta, correlacionada por `traceId`/`correlationId`; no describen el sitio o proyecto completos.
> - La preparación TPV read-only descrita en PR #611 y sus flags pertenecen a esa ejecución concreta.
>
> **Fuentes operativas prioritarias actuales:** [PROJECT-CANON](docs/PROJECT-CANON.md), [STATE-NOW](docs/STATE-NOW.md), [RELEASE-READINESS](docs/RELEASE-READINESS.md) y [TPV backend README](src/backend/tpv/README.md). Si existe contradicción, prevalecen estas fuentes y el código probado del commit indicado.

---

**Documento de referencia para contexto de desarrollo, auditoría y migración.** Las secciones históricas que siguen describen decisiones y contratos en su momento; no constituyen por sí solas evidencia de que una capacidad siga activa ni autorización para ejecutar operaciones.
---

**Documento de referencia para DESARROLLO, AUDITORÍA, DEBUG y MIGRACIÓN asistidos por IA**

- **Repositorio canónico:** `https://github.com/nachoortegazgz/marianmadridz.git`
- **Sitio Wix:** Marian Madrid Peluquería y Estética
- **Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`
- **Editor:** Wix Editor clásico
- **Velo:** habilitado
- **Idioma:** español
- **Región:** España
- **Moneda:** EUR
- **Zona horaria:** `Europe/Madrid`
- **Estado confirmado del sitio:** NO PUBLICADO (confirmación comunicada por el propietario tras la última acción; pendiente de nuevo read-back independiente de Wix).
- **Estado del release TPV:** NO-GO PARA PRODUCCIÓN.
- **Regla de release:** la publicación permanece bloqueada salvo autorización expresa y gates completos. Esta regla no sustituye al estado actual del sitio.

---

# 1. Propósito del documento

Este dossier define el contexto técnico, las reglas de arquitectura, las restricciones operativas, los objetivos del MVP y los criterios de calidad del sitio.

Debe utilizarse como referencia única para:

- Analizar el repositorio.
- Diseñar cambios.
- Depurar módulos.
- Validar integraciones.
- Crear planes de implementación.
- Preparar pruebas.
- Evaluar riesgos.
- Decidir si una funcionalidad está lista para Preview o producción.

---

# 2. Rol esperado de la IA desarrolladora

La IA debe actuar como:

- Arquitecto técnico.
- Auditor de código.
- Responsable de integración Wix/Velo.
- Responsable de calidad.
- Analista de riesgos.
- Planificador de despliegue controlado.

- Una IA que trabaje sobre el proyecto debe CUMPLIR OBLIGATORIAMENTE:

- CERO SUPONER. CERO INVENTAR. CERO FALSOS POSITIVOS NO VERIFICADOS. SIEMPRE OPINAR Y DECIDIR SIGUIENDO DIRECTRICES DE DOCUMENTACION OFICIAL DE WIX Y WIX APPS INTEGRADAS.
- SIEMPRE TRABAJO EN EQUIPO, PREGUNTANDO DUDAS AL USUARIO EN CASO DE PELIGRO REAL DE MALENTENDIDO, AUTONOMA, INTELIGENTE, ANALIZA PRIMERO, ESTUDIA RECURSOS A SU ALCANCE Y EJECUTA, OBJETIVIDAD, REALISTA, HONESTA, PROFESIONAL, DIDACTICA, EFICAZ, MINIMO CONSUMO DE TOKENS INNECESARIOS EN ACCIONES Y VERIFICACIONES EXCESIVAS, REDUNDANTES E INNECESARIAS.


Antes de modificar cualquier archivo debe:

1. Leer el repositorio actual.
2. Confirmar rama y commit.
3. Revisar imports, exports y dependencias.
4. Verificar los contratos reales.
5. Identificar las colecciones utilizadas.
6. Comprobar las APIs Wix empleadas.
7. Ejecutar tests seguros.
8. Presentar un plan.
9. Solicitar autorización para escribir cambios.

**Autonomía limitada por gates de seguridad y release.** La IA puede investigar, auditar, preparar propuestas y realizar cambios documentales o de código no sensibles dentro del alcance autorizado. Debe solicitar confirmación expresa antes de: publicar o desplegar en producción; ejecutar cargos, capturas o reembolsos reales; emitir o rectificar documentos fiscales; modificar roles, permisos o controles de acceso; activar automatizaciones con efectos externos; alterar o eliminar datos; ejecutar migraciones destructivas; o realizar cualquier operación irreversible. Una autorización general no elimina estos gates. Toda actuación autónoma debe quedar documentada con commit, alcance, evidencia, pruebas y reversión.
---

# 3. Objetivo general del proyecto

Construir un sistema Wix fiable, mantenible y funcional para un salón de peluquería y estética.

El sistema debe cubrir:

- WIX BOOKINGS V2 CUSTOMIZADO para gestión profesional de Reservas y Agenda de Peluquería.
- NO MULTISERVICE - gap de tiempo entre fases de los servicios duales
- Reservas Online simples
- Reservas Online duales. (FASE1 + Tiempo de exposición + FASE2). El profesional queda libre en agenda durante tiempo de exposicion y es el mismo en FASE 1 y FASE2.
- Venta online.
- TPV PERSONALIZADA en pagina principal con funciones conciliadas con procesos nativos de WIX para:
- Pagos, Devoluciones, Caja, Arqueos, Apertura y Cierre, etc.
- Productos.
- Variantes.
- Inventario.
- Facturación.
- Registro fiscal y normativo.
- Auditoría.
- Idempotencia.
- Reconciliación.
- Evidencia documental.

“MVP” significa la primera versión con alcance de negocio explícitamente aprobado, completa respecto de ese alcance y verificada mediante pruebas y evidencias proporcionales al riesgo. No significa implementar todas las funcionalidades imaginables ni reducir unilateralmente requisitos aprobados. Cualquier exclusión o aplazamiento requiere decisión trazable del propietario.

---

# 4. Aplicaciones Wix instaladas

### Inventario de apps y fecha de verificación

**Read-back de contexto Wix documentado el 2026-11-25:** Wix Bookings, Wix Stores Catalog V3, Wix Payments e Wix Invoices V1 aparecen instalados en el sitio. Fuente: lectura de contexto Wix registrada en README.md; no equivale a verificar que cada capacidad, permiso, método de pago o writer esté operativo.

**Declaradas en documentación anterior, sin read-back individual vigente en este corte:** Wix Forms & Payments, Wix Gift Cards, Wix Members Area, Wix Blog y Promote SEO. No deben tratarse como instaladas/activas hasta comprobarlas.

Cada inventario futuro debe registrar fecha/hora, fuente (GetSiteContext / App Management / Dashboard), app, versión/API, estado observado y alcance de la comprobación. La instalación no demuestra configuración, permisos, activación comercial ni disponibilidad de una función.

## Regla de compatibilidad

Antes de usar una API:

1. Confirmar que la aplicación está instalada.
2. Confirmar la versión instalada.
3. Consultar documentación oficial.
4. Verificar el método y su esquema.
5. Confirmar permisos y contexto.
6. Probar primero en lectura o Preview.

El código existente usa Velo como vía principal. REST y Wix JavaScript SDK solo se incorporan cuando el método, versión, autenticación, permisos y compatibilidad con el runtime/sitio estén verificados en documentación oficial y en el proyecto. No se presume equivalencia entre Velo, REST y SDK. No migrar a Catalog V1 ni aplicar contratos de Invoices V2 cuando el sitio/código requiera Catalog V3 e Invoices V1.

---

# 5. Fuentes oficiales y referencias

La IA debe priorizar:

- Código real del repositorio.
- Configuración Wix del proyecto.
- Tests del repositorio.
- Contexto actual del sitio.
- Documentación oficial de Wix.
- Esquemas oficiales de las APIs.
- Evidencias de Wix Preview.
- Decisiones aprobadas en este dossier.

Referencias principales:

- Wix API Reference: `https://dev.wix.com/docs/api-reference`
- Wix Velo API Reference: `https://dev.wix.com/docs/velo`
- Wix Developers: `https://dev.wix.com`
- Repositorio canónico: `https://github.com/nachoortegazgz/marianmadridz.git`

Para cualquier API concreta, la IA debe registrar:

- URL oficial consultada.
- Método utilizado.
- Versión.
- Permisos.
- Request esperado.
- Response esperado.
- Limitaciones.
- Resultado de la prueba.

No debe inventar endpoints, campos, estados ni permisos.

---

# 6. Arquitectura de autoridad de datos

El sistema tiene una autoridad distribuida.

## 6.1. Wix CMS

Wix CMS es fuente de verdad para entidades personalizadas del negocio, como:

- Sesiones TPV.
- Terminales.
- Operadores.
- Roles internos.
- Turnos.
- Movimientos internos.
- Arqueos.
- Cierres.
- Configuración fiscal propia.
- Numeración interna.
- Correlaciones.
- Idempotencia.
- Locks.
- Auditoría.
- Incidencias.
- Estados de reconciliación.
- Proyecciones.
- Registros normativos propios.

## 6.2. Aplicaciones nativas Wix

Las aplicaciones Wix gobiernan sus dominios nativos:

- Bookings: servicios, disponibilidad, reservas, profesionales y recursos.
- Stores Catalog V3: productos, variantes, información comercial y precios del catálogo.
- Stores Inventory Items V3: cantidades y disponibilidad de stock por variante y ubicación.
- eCommerce: pedidos y su ciclo de vida; las transacciones asociadas se consultan/registran mediante las APIs eCommerce correspondientes.
- Payments / eCommerce Order Billing: ejecución de cobros, capturas, anulaciones y reembolsos según proveedor y método soportado. Un registro de pago en Order Transactions no mueve dinero por sí solo.
- Invoices V1: documentos de factura dentro de las capacidades que la API exponga y que estén disponibles para este sitio; su uso no acredita por sí mismo cumplimiento fiscal español, Veri*Factu ni validez legal/fiscal.
- Members y Contacts: identidades y contactos cuando corresponda.

## 6.3. SharePoint

SharePoint solo conserva evidencia documental:

- Informes.
- Exportaciones.
- Justificantes.
- Actas.
- Evidencias de auditoría.
- Documentos derivados.

SharePoint no gobierna la Capa 1, no actualiza Wix CMS y no confirma operaciones transaccionales.

## 6.4. Correlación entre capas

Toda operación que combine entidades personalizadas y nativas debe conservar:

- ID personalizado.
- ID nativo.
- Tipo de entidad.
- Estado de cada capa.
- Clave de idempotencia.
- Correlación.
- Timestamp.
- Actor.
- Resultado.
- Estado de reconciliación.

Ninguna capa puede inventar el estado de una entidad cuya autoridad pertenece a otra.

---

# 7. Capas del sistema

## Capa de presentación

Incluye:

```text
src/pages/
src/public/
#htmlTPV.txt
```

Responsabilidades:

- Mostrar datos.
- Recoger entradas.
- Enviar solicitudes.
- Recibir respuestas.
- Mostrar errores.
- Gestionar handshake y bridge.

No puede:

- Confirmar pagos.
- Decidir permisos.
- Calcular importes definitivos.
- Resolver stock.
- Persistir directamente operaciones.
- Declarar éxito sin confirmación backend.

## Capa de Web Methods

Incluye módulos `.web.js`.

Responsabilidades:

- Autenticación.
- Autorización.
- Validación.
- Normalización.
- Coordinación de operaciones.
- Protección contra duplicados.
- Respuesta uniforme.

## Capa de dominio

Incluye:

```text
src/backend/tpv/
src/backend/booking*
src/backend/fiscal/
src/backend/accounting/
```

Responsabilidades:

- Reglas del negocio.
- Cálculo de importes.
- Estados.
- Locks.
- Idempotencia.
- Correlaciones.
- Auditoría.
- Reconciliación.

## Capa de integración Wix

Responsabilidades:

- Bookings.
- Stores V3.
- eCommerce.
- Payments.
- Invoices V1.
- Members.
- Contacts.
- Gift Cards.

## Capa documental

Incluye SharePoint u otros repositorios documentales.

Solo conserva evidencia y documentos derivados.

---

# 8. Módulos de referencia

## TPV

```text
src/backend/tpv/tpvAuditoria.web.js
src/backend/tpv/tpvCaja.web.js
src/backend/tpv/tpvCatalogo.web.js
src/backend/tpv/tpvCierres.web.js
src/backend/tpv/tpvCierresCore.js
src/backend/tpv/tpvContext.js
src/backend/tpv/tpvDevoluciones.web.js
src/backend/tpv/tpvGiftCards.web.js
src/backend/tpv/tpvMovementContracts.js
src/backend/tpv/tpvMovimientos.web.js
src/backend/tpv/tpvNativeDirectory.js
src/backend/tpv/tpvOperatorContext.js
src/backend/tpv/tpvPagos.web.js
src/backend/tpv/tpvPermisos.web.js
src/backend/tpv/tpvRepository.js
src/backend/tpv/tpvUtils.js
src/backend/tpv/tpvUtils.web.js
src/backend/tpv/tpvValidation.js
src/backend/tpv/tpvVentas.web.js
```

## Controlador

```text
src/public/tpvPageController.js
```

## Página

```text
src/pages/TPV.yl5th.js
```

## Componente HTML

```text
#htmlTPV
```

---

# 9. Contrato TPV

El controlador debe mantener compatibilidad con:

```text
MM_READY
MM_CONTEXT
CASHIER_STATE
SESSION_OPEN
CATALOG_SERVICES
CATALOG_PRODUCTS
CATALOG_VARIANTS
CATALOG_STAFF
CUSTOMERS_SEARCH
SALE_VALIDATE
SALE_REGISTER
CASH_MOVEMENT
PARTIAL_CASH_COUNT
REFUND
TICKET_X
TICKET_Z
SESSION_SUMMARY
AUDIT_LIST
CASH_MOVEMENTS_EXPORT
AUDIT_EXPORT
```

Web Methods principales:

```text
validarVentaBorrador
registrarVenta
registrarDevolucion
registrarMovimientoCaja
generarControlX
generarCierreZ
obtenerResumenCaja
```

Los nombres deben coincidir exactamente entre imports, exports, documentación y tests.

---

# 10. Contratos de respuesta

Todas las operaciones deben responder con:

```js
{
    status: "SUCCESS" | "PENDING" | "ERROR",
    data: {},
    error: null
}
```

Errores:

```js
{
    code,
    message,
    solution,
    recoverable,
    retryable,
    requiresReconciliation
}
```

## Estados

- `SUCCESS`: operación confirmada.
- `PENDING`: operación iniciada pero no confirmada.
- `ERROR`: operación no confirmada.
- `RECONCILIATION_REQUIRED`: existe una escritura parcial, respuesta ambigua o discrepancia.

Nunca se debe devolver `SUCCESS` si Wix no ha confirmado la parte nativa necesaria.

---

# 11. Ventas y pagos

## Ventas

El backend debe:

- Resolver producto, variante o servicio.
- Obtener precios vigentes.
- Calcular descuentos.
- Calcular impuestos.
- Calcular el total.
- Validar stock.
- Crear o vincular pedido.
- Confirmar el pago.
- Persistir correlaciones propias.
- Registrar auditoría.

El cliente no puede ser autoridad del precio, impuesto o total.

## Pagos

Un desglose de medios no demuestra un cobro.

Debe existir:

- Identificador de transacción.
- Proveedor.
- Estado confirmado.
- Relación con el pedido.
- Idempotencia.
- Reconciliación.

No utilizar proveedores simulados para operaciones reales.

---

# 12. Reservas

Bookings gobierna:

- Servicios.
- Disponibilidad.
- Reservas.
- Participantes.
- Profesionales.
- Recursos.
- Estados de reserva.

El CMS puede conservar:

- Correlaciones.
- Datos complementarios.
- Auditoría.
- Proyecciones.
- Incidencias.
- Estados de reconciliación.

El sistema debe soportar reserva simple, reprogramación, cancelación y pagos vinculados mediante Bookings. El caso F1 → intervalo de exposición → F2 no se considera una reserva multiservicio nativa por defecto: es una orquestación propia de backend que coordina reservas nativas independientes, correlación/pair token, locks, idempotencia, liberación del profesional durante el intervalo y reconciliación. Cada booking conserva Bookings como autoridad de su disponibilidad, estado y ciclo de vida. No presentar el flujo dual como capacidad nativa multiservicio salvo verificación documental específica.

---

# 13. Inventario y catálogo

Stores Catalog V3 gobierna productos, variantes, información comercial y precios del catálogo. La API Inventory Items V3 gobierna cantidades/disponibilidad por variante y ubicación. El campo agregado de inventario de un producto no sustituye la consulta del item de inventario por variante/ubicación.

El backend debe:

- Resolver IDs.
- Validar variante.
- Obtener precio vigente.
- Consultar stock.
- Bloquear stock insuficiente.
- Gestionar concurrencia.
- Actualizar inventario.
- Reponer inventario tras devolución cuando proceda.

`stockAfectado` no puede ser únicamente una marca almacenada sin operación real sobre inventario.

---

# 14. Devoluciones

Una devolución debe:

- Referenciar un pedido confirmado.
- Resolver los pagos originales.
- Consultar devoluciones previas.
- Validar el importe máximo.
- Ejecutar el reembolso aplicable.
- Actualizar stock cuando proceda.
- Generar documento fiscal relacionado.
- Mantener idempotencia.
- Registrar auditoría.
- Ser reconciliable.

No basar una devolución únicamente en una venta sintética o registro interno si existe una entidad nativa vinculada.

---

# 15. Caja y ledgers

Las sesiones de caja, arqueos, movimientos internos y cierres pueden ser fuente de verdad personalizada en Wix CMS.

Los ledgers deben ser:

- Append-only.
- Inmutables.
- Auditables.
- Idempotentes.
- Reconciliables.

No se permite:

- Editar hechos históricos.
- Sobrescribir importes confirmados.
- Borrar movimientos.
- Truncar auditoría.
- Corregir silenciosamente.

Las correcciones se realizan mediante eventos rectificativos que referencian el hecho original.

El cierre Z debe ser inmutable.

---

# 16. Fiscalidad y normativa

El sistema debe separar factura nativa Wix, registro fiscal propio, ledger contable, documento interno, evidencia documental e informe derivado. Wix Invoices V1 solo se utiliza para las funciones efectivamente soportadas y disponibles en el sitio. La conformidad con normativa española (incluidos requisitos de facturación y Veri*Factu cuando resulten aplicables) exige análisis legal/fiscal y validación técnica independiente; no se presume por emitir una factura en Wix.

Durante QA permanecen bloqueados, salvo autorización y gates aprobados:

- Writers fiscales.
- Veri*Factu.
- Emisión fiscal real.
- Automatizaciones externas.
- Publicación.

No marcar una factura o registro fiscal como emitido sin confirmación real.

---

# 17. Datos sintéticos de QA

Los datos sintéticos de QA deben identificarse mediante metadatos de QA trazables (por ejemplo, `qaRunId`, `recordNature`, `createdByTest`, `environmentEvidence` y timestamp), usando el mismo contrato y código que el flujo normal cuando así esté aprobado. No se deben inventar estados de negocio para marcar simulaciones ni representar como confirmados pagos, reservas, persistencias o efectos fiscales que no hayan ocurrido realmente. Los simuladores de pasarela solo pueden devolver respuestas de prueba controladas y no pueden generar transacciones reales ni confirmar pagos en el sistema nativo. Los metadatos no sustituyen la evidencia de aislamiento/destino. No usar `CONFIRMADA_SINTETICA`, `SIMULATED` ni `NO-GATEWAY` como estados de pago/negocio. Un test simulado nunca puede poner `paymentVerified=true`.

---

# 18. QA y gates

Separar tres niveles que no son intercambiables:

1. **QA offline:** tests unitarios/contratos/lint/CI sobre el código. Acreditan propiedades del código cubiertas por esos tests; no acreditan Wix Preview, Runtime, configuración del sitio ni despliegue.
2. **Wix Preview seguro:** validación en Preview después de comprobar el destino real de CMS y apps, permisos, automatizaciones, notificaciones y ausencia de efectos económicos/fiscales externos. Preview no implica aislamiento de datos por sí solo.
3. **Producción:** pruebas y operaciones reales solo tras gates, autorización expresa y controles legales/operativos. No usar cargos, reembolsos, emisión fiscal ni publicación como método de QA.

En QA deben permanecer bloqueados pagos reales, writers fiscales, Veri*Factu, automatizaciones con efectos externos y publicación productiva.

Gates mínimos:

1. Gate de contratos.
2. Gate de permisos.
3. Gate de persistencia.
4. Gate de idempotencia.
5. Gate de concurrencia.
6. Gate de reconciliación.
7. Gate fiscal.
8. Gate de pruebas E2E.
9. Gate de hardware, si aplica.
10. Gate de autorización de publicación.

Cada gate debe registrar:

- Responsable.
- Fecha/hora y entorno.
- Commit/versión y `qaRunId`.
- Evidencia reproducible y destino de datos verificado.
- Resultado PASS/FAIL/BLOCKED.
- Bloqueos y riesgos.
- Decisión y autorizador.

Los flags `saleReady`, `paymentVerified` y `persisted` son resultados de una ejecución TPV concreta, correlacionados con `traceId`/`correlationId` y el snapshot de operación. No son indicadores globales del sitio, release o proyecto. `saleReady` expresa preparación comercial validada; `paymentVerified` exige confirmación real del proveedor/nativo aplicable; `persisted` exige confirmación de persistencia en los sistemas de autoridad correspondientes. Una simulación no puede convertir un pago en verificado.

---

# 19. Informes y conservación histórica

Los informes históricos, registros append-only y hechos de auditoría no se eliminan ni sobrescriben por antigüedad. Esta regla se aplica a CMS, ledgers fiscales/contables/laborales, informes, exportaciones, auditoría y evidencia documental. Las rectificaciones se incorporan como nuevos registros/versiones enlazados al original, conservando fecha, actor, motivo y trazabilidad cuando el esquema lo permita.

Debe conservarse:

- Documento original.
- Fecha.
- Versión.
- Fuente.
- Alcance.
- Estado.
- Rectificaciones.
- Relación con versiones posteriores.

Las nuevas versiones deben crear un documento nuevo o una revisión trazable.

SharePoint puede custodiar los documentos, pero no es autoridad transaccional.

---

# 20. Seguridad

El backend debe resolver:

- Identidad.
- Rol.
- Permiso.
- Operador.
- Sesión.
- Profesional.
- Cliente.

El frontend no puede enviar datos que sustituyan la identidad autenticada.

El bridge debe:

- Validar origen.
- Validar handshake.
- Restringir tipos de mensaje.
- Rechazar mensajes inválidos.
- Evitar `allowOpaqueOrigin: true`.
- No ejecutar escrituras sin contexto válido.

---

# 21. Idempotencia y reconciliación

Toda escritura debe:

1. Recibir o generar una clave idempotente.
2. Validarse en backend.
3. Guardar hash del payload.
4. Detectar duplicados.
5. Detectar conflictos.
6. Devolver resultado anterior si ya terminó.
7. Devolver `PENDING` si está en curso.
8. Requerir reconciliación si quedó incompleta.

Aplicar a:

- Reservas.
- Ventas.
- Pedidos.
- Pagos.
- Devoluciones.
- Facturas.
- Movimientos.
- Aperturas.
- Cierres.

Nunca repetir automáticamente una operación de resultado incierto.

---

# 22. Auditoría

Toda operación relevante debe registrar:

- Actor.
- Operador.
- Permisos.
- Fecha y hora.
- Sesión.
- Tipo de operación.
- Identificador personalizado.
- Identificador nativo.
- Estado anterior.
- Estado posterior.
- Resultado.
- Clave idempotente.
- Correlaciones.
- Errores.
- Rectificaciones.

La auditoría también debe registrar bloqueos y fallos de reconciliación. Está prohibido almacenar tokens, API keys, secretos, credenciales, cookies/sesiones, datos completos de tarjetas o CVV. Registrar únicamente identificadores tokenizados/mascarados y metadatos mínimos necesarios. Aplicar minimización, control de acceso y retención conforme a normativa.

---

# 23. Estándar de análisis para la IA

Antes de proponer cambios, la IA debe:

- Leer el archivo completo.
- Buscar referencias a la función.
- Verificar exports.
- Verificar consumidores.
- Revisar tests.
- Revisar colecciones.
- Revisar documentación oficial.
- Identificar dependencias.
- No asumir que una integración existe.
- No asumir que un mock representa producción.
- No reutilizar IDs de memoria.
- No generar código basado en endpoints no verificados.

Cada hallazgo debe incluir:

```text
Archivo
Función
Evidencia
Problema
Riesgo
Invariante afectada
Corrección propuesta
Dependencias
Test requerido
```

---

# 24. Tests mínimos

Scripts esperados:

```bash
npm test
npm run test:layer1
npm run test:layer2
npm run lint
```

Los tests deben cubrir:

- Imports y exports.
- Contratos.
- Validación.
- Errores.
- Idempotencia.
- Conflictos.
- Locks.
- Pagos pendientes.
- Pedidos.
- Inventario.
- Reservas simples.
- Reservas duales.
- Devoluciones.
- Caja.
- Cierres.
- Ledgers.
- Rectificaciones.
- Reconciliación.
- Seguridad del bridge.
- Aislamiento QA.

Los tests offline demuestran únicamente compatibilidad del código dentro del alcance ejecutado. No acreditan Wix Preview, Runtime, integración real, permisos efectivos, aislamiento ni publicación. Preview y producción requieren evidencias separadas y registradas.

---

# 25. Criterios de aceptación del MVP

El MVP será aceptable cuando:

- Los contratos coincidan.
- Los módulos importados existan.
- Los Web Methods estén exportados.
- Las fuentes de verdad estén clasificadas.
- Las colecciones propias estén preservadas.
- Las apps Wix gobiernen sus dominios.
- No existan circuitos sandbox paralelos.
- Los precios e impuestos se calculen en backend.
- Los pagos estén confirmados.
- Las ventas estén vinculadas a pedidos.
- Las reservas utilicen Bookings.
- El inventario utilice Stores V3.
- Las facturas utilicen Invoices V1.
- Las devoluciones estén vinculadas a pedidos y pagos.
- Los ledgers sean inmutables.
- Las rectificaciones sean eventos trazables.
- Existan idempotencia y locks.
- Exista reconciliación.
- Los errores sean específicos.
- Los datos QA estén aislados.
- Los informes históricos estén conservados.
- Los tests pasen sobre el código final.
- El lint pase.
- Las pruebas E2E funcionen en Preview.
- No existan operaciones sensibles activas sin gate.
- No se publique sin autorización expresa.

---

# 26. Estado del sitio y del release

```text
Estado confirmado del sitio: NO PUBLICADO.
Estado del release TPV: NO-GO PARA PRODUCCIÓN.
La publicación permanece bloqueada salvo autorización expresa.
```

El estado NO PUBLICADO describe el sitio; NO-GO describe la decisión de release TPV. No son estados equivalentes ni deben mezclarse. La confirmación de no publicación procede de la última confirmación comunicada por el propietario; se requiere read-back Wix fechado para elevarla a verificación independiente.

Hasta completar:

- Validación E2E.
- Confirmación de integraciones Wix.
- Validación de pagos.
- Validación fiscal.
- Validación de inventario.
- Validación de reservas simples y duales.
- Validación de TPV.
- Validación de hardware.
- Validación de reconciliación.
- Revisión legal.
- Aprobación de publicación.

---

# 27. Regla final

> Wix CMS gobierna las entidades personalizadas del negocio.  
> Las aplicaciones Wix gobiernan sus dominios nativos.  
> SharePoint conserva evidencia documental, pero no gobierna transacciones.  
> El frontend solicita; el backend valida, autoriza y coordina.  
> Los ledgers son append-only e inmutables.  
> Las correcciones son eventos rectificativos.  
> Los datos QA no son hechos reales.  
> Las capacidades sensibles permanecen bloqueadas hasta superar sus gates.  
> Los informes históricos se conservan.  
> Ninguna operación se declara confirmada sin evidencia verificable.


# LINKS DE ACCESO A FUENTES CONSULTIVAS OFICIALES.

## 1. Proyecto y código fuente

- Repositorio canónico:  
  https://github.com/nachoortegazgz/marianmadridz

- Árbol completo del repositorio:  
  https://github.com/nachoortegazgz/marianmadridz/tree/main

- Código backend:  
  https://github.com/nachoortegazgz/marianmadridz/tree/main/src/backend

- Módulos TPV:  
  https://github.com/nachoortegazgz/marianmadridz/tree/main/src/backend/tpv

- Controlador público TPV:  
  https://github.com/nachoortegazgz/marianmadridz/blob/main/src/public/tpvPageController.js

- Página TPV:  
  https://github.com/nachoortegazgz/marianmadridz/blob/main/src/pages/TPV.yl5th.js

- Tests backend:  
  https://github.com/nachoortegazgz/marianmadridz/tree/main/src/backend/tests

- Dossier técnico consolidado:  
  https://github.com/nachoortegazgz/marianmadridz/blob/main/DOSSIER%20T%C3%89CNICO%20CONSOLIDADO.md

- Configuración de colecciones CMS:  
  https://github.com/nachoortegazgz/marianmadridz/blob/main/CMS%20KEYFIELDS.md

---

## 2. Documentación oficial de Wix

- Documentación oficial de Wix Developers:
  https://dev.wix.com/docs/overview
  https://dev.wix.com/docs/develop-websites
  https://dev.wix.com/docs/develop-websites

- Referencia general de APIs Wix:  
  https://dev.wix.com/docs/api-reference

- Referencia SDK API:  
  https://dev.wix.com/docs/api-reference/account-level/about-account-level-apis?apiView=SDK
  
- Documentación de Velo:  
  https://dev.wix.com/docs/velo

- Referencia de módulos Velo:  
  https://dev.wix.com/docs/velo/api-reference

- Wix CLI:  
  https://dev.wix.com/docs/develop-websites/articles/wix-cli

- Wix Web Modules:  
  https://dev.wix.com/docs/velo/backend-web-modules

- Permisos de Web Methods:  
  https://dev.wix.com/docs/velo/backend-web-modules/web-methods

- Wix Data:  
  https://dev.wix.com/docs/velo/apis/wix-data

- Seguridad de Wix Data:  
  https://dev.wix.com/docs/velo/apis/wix-data/data-api/permissions

  
### Prioridad 1: reservas y lógica F1 → F2
- [Crear una reserva completa](https://dev.wix.com/docs/api-reference/business-solutions/bookings/skills/end-to-end-booking-flow)
- [Servicios de Wix Bookings](https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/introduction)
- [Disponibilidad y horarios](https://dev.wix.com/docs/api-reference/business-solutions/bookings/time-slots/time-slots-v2/introduction)
- [Configuración de empleados y horarios](https://dev.wix.com/docs/api-reference/business-solutions/bookings/skills/bookings-staff-setup)
- [Políticas de reserva](https://dev.wix.com/docs/api-reference/business-solutions/bookings/skills/booking-service-policy-setup)

### Prioridad 2: código backend Velo
- [Backend Velo](https://dev.wix.com/docs/velo/backend)
- [Web Modules](https://dev.wix.com/docs/velo/backend/web-modules)
- [Funciones backend](https://dev.wix.com/docs/velo/backend-code)
- [Eventos backend](https://dev.wix.com/docs/velo/events)
- [Wix Data desde backend](https://dev.wix.com/docs/velo/api-reference/wix-data)
- [Gestión de secretos](https://dev.wix.com/docs/velo/api-reference/wix-secrets-backend)

### Prioridad 3: colecciones personalizadas
- [CMS Data Items CRUD](https://dev.wix.com/docs/api-reference/business-solutions/cms/skills/cms-data-items-crud)
- [Gestión de esquemas CMS](https://dev.wix.com/docs/api-reference/business-solutions/cms/skills/cms-schema-management)
- [Referencias entre colecciones](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items)
- [Eventos y disparadores de datos](https://dev.wix.com/docs/velo/api-reference/wix-data)

Especialmente relevante para `CitasF2`, `ServiciosCatalogo`, `RegistroIntegracion`, `ControlOperativo` y `MapaStaff`.

### Prioridad 4: SDK moderno de Wix
- [SDK de Wix](https://dev.wix.com/docs/sdk)
- [Referencia del SDK](https://dev.wix.com/docs/sdk/api-reference)
- [SDK de Bookings](https://dev.wix.com/docs/sdk/backend-modules/bookings)
- [SDK de CMS / Wix Data](https://dev.wix.com/docs/sdk/backend-modules/data)
- [SDK de eCommerce](https://dev.wix.com/docs/sdk/backend-modules/ecom)

### Prioridad 5: pagos y checkout
- [API eCommerce](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce)
- [Carritos y checkout](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/cart)
- [Pagos](https://dev.wix.com/docs/api-reference/business-management/payments)
- [Pruebas del checkout](https://dev.wix.com/docs/sdk/backend-modules/ecom)

### Prioridad 6: contenido dinámico del sitio
- [API de Wix Blog](https://dev.wix.com/docs/api-reference/business-solutions/blog)
- [Entradas y borradores del blog](https://dev.wix.com/docs/api-reference/business-solutions/blog/draft-posts)
- [Wix Stores Catalog V3](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3)
- [Rich Content de Wix](https://dev.wix.com/docs/api-reference/assets/rich-content)

### Orden recomendado de estudio

1. **Backend Velo y Web Modules**
2. **Bookings y disponibilidad**
3. **Wix Data/CMS y colecciones**
4. **SDK de Bookings y Wix Data**
5. **eCommerce, checkout y pagos**
6. **Blog, Stores y contenido dinámico**

Para el desarrollo actual del sitio, el núcleo técnico es:

**Velo Backend → Bookings → Wix Data → SDK → eCommerce/Checkout**.

---

## 3. Wix CMS y colecciones personalizadas

- CMS Data API:  
  https://dev.wix.com/docs/api-reference/business-management/cms

- Operaciones CRUD de elementos CMS:  
  https://dev.wix.com/docs/api-reference/business-management/cms/data-items

- Gestión de esquemas CMS:  
  https://dev.wix.com/docs/api-reference/business-management/cms/collections

- Consultas Wix Data:  
  https://dev.wix.com/docs/velo/api-reference/wix-data

- Hooks de datos:  
  https://dev.wix.com/docs/velo/code-examples/working-with-data/using-data-hooks

- Lenguaje de consultas Wix:  
  https://dev.wix.com/docs/api-reference/articles/about-the-wix-api-query-language

---

## 4. Wix Bookings

- API de Wix Bookings:  
  https://dev.wix.com/docs/api-reference/business-solutions/bookings

- Servicios de Bookings:  
  https://dev.wix.com/docs/api-reference/business-solutions/bookings/services

- Reservas:  
  https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings

- Disponibilidad y franjas horarias:  
  https://dev.wix.com/docs/api-reference/business-solutions/bookings/time-slots

- Profesionales y personal:  
  https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff

- Recursos:  
  https://dev.wix.com/docs/api-reference/business-solutions/bookings/resources

- Políticas de reserva:  
  https://dev.wix.com/docs/api-reference/business-solutions/bookings/booking-policies

---

## 5. Wix Stores Catalog V3 e inventario

- API de Stores:  
  https://dev.wix.com/docs/api-reference/business-solutions/stores

- Catalog V3:  
  https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3

- Productos Catalog V3:  
  https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3

- Consultar productos:  
  https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/query-products

- Buscar productos:  
  https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/search-products

- Obtener un producto:  
  https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/get-product

- Inventario Catalog V3:  
  https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/inventory

- Categorías Catalog V3:  
  https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/categories

---

## 6. Pedidos, eCommerce y pagos

- API de eCommerce:  
  https://dev.wix.com/docs/api-reference/business-solutions/e-commerce

- Pedidos:  
  https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders

- Checkout:  
  https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/checkout

- Carritos:  
  https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/carts

- Transacciones:  
  https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/transactions

- Reembolsos y transacciones:  
  https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/transactions

- API de pagos:  
  https://dev.wix.com/docs/api-reference/business-management/payments

- Wix Payments:  
  https://dev.wix.com/docs/api-reference/business-management/payments/wix-payments

- Payment Links:  
  https://dev.wix.com/docs/api-reference/business-management/payments/payment-links

- Velo Pay API:  
  https://dev.wix.com/docs/velo/apis/wix-pay

---

## 7. Wix Invoices V1

- API general de facturas:  
  https://dev.wix.com/docs/api-reference/business-management/get-paid/invoices

- Wix Invoices V1:  
  https://dev.wix.com/docs/api-reference/business-management/get-paid/invoices/invoices-v1

- Facturas:  
  https://dev.wix.com/docs/api-reference/business-management/get-paid/invoices/invoices-v1/invoices

La IA debe verificar siempre que el sitio utiliza **Invoices V1** y no aplicar documentación de Invoices V2.

---

## 8. Miembros, contactos y clientes

- API de Members:  
  https://dev.wix.com/docs/api-reference/members

- API de Contacts:  
  https://dev.wix.com/docs/api-reference/crm/contacts

- API de CRM:  
  https://dev.wix.com/docs/api-reference/crm

- Identidad y autenticación:  
  https://dev.wix.com/docs/velo/apis/wix-users

- Gestión de permisos y miembros:  
  https://dev.wix.com/docs/velo/apis/wix-members

---

## 9. Facturación, fiscalidad y evidencias

- Wix Get Paid:  
  https://dev.wix.com/docs/api-reference/business-management/get-paid

- Invoices:  
  https://dev.wix.com/docs/api-reference/business-management/get-paid/invoices

- Pagos y transacciones:  
  https://dev.wix.com/docs/api-reference/business-management/payments

- Wix Data para registros fiscales propios:  
  https://dev.wix.com/docs/velo/apis/wix-data

La documentación de Veri*Factu, normativa fiscal española y obligaciones legales debe contrastarse además con fuentes oficiales de la Agencia Tributaria y legislación española. No debe tratarse como confirmada únicamente por documentación interna del repositorio.

---

## 10. Seguridad, autenticación y secretos

- Seguridad en Velo:  
  https://dev.wix.com/docs/velo/security

- Secret Manager:  
  https://dev.wix.com/docs/velo/apis/wix-secrets-backend

- Autenticación de APIs Wix:  
  https://dev.wix.com/docs/build-apps/develop-your-app/access/authentication

- OAuth de Wix:  
  https://dev.wix.com/docs/build-apps/develop-your-app/access/authentication/oauth-2

- Rate limiting y buenas prácticas:  
  https://dev.wix.com/docs/build-apps/develop-your-app/build-apps-overview/rate-limits

- HTML Components y comunicación:  
  https://dev.wix.com/docs/velo/api-reference/%24w/html-component/on-message

---

## 11. Wix Apps, integraciones y herramientas

- Wix App Market:  
  https://www.wix.com/app-market

- Apps instaladas en Wix:  
  https://dev.wix.com/docs/api-reference/app-management/apps

- API de instalación de aplicaciones:  
  https://dev.wix.com/docs/api-reference/app-management/apps-installer

- Extensiones de aplicaciones:  
  https://dev.wix.com/docs/build-apps/develop-your-app/extensions

- APIs de aplicaciones Wix:  
  https://dev.wix.com/docs/build-apps

La IA debe comprobar la app instalada en el sitio antes de asumir que una capacidad está disponible.

---

## 12. Wix MCP, integrador y herramientas de consulta

Para consultar o actuar sobre el sitio mediante el integrador Wix/MCP, la IA debe utilizar las herramientas disponibles en la sesión, especialmente:

- Lectura de contexto del sitio.
- Listado de sitios.
- Consulta de documentación Wix.
- Inspección de esquemas API.
- Ejecución de APIs Wix.
- Lectura del contenido de URLs.
- Herramientas específicas de aplicaciones instaladas.

Reglas de uso:

- Usar siempre el site ID activo:  
  `188bed94-177c-4bc9-a9f0-35080d874f3e`
- No reutilizar IDs de otros sitios.
- Confirmar el contexto del sitio antes de operar.
- Usar `GetSiteContext` si falta información actualizada.
- Usar documentación oficial antes de ejecutar una API no confirmada.
- Preferir métodos específicos de la aplicación instalada.
- No inventar endpoints, cuerpos, permisos ni estados.
- Separar operaciones de lectura de operaciones de escritura.
- Solicitar autorización antes de cambios sensibles.
- No activar pagos reales, writers fiscales, Veri*Factu, automatizaciones externas ni publicación durante QA.

---

## 13. Documentación técnica del repositorio

- README principal:  
  https://github.com/nachoortegazgz/marianmadridz/blob/main/README.md

- Directrices de desarrollo:  
  https://github.com/nachoortegazgz/marianmadridz/blob/main/DIRECTRICES_DESARROLLO_CODIGO.txt

- Dossier técnico:  
  https://github.com/nachoortegazgz/marianmadridz/blob/main/DOSSIER%20T%C3%89CNICO%20CONSOLIDADO.md

- Documentación de flujos E2E:  
  https://github.com/nachoortegazgz/marianmadridz/blob/main/DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md

- Documentación TPV:  
  https://github.com/nachoortegazgz/marianmadridz/tree/main/src/backend/tpv

- Workflows CI/CD:  
  https://github.com/nachoortegazgz/marianmadridz/tree/main/.github/workflows

- Scripts de verificación Wix:  
  https://github.com/nachoortegazgz/marianmadridz/tree/main/scripts

---

## 14. Matriz única de autoridad y precedencia

| Dominio | Autoridad primaria | Papel de Wix CMS / código propio |
|---|---|---|
| Reservas, servicios, disponibilidad, staff/recursos | Wix Bookings | Correlación, auditoría y proyección; F1→intervalo→F2 se orquesta en backend |
| Productos, variantes y catálogo | Wix Stores Catalog V3 | Metadatos de negocio que no existan en catálogo nativo |
| Stock por variante/ubicación | Wix Stores Inventory Items V3 | Locks/correlación/reconciliación; no duplicar el stock nativo |
| Pedidos y ciclo post-compra | Wix eCommerce Orders | Correlación y ledger interno complementario |
| Cobros, capturas, anulaciones y reembolsos | Wix Payments / eCommerce Order Billing según operación y proveedor | El registro de transacción no equivale por sí solo a movimiento de dinero |
| Facturas nativas | Wix Invoices V1 dentro de sus capacidades | Registro fiscal/legal propio solo tras validación independiente |
| Entidades personalizadas del negocio | Wix CMS | SSOT solo de esas entidades, no de dominios nativos |
| Identidades y contactos | Wix Members / CRM Contacts según entidad | Referencias y datos complementarios mínimos |
| Evidencia documental | SharePoint | Repositorio; nunca autoridad transaccional |
| Auditoría/ledgers personalizados | CMS/almacenamiento canónico definido por dominio | Append-only, inmutables y rectificables mediante nuevos registros |

Precedencia de decisión: (1) normativa aplicable y documentación oficial vigente para contratos técnicos; (2) decisiones expresas y más recientes del propietario para objetivos, alcance y autorizaciones; (3) estado live verificado de Wix y apps; (4) código y configuración del commit inspeccionado; (5) tests ejecutados sobre ese commit; (6) dossier y demás documentación derivada; (7) documentación histórica/propuestas. La precedencia no convierte el código o un test en autoridad de negocio: son evidencia del estado implementado. Toda contradicción debe registrarse y resolverse explícitamente.

---

## 15. Regla final para el modelo IA

> Consultar primero el repositorio y el contexto real del sitio.  
> Confirmar la versión de cada aplicación Wix.  
> Usar documentación oficial y esquemas verificables.  
> Tratar Wix CMS como autoridad de las entidades personalizadas.  
> Tratar las apps Wix como autoridad de sus dominios nativos.  
> Usar SharePoint únicamente como custodia documental.  
> Mantener el frontend sin autoridad de negocio.  
> Preservar ledgers e informes históricos.  
> Aislar datos sintéticos.  
> No modificar ni publicar sin plan, autorización y evidencia suficiente.


## Anexo de estado de validación del dossier (corte 2026-11-27)

### Evidencia de integración documental

- PR #623 fusionada en `main`: https://github.com/nachoortegazgz/marianmadridz/pull/623
- Commit de cambios documentales: `0443ec8cd2bd50c1a5ff3f19bba77dc2d51be345`.
- Merge commit: `4b4ea2fe34e803a2fa325838ebeb352e7cd1630d`.
- CI Backend offline quality gates, run `45908306328`: **SUCCESS**. Checkout, Node setup, sincronización package/lockfile, instalación bloqueada, dependencias críticas, npm audit, Layer 1, Layer 2, suite offline completa, verificaciones SDK de cart/transactions/TPV y ESLint finalizaron correctamente.
- Secret scanning, run `45908306358`: **SUCCESS**. Gitleaks full-history scan completado correctamente.
- Alcance de esta evidencia: commit de PR #623 y pruebas automatizadas indicadas. No acredita Wix Preview, Wix Runtime, configuración live, permisos efectivos ni despliegue.

### Gates que siguen abiertos

1. **Estado de publicación:** NO PUBLICADO según última confirmación del propietario; falta un read-back independiente y fechado de Wix para elevarlo a verificación directa.
2. **Release TPV:** NO-GO PARA PRODUCCIÓN. No se autoriza publicación ni operaciones reales.
3. **Wix Preview / Runtime:** pendiente de sesión autenticada y ejecución segura de pruebas de aceptación. No declarar el bridge, Bookings, pagos o persistencia validados en runtime por el resultado de CI offline.
4. **Permisos por rol:** pendiente inspección de código/configuración efectiva y matriz de pruebas positivas y negativas para ADMIN, GESTION y ESTILISTA ROL. Mantener denegación por defecto donde la allowlist no esté demostrada.
5. **Apps instaladas:** el inventario fechado es una evidencia de contexto, no una prueba de configuración operativa ni de permisos de cada aplicación.
6. **Fiscalidad:** Invoices V1 no acredita cumplimiento normativo. Requiere validación fiscal/legal y técnica separada antes de habilitar emisión real.

### Criterio de cierre

No cambiar el release a GO ni declarar el proyecto plenamente validado hasta cerrar los gates aplicables con evidencia reproducible, entorno identificado, commit probado, resultados PASS y autorización correspondiente. Los tests offline satisfactorios no sustituyen Preview, Runtime ni pruebas productivas autorizadas.

## Anexo operativo — permisos por rol y protección de auditoría (corte 2026-11-26)

### Roles Wix / aplicación

Los permisos efectivos no se deducen del nombre visible del rol ni de descripciones genéricas. Deben verificarse por aplicación, recurso, método y rol mediante la configuración live, security.js, internalConfig.STAFF.WEBSITE_ROLE_BY_RESOURCE_ID y las APIs de Bookings/Members que correspondan.

| Rol de negocio | Evidencia estática actual | Permitido en TPV según código | Denegado / límite probado estáticamente | Estado |
|---|---|---|---|---|
| ADMIN | Un recurso está asignado a `ROL_WEBSITE.ADMIN` en `internalConfig.STAFF.WEBSITE_ROLE_BY_RESOURCE_ID`. `security.js:isAdmin()` exige coincidencia de identidad Wix + Contact ID + Bookings resourceId. | `SiteMember` más guard backend; lectura y preparación/registro de venta; apertura de sesión y arqueo parcial. `tpvPermisos.web.js` declara `read`, `createSale`, `openSession`, `registerCashMovement` y `registerPartialCount` como disponibles para ADMIN. | Reembolsos, cierre de sesión, tickets X/Z, exportaciones de movimientos/auditoría, notificaciones a clientes y hardware físico permanecen deshabilitados en el contrato de capacidades leído. | Evidencia estática; Runtime pendiente |
| GESTION | Enum y guards existen; `isCajero()` y `getMyCajeroContext()` aceptan ADMIN/GESTION. Sin embargo, el mapa estático actual no asigna ningún `resourceId` a GESTION. | Si se asignara mediante el mapa canónico, podría superar los guards de cajero para lectura/preparación/registro de venta y bootstrap/lectura de caja. | No supera `requireAdmin()`: apertura de sesión y arqueo parcial TPV denegados. No se debe inferir acceso a otras capacidades. | Rol definido, pero sin asignación activa en el mapa inspeccionado |
| ESTILISTA | Dos recursos están asignados a `ROL_WEBSITE.ESTILISTA`; `isEstilista()` y `isStaffCollaborator()` reconocen este rol. | Identidad reconocida como colaborador/staff en los métodos que admitan explícitamente ese rol. | No supera `isCajero()` ni `getMyCajeroContext()`; por tanto, el acceso a los WebMethods TPV examinados que exigen esos guards queda denegado. No tiene permisos TPV de venta/caja por el mero hecho de ser staff. | Evidencia estática; Runtime pendiente |

**Base de evidencia inspeccionada en `main` (merge de PR #623):** `src/backend/internalConfig.js` (mapa de roles); `src/backend/security.js` (`isAdmin`, `isCajero`, `isEstilista`, `getMyCajeroContext`, `requireAdmin`, `requireCajero`); `src/backend/tpv/tpvPermisos.web.js`; `src/backend/tpv/tpvCaja.web.js`; `src/backend/tpv/tpvVentas.web.js`. Los WebMethods TPV revisados declaran `Permissions.SiteMember` y aplican además guards de rol en backend. La matriz describe solo el alcance TPV inspeccionado, no todos los módulos ni los permisos efectivos del Dashboard Wix.

La frase “ESTILISTA: todo excepto contabilidad y gestión” queda retirada por ser demasiado amplia y ambigua. ESTILISTA no hereda permisos por pertenecer al staff: cada WebMethod debe permitir expresamente el rol. Mantener denegación por defecto. La matriz global por aplicación y recurso requiere seguir revisando los demás WebMethods y permisos nativos Wix; las pruebas Runtime positivas/negativas siguen pendientes.

### Protección de registros y auditoría

No incluir en auditoría, logs, exportaciones, issues ni dossiers: tokens, API keys, secretos, credenciales, cookies, sesiones, números completos de tarjeta, CVV ni payloads sensibles completos. Usar referencias opacas, enmascaramiento y minimización. Esta prohibición se aplica también a logs de error y evidencias de QA.

### Estado de verificación de URLs oficiales

Se han contrastado en documentación oficial, a fecha 2026-11-26, los enlaces de Bookings Services V2, Bookings Reader V2, Time Slots V2, Catalog V3 Inventory Items, conceptos de inventario Catalog V3, eCommerce Orders, Order Transactions, Order Billing/Refund Payments y HtmlComponent.onMessage. Los demás enlaces de esta sección son rutas oficiales de referencia general, pero deben revalidarse al consultar cada método concreto; no se consideran verificados por el mero hecho de estar listados. Se ha eliminado la URL malformada del antiguo enlace a develop-websites-sdk.
