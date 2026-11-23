# Auditoría de minimización de código personalizado

**Fecha:** 23-11-2026  
**Base de código:** main, SHA 26f51bcb3fb46c1c0e0e933ae6bb08c4c26d52f9.  
**Alcance:** lectura estática de módulos seleccionados. No se han editado ni ejecutado pruebas sobre el código.

## 1. Conclusión

La arquitectura ya utiliza varias capacidades nativas de Wix: Bookings V2, Cart V2, Stores Catalog V3, Members/Staff, Wix Data y backend events. No procede reconstruir esos procesos.

Sí existen candidatos claros a simplificación, principalmente en la configuración TPV y en la duplicación de atributos de catálogo. No se ha demostrado todavía que esos candidatos puedan eliminarse sin romper consumidores, datos históricos o garantías de seguridad.

La reducción de código debe comenzar después de corregir las divergencias de datos y definir qué responsabilidades del TPV propio son realmente necesarias.

## 2. Módulos revisados

| Archivo | Tamaño observado | Responsabilidad | Evaluación |
|---|---:|---|---|
| src/backend/internalConfig.js | 37.563 bytes | Constantes, enums y políticas | Candidato a consolidación de flags, no a reescritura |
| src/backend/validation.js | 41.359 bytes | Validaciones de contratos CMS/DTO | Conservar como autoridad; revisar duplicidades por consumidores |
| src/backend/dataAccess.js | 20.303 bytes | Acceso centralizado Wix Data | Conservar si mantiene un único límite de acceso |
| src/backend/dataAccessPolicy.js | 12.243 bytes | Política de mutaciones y append-only | Garantía crítica; no simplificar sin pruebas de seguridad |
| src/backend/events.js | 141.412 bytes / 3.354 líneas | Eventos Bookings/eCommerce y efectos de dominio | Revisar por dominios; no reescribir en bloque |
| src/backend/cajas.web.js | 93.296 bytes | Caja, ledger y lógica fiscal | Mantener bloqueado; requiere auditoría fiscal específica |
| src/backend/fiscalLedgerLock.js | 16.750 bytes | Exclusión y secuenciación de ledger | Mantener hasta resolver concurrencia Runtime |
| src/backend/tpv/tpvRepository.js | 46.025 bytes | Persistencia TPV, locks, idempotencia y auditoría | Candidato a simplificación posterior a aceptación |
| src/backend/tpv/tpvUtils.js | 8.000+ bytes en la lectura parcial | Identificadores, huellas y payloads sintéticos | Revisar compatibilidad legacy y contratos |
| src/backend/tpv/tpvVentas.web.js | 11.656 bytes | Venta sintética | Revisar roles y necesidad de venta propia |
| src/public/tpvPageController.js | 10.614 bytes | Puente UI/WebMethods | Mantener delgado; no duplicar reglas de negocio |
| src/backend/tpv/tpvPermisos.web.js | 1.449 bytes | Capacidades expuestas al widget | Revisar matriz de roles |
| src/backend/booking/bookingCore.js | Lectura parcial | Primitivas y sagas de reservas | Mantener solo la lógica diferencial dual |

La lista es una muestra de módulos críticos, no un inventario exhaustivo de src/. La conexión GitHub utilizada en esta revisión no expuso un árbol completo ni búsqueda global de código. No se ha certificado la ausencia de consumidores de ningún símbolo.

## 3. Hallazgos por prioridad

### A. TPV_RUNTIME_POLICY contiene controles semánticamente solapados

En internalConfig.js aparecen, entre otros:
- ENABLED y SYNTHETIC_ONLY.
- ALLOW_REAL_PAYMENTS y REAL_PAYMENTS_ENABLED.
- ALLOW_NATIVE_WRITES y FISCAL_WRITES_ENABLED.
- CAPABILITIES.realPayments/nativeWrites/fiscalEmission.
- SOURCE_TYPE, LEDGER_VERSION y SCHEMA_VERSION.
- CURRENCY y CURRENCY_CODE.
- LEGACY_RUN_ID y varios LEGACY_*_SOURCE.

No debe concluirse que todos son duplicados: algunos pueden ser contratos distintos o consumidores históricos. La duplicidad semántica sí está demostrada en parte y merece una matriz de referencias.

**Propuesta:** definir una política backend canónica, mapear cada consumidor, sustituir las referencias redundantes y retirar flags solo cuando la búsqueda global y las pruebas demuestren que no hay contratos activos. No cambiar el valor de seguridad de ninguna capacidad durante esta limpieza.

### B. Compatibilidad legacy TPV

