# Capa 3 — preparación de exportación contable para registro externo

**Fecha:** 2026-11-27  
**Integración:** PR #641 fusionada en `main`.  
**Estado:** contrato y preparación backend implementados en código; transporte y runtime pendientes.  
**Autoridad:** Wix CMS sigue siendo SSOT transaccional. Capa 3 solo recibe evidencia documental.

## Alcance implementado

- `src/backend/exports/exportContract.js`: contrato JSON versionado `1.0.0`, serialización determinista, checksum SHA-256, identificadores deterministas por periodo/artefacto y minimización de campos.
- `src/backend/exports/exportService.web.js`: WebMethod `Permissions.Admin`, autorización adicional `requireAdmin`, rate limit y preparación trimestral en memoria.
- `src/backend/fiscalAggregator.web.js`: opción interna `requireRealRecords` para excluir del paquete registros no clasificados exactamente como `REAL`; el agregador habitual no cambia su comportamiento por defecto.
- Pruebas de contrato: hash estable, periodo, importes en céntimos, exclusión de datos personales/concepto, rechazo de registros sintéticos y validación de hash/fecha.

## Contrato de datos

El artefacto contiene:

- Manifest: `exportId`, `artifactId`, tipo, versión, periodo, zona `Europe/Madrid`, `generatedAt`, `traceId`, conteo, algoritmo y checksum.
- Contenido: NIF del emisor (necesario para la finalidad contable), totales agregados y líneas fiscales mínimas.
- Líneas: número/fecha/tipo de documento, naturaleza/movimiento, tratamiento fiscal, medio de pago, base/cuota/total en céntimos, tipo impositivo en basis points, referencia rectificativa, timestamp, hash completo y transactionId opaco.

No se exportan nombre/NIF/dirección de clientes, notas de reserva, descripción libre, datos de tarjeta, tokens, secretos ni credenciales. Los campos identificativos de origen se limitan a referencias opacas necesarias para trazabilidad.

## Garantías y límites

- Solo lectura desde los agregadores de Wix CMS; no inserta ni actualiza CMS.
- No envía correo, no llama a Microsoft Graph, no sube a SharePoint y no ejecuta Power Automate.
- No se ha añadido ningún cron de exportación.
- No se filtran registros por naturaleza del entorno. Cada fila debe superar validaciones fiscales explícitas: identidad de factura, fecha, tipo, importes, IVA, transactionId y hash.
- Los agregadores requieren la configuración fiscal canónica de `MapaStaff`. El read-back live del 2026-11-27 devolvió cero registros de configuración; por tanto no puede generarse un paquete fiscal online hasta completar datos legales verificados. No se inventan NIF ni datos del emisor.
- La clasificación `recordNature` y el corte `productionActivationAt` quedan retirados del contrato runtime. El mismo código y formato se usan en todos los entornos; los datos se validan por su contenido y por las garantías de integridad, no por etiquetas de entorno.
- No existe evidencia de tenant M365, biblioteca SharePoint, permisos, DLP, retención, PA-01…PA-07 ni aprobación de gestoría. No declarar transporte externo conectado.

## Gates para activar transporte

1. Aprobar ADR de transporte (Microsoft Graph/SharePoint o alternativa) y destino exacto.
2. Verificar tenant, biblioteca, identidad de aplicación/conexión, permisos mínimos, DLP, retención y versionado.
3. Obtener aprobación del asesor/gestoría para el formato, campos y periodo.
4. Implementar adapter de entrega con creación no destructiva, idempotencia por `exportId`, artefacto versionado por checksum, retry limitado y ledger de intentos separado de los ledgers transaccionales.
5. Probar en tenant aislado con fixtures sintéticas y confirmar hash/lectura/ACL.
6. Demostrar unidireccionalidad: ningún callback ni acción del repositorio documental puede modificar Wix CMS.
7. Activar jobs solo después de E2E y aprobación operativa.

**Resultado:** backend preparado para generar un artefacto contable minimizado y verificable cuando exista configuración fiscal real; no está preparado para envío externo ni para sincronización online con SharePoint/Power Automate.
