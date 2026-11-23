# Capa 3 M365 / SharePoint — estado de implantación verificado

**Fecha:** 2026-11-09  
**Base:** main commit 8b692d6d180a796882fc0c7fa180ee7fdeeacc45  
**Estado:** Arquitectura documentada; ejecución operativa no demostrada.

## 1. Evidencia en el repositorio

- No existe src/backend/exports/exportService.js.
- src/backend/crons.js declara 13 funciones; ninguna es exportDailyMovements, exportWeeklyFichajes, exportMonthlyVentas ni exportMonthlyInventario.
- src/backend/jobs.config contiene 13 jobs; ninguno programa exportaciones a Capa 3.
- verifyNightlyZClosing está implementado, pero su función es cierre/verificación Z; no genera ni envía un CSV de Cierre Z a SharePoint.
- No se ha localizado una llamada runtime a Resend ni un módulo de envío de adjuntos a gestion@marianmadrid.es.
- El README prohíbe incorporar proveedores externos de email, pago, fiscalidad o IA por defecto sin justificación y aprobación expresa.
- El Dossier Técnico y el Dossier de Flujos describen Resend como integrado/adoptado, cuatro crons de exportación y siete flujos PA-01…PA-07. Esta descripción no coincide con el runtime actual.
- Los cuatro jobs previstos son exportaciones diarias de movimientos, semanales de fichajes, mensuales de ventas y mensuales de inventario. PA-06 (gastos) y PA-07 (consolidación trimestral) son procesos de gestión documental adicionales, no crons Wix de exportación.

## 2. Estado de implantación

| Componente | Estado verificado |
|---|---|
| Wix CMS como SSOT | Directriz vigente |
| exportService.js | Ausente |
| Cuatro crons de exportación | Ausentes |
| Jobs de exportación en jobs.config | Ausentes |
| Envío runtime Resend | No localizado |
| Power Automate PA-01…PA-07 | No auditados en tenant; no se presume que existan |
| Biblioteca SharePoint / carpetas | No auditadas en tenant |
| Permisos y retención SharePoint | No auditados |
| Idempotencia de archivos | No implementada/verificada en runtime |
| Minimización de PII en archivos exportados | Diseño documentado; no probado por ausencia de export runtime |
| E2E Wix → correo → Power Automate → SharePoint | No ejecutado |

## 3. Contradicción que bloquea implementación

- Dossier: Resend es el mecanismo adoptado para enviar CSV/JSON a Outlook.
- README/directriz de proyecto: no se introduce proveedor externo de email sin justificación y aprobación.
- Código actual: no se localiza una integración Resend activa.

No se debe implementar Resend por inercia ni afirmar que está integrado. Hace falta una ADR aprobada que compare al menos:
1. Resend + Outlook + Power Automate + SharePoint (patrón descrito en el Dossier).
2. Microsoft Graph / mecanismo Microsoft nativo con su registro de aplicación, permisos y secretos.

La decisión debe considerar licencias, coste, DPA, residencia de datos, secretos, límites, idempotencia, auditoría y operación. No se crea un proveedor ni se habilitan envíos hasta aprobarla.

## 4. Requisitos arquitectónicos no negociables

- Wix CMS es la única fuente de verdad transaccional.
- SharePoint es repositorio de evidencia; no puede escribir ni gobernar Capa 1.
- No exportar PII de clientes si no existe obligación y base jurídica demostrada.
- Los ledgers fiscales/laborales se exportan como evidencia, nunca se corrigen desde SharePoint.
- Cada export debe tener identidad determinista, periodo, versión de esquema, traceId, checksum y resultado trazable.
- Un reintento no debe duplicar el archivo ni sobrescribir evidencia existente; una corrección debe generar un nuevo artefacto/versionado trazable.
- No declarar un flujo operativo hasta verificarlo en el tenant real.

## 5. Próximas tareas y criterio de cierre

1. P1 — ADR del transporte: resolver Resend frente a Microsoft Graph/nativo y aprobar proveedor, permisos y coste.
2. P1 — Acceso M365: verificar tenant, SharePoint site/library, PA-01…PA-07, conexiones, propietarios, cuentas de servicio, DLP y permisos efectivos.
3. P1 — Contrato de export: definir esquemas versionados para cierre Z, movimientos, fichajes, ventas, inventario y gastos; incluir filtros temporales y minimización de PII.
4. P1 — Implementar exportService: lectura paginada desde CMS con permisos backend, sin duplicar lógica de negocio ni mutar datos.
5. P1 — Implementar jobs: añadir cuatro crons tras validar idempotencia, exclusión mutua, reintentos y observabilidad.
6. P1 — Power Automate: configurar PA-01…PA-07 según el Dossier aprobado; confirmar creación de archivo, no sobrescritura y alerta de fallo.
7. P1 — E2E: ejecutar un ciclo de prueba con datos sintéticos y tenant de prueba; comprobar archivo, hash, checksum, permisos y ausencia de PII.
8. P2 — Documentación operativa: runbook de reintento, incidencias, rotación de secretos, retención y recuperación.

## 6. Limitaciones de esta intervención

- No hay acciones conectadas de SharePoint ni Power Automate disponibles en esta sesión.
- No se ha accedido al tenant M365 ni se ha creado ningún flujo, archivo o correo.
- No se han modificado datos CMS ni se han añadido dependencias.
- Esta auditoría acredita el estado del repositorio, no la inexistencia de flujos externos en el tenant.

**Conclusión:** Capa 3 sigue siendo arquitectura objetivo, no una integración cuya operativa pueda darse por completada. La implementación queda bloqueada por la decisión de transporte y la falta de acceso verificable al tenant M365.