Persisten:
- TPV_LEGACY_COLLECTIONS.
- makeLegacyTpvTransactionIdByCollection.
- makeLegacyTpvTransactionId.
- LEGACY_RUN_ID, LEGACY_CASH_REGISTER_SOURCE y LEGACY_LEDGER_SOURCE.
- Lecturas/validaciones que aceptan marcadores históricos SANDBOX.

La compatibilidad no debe permanecer indefinidamente, pero tampoco puede eliminarse solo por nomenclatura. Primero hay que inventariar los registros existentes en MovimientosCaja y las ramas de lectura/escritura que aceptan el contrato legacy.

**Propuesta:** clasificar cada ruta como lectura histórica, escritura activa o test fixture. Retirar escrituras legacy antes que lecturas históricas; para cada fallback restante, registrar métrica, fecha de retirada y prueba de ausencia de datos consumidores.

### C. Locks TPV y lock fiscal: no fusionar por apariencia

tpvRepository.js contiene:
- withCajaActualProjectionLock, que utiliza fiscalLedgerLock para serializar la proyección de CajaActual.
- withTpvScopedLock, que aplica CAS sobre registros de ControlOperativo para sesión/venta/devolución.
- withTpvSessionLock y withTpvSaleLock como ámbitos específicos.

Son garantías de distinto alcance. No se ha demostrado que sean redundantes. El riesgo relevante es comprobar que todos los escritores de CajaActual usan la misma sección crítica y que los locks se adquieren en orden coherente.

**Propuesta:** conservar hasta cerrar #525 y demostrar concurrencia en Wix Runtime. No sustituir CAS/locks por un retry simple de update.

### D. Frontend TPV: reducir a puente y UX

tpvPageController.js contiene normalización numérica, validación de formato de idempotencyKey, generación de clave de transporte, dispatch y adaptación de DTOs.

La generación de una clave idempotente en cliente puede ser necesaria para correlacionar reintentos. La validación visual también puede mejorar UX. Ninguna de ellas debe convertirse en autoridad de negocio.

**Propuesta:** mantener únicamente validación de UX y adaptación de mensajes. El backend vuelve a validar importe, permisos, sesión, pago y estado. Eliminar validaciones duplicadas solo si no aportan feedback útil y después de probar los contratos del widget.

### E. Roles TPV más restrictivos que el modelo general

tpvPermisos.web.js expone capacidades de escritura solo cuando rolWebsite es ADMIN. tpvVentas.web.js también exige requireAdmin para registrar venta, aunque el modelo general contempla ADMIN, GESTION y ESTILISTA.

No se considera un defecto automáticamente: puede ser una restricción intencional del TPV. Falta el criterio de aceptación de negocio por rol.

**Propuesta:** aprobar matriz de permisos antes de cambiar guards. Nunca sustituir autorización backend por botones deshabilitados.

### F. Identidades TPV sintéticas vacías

TpvSandboxIdentities existe, pero contiene cero registros en el CMS actual. tpvIdentities.js filtra identidades activas y syntheticOnly=true; el flujo de inicialización TPV contempla seed de identidades.

**Propuesta:** decidir si la búsqueda de clientes sintéticos forma parte del requisito de TPV. Si no, retirar esa capacidad y sus consumidores; si sí, provisionar mediante el flujo backend autorizado y probar el contrato. No ejecutar inicialización durante esta auditoría.

### G. Catálogo y pago: evitar dos autoridades

tpvCatalogo.web.js consulta servicios Bookings y productos Stores Catalog V3. Es un patrón correcto de lectura nativa.

La issue #522 confirma 16 discrepancias online y 8 presenciales entre ServiciosCatalogo y Bookings V2. El problema no se resuelve duplicando validaciones en frontend.

**Propuesta:** usar Bookings V2 como autoridad para payment.options y conservar en ServiciosCatalogo solo metadatos propios del negocio que no existan en el servicio nativo.

### H. Inventario personalizado

El archivo src/backend/inventario.web.js no se encuentra en main (404). events.js declara que Wix Catalog es autoridad del stock, que ORDER_CREATED no realiza custom stock write y que la cancelación/reposición corresponde a Wix.

**Propuesta:** issue #237 requiere reconciliación de consumidores UI, páginas, tests y jobs antes de cerrarse. No recrear la capa de inventario.

### I. node:crypto en Velo Runtime

tpvRepository.js y tpvUtils.js importan node:crypto y utilizan createHash("sha256"). La documentación oficial consultada confirma que el backend gestionado de Wix corre sobre Node.js y admite la mayoría de paquetes npm. No se ha obtenido una declaración específica de compatibilidad de este módulo en el Runtime concreto ni se ha ejecutado un smoke test Wix.

