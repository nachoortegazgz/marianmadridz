# Base maestra del proyecto — Marian Madrid

**Vigencia:** 2026-11-14 · addendum operativo QA  
**Sitio:** `50b39f33-e753-4331-ab35-b2ed43dc97f7`  
**Naturaleza:** banco de pruebas aislado, sin actividad real, según declaración expresa del propietario.  
**Plataforma confirmada:** Wix Editor Classic + Velo.  
**Repositorio:** https://github.com/nachoortegazgz/marianmadridz

Este documento describe un único sitio objeto de trabajo. No se mantiene una matriz comparativa de entornos. Los registros presentes deben considerarse sintéticos hasta que exista evidencia expresa en contrario.

## Addendum de decisión y estado de QA — 2026-11-14

- **Decisión expresa del propietario:** utilizar el sitio `50b39f33-e753-4331-ab35-b2ed43dc97f7` como entorno QA del proyecto, con datos sintéticos y simulación de pagos. No volver a plantear como alternativa operativa el uso de producción.
- **Producción separada:** `188bed94-177c-4bc9-a9f0-35080d874f3e` (`www.marianmadrid.es`) permanece fuera del alcance de QA.
- **Discrepancia de acceso:** el inventario CMS del sitio QA está documentado en el corte 2026-11-14, pero la conexión Wix disponible en esta sesión no resolvió el Site ID QA y solo listó producción. No declarar acceso runtime ni aislamiento efectivo hasta reconciliar la conexión. No ejecutar pruebas Wix contra producción como alternativa.
- **Continuidad de trabajo:** avanzar con pruebas offline/mock, fixtures sintéticos, auditoría estática, CI y correcciones en ramas/PR. Wix Runtime/E2E queda `BLOCKED_ENVIRONMENT` hasta que el ID QA sea resoluble.
- **Pagos:** usar adaptador mock local sin red, sin PSP, sin Wix Payments y sin banco. `TEST_PAYMENT_CONFIRMED` solo es un resultado interno de simulación.
- **Comunicaciones y gestoría:** sinks offline sin entrega. No emitir facturas/tickets reales ni invocar AEAT/Veri*Factu, SharePoint o Power Automate desde escenarios QA.
- **Datos:** no importar PII. Emails bajo `.example.test`; no utilizar teléfonos operativos. Los datos de gestoría son fixtures internos no válidos para procesos fiscales.
- **Mutaciones:** la autorización/documentación de mutaciones QA no habilita por sí sola los writers fiscales/contables/laborales, pagos, reembolsos o efectos externos, que conservan sus gates independientes.

El plan ejecutable, escenarios y criterios de evidencia están en [PLAN_ACCION_QA.md](PLAN_ACCION_QA.md). Este addendum prevalece sobre frases anteriores de este documento que presenten el aislamiento como verificado o permitan inferir acceso runtime.

## 1. Estado actual verificado

### Git y Wix
- Rama de referencia: `main`, con PR #361–#366 integradas; último merge `13b9ae095214e0c601f255fa75d629680c539933`. PR #367 (`fix/current-site-cms-field-alignment`): CI offline PASS, run #1137 (69 suites, 631 tests), secret scanning PASS #561; integrada en main mediante merge `dfdee00d8ebc535427c95d49cae91b4c557e4209`.
- CI offline, contratos SDK, ESLint y secret scanning de las cuatro intervenciones: PASS (runs #1122, #1124, #1126, #1128; secret scanning #546, #548, #550, #552).
- GitHub es la referencia del código versionado, no prueba del código ejecutado por Wix.
- La correspondencia entre los archivos Velo del Editor Classic y Git no está verificada.
- No existe evidencia de release Wix que vincule runtime con un SHA de Git.
- No se ha autorizado publicación ni conexión a operaciones reales.
- Ninguna de las PR #361–#364 ha desplegado o publicado cambios en Wix.

### CMS
- 23 colecciones: 15 NATIVE y 8 WIX_APP.
- 524 campos físicos en colecciones NATIVE.
- 140 registros en las colecciones propias en el corte leído.
- El inventario completo y los tipos físicos vigentes están en `docs/audits/2026-11-14-current-site-cms-normalization.md`; el diccionario raíz enlaza ese corte y marca los bloques anteriores como históricos.
- `CajaActual`: 39 campos, 1 registro; `sequenceCounters` es OBJECT y está almacenado como objeto. `ticketSequence` no existe. `id` coincide con `_id` en el singleton leído; candidato a retirar tras comprobar consumidores.
- `ControlOperativo`: 42 campos, 0 registros; `ownerToken` no existe. `traceId` es el token de fencing canónico.
- `ComplementosCatalogo`: 18 campos, 36 registros; `addonId = _id` en todos. `traceId` está vacío. `name = description` en todos los registros, pero los tipos TEXT/RICH_TEXT y el uso de presentación son distintos; no borrar sin revisar UI y consumidores.
- `MapaStaff`: 18 campos, 3 registros; maestro exclusivo de identidad staff. El código valida `staffMemberId`, `resourceId`, `scheduleId` y los IDs opcionales `memberId`/`thirdPartyId`; no exige `recordType`, `traceId` ni campos fiscales. `resourceId = _id` en los tres registros, pero no se fusionan: el primero es ID nativo de recurso Bookings y el segundo ID CMS.
- `DatosFiscales`: 28 campos, 1 registro sintético placeholder; maestro fiscal canónico para `recordType`, `taxId`, `legalName`, `thirdPartyType`, `address` y datos de gestoría. `gestorName` y `gestorNombre` coinciden; el código usa solo `gestorName`. `taxId` está informado y `nif` vacío; `name`/`legalName` difieren y `gestorEmail`/`email` tienen funciones distintas. No existe `traceId` ni `schemaVersion`; el código deja de persistirlos.
- `ServiciosCatalogo`: 42 campos, 95 registros (94 SERVICE y 1 PRICING_PLAN). `serviceId` y `pricingPlanId` son IDs nativos distintos de `_id` CMS. No fusionar identidades diferentes.
- `RegistrosHorariosStaff`: 21 campos, 2 filas sintéticas sin firma; no acreditan jornada real.
- `InventarioStockVenta` y `MovimientosInventario` están presentes físicamente en este sitio, pero sus contratos/writers están retirados. Su presencia no autoriza reactivar inventario custom: Stores Catalog V3 sigue siendo la autoridad prevista para stock comercial.

### Mutabilidad y seguridad
- Se han retirado del código los bypasses globales de update/remove y la ventana temporal append-only; no existe un flag que pueda abrirlos desde configuración.
- Los ledgers MovimientosCaja, LibroAsientosContablesDetalle, HistoricoCierresZ, RegistrosHorariosStaff y PaquetesGestoria permanecen append-only también en QA.
- CajaActual es una proyección mutable únicamente a través del flujo backend autorizado y vinculada a movimientos fuente; no se habilita su borrado.
- Bulk update está deshabilitado. Bulk remove solo admite purgas condicionadas por tipo, estado terminal y fecha de expiración/retención en ControlOperativo; WEBHOOK_EVENT y claims durables están excluidos.
- La identidad QA no está acreditada por la conexión Wix actual; no existe todavía una barrera runtime por Site ID. Las colecciones WIX_APP se operan exclusivamente mediante sus APIs oficiales y los efectos externos siguen fail-closed.

## 2. Alcance funcional

La web debe apoyar la operativa del salón:
1. Reservas online y disponibilidad fiable.
2. Servicios por fases con huecos de exposición y solapamiento controlado cuando el modelo Bookings lo permita.
3. Anticipos, cancelaciones, pagos y reembolsos solo tras validar contratos Wix y el flujo fiscal.
4. Catálogo y venta mediante Wix Stores; stock gobernado por Stores Catalog V3.
5. Área de cliente, contenidos y comunicación conforme a capacidades nativas y consentimientos válidos.
6. Asistencia capilar automatizada con límites de seguridad, privacidad y supervisión profesional.
7. Registros fiscales, contables y laborales conformes con normativa aplicable; no afirmar cumplimiento hasta validación técnica y profesional.
8. Exportación documental y eventual archivo de evidencia en SharePoint.

Los requisitos funcionales son declaraciones de alcance, no prueba de implementación o certificación legal.

## 3. Directrices de arquitectura

- Mejorar el sistema existente; no reconstruir ni introducir funciones sin necesidad demostrada.
- Wix CMS es SSOT transaccional. SharePoint es repositorio documental de evidencias. Capa 3 no gobierna ni modifica Capa 1.
- Frontend de presentación; lógica de negocio en backend/WebMethods.
- Constantes en `internalConfig.js`; validaciones compartidas en `validation.js`.
- Permisos y autorización en backend. Secretos nunca en frontend.
- Webhooks y procesos asíncronos idempotentes.
- Contratos oficiales de Wix e integraciones prevalecen sobre ejemplos antiguos.
- No eliminar campos/símbolos sin búsqueda de consumidores, pruebas y revisión del diff.
- Distinguir verificado, declarado, inferido y pendiente.
- CI offline no equivale a runtime Wix ni E2E.
- Cambios mínimos, PR delimitada, CI verde, diff revisado y reversión documentada.
- No publicar/desplegar sin autorización expresa.

## 4. Prioridades

- **P0:** integridad fiscal, seguridad crítica y pérdida de datos.
- **P1:** reservas, pagos, concurrencia, ledgers y jornada laboral.
- **P2:** integraciones, automatizaciones y exportaciones.
- **P3:** rendimiento, mantenibilidad y deuda técnica.
- **P4:** mejoras evolutivas aprobadas.

## 5. Bloqueos abiertos

0. Resolver la discrepancia de acceso del Site ID QA `50b39f33-e753-4331-ab35-b2ed43dc97f7`; no redirigir pruebas a producción `188bed94-177c-4bc9-a9f0-35080d874f3e`. Mantener H4 Wix Runtime/E2E bloqueado y avanzar con mocks offline.


1. Probar en Wix Local Editor y ejecutar E2E; la integración en Git está cerrada, el despliegue Wix no.
2. Probar en Wix Editor los hooks de MapaStaff y DatosFiscales, junto con las lecturas de identidad fiscal y destinatarios de gestoría.
3. Completar búsqueda de consumidores para los candidatos físicos: CajaActual.id, ComplementosCatalogo.addonId, DatosFiscales.gestorNombre y ComplementosCatalogo.traceId.
4. Mantener MapaStaff.resourceId porque no es semánticamente equivalente a _id CMS, aunque los valores actuales coincidan.
5. Obtener exportación reproducible de Velo desde Editor Classic y comparar con Git.
6. Ejecutar E2E en el sitio aislado antes de cualquier autorización de actividad real.

## 6. Fuentes de referencia

- `DICCIONARIO_DATOS_CMS.md`: índice y contexto histórico del esquema.
- `docs/audits/2026-11-14-current-site-cms-normalization.md`: inventario live vigente, tipos y hallazgos de normalización.
- `ESTADO_ACTUAL_PROYECTO.md`: resumen operativo.
- `DOSSIER TÉCNICO CONSOLIDADO.md`: arquitectura y contratos detallados; validar cada sección contra el CMS actual.
- `DOSSIER FLUJOS END TO END CAPA 3.md`: diseño documental; no implica operación certificada.
- `NECESIDADES WEB MARIAN.txt`: requisitos declarados, no estado técnico.
- `DIRECTRICES_DESARROLLO_CODIGO.md`: directrices raíz vigentes.
- `PLAN_ACCION_QA.md`: fases, simuladores, escenarios, gates y registro de ejecución.

## 7. Regla de mantenimiento

Actualizar esta base solo ante evidencia nueva o decisión expresa del propietario. Registrar fecha, fuente y alcance. Mantener los informes históricos como evidencia, sin presentarlos como estado live actual.