**Propuesta:** verificar import y hash en Wix Local Editor/Runtime con un test aislado. No sustituir el hash ni cambiar el algoritmo por intuición.

## 4. Qué no debe eliminarse

- dataAccess.js mientras sea el límite central de Wix Data.
- dataAccessPolicy.js y las restricciones append-only.
- security.js y la resolución server-side de identidad/roles.
- fiscalLedgerLock.js hasta validar secuenciación y concurrencia.
- Idempotencia de eventos Wix y claims webhook.
- bookingCore.js mientras exista el requisito dual F1/F2.
- Validadores CMS/DTO que protegen escrituras.
- Históricos, ledgers, pruebas y decisiones que tengan valor probatorio.

## 5.1 Persistencia TPV: migración lógica ya presente en main

La lectura de internalConfig.js confirma que TPV_COLLECTIONS contiene discriminadores lógicos (TPV_LOGICAL_*), no IDs de colecciones CMS. El propio comentario del código indica que el repositorio los persiste físicamente en MovimientosCaja y que las sesiones se representan en CajaActual.

tpvRepository.js confirma el comportamiento:
- insertTpvEvent persiste los eventos lógicos en BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA.
- queryTpvRecords consulta MovimientosCaja y reconstruye el registro lógico desde payloadFiscal.
- Las sesiones de caja se proyectan en CajaActual.
- TPV_LEGACY_COLLECTIONS se describe en internalConfig como mapeo de solo lectura para discriminadores históricos.

Por tanto, el objetivo técnico de la issue #435 parece estar implementado parcialmente o en gran parte en el código actual de main. La issue sigue abierta y debe reconciliarse con el código actual, los dos movimientos sintéticos live, la colección de identidades vacía y la aceptación Runtime. No crear colecciones TPV_QA_* ni confundir los discriminadores lógicos con IDs CMS.

## 5.2 Directriz TPV neutral incorporada

El propietario ha establecido que la adaptación del TPV debe integrarse en `internalConfig.js`, `tpvUtils.js` y `tpvRepository.js`, sin crear `tpvRuntimePolicy.js` ni un segundo repositorio. La política propuesta, los aliases de colecciones, la firma compatible de `makeTpvId`, el envelope central, la normalización de estados/trazas y el checklist completo quedan documentados en [Baseline de adaptación neutral del TPV](2026-11-23-tpv-neutral-adaptation-baseline.md).

Este baseline es un requisito de diseño pendiente de reconciliación con el HEAD, no un patch aprobado. En particular, no se deben copiar los valores de `TPV_COLLECTIONS` ni sustituir estados/IDs hasta comprobar imports, exports, consumidores, esquema CMS y registros históricos. La compatibilidad `node:crypto` debe probarse en Wix Runtime. Los locks, CAS, idempotencia, append-only y separación de pagos nativos permanecen como garantías obligatorias.

## 5. Orden de simplificación recomendado

1. Resolver divergencias nativas Bookings/CitasF2 y opciones de pago.
2. Completar búsqueda global de consumidores y contratos del repositorio.
3. Crear matriz de flags TPV con referencias exactas.
4. Eliminar duplicidades demostradas de configuración en una rama aislada.
5. Revisar legacy TPV y planificar retirada por tipo de dato.
6. Reducir el controlador frontend a puente/UX.
7. Reevaluar la necesidad de TPV propio frente a las capacidades nativas disponibles.
8. Ejecutar CI, regresión, Runtime y diff review en el mismo SHA.

## 6. Límites de validación

No se ha ejecutado npm ci, npm test, lint, Wix Local Editor ni E2E. No se ha probado concurrencia Runtime, pagos, reembolsos, webhooks ni escritores fiscales. Los resultados CI citados en la documentación del proyecto corresponden a SHAs concretos anteriores.

No se ha cambiado código ni datos CMS durante esta revisión.

## 7. Referencias

- [Estándares de desarrollo](../engineering/DEVELOPMENT-STANDARDS.md)
- [README backend](../../src/backend/README.md)
- [README TPV](../../src/backend/tpv/README.md)
- [Issue #525 — CajaActual y concurrencia](https://github.com/nachoortegazgz/marianmadridz/issues/525)
- [Issue #522 — opciones de pago](https://github.com/nachoortegazgz/marianmadridz/issues/522)
- [Issue #237 — inventario](https://github.com/nachoortegazgz/marianmadridz/issues/237)
- [Wix Backend Development](https://dev.wix.com/docs/overview/backend-services/backend-development-on-wix)
